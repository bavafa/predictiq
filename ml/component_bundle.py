"""Component scores for the serving bundle (spec step 3; decisions 77 and 79). All data is simulated.

Optional files beside the machine-model bundle (schema 1 files are unchanged; a bundle without them
still loads):
  components.json              component model version, illustrative names, grids, shipped model per part,
                               warning cut-offs, and the test evaluation of step 2 when it exists
  component_wear_scores.npy    float32 (2 horizons: 7 and 14 days, machines, days, 4 parts)
                               chance this part fails within the horizon; scored once a day at 06:00
  component_days_since.npy     float32 (machines, days, 4)  days since the part was replaced or failed
  component_warning_scores.npy float32 (machines, test hours, 4)  chance this part fails within 48 hours
A score at time t only uses records stamped before t. Wear days run daily at 06:00 from the last 06:00 before
the first test hour, so every test hour has a wear score to read.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import pandas as pd

from ml.component_labels import wear_inputs
from ml.component_models import (
    WARNING_EXTRA,
    WARNING_LEVEL,
    WEAR_LEVELS,
    load_raw,
    warning_matrix,
    wear_matrix,
)
from ml.data import COMPONENTS, Tables
from ml.features import build_features
from ml.models import Calibrator

SCHEMA = 1
COMPONENT_FILES = (
    "components.json",
    "component_wear_scores.npy",
    "component_days_since.npy",
    "component_warning_scores.npy",
)
NAMES = {"comp1": "Motor winding", "comp2": "Bearing", "comp3": "Seal / valve", "comp4": "Coupling"}
NAMES_NOTE = (
    "Illustrative names, assumed, not stated by the source (decision 77). The data only has comp1 to comp4."
)
HORIZONS = (7, 14)
F32 = npt.NDArray[np.float32]


def wear_days(hours: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Daily 06:00 scoring times, from the last 06:00 at or before the first test hour to the last hour."""
    first = hours[0].normalize() + pd.Timedelta(hours=6)
    if first > hours[0]:
        first -= pd.Timedelta(days=1)
    return pd.date_range(first, hours[-1], freq="D")


def _scores(vdir: Path, info: dict[str, Any], level: str, comp: str, x: npt.NDArray[np.float64]) -> F32:
    """Scores from the model that ships for this part (the rule, or the chosen wear model), calibrated."""
    shipped = info["shipped"] if level in WEAR_LEVELS else "xgb"
    entry = info["rule"] if shipped == "rule" else info["wear_model"] if level in WEAR_LEVELS else info
    raw = load_raw(vdir, level, comp, shipped).predict_raw(x)
    return Calibrator.from_json(entry["calibrator"]).apply(raw).astype(np.float32)


def build_component_arrays(
    comp_dir: Path, tables: Tables, hours: pd.DatetimeIndex
) -> tuple[dict[str, F32], dict[str, Any]]:
    meta_in = json.loads((comp_dir / "metadata.json").read_text())
    ids = np.sort(tables.machines["machineID"].to_numpy())
    n_m, n_h = len(ids), len(hours)
    days = wear_days(hours)
    n_d = len(days)

    wx = wear_inputs(tables, ids, days)
    wear = np.zeros((len(WEAR_LEVELS), n_m, n_d, len(COMPONENTS)), dtype=np.float32)
    since = np.zeros((n_m, n_d, len(COMPONENTS)), dtype=np.float32)
    for k, comp in enumerate(COMPONENTS):
        sel = wx[wx["comp"] == comp].sort_values(["machineID", "datetime"])
        since[:, :, k] = sel["days_since_replacement"].to_numpy().reshape(n_m, n_d)
        for li, level in enumerate(WEAR_LEVELS):
            s = _scores(comp_dir, meta_in["models"][level][comp], level, comp, wear_matrix(sel))
            wear[li, :, :, k] = s.reshape(n_m, n_d)

    feats = build_features(tables, hours)
    hx = wear_inputs(tables, ids, hours)
    warn = np.zeros((n_m, n_h, len(COMPONENTS)), dtype=np.float32)
    for k, comp in enumerate(COMPONENTS):
        sel = hx[hx["comp"] == comp][["machineID", "datetime", *WARNING_EXTRA]]
        frame = feats.merge(sel, on=["machineID", "datetime"], how="left", validate="one_to_one")
        frame = frame.sort_values(["machineID", "datetime"])
        info = meta_in["models"][WARNING_LEVEL][comp]
        warn[:, :, k] = _scores(comp_dir, info, WARNING_LEVEL, comp, warning_matrix(frame)).reshape(n_m, n_h)

    arrays = {"wear": wear, "since": since, "warning": warn}
    for name, a in arrays.items():
        if not np.isfinite(a).all():
            raise ValueError(f"component {name} array has missing or infinite values")
    for name in ("wear", "warning"):
        if arrays[name].min() < 0 or arrays[name].max() > 1:
            raise ValueError(f"component {name} scores are outside 0..1")
    evaluation_path = comp_dir / "component_evaluation.json"
    meta = {
        "schema": SCHEMA,
        "simulated": True,
        "component_model_version": meta_in["model_version"],
        "names": NAMES,
        "names_note": NAMES_NOTE,
        "components": list(COMPONENTS),
        "horizons_days": list(HORIZONS),
        "wear_first_day": days[0].strftime("%Y-%m-%dT%H:%M:%S"),
        "wear_days": n_d,
        "wear_shipped": {
            lv: {c: meta_in["models"][lv][c]["shipped"] for c in COMPONENTS} for lv in WEAR_LEVELS
        },
        "warning_cutoff_percent": {c: int(meta_in["models"][WARNING_LEVEL][c]["cutoff"]) for c in COMPONENTS},
        "evaluation": json.loads(evaluation_path.read_text()) if evaluation_path.exists() else None,
    }
    return arrays, meta


def synthetic_components(
    rng: np.random.Generator, n_m: int, hours: pd.DatetimeIndex
) -> tuple[dict[str, F32], dict[str, Any]]:
    """Fake component scores of the real shapes, for tests."""
    n_h, n_d, n_c = len(hours), len(wear_days(hours)), len(COMPONENTS)
    arrays = {
        "wear": rng.beta(0.5, 8.0, (len(WEAR_LEVELS), n_m, n_d, n_c)).astype(np.float32),
        "since": rng.uniform(0, 300, (n_m, n_d, n_c)).astype(np.float32),
        "warning": rng.beta(0.2, 12.0, (n_m, n_h, n_c)).astype(np.float32),
    }
    meta = {
        "schema": SCHEMA,
        "simulated": True,
        "synthetic": True,
        "component_model_version": "comp-synthetic-00000000",
        "names": NAMES,
        "names_note": NAMES_NOTE,
        "components": list(COMPONENTS),
        "horizons_days": list(HORIZONS),
        "wear_first_day": wear_days(hours)[0].strftime("%Y-%m-%dT%H:%M:%S"),
        "wear_days": n_d,
        "wear_shipped": {lv: dict.fromkeys(COMPONENTS, "synthetic") for lv in WEAR_LEVELS},
        "warning_cutoff_percent": dict.fromkeys(COMPONENTS, 30),
        "evaluation": None,
    }
    return arrays, meta


def write_components(out: Path, arrays: dict[str, F32], meta: dict[str, Any]) -> None:
    (out / "components.json").write_text(json.dumps(meta, sort_keys=True, separators=(",", ":")) + "\n")
    np.save(out / "component_wear_scores.npy", arrays["wear"].astype(np.float32))
    np.save(out / "component_days_since.npy", arrays["since"].astype(np.float32))
    np.save(out / "component_warning_scores.npy", arrays["warning"].astype(np.float32))
