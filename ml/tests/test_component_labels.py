"""Component labels and wear inputs (spec step 1). Synthetic data only; the real-data counts are opt-in."""

import numpy as np
import pandas as pd
import pytest

from ml.component_labels import (
    LEVELS,
    build_component_frame,
    component_events,
    label_components,
    purge,
    wear_inputs,
)
from ml.data import RAW_DIR, Tables
from ml.splits import TEST_START, VALIDATION_START

T = pd.Timestamp("2015-06-01 06:00")
D = pd.Timedelta(days=1)
H = pd.Timedelta(hours=1)
FAR = pd.Timestamp("2016-01-01")


def label_at(
    events: list[tuple[int, str, pd.Timestamp]],
    comp: str,
    horizon: pd.Timedelta,
    t: pd.Timestamp = T,
    coverage: pd.Timestamp = FAR,
) -> int:
    ev = pd.DataFrame(events, columns=["machineID", "comp", "datetime"])
    lab = label_components(ev, [1], pd.DatetimeIndex([t]), horizon, coverage)
    return int(lab.loc[lab["comp"] == comp, "label"].iloc[0])


@pytest.mark.parametrize("horizon", [LEVELS["day7"][1], LEVELS["day14"][1], LEVELS["hour48"][1]])
def test_window_edges(horizon: pd.Timedelta) -> None:
    assert label_at([(1, "comp2", T)], "comp2", horizon) == 0  # at t: unknown
    assert label_at([(1, "comp2", T + H)], "comp2", horizon) == 1
    assert label_at([(1, "comp2", T + horizon)], "comp2", horizon) == 1
    assert label_at([(1, "comp2", T + horizon + H)], "comp2", horizon) == 0


def test_only_the_same_part_and_machine_count() -> None:
    h = LEVELS["day7"][1]
    assert label_at([(1, "comp1", T + D)], "comp2", h) == 0
    assert label_at([(2, "comp2", T + D)], "comp2", h) == 0


def test_two_parts_same_hour_label_both_parts() -> None:
    ev = [(1, "comp1", T + D), (1, "comp3", T + D), (1, "comp3", T + D)]
    h = LEVELS["day7"][1]
    assert (label_at(ev, "comp1", h), label_at(ev, "comp3", h), label_at(ev, "comp4", h)) == (1, 1, 0)
    assert len(component_events(pd.DataFrame(ev, columns=["machineID", "failure", "datetime"]))) == 2


def test_unlabelled_at_end_of_coverage() -> None:
    ev = pd.DataFrame([(1, "comp1", T + D)], columns=["machineID", "comp", "datetime"])
    cov = T + 7 * D
    lab = label_components(ev, [1], pd.DatetimeIndex([T, T + H]), LEVELS["day7"][1], cov)
    assert list(lab["datetime"].unique()) == [T]  # T+1h has its window past coverage: dropped, not 0


def test_purge_keeps_24h_rows_and_drops_longer_windows() -> None:
    last_train = pd.Timestamp("2015-08-30 23:00")
    rows = pd.DataFrame({"datetime": [last_train, pd.Timestamp("2015-08-17 06:00")], "split": ["train"] * 2})
    assert len(purge(rows, pd.Timedelta(hours=24))) == 2
    kept = purge(rows, LEVELS["day14"][1])
    assert list(kept["datetime"]) == [pd.Timestamp("2015-08-17 06:00")]  # window ends 08-31 06:00 < Sep 1
    v = pd.DataFrame({"datetime": [pd.Timestamp("2015-10-18 06:00")], "split": ["validation"]})
    assert purge(v, LEVELS["day14"][1]).empty  # window ends Nov 1 06:00, inside test


@pytest.mark.parametrize("level", list(LEVELS))
def test_purge_boundary_is_exact(level: str) -> None:
    h = LEVELS[level][1]
    for split, nxt in (("train", VALIDATION_START), ("validation", TEST_START)):
        rows = pd.DataFrame({"datetime": [nxt - h, nxt - h - H], "split": [split] * 2})
        assert list(purge(rows, h)["datetime"]) == [nxt - h - H]  # window ending at the next start is dropped


def test_no_machines_gives_empty_labels_and_duplicates_are_ignored() -> None:
    ev = pd.DataFrame([(1, "comp1", T + D)], columns=["machineID", "comp", "datetime"])
    times = pd.DatetimeIndex([T])
    assert label_components(ev, [], times, LEVELS["day7"][1], FAR).empty
    assert len(label_components(ev, [1, 1], times, LEVELS["day7"][1], FAR)) == 4


def tiny() -> Tables:
    ids = [1, 2]
    maint = pd.DataFrame(
        [(T - 20 * D, 1, "comp1"), (T - 3 * D, 1, "comp1"), (T, 1, "comp1"), (T - 5 * D, 1, "comp2")],
        columns=["datetime", "machineID", "comp"],
    )
    fails = pd.DataFrame(
        [(T - 10 * D, 1, "comp1"), (T - 10 * D, 1, "comp1"), (T, 1, "comp1"), (T + 2 * D, 1, "comp1")],
        columns=["datetime", "machineID", "failure"],
    )
    machines = pd.DataFrame({"machineID": ids, "model": ["model2", "model4"], "age": [7, 15]})
    empty = pd.DataFrame()
    return Tables(telemetry=empty, errors=empty, maint=maint, failures=fails, machines=machines)


def test_wear_inputs_treat_records_at_scoring_time_as_unknown() -> None:
    x = wear_inputs(tiny(), np.array([1, 2]), pd.DatetimeIndex([T, T + D]))
    x = x.set_index(["machineID", "comp", "datetime"])
    at_t = x.loc[(1, "comp1", T)]  # type: ignore[index]
    assert at_t["days_since_replacement"] == 3.0  # the replacement stamped at T is not seen
    assert (
        at_t["past_failures"] == 1
    )  # one failure hour before T (two rows, same hour); the one at T is not seen
    nxt = x.loc[(1, "comp1", T + D)]  # type: ignore[index]
    assert nxt["days_since_replacement"] == 1.0 and nxt["past_failures"] == 2
    assert (at_t["machine_model"], at_t["age"]) == (2, 7)
    assert np.isnan(float(x.loc[(1, "comp3", T), "days_since_replacement"]))  # type: ignore[arg-type]  # never replaced
    assert x.loc[(2, "comp1", T), "past_failures"] == 0 and x.loc[(2, "comp1", T), "machine_model"] == 4


def test_wear_and_label_rows_line_up_and_no_label_in_inputs() -> None:
    t = tiny()
    times = pd.DatetimeIndex([T, T + D, T + 2 * D])
    lab = label_components(component_events(t.failures), [1, 2], times, LEVELS["day7"][1], FAR)
    x = wear_inputs(t, np.array([1, 2]), times)
    assert lab[["machineID", "comp", "datetime"]].equals(x[["machineID", "comp", "datetime"]])
    assert "label" not in x.columns


@pytest.mark.parametrize("level", list(LEVELS))
def test_build_frame_unseen_machines_only_in_test_and_purged(level: str) -> None:
    h = LEVELS[level][1]
    f = build_component_frame(tiny(), [2], level)
    assert set(f["split"]) == {"train", "validation", "test"}
    assert f["unseen"].any() and f.loc[f["unseen"], "split"].eq("test").all()
    assert f.loc[f["split"].isin(["train", "validation"]), "machineID"].eq(1).all()  # machine 2 is unseen
    train = f.loc[f["split"] == "train", "datetime"]
    val = f.loc[f["split"] == "validation", "datetime"]
    assert (train + h < VALIDATION_START).all() and (val + h < TEST_START).all()
    assert train.max() + h >= VALIDATION_START - (D if level != "hour48" else H)  # purged no more than needed
    assert f["datetime"].max() + h <= pd.Timestamp("2015-12-31 06:00")


# positives / rows per split, simulated data, unseen machines as in ml/unseen_machines.json
REAL_COUNTS = {
    "day7": {"train": (2540, 75200), "validation": (514, 17280), "test": (720, 21600)},
    "day14": {"train": (4944, 72960), "validation": (887, 15040), "test": (1280, 18800)},
    "hour48": {"train": (17862, 1841280), "validation": (4026, 453120), "test": (5329, 559600)},
}


@pytest.mark.realdata
@pytest.mark.parametrize("level", list(LEVELS))
def test_real_counts_recorded(level: str) -> None:
    if not (RAW_DIR / "PdM_failures.csv").exists():
        pytest.skip("data/raw is missing")
    from ml.splits import load_unseen_machines
    from ml.validate import validate

    t, problems = validate()
    assert problems == [] and t is not None
    f = build_component_frame(t, load_unseen_machines(), level, with_inputs=level == "day14")
    got = {k: (int(g["label"].sum()), len(g)) for k, g in f.groupby("split")}
    assert got == REAL_COUNTS[level]
    if level == "day14":  # a never-replaced part may be NaN by design; the rest must be complete
        assert f[["machine_model", "age", "past_failures"]].notna().all().all()


def test_a_failure_with_no_replacement_record_counts_as_a_replacement() -> None:
    t = tiny()  # machine 1 comp1: replaced T-3d, failed T-10d and T+2d; comp3 has no records
    extra = pd.DataFrame([(T - 2 * D, 1, "comp3")], columns=["datetime", "machineID", "failure"])
    t = Tables(t.telemetry, t.errors, t.maint, pd.concat([t.failures, extra], ignore_index=True), t.machines)
    x = wear_inputs(t, np.array([1]), pd.DatetimeIndex([T])).set_index(["machineID", "comp"])
    assert x.loc[(1, "comp3"), "days_since_replacement"] == 2.0
    assert (
        x.loc[(1, "comp1"), "days_since_replacement"] == 3.0
    )  # the replacement at T-3d is later than the failure at T-10d
