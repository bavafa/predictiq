"""Metric functions (docs/architecture.md, "Metrics"). Pure numpy; no files, no models.

Data layout used throughout: `scores` and `labels` are (machines, hours) matrices on one shared hourly
grid; an alert at hour t means score >= cutoff / 100 (cutoff = whole percent).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import numpy.typing as npt
from sklearn.metrics import average_precision_score

LOOKBACK = 24  # hours; equals the label horizon (ml.data.LABEL_HORIZON)
CUTOFFS = tuple(range(0, 101))
DEFAULT_CUTOFF_RANGE = tuple(range(1, 101))
DIGITS = 6

FloatArr = npt.NDArray[np.float64]
BoolArr = npt.NDArray[np.bool_]
IntArr = npt.NDArray[np.int64]


def r6(x: float | None) -> float | None:
    """Stored precision for every non-count number."""
    return None if x is None else round(float(x), DIGITS)


def alerts_at(scores: FloatArr, cutoff: int) -> BoolArr:
    return scores >= cutoff / 100.0


def confusion(labels: npt.NDArray[Any], alert: BoolArr) -> tuple[int, int, int, int]:
    """(tp, fp, fn, tn)."""
    y = labels.astype(bool)
    tp = int((alert & y).sum())
    fp = int((alert & ~y).sum())
    fn = int((~alert & y).sum())
    tn = int((~alert & ~y).sum())
    return tp, fp, fn, tn


def precision(tp: int, fp: int) -> float | None:
    return None if tp + fp == 0 else tp / (tp + fp)


def recall(tp: int, fn: int) -> float | None:
    return None if tp + fn == 0 else tp / (tp + fn)


def f1(tp: int, fp: int, fn: int) -> float:
    """Hour-level F1 = 2tp / (2tp + fp + fn); 0 when there is nothing to find or alert on."""
    d = 2 * tp + fp + fn
    return 0.0 if d == 0 else 2 * tp / d


def best_f1_cutoff(scores: FloatArr, labels: npt.NDArray[Any]) -> tuple[int, float]:
    """Whole percent in 1..100 with the best F1; on a tie the HIGHER cutoff wins."""
    best_c, best_f = DEFAULT_CUTOFF_RANGE[0], -1.0
    for c in DEFAULT_CUTOFF_RANGE:
        tp, fp, fn, _ = confusion(labels, alerts_at(scores, c))
        f = f1(tp, fp, fn)
        if f >= best_f:  # >= : later (higher) cutoffs replace equal ones
            best_c, best_f = c, f
    return best_c, best_f


def brier(scores: FloatArr, labels: npt.NDArray[Any]) -> float:
    return float(np.mean((scores - labels.astype(float)) ** 2))


def pr_auc(scores: FloatArr, labels: npt.NDArray[Any]) -> float | None:
    """Average precision (area under the precision-recall curve, step-wise). None without positives."""
    y = labels.astype(int).ravel()
    if y.sum() == 0:
        return None
    return float(average_precision_score(y, scores.ravel()))


def calibration_curve(scores: FloatArr, labels: npt.NDArray[Any], bins: int = 10) -> list[dict[str, Any]]:
    """Equal-size bins by score rank (ties broken by position, so it is deterministic)."""
    s = scores.ravel()
    y = labels.astype(float).ravel()
    order = np.argsort(s, kind="stable")
    out = []
    for i, idx in enumerate(np.array_split(order, bins)):
        n = len(idx)
        out.append(
            {
                "bin": i + 1,
                "n": n,
                "mean_score": r6(s[idx].mean()) if n else None,
                "observed_rate": r6(y[idx].mean()) if n else None,
                "positives": int(y[idx].sum()),
            }
        )
    return out


def alert_runs(alert: BoolArr, labels: npt.NDArray[Any]) -> tuple[int, int]:
    """(alerts, false alerts). Consecutive alert hours on one machine are ONE alert; an alert is false
    if none of its hours is labeled positive. Runs never join across machines."""
    m, h = alert.shape
    pad = np.zeros((m, h + 1), dtype=bool)
    pad[:, 1:] = alert
    flat = pad.ravel()
    starts = flat & ~np.concatenate(([False], flat[:-1]))
    run_id = np.cumsum(starts)
    n_alerts = int(starts.sum())
    lab = np.zeros((m, h + 1), dtype=bool)
    lab[:, 1:] = labels.astype(bool)
    true_runs = np.unique(run_id[flat & lab.ravel()])
    return n_alerts, n_alerts - len(true_runs)


def false_alerts_per_100_machine_days(false_alerts: int, machine_hours: int) -> float | None:
    """false alerts / (machine-hours / 24) * 100."""
    return None if machine_hours == 0 else false_alerts / (machine_hours / 24.0) * 100.0


def events_caught(alert: BoolArr, ev_machine: IntArr, ev_hour: IntArr) -> int:
    """Events with an alert in the 24 hours before them (hours e-24 .. e-1 on the grid).

    `ev_machine` is the matrix row, `ev_hour` the grid column of the event hour. Only events whose whole
    lookback lies on the grid should be passed (see `full_lookback`)."""
    cs = np.concatenate(
        [np.zeros((alert.shape[0], 1), dtype=np.int64), np.cumsum(alert, axis=1, dtype=np.int64)], axis=1
    )
    count = cs[ev_machine, ev_hour] - cs[ev_machine, ev_hour - LOOKBACK]
    return int((count > 0).sum())


def full_lookback(ev_hour: IntArr, n_hours: int) -> BoolArr:
    """Whole 24-hour lookback inside the grid: e-24 >= first hour and e-1 <= last hour."""
    return (ev_hour - LOOKBACK >= 0) & (ev_hour - 1 <= n_hours - 1)


def group_counts(
    scores: FloatArr,
    labels: npt.NDArray[Any],
    cutoff: int,
    ev_machine: IntArr,
    ev_hour: IntArr,
) -> dict[str, Any]:
    """Counts and rates at one cutoff for one group of machines. `ev_*` are test events inside the grid
    (any lookback); events without a full lookback are excluded from the catch share."""
    alert = alerts_at(scores, cutoff)
    tp, fp, fn, tn = confusion(labels, alert)
    n_alerts, n_false = alert_runs(alert, labels)
    full = full_lookback(ev_hour, scores.shape[1])
    caught = events_caught(alert, ev_machine[full], ev_hour[full])
    n_full = int(full.sum())
    return {
        "cutoff": cutoff,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "precision": r6(precision(tp, fp)),
        "recall": r6(recall(tp, fn)),
        "alerts": n_alerts,
        "false_alerts": n_false,
        "false_alerts_per_100_machine_days": r6(false_alerts_per_100_machine_days(n_false, int(scores.size))),
        "events_caught": caught,
        "events_full_lookback": n_full,
        "share_events_caught": r6(None if n_full == 0 else caught / n_full),
    }
