"""Component-level labels and wear-view inputs (docs/specs/component-planner.md, step 1; decision 77).

All data is simulated (Microsoft sample dataset). Three label sets, one rule:
  * component-day, 7 days and 14 days: scored once a day at 06:00;
  * component-hour, 48 hours: scored every hour.
Label for machine m, component c, scoring time t: positive if a failure of c on m falls strictly after t and
at or before t + horizon (a failure at t does not count). Times whose window passes the end of failure
coverage are unlabeled and dropped, never labeled 0.

Splits are the same time ranges, embargo days and unseen machines as the 24-hour model. A longer horizon
needs a longer gap, so rows are also purged: a row is kept only if its whole label window ends before the
start of the next period (train -> validation start, validation -> test start). For 24 hours this removes
nothing (the 1-day embargo already does it); for 7, 14 and 48 hours it removes the last rows of train and
validation. Test rows are limited only by the end of coverage.

Wear-view inputs (no telemetry, no errors), as of t with records stamped at t treated as unknown:
days since this part was last replaced or failed (NaN if never), machine model (1-4), machine age, and the
number of earlier failures of this part on this machine.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

from ml.data import COMPONENTS, COVERAGE_END, FIRST_SCORED, LAST_SCORED, Tables
from ml.features.build import _maint_features
from ml.splits import TEST_START, VALIDATION_START, assign_split, split_frame

# name -> (scoring step, label horizon)
LEVELS: dict[str, tuple[str, pd.Timedelta]] = {
    "day7": ("D", pd.Timedelta(days=7)),
    "day14": ("D", pd.Timedelta(days=14)),
    "hour48": ("h", pd.Timedelta(hours=48)),
}
WEAR_COLUMNS = ["days_since_replacement", "machine_model", "age", "past_failures"]


def component_events(failures: pd.DataFrame) -> pd.DataFrame:
    """One event per machine, component and hour (duplicates collapsed)."""
    ev = failures[["machineID", "failure", "datetime"]].drop_duplicates()
    return ev.rename(columns={"failure": "comp"}).sort_values(
        ["machineID", "comp", "datetime"], ignore_index=True
    )


def scoring_times(freq: str) -> pd.DatetimeIndex:
    """Daily at 06:00 ('D') or hourly ('h'), from the first to the last scored hour of the 24-hour model."""
    return pd.date_range(FIRST_SCORED, LAST_SCORED, freq=freq)


def label_components(
    events: pd.DataFrame,
    machine_ids: np.ndarray | list[int],
    times: pd.DatetimeIndex,
    horizon: pd.Timedelta,
    coverage_end: pd.Timestamp = COVERAGE_END,
) -> pd.DataFrame:
    """Label every (machine, component, time): machineID, comp, datetime, label, sorted in that order."""
    times = times[times + horizon <= coverage_end]
    t = times.to_numpy()
    upper = (times + horizon).to_numpy()
    by_key = {k: g["datetime"].to_numpy() for k, g in events.groupby(["machineID", "comp"])}
    parts = []
    ids = sorted({int(x) for x in machine_ids})
    if not ids:
        return pd.DataFrame({"machineID": [], "comp": [], "datetime": [], "label": []})
    for m in ids:
        for comp in COMPONENTS:
            ev = np.sort(by_key.get((m, comp), np.array([], dtype="datetime64[ns]")))
            n = np.searchsorted(ev, upper, side="right") - np.searchsorted(ev, t, side="right")
            parts.append(
                pd.DataFrame(
                    {"machineID": m, "comp": comp, "datetime": times, "label": (n > 0).astype("int8")}
                )
            )
    return pd.concat(parts, ignore_index=True)


def wear_inputs(tables: Tables, machine_ids: np.ndarray, times: pd.DatetimeIndex) -> pd.DataFrame:
    """Wear-view inputs for every (machine, component, time), in the same key order as `label_components`.

    Labels drop times whose window passes the end of coverage and inputs do not, so join by key."""
    ids = np.unique(machine_ids)
    grid = pd.DataFrame(
        {"machineID": np.repeat(ids, len(times)), "datetime": np.tile(times.to_numpy(), len(ids))}
    )
    by_time = grid.sort_values("datetime", kind="stable")
    # A failure counts as a replacement (18 failures on 2015-01-02 have no maintenance record; decision 78).
    fails = tables.failures.rename(columns={"failure": "comp"})[["datetime", "machineID", "comp"]]
    replaced = pd.concat([tables.maint[["datetime", "machineID", "comp"]], fails], ignore_index=True)
    since = _maint_features(replaced, by_time)  # strictly earlier records only
    mach = tables.machines.set_index("machineID")
    model = grid["machineID"].map(mach["model"].str.removeprefix("model").astype(int)).to_numpy()
    age = grid["machineID"].map(mach["age"]).to_numpy()
    fail = {
        k: np.sort(g["datetime"].to_numpy())
        for k, g in component_events(tables.failures).groupby(["machineID", "comp"])
    }
    parts = []
    for comp in COMPONENTS:
        hours = pd.Series(since[f"hours_since_{comp}"], index=by_time.index).reindex(grid.index).to_numpy()
        past = np.zeros(len(grid), dtype=np.int64)
        for i, m in enumerate(ids):
            ev = fail.get((int(m), comp))
            if ev is not None:
                # failures stamped strictly before t; one at t is unknown
                past[i * len(times) : (i + 1) * len(times)] = np.searchsorted(
                    ev, times.to_numpy(), side="left"
                )
        parts.append(
            pd.DataFrame(
                {
                    "machineID": grid["machineID"],
                    "comp": comp,
                    "datetime": grid["datetime"],
                    "days_since_replacement": hours / 24.0,
                    "machine_model": model,
                    "age": age,
                    "past_failures": past,
                }
            )
        )
    out = pd.concat(parts, ignore_index=True)
    # one block per machine, then component, then time: same order as label_components
    return out.sort_values(["machineID", "comp", "datetime"], kind="stable", ignore_index=True)


def purge(frame: pd.DataFrame, horizon: pd.Timedelta) -> pd.DataFrame:
    """Drop train/validation rows whose label window reaches the next period (see module docstring)."""
    end = frame["datetime"] + horizon
    bad = ((frame["split"] == "train") & (end >= VALIDATION_START)) | (
        (frame["split"] == "validation") & (end >= TEST_START)
    )
    return frame[~bad].reset_index(drop=True)


def build_component_frame(
    tables: Tables,
    unseen: list[int] | set[int],
    level: str,
    with_inputs: bool = True,
    splits: tuple[str, ...] = ("train", "validation", "test"),
) -> pd.DataFrame:
    """Rows (machine, component, time) with `label`, `split`, `unseen` and, if asked, WEAR_COLUMNS.

    Only times of the requested splits are built, so a training run never builds test rows."""
    freq, horizon = LEVELS[level]
    ids = np.sort(tables.machines["machineID"].to_numpy())
    times = scoring_times(freq)
    times = times[assign_split(times).isin(splits).to_numpy()]
    frame = label_components(component_events(tables.failures), ids, times, horizon)
    if with_inputs:
        x = wear_inputs(tables, ids, times)
        key = ["machineID", "comp", "datetime"]
        frame = frame.merge(x, on=key, how="left", validate="one_to_one")
    return purge(split_frame(frame, unseen), horizon)


def main() -> int:
    from ml.splits import load_unseen_machines
    from ml.validate import validate

    t, problems = validate()
    if t is None or problems:
        print("data checks failed; run python -m ml.validate", file=sys.stderr)
        return 1
    unseen = load_unseen_machines()
    for level in LEVELS:
        f = build_component_frame(t, unseen, level, with_inputs=False)
        print(f"{level} (simulated data): positive / rows per split")
        for split, g in f.groupby("split"):
            per = g.groupby("comp")["label"].sum().to_dict()
            print(f"  {split}: {int(g['label'].sum()):,} / {len(g):,}  by part {per}")
        u = f[(f["split"] == "test") & f["unseen"]]
        print(f"  test, unseen machines only: {int(u['label'].sum()):,} / {len(u):,}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
