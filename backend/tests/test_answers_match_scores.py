"""Answers tested against the saved scores (story "Data service": "Answers are tested against saved scores").

For sampled hours and cut-offs, /fleet and /assets/{id} are compared with the bundle's arrays read directly,
by an independent computation here (not the service's own code path). Runs on the synthetic bundle in CI and,
opt-in (`pytest -m realbundle`), on the real bundle in artifacts/<version>/bundle."""

import json
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from app import bundle as reader
from fastapi.testclient import TestClient

V = "/api/v1"
ROOT = Path(__file__).resolve().parents[2]
CUTOFFS = (0, 1, 27, 51, 63, 99, 100)


def _real_dir() -> Path | None:
    for meta in sorted(ROOT.glob("artifacts/piq-*/bundle/meta.json"), reverse=True):
        if json.loads(meta.read_text()).get("synthetic") is False:
            return meta.parent
    return None


@pytest.fixture(params=["synthetic", pytest.param("real", marks=pytest.mark.realbundle)])
def served(
    request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch, synthetic_dir: Path
) -> reader.Bundle:
    folder = synthetic_dir
    if request.param == "real":
        real = _real_dir()
        if real is None:
            pytest.skip("no real bundle in artifacts/ (run scripts/fetch_bundle.py or build_bundle.py)")
        folder = real
    monkeypatch.setenv(reader.ENV_DIR, str(folder))
    reader.clear_cache()
    b = reader.get_bundle()
    assert b is not None
    return b


def sample_hours(b: reader.Bundle) -> list[int]:
    """First, last, a mid-window hour and a seeded spread (hour indices on the test grid)."""
    rng = np.random.default_rng(7)
    picks = {b.first_index, b.last_index, (b.first_index + b.last_index) // 2}
    picks |= {int(i) for i in rng.integers(b.first_index, b.last_index + 1, 9)}
    return sorted(picks)


def served_score(raw: np.ndarray, machine_row: int, hour: int) -> float:
    """The rule from decision 56: the stored float32, served rounded to 6 decimals."""
    return round(float(raw[machine_row, hour]), 6)


def url(b: reader.Bundle, path: str, **kw: object) -> str:
    query = "&".join([f"mv={b.model_version}", *(f"{k}={v}" for k, v in kw.items())])
    return f"{V}/{path}?{query}"


def at_text(b: reader.Bundle, hour: int) -> str:
    return b.hour_at(hour).strftime("%Y-%m-%dT%H:%M:%S")


def test_fleet_matches_the_saved_scores(client: TestClient, served: reader.Bundle) -> None:
    raw = np.asarray(served.scores["main"])
    for hour in sample_hours(served):
        for cutoff in CUTOFFS:
            body = client.get(url(served, "fleet", at=at_text(served, hour), cutoff=cutoff)).json()
            expected = {m + 1: served_score(raw, m, hour) for m in range(raw.shape[0])}
            assert {r["machine_id"]: r["score"] for r in body["rows"]} == expected, (hour, cutoff)
            for r in body["rows"]:
                want = "alert" if expected[r["machine_id"]] >= cutoff / 100 else "below_cutoff"
                assert r["status"] == want, (hour, cutoff, r["machine_id"])
            ranked = sorted(expected.items(), key=lambda kv: (-kv[1], kv[0]))
            assert [r["machine_id"] for r in body["rows"]] == [m for m, _ in ranked], (hour, cutoff)
            n_alert = sum(1 for v in expected.values() if v >= cutoff / 100)
            assert body["cards"]["machines_in_alert"] == n_alert
            assert n_alert == sum(1 for r in body["rows"] if r["status"] == "alert")
            assert body["cards"]["highest_score"] == ranked[0][1]
            assert sum(b["count"] for b in body["distribution"]) == len(expected)


def test_trend_matches_the_saved_scores(client: TestClient, served: reader.Bundle) -> None:
    raw = np.asarray(served.scores["main"])
    for hour in sample_hours(served):
        for cutoff in (27, 51, 80):
            body = client.get(url(served, "fleet/trend", at=at_text(served, hour), cutoff=cutoff)).json()
            for p in body["points"]:
                h = served.hour_index(datetime.fromisoformat(p["hour"]))
                n = sum(1 for m in range(raw.shape[0]) if served_score(raw, m, h) >= cutoff / 100)
                assert p["machines_in_alert"] == n, (hour, cutoff, p["hour"])
            assert body["points"][-1]["hour"] == at_text(served, hour)


def test_asset_matches_the_saved_scores_and_history(client: TestClient, served: reader.Bundle) -> None:
    raw = np.asarray(served.scores["main"])
    for hour in sample_hours(served):
        at = served.hour_at(hour)
        for m in (1, 2, 37, 99, 100):
            for cutoff in (27, 51):
                body = client.get(url(served, f"assets/{m}", at=at_text(served, hour), cutoff=cutoff)).json()
                score = served_score(raw, m - 1, hour)
                assert body["score"] == score
                assert body["status"] == ("alert" if score >= cutoff / 100 else "below_cutoff")
                # past estimates are the saved scores of the preceding hours, ending at `at` itself
                lo = max(hour - 167, 0)
                assert [p["score"] for p in body["past_estimates"]] == [
                    served_score(raw, m - 1, h) for h in range(lo, hour + 1)
                ]
                # every record is stamped strictly before `at`, within the 7 days before it
                for key in ("errors", "repairs", "failures"):
                    for rec in body[key]:
                        assert at - timedelta(days=7) <= datetime.fromisoformat(rec["time"]) < at


def test_asset_and_fleet_agree_on_the_same_machine(client: TestClient, served: reader.Bundle) -> None:
    hour = (served.first_index + served.last_index) // 2
    fleet = client.get(url(served, "fleet", at=at_text(served, hour), cutoff=40)).json()
    for row in fleet["rows"][:5]:
        a = client.get(url(served, f"assets/{row['machine_id']}", at=at_text(served, hour), cutoff=40)).json()
        assert (a["score"], a["status"], a["model"], a["age"]) == (
            row["score"],
            row["status"],
            row["model"],
            row["age"],
        )
