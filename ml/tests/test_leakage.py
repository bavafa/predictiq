"""The architecture's leakage test: randomise every row stamped at or after t in all tables, rebuild,
and assert the features at t (and before) are unchanged."""

import numpy as np
import pandas as pd
import pytest

from ml.data import COMPONENTS, ERROR_TYPES, SENSORS, Tables
from ml.features import build_features
from ml.tests.synthetic import START, make_tables

H = pd.Timedelta(hours=1)


def scramble_from(tables: Tables, t: pd.Timestamp, seed: int) -> Tables:
    """Randomise every record stamped at or after t: new values, new types, new times, extra rows."""
    rng = np.random.default_rng(seed)
    horizon = tables.telemetry["datetime"].max() + 48 * H

    def future_times(n: int) -> pd.Series:
        span = int((horizon - t) / H) + 1
        return pd.Series(t + pd.to_timedelta(rng.integers(0, span, n), unit="h"))

    tel = tables.telemetry.copy()
    late = (tel["datetime"] >= t).to_numpy()
    for s in SENSORS:
        tel.loc[late, s] = rng.normal(500.0, 300.0, int(late.sum()))

    def scramble(df: pd.DataFrame, col: str, values: tuple[str, ...], extra: int) -> pd.DataFrame:
        keep = df[df["datetime"] < t]
        n = int((df["datetime"] >= t).sum()) + extra
        new = pd.DataFrame(
            {
                "datetime": future_times(n).to_numpy(),
                "machineID": rng.choice(tables.machines["machineID"].to_numpy(), n),
                col: rng.choice(values, n),
            }
        )
        return pd.concat([keep, new], ignore_index=True)

    return Tables(
        telemetry=tel,
        errors=scramble(tables.errors, "errorID", ERROR_TYPES, 30),
        maint=scramble(tables.maint, "comp", COMPONENTS, 30),
        failures=scramble(tables.failures, "failure", COMPONENTS, 30),
        machines=tables.machines,
    )


@pytest.mark.parametrize("seed", range(5))
def test_features_at_t_unchanged_when_the_future_is_randomised(seed: int) -> None:
    tables = make_tables(n_machines=4, n_hours=120, seed=seed)
    rng = np.random.default_rng(100 + seed)
    for _ in range(4):
        t = START + int(rng.integers(24, 118)) * H
        hours = pd.date_range(START + 24 * H, t, freq="h")  # everything up to and including t
        base = build_features(tables, hours)
        shuffled = build_features(scramble_from(tables, t, seed), hours)
        pd.testing.assert_frame_equal(base, shuffled)


def test_leakage_test_has_power_a_change_before_t_is_detected() -> None:
    tables = make_tables(n_machines=4, n_hours=120, seed=1)
    t = START + 80 * H
    hours = pd.DatetimeIndex([t])
    base = build_features(tables, hours)
    # Randomising from t-1h on touches a record the model is allowed to see, so features must change.
    changed = build_features(scramble_from(tables, t - H, 1), hours)
    assert not base.equals(changed)
