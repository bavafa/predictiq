"""Data checks. Fails loudly (exit 1, every problem listed) on IDs, hourly steps, duplicates, blanks,
value ranges, joins and the recorded counts. Data: Microsoft Predictive Maintenance Modelling Guide
sample dataset (simulated); see docs/DATA_PROVENANCE.md."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

from ml.data import (
    COMPONENTS,
    COVERAGE_END,
    ERROR_TYPES,
    HOUR,
    MODELS,
    RAW_DIR,
    SENSORS,
    TELEMETRY_END,
    TELEMETRY_START,
    Tables,
    load_tables,
)
from ml.labels import events_from_failures

COLUMNS = {
    "telemetry": ["datetime", "machineID", *SENSORS],
    "errors": ["datetime", "machineID", "errorID"],
    "maint": ["datetime", "machineID", "comp"],
    "failures": ["datetime", "machineID", "failure"],
    "machines": ["machineID", "model", "age"],
}

# Wider than the observed ranges (DATA_PROVENANCE.md), so only broken values trip them.
SENSOR_RANGES = {
    "volt": (90.0, 260.0),
    "rotate": (130.0, 700.0),
    "pressure": (45.0, 190.0),
    "vibration": (10.0, 80.0),
}
AGE_RANGE = (0, 20)

# Recorded counts at the pinned commit (DATA_PROVENANCE.md).
RECORDED_ROWS = {"telemetry": 876_100, "errors": 3_919, "maint": 3_286, "failures": 761, "machines": 100}
RECORDED_FAILURE_ROWS = 761
RECORDED_EVENTS = 719
RECORDED_DOUBLE_EVENTS = 42
RECORDED_EVENTS_WITH_SAME_HOUR_REPAIR = 702
RECORDED_MACHINES_WITH_FAILURES = 98


def _frames(t: Tables) -> dict[str, pd.DataFrame]:
    return {
        "telemetry": t.telemetry,
        "errors": t.errors,
        "maint": t.maint,
        "failures": t.failures,
        "machines": t.machines,
    }


def check_structure(t: Tables) -> list[str]:
    """IDs, hourly steps, duplicates, blanks, ranges and joins. Returns a list of problems."""
    problems: list[str] = []
    frames = _frames(t)

    # Columns and blanks first: later checks assume both.
    for name, df in frames.items():
        if list(df.columns) != COLUMNS[name]:
            problems.append(f"{name}: columns are {list(df.columns)}, expected {COLUMNS[name]}")
    if problems:
        return problems
    for name, df in frames.items():
        blanks = int(df.isna().sum().sum())
        if blanks:
            problems.append(f"{name}: {blanks} blank fields")
        text_cols = [
            c
            for c in df.columns
            if not (pd.api.types.is_numeric_dtype(df[c]) or pd.api.types.is_datetime64_any_dtype(df[c]))
        ]
        for col in text_cols:
            empty = int((df[col].astype(str).str.strip() == "").sum())
            if empty:
                problems.append(f"{name}.{col}: {empty} empty strings")
    if problems:
        return problems

    # IDs
    ids = t.machines["machineID"]
    if ids.duplicated().any():
        problems.append("machines: duplicate machineID")
    if ids.min() != 1 or ids.max() != len(ids) or ids.nunique() != len(ids):
        problems.append(f"machines: IDs must be 1..{len(ids)} with no gaps")
    known = set(ids)
    for name in ("telemetry", "errors", "maint", "failures"):
        unknown = set(frames[name]["machineID"]) - known
        if unknown:
            problems.append(f"{name}: machine IDs not in machines table: {sorted(unknown)[:5]}")
    missing = known - set(t.telemetry["machineID"])
    if missing:
        problems.append(f"telemetry: no rows for machines {sorted(missing)[:5]}")

    # Categories and ranges
    for name, col, allowed in (
        ("machines", "model", MODELS),
        ("errors", "errorID", ERROR_TYPES),
        ("maint", "comp", COMPONENTS),
        ("failures", "failure", COMPONENTS),
    ):
        bad = set(frames[name][col]) - set(allowed)
        if bad:
            problems.append(f"{name}.{col}: unexpected values {sorted(bad)}")
    for sensor, (lo, hi) in SENSOR_RANGES.items():
        s = t.telemetry[sensor]
        if (s < lo).any() or (s > hi).any():
            problems.append(f"telemetry.{sensor}: values outside {lo}..{hi} (min {s.min()}, max {s.max()})")
    age = t.machines["age"]
    if (age < AGE_RANGE[0]).any() or (age > AGE_RANGE[1]).any():
        problems.append(f"machines.age: outside {AGE_RANGE}")

    # Whole-hour timestamps
    for name in ("telemetry", "errors", "maint", "failures"):
        dt = frames[name]["datetime"]
        if (dt != dt.dt.floor("h")).any():
            problems.append(f"{name}: timestamps not on the hour")

    # Duplicates
    if t.telemetry.duplicated(["machineID", "datetime"]).any():
        problems.append("telemetry: duplicate machine-hour rows")
    for name in ("errors", "maint", "failures"):
        n = int(frames[name].duplicated().sum())
        if n:
            problems.append(f"{name}: {n} identical duplicate rows")

    # Hourly steps: one gap-free hourly series per machine, all with the same span.
    tel = t.telemetry.sort_values(["machineID", "datetime"])
    gaps = tel.groupby("machineID")["datetime"].diff().dropna()
    if (gaps != HOUR).any():
        problems.append(f"telemetry: {int((gaps != HOUR).sum())} steps are not exactly 1 hour")
    span = tel.groupby("machineID")["datetime"].agg(["min", "max", "count"])
    if span["min"].nunique() != 1 or span["max"].nunique() != 1:
        problems.append("telemetry: machines do not share the same first and last hour")

    # Joins
    tel_keys = pd.MultiIndex.from_frame(t.telemetry[["machineID", "datetime"]])
    ev = events_from_failures(t.failures)
    ev_keys = pd.MultiIndex.from_frame(ev[["machineID", "datetime"]])
    orphan = int((~ev_keys.isin(tel_keys)).sum())
    if orphan:
        problems.append(f"failures: {orphan} events have no telemetry row at the same machine-hour")
    t_min, t_max = t.telemetry["datetime"].min(), t.telemetry["datetime"].max()
    for name in ("errors", "failures"):
        dt = frames[name]["datetime"]
        if ((dt < t_min) | (dt > t_max)).any():
            problems.append(f"{name}: records outside the telemetry period {t_min}..{t_max}")
    if (t.maint["datetime"] > t_max).any():
        problems.append("maint: records after the end of telemetry")
    return problems


def check_recorded_counts(t: Tables) -> list[str]:
    """The counts recorded in docs/DATA_PROVENANCE.md at the pinned commit."""
    problems: list[str] = []
    for name, df in _frames(t).items():
        if len(df) != RECORDED_ROWS[name]:
            problems.append(f"{name}: {len(df)} rows, recorded {RECORDED_ROWS[name]}")
    ev = events_from_failures(t.failures)
    if len(ev) != RECORDED_EVENTS:
        problems.append(f"failure events: {len(ev)}, recorded {RECORDED_EVENTS}")
    per_event = t.failures.groupby(["machineID", "datetime"]).size()
    doubles = int((per_event == 2).sum())
    if doubles != RECORDED_DOUBLE_EVENTS or int(per_event.max()) != 2:
        problems.append(
            f"events with two components: {doubles}, recorded {RECORDED_DOUBLE_EVENTS}, none more"
        )
    if t.failures["machineID"].nunique() != RECORDED_MACHINES_WITH_FAILURES:
        problems.append(f"machines with failures: {t.failures['machineID'].nunique()}, recorded 98")
    if ev["datetime"].max() != COVERAGE_END:
        problems.append(f"last failure event {ev['datetime'].max()}, recorded {COVERAGE_END}")
    if t.telemetry["datetime"].min() != TELEMETRY_START or t.telemetry["datetime"].max() != TELEMETRY_END:
        problems.append("telemetry period differs from 2015-01-01 06:00 .. 2016-01-01 06:00")
    same_hour = ev.merge(t.maint[["machineID", "datetime"]].drop_duplicates(), on=["machineID", "datetime"])
    if len(same_hour) != RECORDED_EVENTS_WITH_SAME_HOUR_REPAIR:
        recorded = RECORDED_EVENTS_WITH_SAME_HOUR_REPAIR
        problems.append(f"events with a same-hour repair: {len(same_hour)}, recorded {recorded}")
    return problems


def summary(t: Tables) -> str:
    ev = events_from_failures(t.failures)
    lines = [f"  {name}: {len(df):,} rows" for name, df in _frames(t).items()]
    lines.append(
        f"  failure rows {len(t.failures)} -> events {len(ev)}; "
        f"telemetry {t.telemetry['datetime'].min()} .. {t.telemetry['datetime'].max()}; "
        f"last event {ev['datetime'].max()}"
    )
    return "\n".join(lines)


def validate(raw_dir: Path = RAW_DIR) -> tuple[Tables | None, list[str]]:
    try:
        t = load_tables(raw_dir)
    except (FileNotFoundError, ValueError, KeyError) as e:
        return None, [f"could not load files from {raw_dir}: {e}"]
    problems = check_structure(t)
    if not problems:
        problems = check_recorded_counts(t)
    return t, problems


def main() -> int:
    t, problems = validate()
    if problems or t is None:
        print("VALIDATION FAILED", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1
    print("Validation passed (data: Microsoft Predictive Maintenance sample dataset, simulated).")
    print(summary(t))
    return 0


if __name__ == "__main__":
    sys.exit(main())
