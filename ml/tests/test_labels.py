import pandas as pd

from ml.data import COVERAGE_END, FIRST_SCORED, LAST_SCORED
from ml.labels import events_from_failures, label_frame, scored_hours

T = pd.Timestamp("2015-06-01 12:00")
H = pd.Timedelta(hours=1)
FAR = pd.Timestamp("2016-01-01")


def label_at(event_times: list[pd.Timestamp], t: pd.Timestamp = T, machine: int = 1) -> int:
    ev = pd.DataFrame({"machineID": [machine] * len(event_times), "datetime": event_times})
    lab = label_frame(ev, [machine], pd.DatetimeIndex([t]), coverage_end=FAR)
    return int(lab["label"].iloc[0])


def test_event_at_t_does_not_count() -> None:
    assert label_at([T]) == 0


def test_event_one_hour_after_t_counts() -> None:
    assert label_at([T + H]) == 1


def test_event_at_t_plus_24h_counts() -> None:
    assert label_at([T + 24 * H]) == 1


def test_event_after_t_plus_24h_does_not_count() -> None:
    assert label_at([T + 25 * H]) == 0


def test_hour_after_a_failure_is_kept_and_labeled_by_the_same_rule() -> None:
    ev = pd.DataFrame({"machineID": [1], "datetime": [T - H]})
    lab = label_frame(ev, [1], pd.DatetimeIndex([T]), coverage_end=FAR)
    assert len(lab) == 1 and int(lab["label"].iloc[0]) == 0
    ev2 = pd.DataFrame({"machineID": [1, 1], "datetime": [T - H, T + 3 * H]})
    assert int(label_frame(ev2, [1], pd.DatetimeIndex([T]), coverage_end=FAR)["label"].iloc[0]) == 1


def test_other_machine_event_ignored() -> None:
    ev = pd.DataFrame({"machineID": [2], "datetime": [T + 5 * H]})
    lab = label_frame(ev, [1, 2], pd.DatetimeIndex([T]), coverage_end=FAR)
    assert dict(zip(lab["machineID"], lab["label"], strict=True)) == {1: 0, 2: 1}


def test_two_parts_same_hour_are_one_event() -> None:
    failures = pd.DataFrame(
        {
            "datetime": [T, T, T + H],
            "machineID": [1, 1, 1],
            "failure": ["comp1", "comp3", "comp1"],
        }
    )
    ev = events_from_failures(failures)
    assert len(ev) == 2
    assert label_at(list(ev["datetime"]), t=T - H) == 1


def test_positive_hours_per_event_are_exactly_24() -> None:
    ev = pd.DataFrame({"machineID": [1], "datetime": [T]})
    hours = pd.date_range(T - 48 * H, T + 48 * H, freq="h")
    lab = label_frame(ev, [1], hours, coverage_end=FAR)
    pos = lab.loc[lab["label"] == 1, "datetime"]
    assert len(pos) == 24
    assert pos.min() == T - 24 * H and pos.max() == T - H


def test_censoring_drops_hours_whose_window_passes_coverage_end() -> None:
    ev = pd.DataFrame({"machineID": [1], "datetime": [COVERAGE_END]})
    hours = pd.date_range(LAST_SCORED - 2 * H, COVERAGE_END + 2 * H, freq="h")
    lab = label_frame(ev, [1], hours, coverage_end=COVERAGE_END)
    assert lab["datetime"].max() == LAST_SCORED == COVERAGE_END - 24 * H
    assert int(lab.loc[lab["datetime"] == LAST_SCORED, "label"].iloc[0]) == 1  # event at t+24h


def test_scored_hours_span() -> None:
    hours = scored_hours()
    assert hours[0] == FIRST_SCORED and hours[-1] == LAST_SCORED
    assert len(hours) == 8689
