import numpy as np
import pandas as pd
import pytest

from ml.data import COMPONENTS, ERROR_TYPES, SENSORS, Tables
from ml.features import FEATURE_COLUMNS, build_features, feature_fingerprint
from ml.tests.synthetic import START, make_tables

H = pd.Timedelta(hours=1)


def one_machine(tables: Tables, t: pd.Timestamp) -> pd.Series:
    f = build_features(tables, pd.DatetimeIndex([t]))
    return f[f["machineID"] == 1].iloc[0]


def replace(t: Tables, **kw: pd.DataFrame) -> Tables:
    d = {
        "telemetry": t.telemetry,
        "errors": t.errors,
        "maint": t.maint,
        "failures": t.failures,
        "machines": t.machines,
    }
    d.update(kw)
    return Tables(**d)


def test_window_ends_at_t_minus_1h_and_matches_manual() -> None:
    tables = make_tables()
    t = START + 60 * H
    row = one_machine(tables, t)
    tel = tables.telemetry[tables.telemetry["machineID"] == 1].set_index("datetime")
    for s in SENSORS:
        w24 = tel.loc[t - 24 * H : t - H, s]
        w3 = tel.loc[t - 3 * H : t - H, s]
        assert len(w24) == 24 and len(w3) == 3
        assert row[f"{s}_last"] == tel.loc[t - H, s]
        assert row[f"{s}_mean_3h"] == pytest.approx(w3.mean())
        assert row[f"{s}_std_3h"] == pytest.approx(w3.std(ddof=0))
        assert row[f"{s}_mean_24h"] == pytest.approx(w24.mean())
        assert row[f"{s}_std_24h"] == pytest.approx(w24.std(ddof=0))
        assert row[f"{s}_slope_24h"] == pytest.approx(np.polyfit(np.arange(24), w24.to_numpy(), 1)[0])


def test_telemetry_stamped_at_t_is_not_used() -> None:
    tables = make_tables()
    t = START + 60 * H
    before = one_machine(tables, t)
    tel = tables.telemetry.copy()
    tel.loc[tel["datetime"] == t, list(SENSORS)] = 1e6
    after = one_machine(replace(tables, telemetry=tel), t)
    pd.testing.assert_series_equal(before, after)


def test_error_counts_window_and_as_of() -> None:
    tables = make_tables()
    t = START + 60 * H
    errs = pd.DataFrame(
        {
            "datetime": [t - 25 * H, t - 24 * H, t - H, t - H, t, t + H],
            "machineID": [1] * 6,
            "errorID": ["error1", "error1", "error2", "error2", "error2", "error2"],
        }
    )
    row = one_machine(replace(tables, errors=errs), t)
    assert row["error1_count_24h"] == 1  # t-24h is inside, t-25h is outside
    assert row["error2_count_24h"] == 2  # t-1h twice; the ones at t and later are not known yet
    assert all(row[f"{e}_count_24h"] == 0 for e in ERROR_TYPES[2:])


def test_hours_since_replacement_uses_strictly_earlier_records() -> None:
    tables = make_tables()
    t = START + 60 * H
    maint = pd.DataFrame(
        {
            "datetime": [t - 10 * H, t, t - 30 * H, t + 5 * H],
            "machineID": [1, 1, 1, 1],
            "comp": ["comp1", "comp1", "comp2", "comp2"],
        }
    )
    row = one_machine(replace(tables, maint=maint), t)
    assert row["hours_since_comp1"] == 10  # the record at t itself is not available
    assert row["hours_since_comp2"] == 30
    assert np.isnan(row["hours_since_comp3"]) and np.isnan(row["hours_since_comp4"])


def test_machine_features() -> None:
    row = one_machine(make_tables(), START + 60 * H)
    assert row["machine_model"] == 1 and row["age"] == 3


def test_failures_are_never_read() -> None:
    tables = make_tables()
    hours = pd.DatetimeIndex([START + 60 * H])
    a = build_features(tables, hours)
    b = build_features(replace(tables, failures=tables.failures.iloc[0:0]), hours)
    pd.testing.assert_frame_equal(a, b)


def test_columns_and_fingerprint() -> None:
    f = build_features(make_tables(), pd.DatetimeIndex([START + 30 * H]))
    assert list(f.columns) == ["machineID", "datetime", *FEATURE_COLUMNS]
    assert len(FEATURE_COLUMNS) == len(set(FEATURE_COLUMNS)) == 35
    assert not any("fail" in c for c in FEATURE_COLUMNS)
    assert len(feature_fingerprint()) == 12
    assert all(f"hours_since_{c}" in FEATURE_COLUMNS for c in COMPONENTS)


def test_warmup_hours_are_refused() -> None:
    tables = make_tables()
    with pytest.raises(ValueError, match="warm-up"):
        build_features(tables, pd.DatetimeIndex([START + 23 * H]))
    build_features(tables, pd.DatetimeIndex([START + 24 * H]))  # first allowed hour


def test_one_row_per_machine_and_hour_sorted() -> None:
    hours = pd.date_range(START + 24 * H, periods=10, freq="h")
    f = build_features(make_tables(), hours)
    assert len(f) == 3 * 10
    assert f.equals(f.sort_values(["machineID", "datetime"]).reset_index(drop=True))
