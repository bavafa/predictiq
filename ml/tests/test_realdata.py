"""Opt-in: runs on the real downloaded files. `pytest -m realdata` (skipped when data/raw is missing)."""

import pytest

from ml.data import RAW_DIR, Tables
from ml.features import FEATURE_COLUMNS, build_features
from ml.labels import events_from_failures, scored_hours
from ml.splits import assign_split, event_counts
from ml.validate import validate

pytestmark = pytest.mark.realdata

FILES = ["PdM_telemetry.csv", "PdM_errors.csv", "PdM_maint.csv", "PdM_failures.csv", "PdM_machines.csv"]


@pytest.fixture(scope="module")
def tables() -> Tables:
    if not all((RAW_DIR / f).exists() for f in FILES):
        pytest.skip("data/raw is missing; run `make data`")
    t, problems = validate()
    assert problems == []
    assert t is not None
    return t


def test_validate_and_recorded_counts(tables: Tables) -> None:
    assert len(tables.failures) == 761
    assert len(events_from_failures(tables.failures)) == 719


def test_architecture_data_facts(tables: Tables) -> None:
    c = event_counts(events_from_failures(tables.failures))
    assert (c["before_first_scored_hour"], c["train"], c["embargo_1"], c["validation"]) == (17, 473, 3, 109)
    assert (c["embargo_2"], c["test"], c["after_last_test_hour"]) == (3, 110, 4)
    assert c["test_full_lookback"] == 107
    assert c["label_some_test_hour"] == 114


def test_test_machine_hours_and_features_complete(tables: Tables) -> None:
    f = build_features(tables, scored_hours())
    assert len(f) == 868_900
    assert int((assign_split(f["datetime"]) == "test").sum()) == 142_300
    assert not f[FEATURE_COLUMNS].isna().any().any()
