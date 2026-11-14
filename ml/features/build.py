"""Past-only features (docs/architecture.md, "Feature rules"; decisions 33 and 35).

As-of rule: scoring hour t happens at the start of the hour. Records stamped at t are NOT available.
Every window ends at t - 1h:
  * telemetry: last reading (t-1h); mean and std (population, ddof=0) over the 3h and 24h windows;
    least-squares slope per hour over the 24h window; for each sensor.
  * errors: count of each error type stamped in [t-24h, t-1h].
  * maintenance: hours since the last replacement of each component, from records stamped strictly
    before t (NaN if the machine has none).
  * machine: model number (1-4) and age.
Failure records are never used.
"""

from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd
from numpy.lib.stride_tricks import sliding_window_view

from ml.data import COMPONENTS, ERROR_TYPES, HOUR, SENSORS, Tables

LONG = 24
SHORT = 3

FEATURE_COLUMNS: list[str] = (
    [f"{s}_last" for s in SENSORS]
    + [f"{s}_{stat}_{w}h" for s in SENSORS for stat in ("mean", "std") for w in (3, 24)]
    + [f"{s}_slope_24h" for s in SENSORS]
    + [f"{e}_count_24h" for e in ERROR_TYPES]
    + [f"hours_since_{c}" for c in COMPONENTS]
    + ["machine_model", "age"]
)


def feature_fingerprint() -> str:
    """Short hash of the ordered feature names, for the model's metadata."""
    return hashlib.sha256("|".join(FEATURE_COLUMNS).encode()).hexdigest()[:12]


def _telemetry_cube(
    telemetry: pd.DataFrame, machine_ids: np.ndarray, start: pd.Timestamp, n_hours: int
) -> np.ndarray:
    """Dense (machine, hour, sensor) array on the hourly grid starting at `start`; NaN where missing."""
    cube = np.full((len(machine_ids), n_hours, len(SENSORS)), np.nan)
    m_pos = np.searchsorted(machine_ids, telemetry["machineID"].to_numpy())
    h_pos = ((telemetry["datetime"] - start) // HOUR).to_numpy()
    cube[m_pos, h_pos, :] = telemetry[list(SENSORS)].to_numpy()
    return cube


def _telemetry_features(cube: np.ndarray, pos: np.ndarray) -> dict[str, np.ndarray]:
    """Features for scored positions `pos` (grid indices of t); returns name -> (machine, hour) arrays."""
    n_m = cube.shape[0]
    out = {name: np.empty((n_m, len(pos))) for name in FEATURE_COLUMNS if name.split("_")[0] in SENSORS}
    x = np.arange(LONG, dtype=float)
    xc = x - x.mean()
    denom = float((xc**2).sum())
    for m in range(n_m):
        for k, s in enumerate(SENSORS):
            series = cube[m, :, k]
            w24 = sliding_window_view(series, LONG)  # window j covers grid hours j .. j+23
            w3 = sliding_window_view(series, SHORT)
            # window ending at t-1h starts at index pos-24 (24h) / pos-3 (3h)
            a24 = w24[pos - LONG]
            a3 = w3[pos - SHORT]
            out[f"{s}_last"][m] = series[pos - 1]
            out[f"{s}_mean_3h"][m] = a3.mean(axis=1)
            out[f"{s}_std_3h"][m] = a3.std(axis=1)
            out[f"{s}_mean_24h"][m] = a24.mean(axis=1)
            out[f"{s}_std_24h"][m] = a24.std(axis=1)
            out[f"{s}_slope_24h"][m] = (a24 - a24.mean(axis=1, keepdims=True)) @ xc / denom
    return out


def _error_features(
    errors: pd.DataFrame, machine_ids: np.ndarray, start: pd.Timestamp, n_hours: int, pos: np.ndarray
) -> dict[str, np.ndarray]:
    out: dict[str, np.ndarray] = {}
    h = ((errors["datetime"] - start) // HOUR).to_numpy()
    in_grid = (h >= 0) & (h < n_hours)
    for etype in ERROR_TYPES:
        sel = in_grid & (errors["errorID"].to_numpy() == etype)
        counts = np.zeros((len(machine_ids), n_hours), dtype=np.int64)
        np.add.at(counts, (np.searchsorted(machine_ids, errors["machineID"].to_numpy()[sel]), h[sel]), 1)
        cs = np.concatenate(
            [np.zeros((len(machine_ids), 1), dtype=np.int64), np.cumsum(counts, axis=1)], axis=1
        )
        # count in hours [pos-24, pos-1] = cs[pos] - cs[pos-24]   (cs[i] = sum of hours < i)
        out[f"{etype}_count_24h"] = (cs[:, pos] - cs[:, pos - LONG]).astype(float)
    return out


def _maint_features(maint: pd.DataFrame, grid: pd.DataFrame) -> dict[str, np.ndarray]:
    """grid: columns machineID, datetime sorted by datetime. Strictly earlier records only."""
    out: dict[str, np.ndarray] = {}
    for comp in COMPONENTS:
        right = maint.loc[maint["comp"] == comp, ["machineID", "datetime"]].copy()
        right["last_replaced"] = right["datetime"]
        right = right.drop_duplicates(["machineID", "datetime"]).sort_values("datetime")
        merged = pd.merge_asof(
            grid, right, on="datetime", by="machineID", direction="backward", allow_exact_matches=False
        )
        out[f"hours_since_{comp}"] = (
            merged["datetime"] - merged["last_replaced"]
        ).dt.total_seconds().to_numpy() / 3600.0
    return out


def build_features(tables: Tables, hours: pd.DatetimeIndex) -> pd.DataFrame:
    """Features for every machine at every hour in `hours` (same hours for all machines).

    Returns a frame with machineID, datetime and FEATURE_COLUMNS, sorted by machine then hour.
    Raises ValueError if an hour has no full 24h of telemetry behind it (warm-up) or lies after the
    hour following the last telemetry row. Failure records are not read.
    """
    tel = tables.telemetry
    start = tel["datetime"].min()
    end = tel["datetime"].max()
    if hours.empty:
        raise ValueError("no hours requested")
    if hours.min() < start + LONG * HOUR:
        raise ValueError(f"hour {hours.min()} is inside the warm-up (first allowed {start + LONG * HOUR})")
    if hours.max() > end + HOUR:
        raise ValueError(f"hour {hours.max()} is after the last telemetry hour + 1h ({end})")
    machine_ids = np.sort(tables.machines["machineID"].to_numpy())
    n_hours = int((end - start) // HOUR) + 1
    pos = ((hours - start) // HOUR).to_numpy()

    cube = _telemetry_cube(tel, machine_ids, start, n_hours)
    cols: dict[str, np.ndarray] = {}
    cols.update(_telemetry_features(cube, pos))
    cols.update(_error_features(tables.errors, machine_ids, start, n_hours, pos))

    n_m, n_h = len(machine_ids), len(hours)
    frame = pd.DataFrame(
        {
            "machineID": np.repeat(machine_ids, n_h),
            "datetime": np.tile(hours.to_numpy(), n_m),
        }
    )
    for name, arr in cols.items():
        frame[name] = arr.reshape(-1)

    by_time = frame[["machineID", "datetime"]].sort_values("datetime", kind="stable")
    maint = _maint_features(tables.maint, by_time)
    for name, arr in maint.items():
        s = pd.Series(arr, index=by_time.index)
        frame[name] = s.reindex(frame.index).to_numpy()

    mach = tables.machines.set_index("machineID")
    frame["machine_model"] = (
        frame["machineID"].map(mach["model"].str.removeprefix("model").astype(int)).astype(int)
    )
    frame["age"] = frame["machineID"].map(mach["age"]).astype(int)
    return frame[["machineID", "datetime", *FEATURE_COLUMNS]]
