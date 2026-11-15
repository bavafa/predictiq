"""Test-period evaluation for the component models, run once per version (spec step 2; decision 77).

  python -m ml.component_evaluate --write [--version comp-...]

Scores the saved models on the test period only, with the calibration and cut-offs chosen on validation.
Refuses to run if component_evaluation.json exists. Nothing here may change a model setting.
Headline numbers are event level: a failure is "caught" if any alert fell in the label window before it
(whole window inside the test period); "false calls" are alert rows with no failure in the window, per 100
component-weeks. All data is simulated; component names are illustrative.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import pandas as pd

from ml import splits
from ml.artifacts import ARTIFACTS_DIR, check_manifest, write_manifest
from ml.component_labels import LEVELS, build_component_frame, component_events
from ml.component_models import (
    WARNING_LEVEL,
    WEAR_LEVELS,
    load_raw,
    warning_inputs,
    warning_matrix,
    wear_matrix,
)
from ml.data import COMPONENTS, Tables
from ml.metrics import alerts_at, brier, confusion, pr_auc, precision, r6, recall
from ml.models import Calibrator

EVALUATION = "component_evaluation.json"
TEST = ("test",)


def event_stats(
    f: pd.DataFrame,
    alert: npt.NDArray[np.bool_],
    events: pd.DataFrame,
    step: pd.Timedelta,
    horizon: pd.Timedelta,
) -> tuple[int, int]:
    """(events with a whole window inside `f`, of which caught). `f` is one regular time grid per
    (machine, component), sorted by time. An alert at t covers failures e with t < e <= t + horizon."""
    k = int(horizon // step)
    ev_by = {key: g["datetime"] for key, g in events.groupby(["machineID", "comp"])}
    times = f["datetime"].to_numpy()
    total = caught = 0
    for key, idx in f.groupby(["machineID", "comp"], sort=False).indices.items():
        ev = ev_by.get(key)  # type: ignore[call-overload]
        n = len(idx)
        t0 = pd.Timestamp(times[idx[0]])
        if (pd.Timestamp(times[idx[-1]]) - t0) != (n - 1) * step:
            raise ValueError("time grid is not regular")
        if ev is None:
            continue
        pos = np.ceil(((pd.DatetimeIndex(ev) - t0) / step).to_numpy()).astype(int)
        lo, hi = pos - k, pos - 1
        ok = (lo >= 0) & (hi <= n - 1)
        cs = np.concatenate([[0], np.cumsum(alert[idx], dtype=np.int64)])
        total += int(ok.sum())
        caught += int(((cs[hi[ok] + 1] - cs[lo[ok]]) > 0).sum())
    return total, caught


def score_group(
    f: pd.DataFrame, scores: npt.NDArray[np.float64], cutoff: int, level: str, events: pd.DataFrame
) -> dict[str, Any]:
    step = pd.Timedelta(days=1) if LEVELS[level][0] == "D" else pd.Timedelta(hours=1)
    y = f["label"].to_numpy()
    alert = alerts_at(scores, cutoff)
    tp, fp, fn, _ = confusion(y, alert)
    total, caught = event_stats(f, alert, events, step, LEVELS[level][1])
    weeks = len(f) * step / pd.Timedelta(weeks=1)
    return {
        "rows": len(f),
        "positive_rows": int(y.sum()),
        "pr_auc": r6(pr_auc(scores, y)),
        "brier": r6(brier(scores, y)),
        "alert_rows": int(alert.sum()),
        "false_alert_rows": fp,
        "row_precision": r6(precision(tp, fp)),
        "row_recall": r6(recall(tp, fn)),
        "component_weeks": r6(weeks),
        "false_calls_per_100_component_weeks": r6(fp / weeks * 100.0) if weeks else None,
        "events_evaluable": total,
        "events_caught": caught,
    }


def _both(
    f: pd.DataFrame, s: npt.NDArray[np.float64], cutoff: int, level: str, ev: pd.DataFrame
) -> dict[str, Any]:
    u = f["unseen"].to_numpy()
    return {
        "all": score_group(f, s, cutoff, level, ev),
        "unseen_machines": score_group(f[u].reset_index(drop=True), s[u], cutoff, level, ev),
    }


def compute_evaluation(vdir: Path, tables: Tables) -> dict[str, Any]:
    meta = json.loads((vdir / "metadata.json").read_text())
    unseen = meta["unseen_machines"]
    ev = component_events(tables.failures)
    out: dict[str, Any] = {"model_version": vdir.name, "simulated": True, "split": "test", "levels": {}}
    for level in WEAR_LEVELS:
        frame = build_component_frame(tables, unseen, level, True, TEST)
        res: dict[str, Any] = {}
        for c in COMPONENTS:
            g = frame[frame["comp"] == c].reset_index(drop=True)
            m = meta["models"][level][c]
            x = wear_matrix(g)
            entry: dict[str, Any] = {
                "shipped": m["shipped"],
                "wear_model_beats_rule_on_validation": m["wear_model_beats_rule"],
            }
            for name, info in (("rule", m["rule"]), ("wear_model", m["wear_model"])):
                kind = "rule" if name == "rule" else info["kind"]
                cal = Calibrator.from_json(info["calibrator"])
                s = cal.apply(load_raw(vdir, level, c, kind).predict_raw(x))
                entry[name] = {
                    "kind": kind,
                    "cutoff": info["cutoff"],
                    **_both(g, s, info["cutoff"], level, ev),
                }
            res[c] = entry
        out["levels"][level] = res
    rows = warning_inputs(tables, unseen, TEST)
    res = {}
    for c, g in rows.items():
        g = g.reset_index(drop=True)
        m = meta["models"][WARNING_LEVEL][c]
        cal = Calibrator.from_json(m["calibrator"])
        s = cal.apply(load_raw(vdir, WARNING_LEVEL, c, "xgb").predict_raw(warning_matrix(g)))
        res[c] = {"cutoff": m["cutoff"], **_both(g, s, m["cutoff"], WARNING_LEVEL, ev)}
    out["levels"][WARNING_LEVEL] = res
    return out


def write(vdir: Path, tables: Tables) -> Path:
    path = vdir / EVALUATION
    if path.exists():
        raise FileExistsError(f"{path} already exists; the test result is written once per model version")
    problems = check_manifest(vdir)
    if problems:
        raise RuntimeError("model files do not match the manifest: " + "; ".join(problems))
    result = compute_evaluation(vdir, tables)
    with path.open("x") as fh:  # "x": fails rather than overwrite
        fh.write(json.dumps(result, sort_keys=True, indent=1) + "\n")
    write_manifest(vdir)
    return path


def main() -> int:
    from ml.validate import validate

    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--write", action="store_true", required=True)
    p.add_argument("--version", required=True, help="component model folder, e.g. comp-20261115-xxxxxxxx")
    args = p.parse_args()
    vdir = ARTIFACTS_DIR / args.version
    if (vdir / EVALUATION).exists():
        print(f"refused: {vdir / EVALUATION} already exists (written once per version)", file=sys.stderr)
        return 1
    tables, problems = validate()
    if (
        tables is None
        or problems
        or splits.load_unseen_machines()
        != json.loads((vdir / "metadata.json").read_text())["unseen_machines"]
    ):
        print("data checks failed or unseen set differs from the model's", file=sys.stderr)
        return 1
    print(f"wrote {write(vdir, tables)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
