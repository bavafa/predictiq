"""Component wear view and 48-hour warning: models and their choice on validation (spec step 2; decision 77).

All data is simulated. Fit on train rows of the 80 seen machines; every choice (model, calibration, cut-off)
is made on validation rows. Test rows are never built here (see ml/component_evaluate.py).

Wear view (7 and 14 days), per component, three candidates on the wear inputs only (no telemetry):
  rule      chance by machine model and days since replacement, from train (the plain rule to beat);
  logistic  logistic regression;  xgb  small gradient-boosted trees (shallow, heavy leaf-size limit).
The better of logistic and xgb (validation PR-AUC) is "the wear model". It is shipped only if it beats the
rule on validation (higher PR-AUC and Brier no worse after calibration); otherwise the rule is shipped.
Warning (48 hours), per component: XGBoost on the 35 existing features plus this part's own wear inputs.
Run: python -m ml.component_models [--date YYYYMMDD]
"""

from __future__ import annotations

import argparse
import datetime as dt
import itertools
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import pandas as pd

from ml import splits
from ml.artifacts import ARTIFACTS_DIR, data_hashes, git_state, model_version, write_manifest
from ml.component_labels import LEVELS, build_component_frame
from ml.data import COMPONENTS, Tables
from ml.dataset import build_frame
from ml.features import FEATURE_COLUMNS, feature_fingerprint
from ml.metrics import best_f1_cutoff, brier, pr_auc, r6
from ml.models import Calibrator, LogisticBaseline, XGBMain
from ml.train import _choose_calibration

FloatArr = npt.NDArray[np.float64]
SEED = 20261114
EDGES = (30.0, 60.0, 120.0, 240.0)  # days since replacement: <30, 30-60, 60-120, 120-240, 240+
WEAR_LEVELS = ("day7", "day14")
WARNING_LEVEL = "hour48"
WEAR_FEATURES = ["days_since_replacement", "replaced_30d_or_less", "age", "past_failures"] + [
    f"model{k}" for k in range(1, 5)
]
WARNING_EXTRA = ["days_since_replacement", "past_failures"]
CONFIG: dict[str, Any] = {
    "seed": SEED,
    "wear": {
        "logistic": {"C": 1.0},
        "xgb": {
            "max_depth": 2,
            "n_estimators": 100,
            "learning_rate": 0.05,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
            "min_child_weight": 50,
        },
        "edges_days": list(EDGES),
        "ships_wear_model_if": "validation PR-AUC above the rule and Brier no worse after calibration",
    },
    "warning": {
        "fixed": {"learning_rate": 0.05, "subsample": 0.8, "colsample_bytree": 0.8, "min_child_weight": 5},
        "grid": {"max_depth": [3, 5], "n_estimators": [100, 300]},
        "select_by": "validation PR-AUC (first grid point wins a tie)",
    },
    "calibration": "none or sigmoid (Platt, on validation), lower validation Brier wins; none on a tie",
    "cutoff": "whole percent 1..100 with best row-level F1 on validation; ties go higher",
    "levels": {k: str(v[1]) for k, v in LEVELS.items()},
}


def wear_matrix(df: pd.DataFrame) -> FloatArr:
    d = df["days_since_replacement"].to_numpy(dtype=float)
    model = df["machine_model"].to_numpy()
    cols = [d, (d <= EDGES[0]).astype(float), df["age"].to_numpy(float), df["past_failures"].to_numpy(float)]
    cols += [(model == k).astype(float) for k in range(1, 5)]
    return np.column_stack(cols)


class RuleBaseline:
    """Chance of failure by machine model (1-4) and days-since-replacement bucket, taken from train rows.
    An empty cell falls back to the bucket's rate, then to the overall rate."""

    def __init__(self, rates: FloatArr) -> None:
        self.rates = rates  # (4 models, len(EDGES) + 1 buckets)

    @staticmethod
    def _cells(x: FloatArr) -> tuple[npt.NDArray[np.int64], npt.NDArray[np.int64]]:
        bucket = np.searchsorted(np.asarray(EDGES), x[:, 0], side="right")
        return np.argmax(x[:, 4:8], axis=1), bucket

    @classmethod
    def fit(cls, x: FloatArr, y: npt.NDArray[Any]) -> RuleBaseline:
        model, bucket = cls._cells(x)
        yy = y.astype(float)
        rates = np.full((4, len(EDGES) + 1), np.nan)
        for b in range(len(EDGES) + 1):
            in_b = bucket == b
            fallback = yy[in_b].mean() if in_b.any() else yy.mean()
            for m in range(4):
                cell = in_b & (model == m)
                rates[m, b] = yy[cell].mean() if cell.any() else fallback
        return cls(rates)

    def predict_raw(self, x: FloatArr) -> FloatArr:
        model, bucket = self._cells(x)
        return np.asarray(self.rates[model, bucket], dtype=np.float64)

    def save(self, path: Path) -> None:
        path.write_text(json.dumps({"kind": "rule", "edges_days": list(EDGES), "rates": self.rates.tolist()}))

    @classmethod
    def load(cls, path: Path) -> RuleBaseline:
        return cls(np.asarray(json.loads(path.read_text())["rates"], dtype=np.float64))


def file_for(level: str, comp: str, kind: str) -> str:
    return f"{level}_{comp}_{kind}." + ("ubj" if kind == "xgb" else "json")


def load_raw(vdir: Path, level: str, comp: str, kind: str) -> RuleBaseline | LogisticBaseline | XGBMain:
    path = vdir / file_for(level, comp, kind)
    if kind == "rule":
        return RuleBaseline.load(path)
    return LogisticBaseline.load(path) if kind == "logistic" else XGBMain.load(path)


def _info(scores: FloatArr, y: npt.NDArray[Any]) -> dict[str, Any]:
    return {"pr_auc": r6(pr_auc(scores, y)), "brier": r6(brier(scores, y))}


def _finish(
    raw_val: FloatArr, y_val: npt.NDArray[Any], calibrate: bool = True
) -> tuple[Calibrator, dict[str, Any]]:
    if calibrate:
        cal, cal_info = _choose_calibration(raw_val, y_val)
    else:
        cal, cal_info = Calibrator("none"), {"chosen": "none"}
    scores = cal.apply(raw_val)
    cutoff, best = best_f1_cutoff(scores, y_val)
    return cal, {"calibration": cal_info, "cutoff": cutoff, "validation_f1": r6(best), **_info(scores, y_val)}


def fit_wear(
    vdir: Path, level: str, comp: str, tr: pd.DataFrame, va: pd.DataFrame, cfg: dict[str, Any]
) -> dict[str, Any]:
    x_tr, y_tr = wear_matrix(tr), tr["label"].to_numpy()
    x_va, y_va = wear_matrix(va), va["label"].to_numpy()
    w = cfg["wear"]
    RuleBaseline.fit(x_tr, y_tr).save(vdir / file_for(level, comp, "rule"))
    LogisticBaseline.fit(x_tr, y_tr, seed=cfg["seed"], c=w["logistic"]["C"], class_weight=None).save(
        vdir / file_for(level, comp, "logistic")
    )
    XGBMain.fit(x_tr, y_tr, seed=cfg["seed"], params=w["xgb"]).save(vdir / file_for(level, comp, "xgb"))
    raw = {k: load_raw(vdir, level, comp, k).predict_raw(x_va) for k in ("rule", "logistic", "xgb")}
    cands = {k: _finish(raw[k], y_va, calibrate=k != "rule") for k in raw}
    wear_kind = max(("logistic", "xgb"), key=lambda k: pr_auc(raw[k], y_va) or 0.0)
    rule_info, wear_info = cands["rule"][1], cands[wear_kind][1]
    beats = (wear_info["pr_auc"] or 0.0) > (rule_info["pr_auc"] or 0.0) and wear_info["brier"] <= rule_info[
        "brier"
    ]
    return {
        "validation_rows": len(va),
        "validation_positives": int(y_va.sum()),
        "rule": {**rule_info, "calibrator": cands["rule"][0].to_json()},
        "wear_model": {"kind": wear_kind, **wear_info, "calibrator": cands[wear_kind][0].to_json()},
        "other_candidate": {k: cands[k][1] for k in ("logistic", "xgb") if k != wear_kind},
        "wear_model_beats_rule": bool(beats),
        "shipped": wear_kind if beats else "rule",
    }


def warning_inputs(
    tables: Tables, unseen: list[int], split_names: tuple[str, ...]
) -> dict[str, pd.DataFrame]:
    """Per component: component-hour rows with FEATURE_COLUMNS and this part's own wear inputs."""
    comp_rows = build_component_frame(tables, unseen, WARNING_LEVEL, True, split_names)
    feats = build_frame(tables, unseen, split_names).drop(
        columns=["label", "split", "unseen", "machine_model", "age"]
    )
    out = {}
    for c in COMPONENTS:
        sub = comp_rows[comp_rows["comp"] == c]
        out[c] = sub.merge(feats, on=["machineID", "datetime"], how="inner", validate="many_to_one")
        if len(out[c]) != len(sub):
            raise ValueError("some component-hours have no features")
    return out


def warning_matrix(df: pd.DataFrame) -> FloatArr:
    return df[FEATURE_COLUMNS + WARNING_EXTRA].to_numpy(dtype=np.float64)


def fit_warning(
    vdir: Path, comp: str, tr: pd.DataFrame, va: pd.DataFrame, cfg: dict[str, Any]
) -> dict[str, Any]:
    x_tr, y_tr = warning_matrix(tr), tr["label"].to_numpy()
    x_va, y_va = warning_matrix(va), va["label"].to_numpy()
    w = cfg["warning"]
    keys = list(w["grid"])
    tried: list[dict[str, Any]] = []
    best: XGBMain | None = None
    best_auc, best_params = -1.0, {}
    for combo in itertools.product(*(w["grid"][k] for k in keys)):
        params = dict(zip(keys, combo, strict=True))
        model = XGBMain.fit(x_tr, y_tr, seed=cfg["seed"], params={**w["fixed"], **params})
        auc = pr_auc(model.predict_raw(x_va), y_va) or 0.0
        tried.append({**params, "validation_pr_auc": r6(auc)})
        if auc > best_auc:
            best, best_auc, best_params = model, auc, params
    if best is None:
        raise RuntimeError("empty grid")
    best.save(vdir / file_for(WARNING_LEVEL, comp, "xgb"))
    raw_val = XGBMain.load(vdir / file_for(WARNING_LEVEL, comp, "xgb")).predict_raw(x_va)
    cal, info = _finish(raw_val, y_va)
    return {
        "validation_rows": len(va),
        "validation_positives": int(y_va.sum()),
        "chosen_params": {**w["fixed"], **best_params},
        "grid_results": tried,
        "calibrator": cal.to_json(),
        **info,
    }


def train_components(
    tables: Tables,
    unseen: list[int],
    out_root: Path,
    hashes: dict[str, str],
    git: dict[str, Any],
    date: str,
    cfg: dict[str, Any] | None = None,
) -> Path:
    cfg = cfg or CONFIG
    full = {**cfg, "features": feature_fingerprint(), "unseen_machines": unseen}
    version = model_version(date, hashes, full, str(git["commit"])).replace("piq-", "comp-", 1)
    vdir = out_root / version
    if (vdir / "component_evaluation.json").exists():
        raise FileExistsError(f"{version} already has an evaluation; a new result needs a new version")
    vdir.mkdir(parents=True, exist_ok=True)
    fit_splits = ("train", "validation")
    models: dict[str, Any] = {}
    for level in WEAR_LEVELS:
        frame = build_component_frame(tables, unseen, level, True, fit_splits)
        if frame["unseen"].any():
            raise RuntimeError("unseen machines leaked into training or validation data")
        models[level] = {
            c: fit_wear(
                vdir,
                level,
                c,
                frame[(frame["comp"] == c) & (frame["split"] == "train")],
                frame[(frame["comp"] == c) & (frame["split"] == "validation")],
                cfg,
            )
            for c in COMPONENTS
        }
    wf = warning_inputs(tables, unseen, fit_splits)
    models[WARNING_LEVEL] = {
        c: fit_warning(vdir, c, g[g["split"] == "train"], g[g["split"] == "validation"], cfg)
        for c, g in wf.items()
    }
    meta = {
        "model_version": vdir.name,
        "created": date,
        "simulated": True,
        "component_names": "illustrative, assumed, not stated by the source (decision 77)",
        "git": git,
        "data_sha256": hashes,
        "config": full,
        "feature_fingerprint": feature_fingerprint(),
        "unseen_machines": unseen,
        "models": models,
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
    vdir = train_components(tables, unseen, ARTIFACTS_DIR, data_hashes(), git_state(), args.date)
    meta = json.loads((vdir / "metadata.json").read_text())
    print(
        f"component model version {vdir.name} (git dirty: {meta['git']['dirty']}); "
        "validation only, simulated data"
    )
    for level in WEAR_LEVELS:
        for c, m in meta["models"][level].items():
            print(
                f"  {level} {c}: rule PR-AUC {m['rule']['pr_auc']} Brier {m['rule']['brier']} | "
                f"{m['wear_model']['kind']} PR-AUC {m['wear_model']['pr_auc']} "
                f"Brier {m['wear_model']['brier']} "
                f"-> shipped {m['shipped']}"
            )
    for c, m in meta["models"][WARNING_LEVEL].items():
        print(f"  {WARNING_LEVEL} {c}: PR-AUC {m['pr_auc']} Brier {m['brier']} cut-off {m['cutoff']}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
