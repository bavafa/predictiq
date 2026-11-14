"""Serving bundle: writer, real builder, synthetic generator and zip packing.

The reader is `backend/app/bundle.py` (numpy only); its docstring is the format description. A test loads
what this module writes through that reader, so the two cannot drift apart.

Explanations: XGBoost's own `pred_contribs` (TreeSHAP, in log-odds of the raw model). No `shap` package is
needed, so nothing is added to the `ml` group. The model's calibration for `main` is "none", so the
contributions plus the base value add up to the logit of the stored score; the build checks this.
"""

from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import pandas as pd
import xgboost as xgb

from ml.artifacts import sha256_file
from ml.data import COMPONENTS, ERROR_TYPES, SENSORS, Tables
from ml.dataset import build_frame
from ml.features import FEATURE_COLUMNS
from ml.labels import events_from_failures
from ml.models import MODEL_NAMES, XGBMain, load_scoring_model

SCHEMA = 1
TOP_K = 8
LOOKBACK_HOURS = 7 * 24
HOUR = pd.Timedelta(hours=1)
ISO = "%Y-%m-%dT%H:%M:%S"
BUNDLE_DIR = "bundle"
ZIP_NAME = "bundle.zip"
SHA_NAME = "bundle.sha256"
JSON_FILES = ("meta.json", "evaluation.json", "threshold_analysis.json", "records.json")
NPY_FILES = (
    "scores_main.npy",
    "scores_baseline.npy",
    "contrib_codes.npy",
    "contrib_values.npy",
    "contrib_other.npy",
    "telemetry.npy",
)
BUNDLE_FILES = (*JSON_FILES, *NPY_FILES)

# Approved credit line, docs/DATA_PROVENANCE.md (a test checks that it is still there).
DATA_CREDIT = (
    "Data: Microsoft Predictive Maintenance Modelling Guide sample dataset (simulated), from "
    "github.com/microsoft/sqlworkshops (pinned commit e836f4e). Microsoft states content in that repository "
    "is licensed under CC BY 4.0; the repository's license file is MIT."
)

F32 = npt.NDArray[np.float32]


def _dump(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, sort_keys=True, separators=(",", ":")) + "\n")


def write_bundle(
    out: Path,
    *,
    meta: dict[str, Any],
    evaluation: dict[str, Any],
    threshold: dict[str, Any],
    records: dict[str, Any],
    scores: dict[str, F32],
    codes: npt.NDArray[np.uint8],
    values: F32,
    other: F32,
    telemetry: F32,
) -> None:
    out.mkdir(parents=True, exist_ok=True)
    _dump(out / "meta.json", meta)
    _dump(out / "evaluation.json", evaluation)
    _dump(out / "threshold_analysis.json", threshold)
    _dump(out / "records.json", records)
    for name in MODEL_NAMES:
        np.save(out / f"scores_{name}.npy", scores[name].astype(np.float32))
    np.save(out / "contrib_codes.npy", codes.astype(np.uint8))
    np.save(out / "contrib_values.npy", values.astype(np.float32))
    np.save(out / "contrib_other.npy", other.astype(np.float32))
    np.save(out / "telemetry.npy", telemetry.astype(np.float32))


def split_evaluation(evaluation: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """(metrics without the threshold tables, the threshold tables). Both are served as they were saved."""
    metrics = json.loads(json.dumps(evaluation))
    threshold: dict[str, Any] = {
        "schema": 1,
        "model_version": evaluation["model_version"],
        "alert_rule": evaluation["alert_rule"],
        "simulated": True,
        "models": {},
    }
    for name, model in metrics["models"].items():
        threshold["models"][name] = {g: v.pop("threshold_analysis") for g, v in model["groups"].items()}
    return metrics, threshold


def _grid_hours(test: dict[str, str]) -> pd.DatetimeIndex:
    return pd.date_range(test["start"], test["end"], freq="h")


def _telemetry_array(tables: Tables, tel_hours: pd.DatetimeIndex) -> F32:
    ids = np.sort(tables.machines["machineID"].to_numpy())
    if not np.array_equal(ids, np.arange(1, len(ids) + 1)):
        raise ValueError("machine IDs are not 1..N")
    tel = tables.telemetry
    tel = tel[(tel["datetime"] >= tel_hours[0]) & (tel["datetime"] <= tel_hours[-1])]
    cube = np.full((len(ids), len(tel_hours), len(SENSORS)), np.nan, dtype=np.float32)
    m = tel["machineID"].to_numpy() - 1
    h = ((tel["datetime"] - tel_hours[0]) // HOUR).to_numpy()
    cube[m, h, :] = tel[list(SENSORS)].to_numpy(dtype=np.float32)
    return cube


def _records(tables: Tables, tel_hours: pd.DatetimeIndex) -> dict[str, Any]:
    start, end = tel_hours[0], tel_hours[-1]

    def rows(df: pd.DataFrame, col: str) -> list[list[Any]]:
        sel = df[(df["datetime"] >= start) & (df["datetime"] <= end)].sort_values(
            ["machineID", "datetime", col], kind="stable"
        )
        h = ((sel["datetime"] - start) // HOUR).to_numpy()
        return [[int(m), int(x), str(v)] for m, x, v in zip(sel["machineID"], h, sel[col], strict=True)]

    ev = events_from_failures(tables.failures)
    ev = ev[(ev["datetime"] >= start) & (ev["datetime"] <= end)]
    comps = tables.failures.groupby(["machineID", "datetime"])["failure"].apply(lambda s: sorted(set(s)))
    failures = [
        [int(m), int((t - start) // HOUR), list(comps[(m, t)])]
        for m, t in zip(ev["machineID"], ev["datetime"], strict=True)
    ]
    return {
        "errors": rows(tables.errors, "errorID"),
        "repairs": rows(tables.maint, "comp"),
        "failures": failures,
    }


def contributions(version_dir: Path, x: npt.NDArray[np.float64]) -> tuple[Any, Any, Any, float]:
    """Top-8 pushes (by size) per row, their feature codes, the sum of the rest, and the base value."""
    booster = XGBMain.load(version_dir / "main_xgboost.ubj").booster.get_booster()
    contrib = booster.predict(xgb.DMatrix(x), pred_contribs=True).astype(np.float64)
    pushes, bias = contrib[:, :-1], contrib[:, -1]
    order = np.argsort(-np.abs(pushes), axis=1, kind="stable")[:, :TOP_K]
    top = np.take_along_axis(pushes, order, axis=1)
    rest = pushes.sum(axis=1) - top.sum(axis=1)
    if not np.allclose(bias, bias[0]):
        raise ValueError("base value is not constant")
    return order.astype(np.uint8), top, rest, float(bias[0])


def build_real(version_dir: Path, tables: Tables, out: Path) -> dict[str, Any]:
    """Build the bundle folder for one model version from its saved models and freshly built features."""
    meta_in = json.loads((version_dir / "metadata.json").read_text())
    evaluation = json.loads((version_dir / "evaluation.json").read_text())
    unseen: list[int] = [int(m) for m in meta_in["unseen_machines"]]
    cfg = meta_in["config"]
    hours = _grid_hours({"start": cfg["splits"]["test"][0], "end": cfg["splits"]["test"][1]})

    frame = build_frame(tables, unseen, ("test",)).sort_values(["machineID", "datetime"], kind="stable")
    ids = np.sort(frame["machineID"].unique())
    shape = (len(ids), len(hours))
    if (
        len(frame) != shape[0] * shape[1]
        or not (frame["datetime"].iloc[: shape[1]].to_numpy() == hours.to_numpy()).all()
    ):
        raise ValueError("test frame does not match the replay grid")
    x = frame[FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    scores = {
        n: load_scoring_model(version_dir, n).predict(x).reshape(shape).astype(np.float32)
        for n in MODEL_NAMES
    }
    codes, top, rest, base = contributions(version_dir, x)
    if meta_in["models"]["main"]["calibration"]["chosen"] == "none":
        margin = base + top.sum(axis=1) + rest
        err = float(np.abs(1 / (1 + np.exp(-margin)) - scores["main"].reshape(-1)).max())
        if err > 1e-4:
            raise ValueError(f"explanations do not add up to the score (max gap {err:.2e})")

    tel_hours = pd.date_range(hours[0] - LOOKBACK_HOURS * HOUR, hours[-1] - HOUR, freq="h")
    mach = tables.machines.sort_values("machineID")
    metrics, threshold = split_evaluation(evaluation)
    meta: dict[str, Any] = {
        "schema": SCHEMA,
        "synthetic": False,
        "simulated": True,
        "model_version": meta_in["model_version"],
        "created": meta_in["created"],
        "git_commit": meta_in["git"]["commit"],
        "grid": {
            "machines": int(shape[0]),
            "hours": int(shape[1]),
            "test_start": hours[0].strftime(ISO),
            "test_end": hours[-1].strftime(ISO),
            "telemetry_start": tel_hours[0].strftime(ISO),
            "telemetry_hours": len(tel_hours),
        },
        "replay": {
            "start": pd.Timestamp(meta_in["replay"]["start"]).strftime(ISO),
            "end": pd.Timestamp(meta_in["replay"]["end"]).strftime(ISO),
            "branch": meta_in["replay"]["branch"],
        },
        "models": {
            n: {
                "default_cutoff_percent": int(meta_in["models"][n]["default_cutoff"]),
                "calibration": meta_in["models"][n]["calibration"]["chosen"],
            }
            for n in MODEL_NAMES
        },
        "splits": {
            "train": cfg["splits"]["train"],
            "validation": cfg["splits"]["validation"],
            "test": cfg["splits"]["test"],
            "embargo_hours": cfg["splits"]["embargo_hours"],
        },
        "unseen_machines": unseen,
        "machines": [
            {"machine_id": int(m), "model": str(mo), "age": int(a)}
            for m, mo, a in zip(mach["machineID"], mach["model"], mach["age"], strict=True)
        ],
        "features": FEATURE_COLUMNS,
        "sensors": list(SENSORS),
        "error_types": list(ERROR_TYPES),
        "components": list(COMPONENTS),
        "contribution": {
            "top_k": TOP_K,
            "unit": "log-odds",
            "method": "XGBoost pred_contribs (TreeSHAP)",
            "base_value": base,
        },
        "data_credit": DATA_CREDIT,
    }
    write_bundle(
        out,
        meta=meta,
        evaluation=metrics,
        threshold=threshold,
        records=_records(tables, tel_hours),
        scores=scores,
        codes=codes.reshape(*shape, TOP_K),
        values=top.reshape(*shape, TOP_K).astype(np.float32),
        other=rest.reshape(shape).astype(np.float32),
        telemetry=_telemetry_array(tables, tel_hours),
    )
    return meta


def synthetic_bundle(
    out: Path, seed: int = 0, n_machines: int = 100, n_hours: int = 1423, replay_start_offset: int = 0
) -> dict[str, Any]:
    """A fake bundle of the real shapes for tests. `synthetic: true` in meta.json; the prebuild refuses it.
    `replay_start_offset` moves where playback begins (hours after the first test hour), so the replay
    window can start earlier than the replay start, as the rule in decision 30 allows."""
    rng = np.random.default_rng(seed)
    hours = pd.date_range("2015-11-01 00:00", periods=n_hours, freq="h")
    tel_hours = pd.date_range(hours[0] - LOOKBACK_HOURS * HOUR, hours[-1] - HOUR, freq="h")
    shape = (n_machines, n_hours)
    scores = {n: rng.beta(0.3, 6.0, shape).astype(np.float32) for n in MODEL_NAMES}
    positives = 2590
    n_machine_hours = n_machines * n_hours

    def cutoff_table(quality: float) -> list[dict[str, Any]]:
        """Fake cut-off rows with every field of the real table (counts add up; no alerts: null precision)."""
        rows: list[dict[str, Any]] = []
        for c in range(101):
            fn = positives if c == 100 else min(positives - 1, round(positives * (c / 100) ** 2 * quality))
            tp = positives - fn
            fp = 0 if c == 100 else round((1 - c / 100) ** 2 * 3000 * (2 - quality))
            alerts = 0 if tp + fp == 0 else max(1, round((tp + fp) / 20))
            caught = round(107 * (1 - (c / 100) ** 3 * quality))
            false_alerts = alerts // 12
            rows.append(
                {
                    "alerts": alerts,
                    "cutoff": c,
                    "events_caught": caught,
                    "events_full_lookback": 107,
                    "false_alerts": false_alerts,
                    "false_alerts_per_100_machine_days": round(
                        false_alerts / (n_machines * n_hours / 24 / 100), 6
                    ),
                    "fn": fn,
                    "fp": fp,
                    "precision": None if tp + fp == 0 else round(tp / (tp + fp), 6),
                    "recall": round(tp / positives, 6),
                    "share_events_caught": round(caught / 107, 6),
                    "tn": n_machine_hours - positives - fp,
                    "tp": tp,
                }
            )
        return rows

    def calibration_curve(scale: float) -> list[dict[str, Any]]:
        return [
            {
                "bin": i + 1,
                "mean_score": round((i + 1) ** 2 / 10000 * scale, 6),
                "n": n_machine_hours // 10,
                "observed_rate": round((i + 1) ** 2 / 9000 * scale, 6),
                "positives": positives * (i + 1) // 55,
            }
            for i in range(10)
        ]

    def group(n_m: int, pr_auc: float, brier: float, scale: float) -> dict[str, Any]:
        return {
            "n_machines": n_m,
            "n_machine_hours": n_m * n_hours,
            "n_positive_hours": positives * n_m // n_machines,
            "pr_auc": pr_auc,
            "brier": brier,
            "calibration_curve": calibration_curve(scale),
        }

    qualities = {"main": (0.4, 0.95, 0.0012, 1.0), "baseline": (1.0, 0.8, 0.006, 3.0)}
    evaluation = {
        "schema": 1,
        "model_version": "piq-synthetic-00000000",
        "alert_rule": "synthetic",
        "simulated": True,
        "test_window": {
            "start": "2015-11-01 00:00",
            "end": hours[-1].strftime("%Y-%m-%d %H:%M"),
            "hours": n_hours,
        },
        "models": {
            n: {
                "default_cutoff_percent": 51,
                "groups": {
                    "all": group(n_machines, qualities[n][1], qualities[n][2], qualities[n][3]),
                    "seen": group(n_machines * 4 // 5, qualities[n][1], qualities[n][2], qualities[n][3]),
                    "unseen": group(n_machines // 5, qualities[n][1], qualities[n][2], qualities[n][3]),
                },
            }
            for n in MODEL_NAMES
        },
    }
    evaluation_for_split = json.loads(json.dumps(evaluation))
    for n in MODEL_NAMES:
        for g in ("all", "seen", "unseen"):
            evaluation_for_split["models"][n]["groups"][g]["threshold_analysis"] = cutoff_table(
                qualities[n][0]
            )
    metrics, threshold = split_evaluation(evaluation_for_split)
    unseen = sorted(
        int(m) for m in rng.choice(np.arange(1, n_machines + 1), size=n_machines // 5, replace=False)
    )
    err_rows = [
        [int(m), int(h), f"error{1 + (int(h) + int(m)) % 5}"]
        for m, h in zip(
            rng.integers(1, n_machines + 1, 600), rng.integers(0, len(tel_hours), 600), strict=True
        )
    ]
    meta: dict[str, Any] = {
        "schema": SCHEMA,
        "synthetic": True,
        "simulated": True,
        "model_version": "piq-synthetic-00000000",
        "created": "00000000",
        "grid": {
            "machines": n_machines,
            "hours": n_hours,
            "test_start": hours[0].strftime(ISO),
            "test_end": hours[-1].strftime(ISO),
            "telemetry_start": tel_hours[0].strftime(ISO),
            "telemetry_hours": len(tel_hours),
        },
        "replay": {
            "start": hours[replay_start_offset].strftime(ISO),
            "end": hours[-1].strftime(ISO),
            "branch": "synthetic",
        },
        "models": {n: {"default_cutoff_percent": 51, "calibration": "none"} for n in MODEL_NAMES},
        "splits": {
            "train": ["2015-01-02 06:00", "2015-08-30 23:00"],
            "validation": ["2015-09-01 00:00", "2015-10-30 23:00"],
            "test": [hours[0].strftime("%Y-%m-%d %H:%M"), hours[-1].strftime("%Y-%m-%d %H:%M")],
            "embargo_hours": 24,
        },
        "unseen_machines": unseen,
        "machines": [
            {"machine_id": m, "model": f"model{1 + m % 4}", "age": m % 20} for m in range(1, n_machines + 1)
        ],
        "features": FEATURE_COLUMNS,
        "sensors": list(SENSORS),
        "error_types": list(ERROR_TYPES),
        "components": list(COMPONENTS),
        "contribution": {"top_k": TOP_K, "unit": "log-odds", "method": "synthetic", "base_value": -6.0},
        "data_credit": DATA_CREDIT,
    }
    records = {
        "errors": sorted(err_rows),
        "repairs": [
            [int(m), int(h), "comp1"] for m, h in zip(range(1, 50), range(10, 500, 10), strict=False)
        ],
        "failures": [
            [int(m), int(h), ["comp2"]] for m, h in zip(range(1, 30), range(200, 1500, 45), strict=False)
        ],
    }
    write_bundle(
        out,
        meta=meta,
        evaluation=metrics,
        threshold=threshold,
        records=records,
        scores=scores,
        codes=rng.integers(0, len(FEATURE_COLUMNS), (*shape, TOP_K)).astype(np.uint8),
        values=rng.normal(0, 1, (*shape, TOP_K)).astype(np.float32),
        other=rng.normal(0, 0.1, shape).astype(np.float32),
        telemetry=rng.normal(100, 10, (n_machines, len(tel_hours), len(SENSORS))).astype(np.float32),
    )
    return meta


def uncompressed_bytes(folder: Path) -> int:
    return sum((folder / n).stat().st_size for n in BUNDLE_FILES)


def pack(folder: Path, zip_path: Path) -> dict[str, Any]:
    """Zip the bundle files (fixed order and timestamps, so the same bundle gives the same zip)."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in sorted(BUNDLE_FILES):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, (folder / name).read_bytes(), compresslevel=9)
    return {
        "file": ZIP_NAME,
        "sha256": sha256_file(zip_path),
        "zip_bytes": zip_path.stat().st_size,
        "uncompressed_bytes": uncompressed_bytes(folder),
    }


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
