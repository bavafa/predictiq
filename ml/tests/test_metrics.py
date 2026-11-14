"""Metric functions on small hand-made cases."""

import numpy as np

from ml import metrics
from ml.evaluate import compare


def arr(rows: list[list[int]]) -> np.ndarray:
    return np.array(rows)


def test_consecutive_alert_hours_are_one_alert_and_runs_do_not_join_across_machines() -> None:
    alert = arr([[0, 1, 1, 0, 1, 1], [1, 0, 0, 0, 0, 0]]).astype(bool)
    labels = arr([[0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 0, 0]])
    # machine 0: run (hours 1-2) has a positive hour -> true; run (4-5) none -> false.
    # machine 1: run (hour 0) false. Machine 0's last alert hour does not join machine 1's first.
    assert metrics.alert_runs(alert, labels) == (3, 2)


def test_alert_at_end_of_one_machine_and_start_of_next_are_two_alerts() -> None:
    alert = arr([[0, 0, 1], [1, 0, 0]]).astype(bool)
    assert metrics.alert_runs(alert, np.zeros((2, 3), dtype=int))[0] == 2


def test_false_alert_rate_formula() -> None:
    # 3 false alerts over 48 machine-hours = 2 machine-days -> 150 per 100 machine-days
    assert metrics.false_alerts_per_100_machine_days(3, 48) == 150.0
    assert metrics.false_alerts_per_100_machine_days(0, 142_300) == 0.0
    assert metrics.false_alerts_per_100_machine_days(1, 0) is None


def test_event_caught_only_by_alert_in_the_24_hours_before_it() -> None:
    n = 40
    event_hour = np.array([30])
    machine = np.array([0])
    for hour, expected in [(6, 1), (29, 1), (30, 0), (5, 0), (31, 0)]:
        alert = np.zeros((1, n), dtype=bool)
        alert[0, hour] = True
        assert metrics.events_caught(alert, machine, event_hour) == expected, hour


def test_event_on_another_machine_is_not_caught() -> None:
    alert = np.zeros((2, 40), dtype=bool)
    alert[1, 20] = True
    assert metrics.events_caught(alert, np.array([0]), np.array([30])) == 0


def test_full_lookback_excludes_events_near_the_window_start() -> None:
    hours = np.array([5, 23, 24, 25, 39])
    assert metrics.full_lookback(hours, 40).tolist() == [False, False, True, True, True]


def test_group_counts_excludes_partial_lookback_events_from_the_catch_share() -> None:
    n = 48
    scores = np.zeros((1, n))
    scores[0, 30] = 0.9
    labels = np.zeros((1, n), dtype=int)
    labels[0, 26:36] = 1  # event at hour 36 labels hours 12..35; keep it simple, just labels
    r = metrics.group_counts(scores, labels, 50, np.array([0, 0]), np.array([36, 10]))
    assert r["events_full_lookback"] == 1  # the event at hour 10 has no full lookback
    assert r["events_caught"] == 1
    assert r["share_events_caught"] == 1.0
    assert (r["tp"], r["fp"], r["fn"], r["tn"]) == (1, 0, 9, 38)
    assert (r["alerts"], r["false_alerts"]) == (1, 0)
    assert r["precision"] == 1.0 and r["recall"] == 0.1


def test_best_cutoff_ties_go_higher() -> None:
    scores = np.array([0.2, 0.2, 0.5])
    labels = np.array([1, 0, 1])
    # cut-offs 1..20 alert on all three (F1 = 0.8); 21..50 alert only on 0.5 (F1 = 2/3)
    assert metrics.best_f1_cutoff(scores, labels) == (20, 0.8)


def test_best_cutoff_when_nothing_is_positive_is_the_highest_percent() -> None:
    cutoff, f = metrics.best_f1_cutoff(np.array([0.1, 0.2]), np.array([0, 0]))
    assert (cutoff, f) == (100, 0.0)


def test_precision_recall_undefined_cases_are_none() -> None:
    assert metrics.precision(0, 0) is None
    assert metrics.recall(0, 0) is None
    assert metrics.f1(0, 0, 0) == 0.0


def test_pr_auc_perfect_and_no_positives() -> None:
    assert metrics.pr_auc(np.array([0.1, 0.2, 0.8, 0.9]), np.array([0, 0, 1, 1])) == 1.0
    assert metrics.pr_auc(np.array([0.1, 0.2]), np.array([0, 0])) is None


def test_brier() -> None:
    assert metrics.brier(np.array([1.0, 0.0]), np.array([1, 0])) == 0.0
    assert metrics.brier(np.array([0.5, 0.5]), np.array([1, 0])) == 0.25


def test_calibration_curve_ten_equal_bins() -> None:
    scores = np.linspace(0.0, 0.99, 100)
    labels = (scores > 0.5).astype(int)
    curve = metrics.calibration_curve(scores, labels)
    assert [b["n"] for b in curve] == [10] * 10
    assert curve[0]["observed_rate"] == 0.0 and curve[-1]["observed_rate"] == 1.0


def test_compare_counts_exact_floats_at_stored_precision() -> None:
    assert compare({"tp": 5, "p": 0.123456}, {"tp": 5, "p": 0.123457}) == []
    assert compare({"tp": 5}, {"tp": 6}) != []
    assert compare({"p": 0.123456}, {"p": 0.123460}) != []
    assert compare({"p": None}, {"p": 0.5}) != []
    assert compare({"libraries": {"x": "1"}}, {"libraries": {"x": "2"}}) == []  # versions are not compared
