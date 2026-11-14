"""Train the baseline and the main model, choose calibration and the default cut-off (validation only).

Fit on train hours of the 80 seen machines. Settings, calibration and cut-off are chosen on validation hours
of the same machines. Test hours are never built here. Usage: python -m ml.train [--date YYYYMMDD]
"""

from __future__ import annotations

import argparse
import datetime as dt
import itertools
import json
import sys
from importlib.metadata import version as pkg_version
from pathlib import Path
from typing import Any

import numpy as np

from ml import splits
from ml.artifacts import ARTIFACTS_DIR, data_hashes, git_state, model_version, write_manifest
from ml.data import Tables
from ml.dataset import build_frame, xy
from ml.features import FEATURE_COLUMNS, feature_fingerprint
from ml.metrics import alerts_at, best_f1_cutoff, brier, confusion, f1, pr_auc, precision, r6, recall
from ml.models import (
    CALIBRATION_FILES,
    MODEL_FILES,
    Calibrator,
    LogisticBaseline,
    XGBMain,
    fit_sigmoid,
    load_scoring_model,
)

SEED = 20261114

CONFIG: dict[str, Any] = {
    "seed": SEED,
    "baseline": {"model": "logistic_regression", "C": 1.0, "class_weight": None, "impute": "train median"},
    "main": {
        "model": "xgboost",
        "fixed": {"learning_rate": 0.05, "subsample": 0.8, "colsample_bytree": 0.8, "min_child_weight": 5},
        "grid": {"max_depth": [3, 5], "n_estimators": [100, 300]},
        "select_by": "validation PR-AUC (first grid point wins a tie)",
    },
    "calibration": "none or sigmoid (Platt, on validation), lower validation Brier wins; none on a tie",
    "cutoff": "whole percent 1..100 with best hour-level F1 on validation; ties go higher",
    "splits": {
        "train": ["2015-01-02 06:00", "2015-08-30 23:00"],
        "validation": ["2015-09-01 00:00", "2015-10-30 23:00"],
        "test": ["2015-11-01 00:00", "2015-12-30 06:00"],
        "embargo_hours": 24,
    },
}


def _choose_calibration(raw_val: np.ndarray, y_val: np.ndarray) -> tuple[Calibrator, dict[str, Any]]:
    none = Calibrator("none")
    sig = fit_sigmoid(raw_val, y_val)
    b_none = brier(none.apply(raw_val), y_val)
    b_sig = brier(sig.apply(raw_val), y_val)
    chosen = sig if b_sig < b_none else none
    return chosen, {"brier_none": r6(b_none), "brier_sigmoid": r6(b_sig), "chosen": chosen.kind}


def _finish_model(
    name: str,
    vdir: Path,
    raw_val: np.ndarray,
    y_val: np.ndarray,
) -> dict[str, Any]:
    """Calibration and cut-off for one saved model, then re-load it so the saved files are what is used."""
    cal, cal_info = _choose_calibration(raw_val, y_val)
    (vdir / CALIBRATION_FILES[name]).write_text(json.dumps(cal.to_json(), sort_keys=True))
    scores = cal.apply(raw_val)
    cutoff, best = best_f1_cutoff(scores, y_val)
    tp, fp, fn, _ = confusion(y_val, alerts_at(scores, cutoff))
    return {
        "calibration": cal_info,
        "default_cutoff": cutoff,
        "validation_at_cutoff": {
            "f1": r6(best),
            "precision": r6(precision(tp, fp)),
            "recall": r6(recall(tp, fn)),
            "f1_check": r6(f1(tp, fp, fn)),
        },
        "validation_pr_auc": r6(pr_auc(scores, y_val)),
        "validation_brier": r6(brier(scores, y_val)),
    }


def train(
    tables: Tables,
    unseen: list[int],
    out_root: Path,
    hashes: dict[str, str],
    git: dict[str, Any],
    date: str,
    config: dict[str, Any] | None = None,
) -> Path:
    cfg = config or CONFIG
    full_cfg = {**cfg, "features": feature_fingerprint(), "unseen_machines": unseen}
    version = model_version(date, hashes, full_cfg, str(git["commit"]))
    vdir = out_root / version
    if (vdir / "evaluation.json").exists():
        raise FileExistsError(f"{version} already has an evaluation; a new result needs a new version")
    vdir.mkdir(parents=True, exist_ok=True)

    frame = build_frame(tables, unseen, ("train", "validation"))
    tr = frame[frame["split"] == "train"]
    va = frame[frame["split"] == "validation"]
    if tr["machineID"].isin(unseen).any() or va["machineID"].isin(unseen).any():
        raise RuntimeError("unseen machines leaked into training or validation data")
    x_tr, y_tr = xy(tr)
    x_va, y_va = xy(va)

    meta_models: dict[str, Any] = {}

    # Baseline: logistic regression on scaled features.
    b = cfg["baseline"]
    base = LogisticBaseline.fit(x_tr, y_tr, seed=cfg["seed"], c=b["C"], class_weight=b["class_weight"])
    base.save(vdir / MODEL_FILES["baseline"])
    raw_val = LogisticBaseline.load(vdir / MODEL_FILES["baseline"]).predict_raw(x_va)
    meta_models["baseline"] = _finish_model("baseline", vdir, raw_val, y_va)

    # Main model: XGBoost, small grid scored on validation PR-AUC.
    m = cfg["main"]
    keys = list(m["grid"])
    tried: list[dict[str, Any]] = []
    best_model: XGBMain | None = None
    best_auc = -1.0
    best_params: dict[str, Any] = {}
    for combo in itertools.product(*(m["grid"][k] for k in keys)):
        params = dict(zip(keys, combo, strict=True))
        model = XGBMain.fit(x_tr, y_tr, seed=cfg["seed"], params={**m["fixed"], **params})
        auc = pr_auc(model.predict_raw(x_va), y_va) or 0.0
        tried.append({**params, "validation_pr_auc": r6(auc)})
        if auc > best_auc:
            best_model, best_auc, best_params = model, auc, params
    if best_model is None:
        raise RuntimeError("empty XGBoost grid")
    best_model.save(vdir / MODEL_FILES["main"])
    raw_val = XGBMain.load(vdir / MODEL_FILES["main"]).predict_raw(x_va)
    meta_models["main"] = {
        **_finish_model("main", vdir, raw_val, y_va),
        "chosen_params": {**m["fixed"], **best_params},
        "grid_results": tried,
    }
    for name in ("baseline", "main"):  # the saved files must load and reproduce the validation scores
        reloaded = load_scoring_model(vdir, name).predict(x_va)
        meta_models[name]["validation_brier_reloaded"] = r6(brier(reloaded, y_va))

    (vdir / "feature_fingerprint.json").write_text(
        json.dumps({"fingerprint": feature_fingerprint(), "columns": FEATURE_COLUMNS}, indent=1) + "\n"
    )
    meta = {
        "model_version": version,
        "created": date,
        "simulated": True,
        "git": git,
        "data_sha256": hashes,
        "config": full_cfg,
        "libraries": {p: pkg_version(p) for p in ("numpy", "pandas", "scikit-learn", "xgboost", "scipy")},
        "feature_fingerprint": feature_fingerprint(),
        "unseen_machines": unseen,
        "training": {
            "machines": int(tr["machineID"].nunique()),
            "train_machine_hours": len(tr),
            "train_positive_hours": int(y_tr.sum()),
            "validation_machine_hours": len(va),
            "validation_positive_hours": int(y_va.sum()),
        },
        "models": meta_models,
    }
    (vdir / "metadata.json").write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    write_manifest(vdir)
    return vdir


def main() -> int:
    from ml.validate import validate

    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--date", default=dt.datetime.now(dt.UTC).strftime("%Y%m%d"))
    args = p.parse_args()
    tables, problems = validate()
    if tables is None or problems:
        print("data checks failed; run python -m ml.validate", file=sys.stderr)
        return 1
    unseen = splits.load_unseen_machines()
    ids = tables.machines["machineID"].tolist()
    if unseen != splits.choose_unseen_machines(ids):
        print("unseen_machines.json does not match its seed", file=sys.stderr)
        return 1
    vdir = train(tables, unseen, ARTIFACTS_DIR, data_hashes(), git_state(), args.date)
    meta = json.loads((vdir / "metadata.json").read_text())
    print(f"model version {vdir.name}  (git dirty: {meta['git']['dirty']})")
    for name, info in meta["models"].items():
        print(
            f"  {name}: calibration {info['calibration']['chosen']}, default cut-off "
            f"{info['default_cutoff']}%, validation PR-AUC {info['validation_pr_auc']}, "
            f"validation Brier {info['validation_brier']}"
        )
    print(json.dumps(meta["training"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
