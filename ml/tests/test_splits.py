import json

import pandas as pd

from ml.data import FIRST_SCORED, HOUR, LABEL_HORIZON, LAST_SCORED
from ml.splits import (
    EMBARGO1_START,
    EMBARGO2_START,
    TEST_START,
    TRAIN_END,
    UNSEEN_COUNT,
    UNSEEN_PATH,
    UNSEEN_SEED,
    VALIDATION_END,
    VALIDATION_START,
    assign_split,
    choose_unseen_machines,
    event_counts,
    load_unseen_machines,
    split_frame,
)

IDS = list(range(1, 101))


def grid(machine: int = 1) -> pd.DataFrame:
    hours = pd.date_range(FIRST_SCORED, LAST_SCORED, freq="h")
    return pd.DataFrame({"machineID": machine, "datetime": hours})


def test_boundaries() -> None:
    s = assign_split(pd.DatetimeIndex([FIRST_SCORED, TRAIN_END, EMBARGO1_START, VALIDATION_START]))
    assert list(s) == ["train", "train", "embargo", "validation"]
    s = assign_split(pd.DatetimeIndex([VALIDATION_END, EMBARGO2_START, TEST_START, LAST_SCORED]))
    assert list(s) == ["validation", "embargo", "test", "test"]


def test_split_sizes_match_architecture() -> None:
    counts = assign_split(pd.DatetimeIndex(grid()["datetime"])).value_counts()
    assert counts["test"] == 1423  # x 100 machines = 142,300 machine-hours
    assert counts["embargo"] == 48
    assert counts["validation"] == 60 * 24


def test_embargo_gaps_are_a_full_24_hours_and_no_label_window_reaches_a_later_split() -> None:
    assert VALIDATION_START - (TRAIN_END + HOUR) == LABEL_HORIZON
    assert TEST_START - (VALIDATION_END + HOUR) == LABEL_HORIZON
    # A train hour's label window (t, t+24h] ends before validation starts; same for validation.
    assert TRAIN_END + LABEL_HORIZON < VALIDATION_START
    assert VALIDATION_END + LABEL_HORIZON < TEST_START
    f = split_frame(grid(), unseen=[])
    assert not f["split"].isin(["embargo", "unscored"]).any()
    train_max = f.loc[f["split"] == "train", "datetime"].max()
    val_min = f.loc[f["split"] == "validation", "datetime"].min()
    assert val_min - train_max > LABEL_HORIZON


def test_unseen_machines_never_in_train_or_validation() -> None:
    unseen = choose_unseen_machines(IDS)
    machines = [1, 2, 3, *unseen[:3]]
    frames = pd.concat([grid(m) for m in machines], ignore_index=True)
    f = split_frame(frames, unseen)
    assert f[f["unseen"] & f["split"].isin(["train", "validation"])].empty
    assert set(f.loc[f["unseen"] & (f["split"] == "test"), "machineID"]) == set(unseen[:3])
    assert {1, 2, 3} <= set(f.loc[f["split"] == "test", "machineID"])
    assert {1, 2, 3} <= set(f.loc[f["split"] == "train", "machineID"])


def test_unseen_choice_is_fixed_and_matches_committed_file() -> None:
    chosen = choose_unseen_machines(IDS)
    assert len(chosen) == UNSEEN_COUNT == len(set(chosen))
    assert chosen == choose_unseen_machines(IDS)
    data = json.loads(UNSEEN_PATH.read_text())
    assert data["seed"] == UNSEEN_SEED
    assert load_unseen_machines() == chosen


def test_event_counts_buckets() -> None:
    times = [
        FIRST_SCORED - HOUR,
        FIRST_SCORED,
        EMBARGO1_START,
        VALIDATION_START,
        EMBARGO2_START,
        TEST_START,
        TEST_START + 24 * HOUR,
        LAST_SCORED,
        LAST_SCORED + HOUR,
    ]
    c = event_counts(pd.DataFrame({"machineID": 1, "datetime": times}))
    assert c["before_first_scored_hour"] == 1
    assert (c["train"], c["embargo_1"], c["validation"], c["embargo_2"]) == (1, 1, 1, 1)
    assert c["test"] == 3 and c["after_last_test_hour"] == 1
    assert c["test_full_lookback"] == 2  # the event at test start has its lookback in the embargo
