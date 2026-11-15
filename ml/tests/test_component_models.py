"""Component wear rule and warning inputs (spec step 2). Synthetic data only."""

import numpy as np
import pandas as pd

from ml.component_labels import build_component_frame
from ml.component_models import EDGES, RuleBaseline, wear_matrix
from ml.tests.test_component_labels import tiny


def wear_df(days: list[float], model: list[int]) -> pd.DataFrame:
    n = len(days)
    return pd.DataFrame(
        {"days_since_replacement": days, "machine_model": model, "age": [5] * n, "past_failures": [0] * n}
    )


def test_wear_matrix_columns() -> None:
    x = wear_matrix(wear_df([10.0, 100.0], [1, 4]))
    assert x.shape == (2, 8)
    assert list(x[:, 1]) == [1.0, 0.0]  # replaced 30 days ago or less
    assert list(np.argmax(x[:, 4:8], axis=1)) == [0, 3]


def test_rule_is_the_train_rate_per_model_and_bucket_with_fallbacks() -> None:
    df = wear_df([5.0, 5.0, 5.0, 5.0, 100.0, 100.0], [1, 1, 1, 2, 1, 1])
    y = np.array([1, 0, 0, 1, 1, 1])
    rule = RuleBaseline.fit(wear_matrix(df), y)
    test = wear_matrix(wear_df([10.0, 10.0, 90.0, 10.0, 300.0], [1, 2, 1, 3, 1]))
    got = rule.predict_raw(test)
    assert got[0] == 1 / 3 and got[1] == 1.0 and got[2] == 1.0  # cells seen in train
    assert got[3] == 2 / 4  # model 3 never seen in the <30-day bucket: bucket rate (2 of 4)
    assert got[4] == 1.0 / 1 * 1.0 or got[4] == 4 / 6  # bucket 240+ has no rows: overall rate
    assert got[4] == 4 / 6
    assert len(EDGES) + 1 == rule.rates.shape[1]


def test_training_build_has_no_test_rows() -> None:
    f = build_component_frame(tiny(), [2], "day14", True, ("train", "validation"))
    assert set(f["split"]) == {"train", "validation"}


def test_warning_matrix_has_every_column_once() -> None:
    from ml.component_models import WARNING_EXTRA, warning_matrix
    from ml.features import FEATURE_COLUMNS

    df = pd.DataFrame({c: [1.0, 2.0] for c in [*FEATURE_COLUMNS, *WARNING_EXTRA]})
    assert warning_matrix(df).shape == (2, len(FEATURE_COLUMNS) + len(WARNING_EXTRA))
    assert len(set(FEATURE_COLUMNS) & set(WARNING_EXTRA)) == 0
