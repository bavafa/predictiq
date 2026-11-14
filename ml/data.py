"""Shared constants and the loader for the five raw CSV files."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"

HOUR = pd.Timedelta(hours=1)
LABEL_HORIZON = pd.Timedelta(hours=24)

SENSORS = ("volt", "rotate", "pressure", "vibration")
ERROR_TYPES = tuple(f"error{i}" for i in range(1, 6))
COMPONENTS = tuple(f"comp{i}" for i in range(1, 5))
MODELS = tuple(f"model{i}" for i in range(1, 5))

TELEMETRY_START = pd.Timestamp("2015-01-01 06:00")
TELEMETRY_END = pd.Timestamp("2016-01-01 06:00")
# Failure coverage is taken to end at the last observed failure event (architecture, "End of data").
COVERAGE_END = pd.Timestamp("2015-12-31 06:00")
FIRST_SCORED = pd.Timestamp("2015-01-02 06:00")  # telemetry start + the 24h longest window
LAST_SCORED = pd.Timestamp("2015-12-30 06:00")  # COVERAGE_END - 24h

DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


@dataclass(frozen=True)
class Tables:
    telemetry: pd.DataFrame
    errors: pd.DataFrame
    maint: pd.DataFrame
    failures: pd.DataFrame
    machines: pd.DataFrame


def _read(path: Path, dated: bool) -> pd.DataFrame:
    df = pd.read_csv(path)
    if dated:
        df["datetime"] = pd.to_datetime(df["datetime"], format=DATE_FORMAT)
    return df


def load_tables(raw_dir: Path = RAW_DIR) -> Tables:
    """Read the five files as published (no cleaning). Raises FileNotFoundError if one is missing."""
    return Tables(
        telemetry=_read(raw_dir / "PdM_telemetry.csv", True),
        errors=_read(raw_dir / "PdM_errors.csv", True),
        maint=_read(raw_dir / "PdM_maint.csv", True),
        failures=_read(raw_dir / "PdM_failures.csv", True),
        machines=_read(raw_dir / "PdM_machines.csv", False),
    )
