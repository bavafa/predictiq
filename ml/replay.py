"""Replay start (decision 30) from saved test scores of the main model.

Rule, fixed before any result: the first test hour at which any machine's main-model score is at or above
the default cut-off (set on validation); if no hour qualifies, the first test hour. The replay ends at the
last scored test hour, 2015-12-30 06:00. Usage: python -m ml.replay [--version V]
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

from ml.artifacts import resolve, write_manifest
from ml.data import Tables
from ml.scoring import compute_test_scores, load_cached_scores
from ml.splits import TEST_END

HOUR_FORMAT = "%Y-%m-%d %H:%M"
BRANCH_ALERT = "first_hour_with_alert"
BRANCH_NONE = "no_alert_first_test_hour"


def replay_start(
    scores: npt.NDArray[np.float64], hours: pd.DatetimeIndex, cutoff_percent: int
) -> dict[str, Any]:
    """`scores` is (machines, hours). Returns the start hour, the branch taken and the replay end."""
    any_alert = (scores >= cutoff_percent / 100.0).any(axis=0)
    if any_alert.any():
        start, branch = hours[int(np.argmax(any_alert))], BRANCH_ALERT
    else:
        start, branch = hours[0], BRANCH_NONE
    return {
        "start": start.strftime(HOUR_FORMAT),
        "end": TEST_END.strftime(HOUR_FORMAT),
        "branch": branch,
        "default_cutoff_percent": cutoff_percent,
        "rule": "decision 30: first test hour with any main-model score >= cut-off, else first test hour",
    }


def compute_replay(version_dir: Path, tables: Tables | None, use_cache: bool = True) -> dict[str, Any]:
    """With `use_cache=False` (used by --verify) scores are always recomputed; the cache is never read."""
    meta = json.loads((version_dir / "metadata.json").read_text())
    cutoff = int(meta["models"]["main"]["default_cutoff"])
    cached = load_cached_scores(version_dir) if use_cache else None
    if cached is not None:
        with np.load(version_dir / "test_scores.npz") as z:
            hours = pd.DatetimeIndex(z["hours"].astype("datetime64[s]"))
        return replay_start(cached["main"], hours, cutoff)
    if tables is None:
        raise FileNotFoundError("no saved test scores; run `make evaluate` or give the data tables")
    ts = compute_test_scores(version_dir, tables)
    return replay_start(ts.scores["main"], ts.hours, cutoff)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--version")
    args = p.parse_args()
    vdir = resolve(args.version)
    tables = None
    if load_cached_scores(vdir) is None:
        from ml.validate import validate

        tables, problems = validate()
        if tables is None or problems:
            print("data checks failed", file=sys.stderr)
            return 1
    rp = compute_replay(vdir, tables)
    path = vdir / "metadata.json"
    meta = json.loads(path.read_text())
    meta["replay"] = rp
    path.write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    write_manifest(vdir)
    print(f"{vdir.name}: replay starts {rp['start']} ({rp['branch']}), ends {rp['end']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
