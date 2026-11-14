"""Serving bundle: parity with the saved model, no look-ahead in stored records, packing, synthetic marker."""

import copy
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from app import bundle as reader

from ml import bundle as mb
from ml import evaluate, replay, train
from ml.artifacts import latest_version, write_manifest
from ml.data import load_tables
from ml.models import Calibrator
from ml.scoring import compute_test_scores
from ml.tests.synthetic import make_year_tables

SMALL = copy.deepcopy(train.CONFIG)
SMALL["main"]["grid"] = {"max_depth": [2], "n_estimators": [15]}
UNSEEN = [9, 10]


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    tables = make_year_tables()
    root = tmp_path_factory.mktemp("art")
    vdir = train.train(tables, UNSEEN, root, {"x": "y"}, {"commit": "abc", "dirty": False}, "20260101", SMALL)
    evaluate.write(vdir, tables)
    meta = json.loads((vdir / "metadata.json").read_text())
    meta["replay"] = replay.compute_replay(vdir, tables)
    (vdir / "metadata.json").write_text(json.dumps(meta))
    write_manifest(vdir)
    out = vdir / "bundle"
    mb.build_real(vdir, tables, out)
    return vdir, out


def test_stored_scores_equal_the_saved_model_on_freshly_built_features(built: tuple[Path, Path]) -> None:
    vdir, out = built
    fresh = compute_test_scores(vdir, make_year_tables())
    b = reader.load_bundle(out)
    for name in ("baseline", "main"):
        np.testing.assert_array_equal(np.asarray(b.scores[name]), fresh.scores[name].astype(np.float32))


def test_explanations_add_up_to_the_stored_score(built: tuple[Path, Path]) -> None:
    vdir, out = built
    b = reader.load_bundle(out)
    base = b.meta["contribution"]["base_value"]
    margin = base + np.asarray(b.values, dtype=np.float64).sum(axis=2) + np.asarray(b.other, dtype=np.float64)
    cal = Calibrator.from_json(json.loads((vdir / "main_calibration.json").read_text()))
    np.testing.assert_allclose(cal.apply(1 / (1 + np.exp(-margin))), np.asarray(b.scores["main"]), atol=1e-4)
    mag = np.abs(np.asarray(b.values))
    assert (np.diff(mag, axis=2) <= 1e-6).all()  # largest push first
    assert b.codes.max() < len(b.meta["features"])


def test_records_and_telemetry_stay_inside_the_window(built: tuple[Path, Path]) -> None:
    _, out = built
    b = reader.load_bundle(out)
    n_t = b.telemetry.shape[1]
    assert n_t == 168 + b.n_hours - 1  # 7 days before the test, then every hour before the last scored hour
    for records in (b.errors, b.repairs, b.failures):
        assert all(0 <= h < n_t for rows in records.values() for h, _ in rows)
    tables = make_year_tables()
    start = pd.Timestamp(b.tel_start)
    m1 = tables.telemetry[tables.telemetry["machineID"] == 1].set_index("datetime")
    t = start + pd.Timedelta(hours=5)
    assert b.telemetry[0, 5, 0] == np.float32(float(m1["volt"].loc[t]))


def test_meta_has_what_the_service_needs(built: tuple[Path, Path]) -> None:
    _, out = built
    meta = json.loads((out / "meta.json").read_text())
    assert meta["synthetic"] is False
    assert meta["unseen_machines"] == UNSEEN
    assert meta["model_version"].startswith("piq-")
    assert meta["replay"]["start"] == "2015-11-01T00:00:00" and meta["replay"]["end"] == "2015-12-30T06:00:00"
    assert "threshold_analysis" not in json.dumps(json.loads((out / "evaluation.json").read_text()))
    assert len(json.loads((out / "threshold_analysis.json").read_text())["models"]["main"]["all"]) == 101


def test_zip_is_reproducible_and_holds_only_the_bundle_files(
    built: tuple[Path, Path], tmp_path: Path
) -> None:
    _, out = built
    a, b = mb.pack(out, tmp_path / "a.zip"), mb.pack(out, tmp_path / "b.zip")
    assert a["sha256"] == b["sha256"]
    with zipfile.ZipFile(tmp_path / "a.zip") as z:
        assert sorted(z.namelist()) == sorted(mb.BUNDLE_FILES)


def test_synthetic_bundle_is_marked_and_loads_through_the_reader(tmp_path: Path) -> None:
    meta = mb.synthetic_bundle(tmp_path, n_machines=12, n_hours=200)
    assert meta["synthetic"] is True
    b = reader.load_bundle(tmp_path)
    assert b.synthetic and b.n_machines == 12 and b.n_hours == 200


def test_data_credit_is_the_approved_line() -> None:
    text = (Path(__file__).resolve().parents[2] / "docs" / "DATA_PROVENANCE.md").read_text()
    assert mb.DATA_CREDIT in text


@pytest.mark.realdata
def test_real_bundle_scores_equal_the_saved_model() -> None:
    vdir = latest_version()
    out = vdir / "bundle"
    if not (out / "meta.json").exists():
        pytest.skip("no real bundle built (run scripts/build_bundle.py)")
    fresh = compute_test_scores(vdir, load_tables())
    b = reader.load_bundle(out)
    assert b.model_version == vdir.name and not b.synthetic
    for name in ("baseline", "main"):
        np.testing.assert_array_equal(np.asarray(b.scores[name]), fresh.scores[name].astype(np.float32))
