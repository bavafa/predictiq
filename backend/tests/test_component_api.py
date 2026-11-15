"""Component level of POST /plan and GET /assets/{id}/components (spec step 3; decisions 77, 79).

Synthetic bundle with component scores. The answers are recomputed from the saved arrays by plain floats."""

from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from app import bundle as reader
from app.bundle import Bundle
from fastapi.testclient import TestClient

from ml.bundle import synthetic_bundle

V = "/api/v1"
AT = "2015-12-01T12:00:00"
BODY: dict[str, Any] = {
    "level": "component",
    "at": AT,
    "horizon_days": 14,
    "failure_cost": 5000,
    "planned_cost": 1000,
    "crew_slots": 3,
}


@pytest.fixture(scope="session")
def comp_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    out = tmp_path_factory.mktemp("comp") / "bundle"
    synthetic_bundle(out, with_components=True)
    return out


@pytest.fixture()
def cb(monkeypatch: pytest.MonkeyPatch, comp_dir: Path) -> Bundle:
    monkeypatch.setenv(reader.ENV_DIR, str(comp_dir))
    reader.clear_cache()
    b = reader.get_bundle()
    assert b is not None and b.components is not None
    return b


def post(client: TestClient, b: Bundle, body: object) -> Any:
    return client.post(f"{V}/plan?mv={b.model_version}", json=body)


def test_component_plan_shape_labels_and_order(client: TestClient, cb: Bundle) -> None:
    r = post(client, cb, BODY)
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    d = r.json()
    assert d["level"] == "component" and d["label"] == "illustrative" and d["horizon_days"] == 14
    assert "wear estimate" in d["honesty"] and "not an early warning" in d["honesty"]
    assert "assumed" in d["windows_note"].lower() and "Illustrative names" in d["names_note"]
    rows = d["rows"]
    assert 0 < len(rows) <= 100 and [x["rank"] for x in rows] == list(range(1, len(rows) + 1))
    exposures = [x["expected_exposure"] for x in rows]
    assert exposures == sorted(exposures, reverse=True)
    assert d["summary"]["parts_ranked"] <= 400 and d["summary"]["rows_returned"] == len(rows)
    assert {x["part_name"] for x in rows} <= {"Motor winding", "Bearing", "Seal / valve", "Coupling"}


def test_rows_match_the_saved_scores(client: TestClient, cb: Bundle) -> None:
    c = cb.components
    assert c is not None
    d = post(client, cb, BODY).json()
    at = datetime(2015, 12, 1, 12)
    idx, day = cb.hour_index(at), c.day_index(at)
    for x in d["rows"][:20]:
        m, k = x["machine_id"] - 1, c.parts.index(x["part"])
        assert x["wear_chance"] == pytest.approx(float(np.round(c.wear[1, m, day, k], 6)))
        assert x["warning_chance_48h"] == pytest.approx(float(np.round(c.warning[m, idx, k], 6)))
        assert x["days_since_replacement"] == pytest.approx(float(c.since[m, day, k]), abs=0.01)
        assert x["expected_exposure"] == pytest.approx(
            x["chance_before_window"] * x["failure_cost"], abs=1e-4
        )
        assert 0.0 <= x["chance_before_window"] <= 1.0


def test_slots_are_per_window(client: TestClient, cb: Bundle) -> None:
    d = post(client, cb, {**BODY, "crew_slots": 2}).json()
    assert d["summary"]["slots_used"] == sum(w["shortlisted"] for w in d["summary"]["windows"])
    assert all(w["shortlisted"] <= 2 for w in d["summary"]["windows"])
    assert len(d["summary"]["windows"]) == 4  # one assumed window per machine model
    shortlisted = [x for x in d["rows"] if x["listing"] == "shortlisted"]
    assert all(x["slot"] in (1, 2) for x in shortlisted)


def test_zero_slots_shortlists_nobody(client: TestClient, cb: Bundle) -> None:
    d = post(client, cb, {**BODY, "crew_slots": 0}).json()
    assert d["summary"]["slots_used"] == 0 and d["summary"]["planned_spend"] == 0
    assert all(x["slot"] is None for x in d["rows"])


def test_horizon_changes_the_numbers_and_default_is_14(client: TestClient, cb: Bundle) -> None:
    body = {k: v for k, v in BODY.items() if k != "horizon_days"}
    assert post(client, cb, body).json() == post(client, cb, BODY).json()
    seven = post(client, cb, {**BODY, "horizon_days": 7}).json()
    assert seven["horizon_days"] == 7 and seven["rows"] != post(client, cb, BODY).json()["rows"]


def test_per_part_costs_and_reduction(client: TestClient, cb: Bundle) -> None:
    body = {**BODY, "failure_cost_by_part": {"comp2": 9000}, "risk_reduction_percent": 50}
    d = post(client, cb, body).json()
    assert d["summary"]["net_benefit_label"] == "Expected net benefit (estimate)"
    assert all(x["failure_cost"] == (9000 if x["part"] == "comp2" else 5000) for x in d["rows"])
    assert d == post(client, cb, body).json()  # deterministic


@pytest.mark.parametrize(
    "patch",
    [
        {"cutoff_percent": 10},  # no cut-off for the wear view
        {"include_below_cutoff": True},
        {"horizon_days": 5},
        {"horizon_days": "14"},
        {"horizon_days": 14.0},
        {"horizon_days": True},
        {"failure_cost_by_part": {"comp9": 1}},
        {"failure_cost_by_part": {"comp1": -1}},
        {"failure_cost_by_model": {"model1": 1}},
        {"crew_slots": 101},
        {"risk_reduction_percent": 7},
        {"at": "2015-10-01T00:00"},
        {"level": "parts"},
    ],
)
def test_component_body_is_strict(client: TestClient, cb: Bundle, patch: dict[str, Any]) -> None:
    r = post(client, cb, {**BODY, **patch})
    assert r.status_code == 422 and r.headers["content-type"].startswith("application/problem+json")


def test_missing_required_field(client: TestClient, cb: Bundle) -> None:
    assert post(client, cb, {k: v for k, v in BODY.items() if k != "crew_slots"}).status_code == 422


def test_machine_plan_refuses_component_fields_and_default_is_machine(client: TestClient, cb: Bundle) -> None:
    machine = {"at": AT, "failure_cost": 5000, "planned_cost": 1000, "crew_slots": 3}
    assert post(client, cb, machine).json().get("level") is None
    assert post(client, cb, {**machine, "level": "machine"}).status_code == 200
    assert post(client, cb, {**machine, "horizon_days": 14}).status_code == 422


def test_component_plan_without_component_scores_is_503(client: TestClient, with_bundle: Bundle) -> None:
    r = post(client, with_bundle, BODY)
    assert r.status_code == 503 and r.json()["title"] == "Component data unavailable"


def test_assets_components(client: TestClient, cb: Bundle) -> None:
    r = client.get(f"{V}/assets/7/components?mv={cb.model_version}&at={AT}")
    assert r.status_code == 200 and "max-age" in r.headers["cache-control"]
    d = r.json()
    assert d["machine_id"] == 7 and d["horizon_days"] == 14 and len(d["parts"]) == 4
    assert [p["part"] for p in d["parts"]] == ["comp1", "comp2", "comp3", "comp4"]
    assert all(0 <= p["chance_before_window"] <= 1 for p in d["parts"])
    assert "wear estimate" in d["honesty"]
    plan_row = {
        (x["machine_id"], x["part"]): x for x in post(client, cb, {**BODY, "crew_slots": 100}).json()["rows"]
    }
    for p in d["parts"]:  # same numbers as the planner row for the same machine, part and hour
        if (7, p["part"]) in plan_row:
            assert plan_row[(7, p["part"])]["chance_before_window"] == pytest.approx(
                p["chance_before_window"], abs=1e-6
            )


@pytest.mark.parametrize(
    ("query", "status"),
    [
        ("mv=current&at=2015-12-01T12:00&horizon_days=7", 200),
        ("mv=current&at=2015-12-01T12:00&horizon_days=9", 422),
        ("mv=current&at=2015-12-01T12:00&horizon_days=abc", 422),
        ("mv=current&horizon_days=7", 422),
        ("at=2015-12-01T12:00", 400),
        ("mv=other&at=2015-12-01T12:00", 404),
    ],
)
def test_assets_components_params(client: TestClient, cb: Bundle, query: str, status: int) -> None:
    q = query.replace("mv=current", f"mv={cb.model_version}")
    assert client.get(f"{V}/assets/3/components?{q}").status_code == status


def test_assets_components_bad_machine_and_missing_data(
    client: TestClient, cb: Bundle, monkeypatch: pytest.MonkeyPatch, synthetic_dir: Path
) -> None:
    q = f"mv={cb.model_version}&at={AT}"
    assert client.get(f"{V}/assets/0/components?{q}").status_code == 404
    assert client.get(f"{V}/assets/101/components?{q}").status_code == 404
    monkeypatch.setenv(reader.ENV_DIR, str(synthetic_dir))
    reader.clear_cache()
    plain = reader.get_bundle()
    assert plain is not None
    assert client.get(f"{V}/assets/3/components?mv={plain.model_version}&at={AT}").status_code == 503


def test_metadata_carries_component_facts_only_with_components(
    client: TestClient, cb: Bundle, monkeypatch: pytest.MonkeyPatch, synthetic_dir: Path
) -> None:
    info = client.get(f"{V}/metadata").json()["component_planner"]
    assert info["default_horizon_days"] == 14 and info["horizons_days"] == [7, 14]
    assert set(info["shutdown_windows"]) == {"model1", "model2", "model3", "model4"}
    assert "Assumed" in info["windows_note"] and "Illustrative" in info["names_note"]
    monkeypatch.setenv(reader.ENV_DIR, str(synthetic_dir))
    reader.clear_cache()
    assert client.get(f"{V}/metadata").json()["component_planner"] is None


def test_bundle_without_component_files_still_loads(with_bundle: Bundle) -> None:
    assert with_bundle.components is None
