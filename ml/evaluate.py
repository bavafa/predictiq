"""Test-period evaluation, used once per model version.

  python -m ml.evaluate --write    run once; saves artifacts/<version>/evaluation.json; refuses if it exists
  python -m ml.evaluate --verify   recompute every test metric from the saved model and freshly built
                                   features; compare with the saved file; write nothing; exit 1 on mismatch

Counts are compared exactly; other numbers at the stored precision (6 decimals, one unit of tolerance).
Nothing here may change a model setting. Every number is from simulated sample data.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ml.artifacts import check_manifest, resolve, write_manifest
from ml.data import HOUR, Tables
from ml.labels import events_from_failures
from ml.metrics import CUTOFFS, DIGITS, brier, calibration_curve, group_counts, pr_auc, r6
from ml.models import MODEL_NAMES
from ml.replay import compute_replay
from ml.scoring import TestScores, compute_test_scores, save_cache
from ml.splits import TEST_END, TEST_START

EVALUATION = "evaluation.json"
GROUPS = ("seen", "unseen", "all")
IGNORED_KEYS = {"libraries"}


def _events_in_grid(ts: TestScores, events: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Row and hour index of every event whose event time is a test hour."""
    e = events[(events["datetime"] >= TEST_START) & (events["datetime"] <= TEST_END)]
    row = np.searchsorted(ts.machine_ids, e["machineID"].to_numpy()).astype(np.int64)
    hour = ((e["datetime"] - TEST_START) // HOUR).to_numpy().astype(np.int64)
    return row, hour


def _group(
    ts: TestScores,
    name: str,
    rows: np.ndarray,
    ev_row: np.ndarray,
    ev_hour: np.ndarray,
    cutoff: int,
) -> dict[str, Any]:
    scores = ts.scores[name][rows]
    labels = ts.labels[rows]
    local = np.full(len(ts.machine_ids), -1, dtype=np.int64)
    local[rows] = np.arange(len(rows))
    keep = local[ev_row] >= 0
    gm, gh = local[ev_row[keep]], ev_hour[keep]
    at = group_counts(scores, labels, cutoff, gm, gh)
    return {
        "n_machines": len(rows),
        "n_machine_hours": int(scores.size),
        "n_positive_hours": int(labels.sum()),
        "n_events_in_test": int(len(gm)),
        "n_events_full_lookback": at["events_full_lookback"],
        "n_events_excluded_partial_lookback": int(len(gm)) - at["events_full_lookback"],
        "at_default_cutoff": at,
        "pr_auc": r6(pr_auc(scores, labels)),
        "brier": r6(brier(scores, labels)),
        "calibration_curve": calibration_curve(scores, labels),
        "threshold_analysis": [group_counts(scores, labels, c, gm, gh) for c in CUTOFFS],
    }


def compute_evaluation(version_dir: Path, tables: Tables, ts: TestScores | None = None) -> dict[str, Any]:
    meta = json.loads((version_dir / "metadata.json").read_text())
    ts = ts or compute_test_scores(version_dir, tables)
    events = events_from_failures(tables.failures)
    ev_row, ev_hour = _events_in_grid(ts, events)
    is_unseen = np.isin(ts.machine_ids, ts.unseen)
    rows = {
        "seen": np.flatnonzero(~is_unseen),
        "unseen": np.flatnonzero(is_unseen),
        "all": np.arange(len(ts.machine_ids)),
    }
    models: dict[str, Any] = {}
    for name in MODEL_NAMES:
        info = meta["models"][name]
        cutoff = int(info["default_cutoff"])
        models[name] = {
            "calibration": info["calibration"]["chosen"],
            "default_cutoff_percent": cutoff,
            "groups": {g: _group(ts, name, rows[g], ev_row, ev_hour, cutoff) for g in GROUPS},
        }
    return {
        "schema": 1,
        "model_version": meta["model_version"],
        "simulated": True,
        "note": "Every number comes from simulated sample data published by Microsoft.",
        "test_window": {
            "start": TEST_START.strftime("%Y-%m-%d %H:%M"),
            "end": TEST_END.strftime("%Y-%m-%d %H:%M"),
            "hours": len(ts.hours),
        },
        "float_digits": DIGITS,
        "alert_rule": (
            "alert when calibrated score >= cut-off percent / 100; "
            "consecutive alert hours on one machine are one alert"
        ),
        "models": models,
        "libraries": meta["libraries"],
    }


def _plain(obj: Any) -> Any:
    return json.loads(json.dumps(obj))


def compare(stored: Any, fresh: Any, path: str = "") -> list[str]:
    """Differences between two results: ints, strings and None exact; floats within one stored unit."""
    if isinstance(stored, dict) and isinstance(fresh, dict):
        out: list[str] = []
        for k in sorted(set(stored) | set(fresh)):
            if not path and k in IGNORED_KEYS:
                continue
            if k not in stored or k not in fresh:
                out.append(f"{path}/{k}: present on one side only")
            else:
                out += compare(stored[k], fresh[k], f"{path}/{k}")
        return out
    if isinstance(stored, list) and isinstance(fresh, list):
        if len(stored) != len(fresh):
            return [f"{path}: length {len(stored)} vs {len(fresh)}"]
        return [
            d
            for i, (a, b) in enumerate(zip(stored, fresh, strict=True))
            for d in compare(a, b, f"{path}[{i}]")
        ]
    if isinstance(stored, float) or isinstance(fresh, float):
        if (
            isinstance(stored, int | float)
            and isinstance(fresh, int | float)
            and not isinstance(stored, bool)
        ):
            return [] if abs(stored - fresh) <= 1.0001 * 10**-DIGITS else [f"{path}: {stored} vs {fresh}"]
        return [f"{path}: {stored!r} vs {fresh!r}"]
    return [] if stored == fresh and type(stored) is type(fresh) else [f"{path}: {stored!r} vs {fresh!r}"]


def write(version_dir: Path, tables: Tables) -> Path:
    path = version_dir / EVALUATION
    if path.exists():
        raise FileExistsError(f"{path} already exists; the test result is written once per model version")
    problems = check_manifest(version_dir)
    if problems:
        raise RuntimeError("model files do not match the manifest: " + "; ".join(problems))
    ts = compute_test_scores(version_dir, tables)
    result = compute_evaluation(version_dir, tables, ts)
    with path.open("x") as f:  # "x": fails rather than overwrite
        f.write(json.dumps(result, sort_keys=True, separators=(",", ":")) + "\n")
    save_cache(version_dir, ts)
    write_manifest(version_dir)
    return path


def verify(version_dir: Path, tables: Tables) -> list[str]:
    """Read-only. Returns the list of mismatches (empty = pass)."""
    path = version_dir / EVALUATION
    if not path.exists():
        return [f"{path} does not exist; run --write first"]
    problems = check_manifest(version_dir)
    stored = json.loads(path.read_text())
    fresh = _plain(compute_evaluation(version_dir, tables))
    problems += compare(stored, fresh)
    meta = json.loads((version_dir / "metadata.json").read_text())
    if "replay" in meta:
        problems += compare(meta["replay"], compute_replay(version_dir, tables, use_cache=False), "/replay")
    return problems


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--verify", action="store_true")
    p.add_argument("--version", help="model version folder name (default: the latest under artifacts/)")
    args = p.parse_args()

    from ml.validate import validate

    vdir = resolve(args.version)
    if args.write and (vdir / EVALUATION).exists():  # refuse before doing any work
        print(
            f"refused: {vdir / EVALUATION} already exists (written once per model version)", file=sys.stderr
        )
        return 1
    tables, problems = validate()
    if tables is None or problems:
        print("data checks failed; run python -m ml.validate", file=sys.stderr)
        return 1
    if args.write:
        path = write(vdir, tables)
        print(f"wrote {path}")
        return 0
    mismatches = verify(vdir, tables)
    if mismatches:
        print(f"VERIFY FAILED for {vdir.name}: {len(mismatches)} difference(s)", file=sys.stderr)
        for m in mismatches[:20]:
            print("  " + m, file=sys.stderr)
        return 1
    print(f"VERIFY OK for {vdir.name}: all test metrics recomputed and equal to {EVALUATION}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
