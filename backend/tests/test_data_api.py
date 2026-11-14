"""Data endpoints against the synthetic bundle (same shapes as the real one, fake numbers)."""

from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from app import config
from app.bundle import Bundle
from fastapi.testclient import TestClient

V = "/api/v1"
START = "2015-11-01T00:00:00"
END = "2015-12-30T06:00:00"
MID = "2015-12-01T12:00:00"


def q(b: Bundle, **kw: str) -> str:
    return "&".join([f"mv={b.model_version}", *(f"{k}={v}" for k, v in kw.items())])


def data_urls(b: Bundle, at: str = MID) -> list[str]:
    return [
        f"{V}/fleet?{q(b, at=at)}",
        f"{V}/fleet/trend?{q(b, at=at, range='24h')}",
        f"{V}/assets/1?{q(b, at=at)}",
        f"{V}/assets/1/telemetry?{q(b, at=at, range='24h')}",
        f"{V}/assets/1/explanation?{q(b, at=at)}",
        f"{V}/model/metrics?{q(b)}",
        f"{V}/model/threshold-analysis?{q(b)}",
    ]


def test_without_a_bundle_data_endpoints_are_503_problem_json_and_never_cached(client: TestClient) -> None:
    for path in ("fleet", "fleet/trend", "assets/1", "assets/1/telemetry", "assets/1/explanation"):
        r = client.get(f"{V}/{path}?mv=x&at={START}")
        assert r.status_code == 503, path
        assert r.headers["content-type"].startswith("application/problem+json")
        assert r.headers["cache-control"] == "no-store"
    for path in ("model/metrics", "model/threshold-analysis"):
        assert client.get(f"{V}/{path}?mv=x").status_code == 503
    h = client.get(f"{V}/health").json()
    assert h == {"status": "ok", "model_version": None, "model_available": False}
    m = client.get(f"{V}/metadata").json()
    assert m["model_available"] is False and m["model_version"] is None and m["machines"] == []
    assert m["planner_defaults"]["label"] == "illustrative"


def test_a_broken_bundle_is_503_not_a_crash(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / "meta.json").write_text('{"schema": 99}')
    monkeypatch.setenv("PREDICTIQ_BUNDLE_DIR", str(tmp_path))
    r = client.get(f"{V}/fleet?mv=x&at={START}")
    assert r.status_code == 503 and r.headers["cache-control"] == "no-store"
    assert client.get(f"{V}/health").json()["model_available"] is False


def test_health_and_metadata_with_a_bundle(client: TestClient, with_bundle: Bundle) -> None:
    h = client.get(f"{V}/health")
    assert h.headers["cache-control"] == "no-store"
    assert h.json() == {"status": "ok", "model_version": with_bundle.model_version, "model_available": True}
    r = client.get(f"{V}/metadata")
    assert r.headers["cache-control"] == config.CACHE_METADATA
    m = r.json()
    assert m["synthetic"] is True  # a fake bundle always says so
    assert m["replay_window"] == {"start": START, "end": END, "status": "ready"}
    assert m["default_cutoff_percent"] == 51
    assert len(m["machines"]) == 100 and len(m["unseen_machines"]) == 20
    assert m["data_credit"].startswith("Data: Microsoft")
    assert set(m["splits"]) == {"train", "validation", "test"}
    assert m["planner_defaults"]["label"] == "illustrative" and m["planner_defaults"]["crew_slots"] == 5


def test_every_data_endpoint_is_200_with_the_cache_header(client: TestClient, with_bundle: Bundle) -> None:
    for url in data_urls(with_bundle):
        r = client.get(url)
        assert r.status_code == 200, url
        assert r.headers["cache-control"] == config.CACHE_DATA, url


def test_model_version_rule(client: TestClient, with_bundle: Bundle) -> None:
    for url in data_urls(with_bundle):
        base = url.split("?")[0]
        rest = "&".join(p for p in url.split("?")[1].split("&") if not p.startswith("mv="))
        missing = client.get(f"{base}?{rest}")
        assert missing.status_code == 400 and missing.headers["cache-control"] == "no-store", url
        other = client.get(f"{base}?mv=piq-19990101-deadbeef&{rest}")
        assert other.status_code == 404 and other.headers["cache-control"] == "no-store", url
        assert other.headers["content-type"].startswith("application/problem+json")


@pytest.mark.parametrize(
    "at",
    [
        "2015-10-31T23:00:00",  # before the window
        "2015-12-30T07:00:00",  # after the window
        "2015-11-01T00:30:00",  # not a whole hour
        "2015-11-01",
        "yesterday",
        "2015-02-30T00:00:00",
        "",
    ],
)
def test_at_outside_the_window_or_malformed_is_refused(
    client: TestClient, with_bundle: Bundle, at: str
) -> None:
    r = client.get(f"{V}/fleet?{q(with_bundle, at=at)}")
    assert r.status_code == 422 and r.headers["cache-control"] == "no-store"
    assert r.headers["content-type"].startswith("application/problem+json")
    assert at == "" or at not in r.text  # the message never echoes the input


def test_at_is_required_and_edges_are_inclusive(client: TestClient, with_bundle: Bundle) -> None:
    assert client.get(f"{V}/fleet?{q(with_bundle)}").status_code == 422
    for at in (START, END, "2015-11-01T00:00", "2015-12-30T06:00"):
        assert client.get(f"{V}/fleet?{q(with_bundle, at=at)}").status_code == 200, at


@pytest.mark.parametrize("cutoff", ["101", "-1", "50.5", "abc", "1e1", "", "1000", " 5"])
def test_cutoff_must_be_a_whole_percent_0_to_100(
    client: TestClient, with_bundle: Bundle, cutoff: str
) -> None:
    r = client.get(f"{V}/fleet?{q(with_bundle, at=MID, cutoff=cutoff)}")
    assert r.status_code == 422, cutoff


def test_cutoff_edges_and_default(client: TestClient, with_bundle: Bundle) -> None:
    low = client.get(f"{V}/fleet?{q(with_bundle, at=MID, cutoff='0')}").json()
    high = client.get(f"{V}/fleet?{q(with_bundle, at=MID, cutoff='100')}").json()
    default = client.get(f"{V}/fleet?{q(with_bundle, at=MID)}").json()
    assert low["cards"]["machines_in_alert"] == 100  # every score is >= 0
    assert high["cards"]["machines_in_alert"] == 0
    assert default["cutoff_percent"] == 51


@pytest.mark.parametrize("machine", ["0", "101", "abc", "-1", "1.5", "007x"])
def test_machine_outside_1_to_100_is_404(client: TestClient, with_bundle: Bundle, machine: str) -> None:
    for tail in ("", "/telemetry", "/explanation"):
        r = client.get(f"{V}/assets/{machine}{tail}?{q(with_bundle, at=MID)}")
        assert r.status_code == 404 and r.headers["cache-control"] == "no-store", (machine, tail)
    assert client.get(f"{V}/fleet?{q(with_bundle, at=MID, machine=machine)}").status_code == 404


def test_machines_1_and_100_exist(client: TestClient, with_bundle: Bundle) -> None:
    for m in (1, 100):
        assert client.get(f"{V}/assets/{m}?{q(with_bundle, at=MID)}").status_code == 200


def test_fleet_rows_ranking_cards_and_distribution(client: TestClient, with_bundle: Bundle) -> None:
    body = client.get(f"{V}/fleet?{q(with_bundle, at=MID, cutoff='20')}").json()
    rows = body["rows"]
    assert len(rows) == 100 and [r["rank"] for r in rows] == list(range(1, 101))
    keys = [(-r["score"], r["machine_id"]) for r in rows]
    assert keys == sorted(keys)
    alerts = [r for r in rows if r["status"] == "alert"]
    assert body["cards"]["machines_in_alert"] == len(alerts) > 0
    assert all(r["score"] >= 0.2 for r in alerts) and all(r["score"] < 0.2 for r in rows if r not in alerts)
    assert body["cards"]["machines_shown"] == 100 and body["cards"]["highest_score"] == rows[0]["score"]
    assert sum(b["count"] for b in body["distribution"]) == 100 and len(body["distribution"]) == 10
    # the stored score is what is served
    i = with_bundle.hour_index(datetime.fromisoformat(MID))
    top = rows[0]["machine_id"] - 1
    assert rows[0]["score"] == pytest.approx(float(with_bundle.scores["main"][top, i]), abs=1e-6)


def test_fleet_filters_narrow_rows_and_cards_together(client: TestClient, with_bundle: Bundle) -> None:
    body = client.get(f"{V}/fleet?{q(with_bundle, at=MID, cutoff='20', machine_model='model2')}").json()
    assert body["rows"] and all(r["model"] == "model2" for r in body["rows"])
    assert body["cards"]["machines_shown"] == len(body["rows"])
    alert_only = client.get(f"{V}/fleet?{q(with_bundle, at=MID, cutoff='20', status='alert')}").json()
    assert all(r["status"] == "alert" for r in alert_only["rows"])
    assert alert_only["cards"]["machines_in_alert"] == len(alert_only["rows"])
    one = client.get(f"{V}/fleet?{q(with_bundle, at=MID, machine='7')}").json()
    assert [r["machine_id"] for r in one["rows"]] == [7]
    none = client.get(f"{V}/fleet?{q(with_bundle, at=MID, machine_model='model1', machine='2')}").json()
    assert none["rows"] == [] and none["cards"]["highest_score"] is None
    for bad in ("machine_model=model9", "status=watch"):
        assert client.get(f"{V}/fleet?{q(with_bundle, at=MID)}&{bad}").status_code == 422


def test_trend_points_count_and_clipping(client: TestClient, with_bundle: Bundle) -> None:
    day = client.get(f"{V}/fleet/trend?{q(with_bundle, at=MID, range='24h')}").json()
    week = client.get(f"{V}/fleet/trend?{q(with_bundle, at=MID, range='7d')}").json()
    assert len(day["points"]) == 24 and len(week["points"]) == 168
    assert week["points"][-1]["hour"] == MID and day["points"][0]["hour"] == "2015-11-30T13:00:00"
    first = client.get(f"{V}/fleet/trend?{q(with_bundle, at=START, range='7d')}").json()
    assert len(first["points"]) == 1  # no scores exist before the first scored hour
    fleet = client.get(f"{V}/fleet?{q(with_bundle, at=MID)}").json()
    assert day["points"][-1]["machines_in_alert"] == fleet["cards"]["machines_in_alert"]
    assert client.get(f"{V}/fleet/trend?{q(with_bundle, at=MID, range='30d')}").status_code == 422


def test_asset_records_are_stamped_strictly_before_at(client: TestClient, with_bundle: Bundle) -> None:
    at = datetime.fromisoformat(MID)
    seen = 0
    for m in range(1, 101):
        body = client.get(f"{V}/assets/{m}?{q(with_bundle, at=MID)}").json()
        for key in ("errors", "repairs", "failures"):
            for rec in body[key]:
                t = datetime.fromisoformat(rec["time"])
                assert at - timedelta(days=7) <= t < at, (m, key, rec)
                seen += 1
        assert body["past_estimates"][-1]["hour"] == MID and len(body["past_estimates"]) == 168
    assert seen > 0


def test_asset_at_exact_record_hour_excludes_that_record(client: TestClient, with_bundle: Bundle) -> None:
    # a record stamped exactly at `at` was not known to the model, so it must not appear
    floor = datetime.fromisoformat("2015-11-10T00:00:00")
    m, h = next(
        (m, h)
        for m, rows in with_bundle.errors.items()
        for h, _ in rows
        if with_bundle.tel_hour_at(h) >= floor
    )
    t = with_bundle.tel_hour_at(h)
    body = client.get(f"{V}/assets/{m}?{q(with_bundle, at=t.isoformat())}").json()
    assert t.isoformat() not in [e["time"] for e in body["errors"]]
    later = client.get(f"{V}/assets/{m}?{q(with_bundle, at=(t + timedelta(hours=1)).isoformat())}").json()
    assert t.isoformat() in [e["time"] for e in later["errors"]]


def test_telemetry_rows_end_just_before_at(client: TestClient, with_bundle: Bundle) -> None:
    day = client.get(f"{V}/assets/3/telemetry?{q(with_bundle, at=MID, range='24h')}").json()
    week = client.get(f"{V}/assets/3/telemetry?{q(with_bundle, at=MID, range='7d')}").json()
    assert len(day["rows"]) == 24 and len(week["rows"]) == 168
    assert day["rows"][-1]["hour"] == "2015-12-01T11:00:00"  # the hour before `at`
    assert set(day["rows"][0]) == {"hour", "volt", "rotate", "pressure", "vibration"}
    first = client.get(f"{V}/assets/3/telemetry?{q(with_bundle, at=START, range='7d')}").json()
    assert len(first["rows"]) == 168 and first["rows"][0]["hour"] == "2015-10-25T00:00:00"
    assert client.get(f"{V}/assets/3/telemetry?{q(with_bundle, at=MID, range='1h')}").status_code == 422


def test_explanation_is_top_8_plus_others(client: TestClient, with_bundle: Bundle) -> None:
    body = client.get(f"{V}/assets/5/explanation?{q(with_bundle, at=MID)}").json()
    assert len(body["contributions"]) == 8 and "all_others" in body
    assert body["unit"] == "log-odds" and "not proven causes" in body["caveat"]
    assert all(c["feature"] in with_bundle.meta["features"] for c in body["contributions"])


def test_model_metrics_and_threshold_analysis(client: TestClient, with_bundle: Bundle) -> None:
    metrics = client.get(f"{V}/model/metrics?{q(with_bundle)}").json()
    assert set(metrics["models"]) == {"baseline", "main"}
    thr = client.get(f"{V}/model/threshold-analysis?{q(with_bundle)}").json()
    assert [r["cutoff"] for r in thr["models"]["main"]["all"]] == list(range(101))


def test_scores_are_what_the_bundle_stores(with_bundle: Bundle) -> None:
    s = np.asarray(with_bundle.scores["main"])
    assert s.dtype == np.float32 and s.shape == (100, 1423)
