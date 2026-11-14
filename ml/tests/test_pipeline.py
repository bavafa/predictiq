"""End-to-end on a small synthetic year: train, write once, verify, replay. No real data, no network."""

import copy
import hashlib
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pytest

from ml import evaluate, replay, train
from ml.artifacts import check_manifest, model_version, sha256_file, write_manifest
from ml.data import Tables
from ml.dataset import build_frame
from ml.tests.synthetic import make_year_tables

UNSEEN = [9, 10]
HASHES = {"PdM_telemetry.csv": "x"}
GIT = {"commit": "abc123", "dirty": False}
SMALL = copy.deepcopy(train.CONFIG)
SMALL["main"]["grid"] = {"max_depth": [2, 3], "n_estimators": [15]}


@pytest.fixture(scope="module")
def tables() -> Tables:
    return make_year_tables()


@pytest.fixture()
def version(tables: Tables, tmp_path: Path) -> Path:
    return train.train(tables, UNSEEN, tmp_path, HASHES, GIT, "20260101", config=SMALL)


def snapshot(d: Path) -> dict[str, tuple[str, int]]:
    return {p.name: (sha256_file(p), p.stat().st_mtime_ns) for p in d.iterdir()}


def test_unseen_machines_are_absent_from_training_and_validation_data(tables: Tables) -> None:
    f = build_frame(tables, UNSEEN, ("train", "validation", "test"))
    fit_rows = f[f["split"].isin(["train", "validation"])]
    assert not fit_rows["machineID"].isin(UNSEEN).any()
    assert fit_rows["machineID"].nunique() == 8
    test_rows = f[f["split"] == "test"]
    assert set(UNSEEN) <= set(test_rows["machineID"])  # unseen machines are scored on the test period


def test_training_never_builds_test_rows(tables: Tables) -> None:
    f = build_frame(tables, UNSEEN, ("train", "validation"))
    assert set(f["split"]) == {"train", "validation"}


def test_train_saves_the_documented_files_and_metadata(version: Path) -> None:
    names = {p.name for p in version.iterdir()}
    assert {
        "baseline.json",
        "main_xgboost.ubj",
        "metadata.json",
        "manifest.json",
        "feature_fingerprint.json",
    } <= names
    assert check_manifest(version) == []
    meta = json.loads((version / "metadata.json").read_text())
    assert meta["training"]["machines"] == 8
    assert version.name == model_version("20260101", HASHES, meta["config"], "abc123")
    assert meta["models"]["main"]["calibration"]["chosen"] in ("none", "sigmoid")
    assert 1 <= meta["models"]["baseline"]["default_cutoff"] <= 100
    assert "evaluation.json" not in names  # training never touches the test period


def test_model_version_format_and_inputs() -> None:
    v = model_version("20261114", HASHES, {"a": 1}, "c1")
    assert v.startswith("piq-20261114-") and len(v.split("-")[2]) == 8
    assert v != model_version("20261114", HASHES, {"a": 2}, "c1")
    assert v != model_version("20261114", HASHES, {"a": 1}, "c2")
    assert v != model_version("20261114", {"PdM_telemetry.csv": "y"}, {"a": 1}, "c1")


def test_training_is_deterministic(tables: Tables, tmp_path: Path) -> None:
    a = train.train(tables, UNSEEN, tmp_path / "a", HASHES, GIT, "20260101", config=SMALL)
    b = train.train(tables, UNSEEN, tmp_path / "b", HASHES, GIT, "20260101", config=SMALL)
    assert a.name == b.name
    for p in a.iterdir():
        assert sha256_file(p) == sha256_file(b / p.name), p.name


def test_write_once_then_refuses_and_leaves_the_file_untouched(version: Path, tables: Tables) -> None:
    path = evaluate.write(version, tables)
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    with pytest.raises(FileExistsError):
        evaluate.write(version, tables)
    assert hashlib.sha256(path.read_bytes()).hexdigest() == before
    assert check_manifest(version) == []
    assert "evaluation.json" in json.loads((version / "manifest.json").read_text())["sha256"]


def test_cli_write_refuses_when_evaluation_exists(
    version: Path, tables: Tables, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    evaluate.write(version, tables)
    monkeypatch.setattr("sys.argv", ["evaluate", "--write"])
    monkeypatch.setattr(evaluate, "resolve", lambda _v: version)
    assert evaluate.main() == 1
    assert "refused" in capsys.readouterr().err


def test_training_refuses_a_version_that_already_has_a_test_result(version: Path, tables: Tables) -> None:
    evaluate.write(version, tables)
    with pytest.raises(FileExistsError):
        train.train(tables, UNSEEN, version.parent, HASHES, GIT, "20260101", config=SMALL)


def test_evaluation_content_groups_and_counts(version: Path, tables: Tables) -> None:
    ev = json.loads(evaluate.write(version, tables).read_text())
    assert ev["simulated"] is True
    assert ev["test_window"] == {"start": "2015-11-01 00:00", "end": "2015-12-30 06:00", "hours": 1423}
    for name in ("baseline", "main"):
        g = ev["models"][name]["groups"]
        assert g["seen"]["n_machines"] == 8
        assert g["unseen"]["n_machines"] == 2
        assert g["all"]["n_machines"] == 10
        assert g["all"]["n_machine_hours"] == 10 * 1423
        assert g["seen"]["n_machine_hours"] + g["unseen"]["n_machine_hours"] == g["all"]["n_machine_hours"]
        assert g["seen"]["n_events_in_test"] + g["unseen"]["n_events_in_test"] == g["all"]["n_events_in_test"]
        a = g["all"]["at_default_cutoff"]
        assert a["tp"] + a["fp"] + a["fn"] + a["tn"] == 10 * 1423
        rows = g["all"]["threshold_analysis"]
        assert [r["cutoff"] for r in rows] == list(range(101))
        assert len(g["all"]["calibration_curve"]) == 10
        excluded = g["all"]["n_events_excluded_partial_lookback"]
        assert excluded == g["all"]["n_events_in_test"] - g["all"]["n_events_full_lookback"]
        assert rows[0]["recall"] == 1.0  # cut-off 0 alerts on everything


def test_verify_passes_and_writes_nothing(version: Path, tables: Tables) -> None:
    evaluate.write(version, tables)
    before = snapshot(version)
    assert evaluate.verify(version, tables) == []
    assert snapshot(version) == before


def _tamper(version: Path, edit: Callable[[dict[str, Any]], object]) -> None:
    path = version / "evaluation.json"
    ev = json.loads(path.read_text())
    edit(ev)
    path.write_text(json.dumps(ev, sort_keys=True, separators=(",", ":")) + "\n")


def test_verify_detects_a_changed_count(version: Path, tables: Tables) -> None:
    evaluate.write(version, tables)
    _tamper(version, lambda ev: ev["models"]["main"]["groups"]["all"]["at_default_cutoff"].update(tp=12345))
    problems = evaluate.verify(version, tables)
    assert any("/tp" in p for p in problems)
    assert any("manifest" in p for p in problems)  # the file no longer matches its saved hash


def test_verify_detects_a_changed_float_even_when_the_manifest_is_refreshed(
    version: Path, tables: Tables
) -> None:
    evaluate.write(version, tables)
    _tamper(version, lambda ev: ev["models"]["baseline"]["groups"]["seen"].update(brier=0.5))
    write_manifest(version)
    problems = evaluate.verify(version, tables)
    assert problems
    assert all("brier" in p for p in problems)


def test_verify_detects_a_changed_model(version: Path, tables: Tables) -> None:
    evaluate.write(version, tables)
    p = version / "baseline.json"
    d = json.loads(p.read_text())
    d["intercept"] += 1.0
    p.write_text(json.dumps(d, sort_keys=True))
    assert evaluate.verify(version, tables)  # manifest and metrics both disagree


def test_verify_without_a_written_evaluation_fails(version: Path, tables: Tables) -> None:
    assert evaluate.verify(version, tables) != []


def test_replay_start_branches() -> None:
    hours = pd.date_range("2015-11-01 00:00", periods=6, freq="h")
    s = np.zeros((2, 6))
    s[1, 3] = 0.6
    r = replay.replay_start(s, hours, 51)
    assert (r["start"], r["branch"]) == ("2015-11-01 03:00", replay.BRANCH_ALERT)
    s[0, 1] = 0.51  # exactly at the cut-off counts
    assert replay.replay_start(s, hours, 51)["start"] == "2015-11-01 01:00"
    none = replay.replay_start(np.zeros((2, 6)), hours, 51)
    assert (none["start"], none["branch"]) == ("2015-11-01 00:00", replay.BRANCH_NONE)
    assert none["end"] == "2015-12-30 06:00"


def test_replay_is_stored_in_metadata_and_checked_by_verify(version: Path, tables: Tables) -> None:
    evaluate.write(version, tables)
    meta_path = version / "metadata.json"
    meta = json.loads(meta_path.read_text())
    meta["replay"] = replay.compute_replay(version, None)  # from the saved score cache
    meta_path.write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    write_manifest(version)
    assert evaluate.verify(version, tables) == []
    meta["replay"]["start"] = "2015-12-01 00:00"
    meta_path.write_text(json.dumps(meta, indent=1, sort_keys=True) + "\n")
    write_manifest(version)
    assert any("replay" in p for p in evaluate.verify(version, tables))
