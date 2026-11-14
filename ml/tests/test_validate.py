import pandas as pd

from ml.data import Tables
from ml.tests.synthetic import START, make_tables
from ml.validate import check_recorded_counts, check_structure


def with_(t: Tables, **kw: pd.DataFrame) -> Tables:
    d = {
        "telemetry": t.telemetry,
        "errors": t.errors,
        "maint": t.maint,
        "failures": t.failures,
        "machines": t.machines,
    }
    d.update(kw)
    return Tables(**d)


def test_clean_synthetic_data_passes_structure_checks() -> None:
    assert check_structure(make_tables()) == []


def test_unknown_machine_id_fails() -> None:
    t = make_tables()
    errs = t.errors.copy()
    errs.loc[0, "machineID"] = 999
    assert any("not in machines" in p for p in check_structure(with_(t, errors=errs)))


def test_gap_in_hourly_steps_fails() -> None:
    t = make_tables()
    tel = t.telemetry.drop(index=10).reset_index(drop=True)
    assert any("1 hour" in p for p in check_structure(with_(t, telemetry=tel)))


def test_duplicate_machine_hour_fails() -> None:
    t = make_tables()
    tel = pd.concat([t.telemetry, t.telemetry.iloc[[5]]], ignore_index=True)
    assert any("duplicate machine-hour" in p for p in check_structure(with_(t, telemetry=tel)))


def test_blank_field_fails() -> None:
    t = make_tables()
    tel = t.telemetry.copy()
    tel.loc[3, "volt"] = float("nan")
    assert any("blank" in p for p in check_structure(with_(t, telemetry=tel)))


def test_out_of_range_value_fails() -> None:
    t = make_tables()
    tel = t.telemetry.copy()
    tel.loc[3, "pressure"] = 5000.0
    assert any("pressure" in p for p in check_structure(with_(t, telemetry=tel)))


def test_failure_without_telemetry_row_fails() -> None:
    t = make_tables()
    extra = pd.DataFrame(
        {"datetime": [START + pd.Timedelta(days=30)], "machineID": [1], "failure": ["comp1"]}
    )
    fail = pd.concat([t.failures, extra], ignore_index=True)
    assert check_structure(with_(t, failures=fail))


def test_identical_duplicate_failure_row_fails() -> None:
    t = make_tables()
    fail = pd.concat([t.failures, t.failures.iloc[[0]]], ignore_index=True)
    assert any("identical duplicate" in p for p in check_structure(with_(t, failures=fail)))


def test_recorded_counts_reject_synthetic_data() -> None:
    assert check_recorded_counts(make_tables())
