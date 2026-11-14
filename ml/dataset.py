"""Features + labels + split flags in one frame."""

from __future__ import annotations

import numpy as np
import numpy.typing as npt
import pandas as pd

from ml.data import Tables
from ml.features import FEATURE_COLUMNS, build_features
from ml.labels import events_from_failures, label_frame, scored_hours
from ml.splits import assign_split, split_frame


def build_frame(tables: Tables, unseen: list[int] | set[int], splits: tuple[str, ...]) -> pd.DataFrame:
    """Rows (machine, hour) for the requested splits only, with FEATURE_COLUMNS, `label`, `split`, `unseen`.

    Only hours of the requested splits are featurised, so a training run never builds test rows.
    The unseen machines are removed from train and validation; test keeps every machine."""
    hours = scored_hours()
    hours = hours[assign_split(hours).isin(splits).to_numpy()]
    feats = build_features(tables, hours)
    ids = np.sort(tables.machines["machineID"].to_numpy())
    labels = label_frame(events_from_failures(tables.failures), ids, hours)
    frame = feats.merge(labels, on=["machineID", "datetime"], how="inner", validate="one_to_one")
    if len(frame) != len(feats):
        raise ValueError("some scored hours have no label")
    return split_frame(frame, unseen)


def xy(frame: pd.DataFrame) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.int8]]:
    return frame[FEATURE_COLUMNS].to_numpy(dtype=np.float64), frame["label"].to_numpy()
