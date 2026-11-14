"""Small synthetic tables for tests (no network, no real data)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ml.data import COMPONENTS, ERROR_TYPES, SENSORS, Tables
from ml.validate import SENSOR_RANGES

START = pd.Timestamp("2015-01-01 06:00")


def make_tables(n_machines: int = 3, n_hours: int = 100, seed: int = 0) -> Tables:
    rng = np.random.default_rng(seed)
    hours = pd.date_range(START, periods=n_hours, freq="h")
    ids = np.arange(1, n_machines + 1)
    tel = pd.DataFrame(
        {
            "datetime": np.tile(hours.to_numpy(), n_machines),
            "machineID": np.repeat(ids, n_hours),
        }
    )
    for s in SENSORS:
        lo, hi = SENSOR_RANGES[s]
        tel[s] = rng.normal((lo + hi) / 2, (hi - lo) / 20, len(tel))

    def records(n: int, col: str, values: tuple[str, ...], first: pd.Timestamp) -> pd.DataFrame:
        span = int((hours[-1] - first) / pd.Timedelta(hours=1)) + 1
        df = pd.DataFrame(
            {
                "datetime": first + pd.to_timedelta(rng.integers(0, span, n), unit="h"),
                "machineID": rng.choice(ids, n),
                col: rng.choice(values, n),
            }
        )
        return df.drop_duplicates().sort_values(["datetime", "machineID"]).reset_index(drop=True)

    errors = records(60, "errorID", ERROR_TYPES, START)
    maint = records(40, "comp", COMPONENTS, START - pd.Timedelta(days=30))
    # make sure every machine has every component replaced before the telemetry starts
    base = pd.DataFrame(
        [(START - pd.Timedelta(days=40 + c), m, comp) for m in ids for c, comp in enumerate(COMPONENTS)],
        columns=["datetime", "machineID", "comp"],
    )
    maint = pd.concat([base, maint], ignore_index=True).sort_values("datetime").reset_index(drop=True)
    failures = records(8, "failure", COMPONENTS, START + pd.Timedelta(hours=30))
    machines = pd.DataFrame(
        {"machineID": ids, "model": [f"model{1 + i % 4}" for i in range(n_machines)], "age": (ids * 3) % 21}
    )
    return Tables(telemetry=tel, errors=errors, maint=maint, failures=failures, machines=machines)


def make_year_tables(n_machines: int = 10, seed: int = 1) -> Tables:
    """A whole-year synthetic fleet (telemetry 2015-01-01 06:00 .. 2016-01-01 06:00) with failures spread
    over train, validation and test, and a vibration rise before each failure so a model can learn it."""
    rng = np.random.default_rng(seed)
    hours = pd.date_range(START, pd.Timestamp("2016-01-01 06:00"), freq="h")
    ids = np.arange(1, n_machines + 1)
    n = len(hours)
    tel = pd.DataFrame({"datetime": np.tile(hours.to_numpy(), n_machines), "machineID": np.repeat(ids, n)})
    for s in SENSORS:
        lo, hi = SENSOR_RANGES[s]
        tel[s] = rng.normal((lo + hi) / 2, (hi - lo) / 20, len(tel))
    days = [60, 120, 180, 250, 270, 300, 320, 345]
    rows = []
    for m in ids:
        for d in days:
            at = START + pd.Timedelta(days=d + int(m) % 5, hours=int(rng.integers(0, 24)))
            rows.append((at, int(m), "comp1"))
    failures = pd.DataFrame(rows, columns=["datetime", "machineID", "failure"]).sort_values("datetime")
    failures = failures.reset_index(drop=True)
    for at, m, _ in failures.itertuples(index=False):
        sel = (
            (tel["machineID"] == m)
            & (tel["datetime"] >= at - pd.Timedelta(hours=24))
            & (tel["datetime"] < at)
        )
        tel.loc[sel, "vibration"] += 25.0
    errors = pd.DataFrame(
        {
            "datetime": hours[rng.integers(0, n, 300)],
            "machineID": rng.choice(ids, 300),
            "errorID": rng.choice(ERROR_TYPES, 300),
        }
    ).drop_duplicates()
    maint = pd.DataFrame(
        [(START - pd.Timedelta(days=40 + c), m, comp) for m in ids for c, comp in enumerate(COMPONENTS)],
        columns=["datetime", "machineID", "comp"],
    )
    machines = pd.DataFrame(
        {"machineID": ids, "model": [f"model{1 + i % 4}" for i in range(n_machines)], "age": (ids * 3) % 21}
    )
    return Tables(telemetry=tel, errors=errors, maint=maint, failures=failures, machines=machines)
