"""Test-period scores from a saved model version and freshly built features."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt
import pandas as pd

from ml.data import Tables
from ml.dataset import build_frame
from ml.features import FEATURE_COLUMNS
from ml.models import MODEL_NAMES, load_scoring_model

SCORES_CACHE = "test_scores.npz"  # throw-away cache, gitignored, not in the manifest


@dataclass
class TestScores:
    machine_ids: npt.NDArray[np.int64]
    hours: pd.DatetimeIndex
    labels: npt.NDArray[np.int8]  # (machines, hours)
    scores: dict[str, npt.NDArray[np.float64]]  # model name -> (machines, hours), calibrated
    unseen: list[int]

    __test__ = False  # not a pytest class


def compute_test_scores(version_dir: Path, tables: Tables) -> TestScores:
    meta = json.loads((version_dir / "metadata.json").read_text())
    unseen: list[int] = [int(m) for m in meta["unseen_machines"]]
    frame = build_frame(tables, unseen, ("test",))
    ids = np.sort(frame["machineID"].unique()).astype(np.int64)
    hours = pd.DatetimeIndex(np.sort(frame["datetime"].unique()))
    if len(frame) != len(ids) * len(hours):
        raise ValueError("test frame is not a full machine x hour grid")
    frame = frame.sort_values(["machineID", "datetime"], kind="stable")
    x = frame[FEATURE_COLUMNS].to_numpy(dtype=np.float64)
    shape = (len(ids), len(hours))
    scores = {name: load_scoring_model(version_dir, name).predict(x).reshape(shape) for name in MODEL_NAMES}
    return TestScores(ids, hours, frame["label"].to_numpy().reshape(shape), scores, unseen)


def save_cache(version_dir: Path, ts: TestScores) -> None:
    arrays: dict[str, Any] = {
        "machine_ids": ts.machine_ids,
        "hours": ts.hours.to_numpy().astype("datetime64[s]").astype(np.int64),
    }
    arrays.update({f"scores_{k}": v for k, v in ts.scores.items()})
    np.savez(version_dir / SCORES_CACHE, **arrays)


def load_cached_scores(version_dir: Path) -> dict[str, npt.NDArray[np.float64]] | None:
    path = version_dir / SCORES_CACHE
    if not path.exists():
        return None
    with np.load(path) as z:
        return {name: z[f"scores_{name}"] for name in MODEL_NAMES}
