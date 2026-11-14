"""Chronological splits with 24-hour embargoes, and the unseen-machine set (architecture, "Splits").

| Split      | Scored hours                         |
| train      | 2015-01-02 06:00 .. 2015-08-30 23:00 |
| embargo    | 2015-08-31, all day (not used)       |
| validation | 2015-09-01 00:00 .. 2015-10-30 23:00 |
| embargo    | 2015-10-31, all day (not used)       |
| test       | 2015-11-01 00:00 .. 2015-12-30 06:00 |

The 20 unseen machines are excluded from train and validation entirely and scored on the test period.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from ml.data import COVERAGE_END, FIRST_SCORED, HOUR, LABEL_HORIZON, LAST_SCORED, ROOT

TRAIN_END = pd.Timestamp("2015-08-30 23:00")
EMBARGO1_START = pd.Timestamp("2015-08-31 00:00")
VALIDATION_START = pd.Timestamp("2015-09-01 00:00")
VALIDATION_END = pd.Timestamp("2015-10-30 23:00")
EMBARGO2_START = pd.Timestamp("2015-10-31 00:00")
TEST_START = pd.Timestamp("2015-11-01 00:00")
TEST_END = LAST_SCORED

UNSEEN_SEED = 20261114
UNSEEN_COUNT = 20
UNSEEN_PATH = ROOT / "ml" / "unseen_machines.json"

SPLIT_NAMES = ("train", "embargo", "validation", "test")


def assign_split(hours: pd.Series | pd.DatetimeIndex) -> pd.Series:
    """Split name per hour; hours outside the scored range get 'unscored'."""
    dt = pd.Series(pd.DatetimeIndex(hours).to_numpy())
    out = pd.Series("unscored", index=dt.index, dtype=object)
    out[(dt >= FIRST_SCORED) & (dt <= TRAIN_END)] = "train"
    out[(dt >= EMBARGO1_START) & (dt < VALIDATION_START)] = "embargo"
    out[(dt >= VALIDATION_START) & (dt <= VALIDATION_END)] = "validation"
    out[(dt >= EMBARGO2_START) & (dt < TEST_START)] = "embargo"
    out[(dt >= TEST_START) & (dt <= TEST_END)] = "test"
    return out


def choose_unseen_machines(
    machine_ids: list[int] | np.ndarray, seed: int = UNSEEN_SEED, count: int = UNSEEN_COUNT
) -> list[int]:
    ids = sorted(int(m) for m in machine_ids)
    return sorted(random.Random(seed).sample(ids, count))  # noqa: S311  (reproducible choice, not security)


def load_unseen_machines(path: Path = UNSEEN_PATH) -> list[int]:
    data = json.loads(path.read_text())
    return [int(m) for m in data["machine_ids"]]


def write_unseen_machines(machine_ids: list[int], path: Path = UNSEEN_PATH) -> list[int]:
    """Chosen ONCE; refuses to overwrite an existing file."""
    if path.exists():
        raise FileExistsError(f"{path} exists; the unseen set is chosen once")
    chosen = choose_unseen_machines(machine_ids)
    payload = {
        "seed": UNSEEN_SEED,
        "count": UNSEEN_COUNT,
        "method": "random.Random(seed).sample(sorted machine IDs 1..100, count), then sorted",
        "machine_ids": chosen,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return chosen


def split_frame(frame: pd.DataFrame, unseen: list[int] | set[int]) -> pd.DataFrame:
    """Usable rows per split. Adds `split` and `unseen`; drops embargo and unscored rows, and removes the
    unseen machines from train and validation. Test keeps every machine (flagged by `unseen`)."""
    out = frame.copy()
    out["split"] = assign_split(out["datetime"]).to_numpy()
    out["unseen"] = out["machineID"].isin(list(unseen)).to_numpy()
    keep = out["split"].isin(["train", "validation", "test"]) & ~(
        out["unseen"] & out["split"].isin(["train", "validation"])
    )
    return out[keep].reset_index(drop=True)


def event_counts(events: pd.DataFrame) -> dict[str, int]:
    """Events by event time per period, plus the test events with a full in-test lookback."""
    e = events["datetime"]
    counts = {
        "before_first_scored_hour": int((e < FIRST_SCORED).sum()),
        "train": int(((e >= FIRST_SCORED) & (e < EMBARGO1_START)).sum()),
        "embargo_1": int(((e >= EMBARGO1_START) & (e < VALIDATION_START)).sum()),
        "validation": int(((e >= VALIDATION_START) & (e < EMBARGO2_START)).sum()),
        "embargo_2": int(((e >= EMBARGO2_START) & (e < TEST_START)).sum()),
        "test": int(((e >= TEST_START) & (e <= TEST_END)).sum()),
        "after_last_test_hour": int((e > TEST_END).sum()),
    }
    # Hours labeled positive by event e are [e-24h, e-1h]; full lookback = all of them are test hours.
    in_test = (e >= TEST_START) & (e <= TEST_END)
    full = in_test & (e - LABEL_HORIZON >= TEST_START) & (e - HOUR <= TEST_END)
    counts["test_full_lookback"] = int(full.sum())
    counts["test_partial_lookback"] = int((in_test & ~full).sum())
    counts["label_some_test_hour"] = int(((e > TEST_START) & (e <= COVERAGE_END)).sum())
    return counts


def main() -> int:
    from ml.labels import events_from_failures
    from ml.validate import validate

    tables, problems = validate()
    if tables is None or problems:
        print("data checks failed; run python -m ml.validate", file=sys.stderr)
        return 1
    ids = tables.machines["machineID"].tolist()
    unseen = load_unseen_machines() if UNSEEN_PATH.exists() else write_unseen_machines(ids)
    if unseen != choose_unseen_machines(ids):
        print("unseen_machines.json does not match its seed", file=sys.stderr)
        return 1
    ev = events_from_failures(tables.failures)
    print("events by period:", json.dumps(event_counts(ev)))
    hours = pd.date_range(FIRST_SCORED, LAST_SCORED, freq="h")
    sizes = assign_split(hours).value_counts()
    print("scored hours per split:", {k: int(sizes.get(k, 0)) for k in (*SPLIT_NAMES, "unscored")})
    print(f"test machine-hours: {int(sizes.get('test', 0)) * len(ids):,}")
    print(f"unseen machines ({UNSEEN_COUNT}, seed {UNSEEN_SEED}): {unseen}")
    in_test = (ev["datetime"] >= TEST_START) & (ev["datetime"] <= TEST_END)
    print(f"test events on unseen machines: {int((in_test & ev['machineID'].isin(unseen)).sum())}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
