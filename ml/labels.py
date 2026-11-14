"""The 24-hour failure label (docs/architecture.md, "The 24-hour label"; decision 34).

Event: all failure rows for one machine in one hour. Label for machine m at scored hour t: positive if an
event for m falls strictly after t and at or before t + 24h (an event at t does not count; at t + 24h does).
Hours after a failure are kept and labeled by the same rule. Hours whose 24-hour window passes the end of
failure coverage are unlabeled and not returned.
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd

from ml.data import COVERAGE_END, FIRST_SCORED, LABEL_HORIZON, LAST_SCORED


def events_from_failures(failures: pd.DataFrame) -> pd.DataFrame:
    """One event per machine-hour: several failed components in the same hour are one event."""
    ev = failures[["machineID", "datetime"]].drop_duplicates()
    return ev.sort_values(["machineID", "datetime"]).reset_index(drop=True)


def scored_hours(first: pd.Timestamp = FIRST_SCORED, last: pd.Timestamp = LAST_SCORED) -> pd.DatetimeIndex:
    return pd.date_range(first, last, freq="h")


def label_frame(
    events: pd.DataFrame,
    machine_ids: np.ndarray | list[int],
    hours: pd.DatetimeIndex,
    coverage_end: pd.Timestamp = COVERAGE_END,
) -> pd.DataFrame:
    """Label every (machine, hour) for `hours` whose window ends by `coverage_end`.

    Returns columns machineID, datetime, label (0/1), sorted by machine then hour. Hours with
    t + 24h > coverage_end are dropped (censored), never labeled 0.
    """
    hours = hours[hours + LABEL_HORIZON <= coverage_end]
    t = hours.to_numpy()
    upper = (hours + LABEL_HORIZON).to_numpy()
    by_machine = {m: g["datetime"].to_numpy() for m, g in events.groupby("machineID")}
    parts = []
    for m in sorted(int(x) for x in machine_ids):
        ev = np.sort(by_machine.get(m, np.array([], dtype="datetime64[ns]")))
        # events in (t, t+24h]  <=>  count(ev <= t+24h) - count(ev <= t) > 0
        n = np.searchsorted(ev, upper, side="right") - np.searchsorted(ev, t, side="right")
        parts.append(pd.DataFrame({"machineID": m, "datetime": hours, "label": (n > 0).astype("int8")}))
    if not parts:
        return pd.DataFrame({"machineID": [], "datetime": [], "label": []})
    return pd.concat(parts, ignore_index=True)


def main() -> int:
    from ml.validate import validate

    t, problems = validate()
    if t is None or problems:
        print("data checks failed; run python -m ml.validate", file=sys.stderr)
        return 1
    ev = events_from_failures(t.failures)
    lab = label_frame(ev, t.machines["machineID"].to_numpy(), scored_hours())
    print(f"events: {len(ev)} (from {len(t.failures)} failure rows)")
    positive = int(lab["label"].sum())
    print(f"labeled machine-hours: {len(lab):,}; positive: {positive:,} ({lab['label'].mean():.2%})")
    print(f"scored hours {lab['datetime'].min()} .. {lab['datetime'].max()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
