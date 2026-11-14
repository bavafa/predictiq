import re
from pathlib import Path

from app import config
from app.main import app, create_app
from fastapi import FastAPI
from fastapi.testclient import TestClient

client = TestClient(app, raise_server_exceptions=False)
ROOT = Path(__file__).resolve().parents[2]


def test_health_ok_and_never_cached() -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert r.json() == {"status": "ok", "model_version": None, "model_available": False}


def test_metadata_has_no_fake_model_fields() -> None:
    r = client.get("/api/v1/metadata")
    assert r.status_code == 200
    body = r.json()
    assert body["model_version"] is None
    assert body["model_available"] is False
    assert body["app_name"] == "PredictIQ"
    assert body["dataset"]["simulated"] is True
    assert body["dataset"]["source"] == "https://github.com/microsoft/sqlworkshops"
    # No metrics, scores, cut-offs or machine data until a bundle is present.
    assert body["default_cutoff_percent"] is None and body["machines"] == [] and body["splits"] is None
    assert body["data_credit"] is None and body["synthetic"] is False
    assert body["planner_defaults"]["label"] == "illustrative"


def test_metadata_cache_header_matches_architecture_table() -> None:
    r = client.get("/api/v1/metadata")
    assert r.headers["cache-control"] == "public, max-age=0, s-maxage=60, stale-while-revalidate=300"


def test_metadata_replay_window_is_marked_planned() -> None:
    window = client.get("/api/v1/metadata").json()["replay_window"]
    assert window == {
        "start": "2015-11-01T00:00:00",
        "end": "2015-12-30T06:00:00",
        "status": "planned",
    }


def test_pinned_commit_matches_provenance_document() -> None:
    text = (ROOT / "docs" / "DATA_PROVENANCE.md").read_text(encoding="utf-8")
    assert config.DATASET_PINNED_COMMIT in text
    assert re.fullmatch(r"[0-9a-f]{40}", config.DATASET_PINNED_COMMIT)


def test_routes_are_exactly_the_contract() -> None:
    # The public OpenAPI schema is generated from the routes the app actually serves,
    # so it does not depend on how FastAPI stores included routers internally.
    contract = {
        "/api/v1/health": {"get"},
        "/api/v1/metadata": {"get"},
        "/api/v1/fleet": {"get"},
        "/api/v1/fleet/trend": {"get"},
        "/api/v1/assets/{machine_id}": {"get"},
        "/api/v1/assets/{machine_id}/telemetry": {"get"},
        "/api/v1/assets/{machine_id}/explanation": {"get"},
        "/api/v1/model/metrics": {"get"},
        "/api/v1/model/threshold-analysis": {"get"},
        "/api/v1/plan": {"post"},
    }
    served = {path: set(ops) for path, ops in app.openapi()["paths"].items() if path.startswith("/api/v1/")}
    assert served == contract
    # Behaviour check: anything outside the contract is a 404.
    assert client.get("/api/v1/not-in-the-contract").status_code == 404


def test_no_served_route_can_bypass_the_openapi_contract_check() -> None:
    # test_routes_are_exactly_the_contract derives the served routes from the OpenAPI schema.
    # That check is only exact if every served route appears in the schema, so forbid the
    # constructs that can serve a path without it: include_in_schema=False, mounted apps,
    # raw Starlette routes and websockets. The only allowed add_api_route calls are the two
    # contract routes in data.py (they are in the schema, so the contract test covers them).
    allowed_add_api_route = {"backend/app/api/data.py": 2}
    forbidden = ("include_in_schema", ".mount(", "add_route(", "websocket", "add_websocket_route")
    files = sorted((ROOT / "backend" / "app").rglob("*.py")) + [ROOT / "frontend" / "api" / "index.py"]
    assert len(files) > 1
    problems: list[str] = []
    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        text = f.read_text(encoding="utf-8")
        problems += [f"{rel}: {token}" for token in forbidden if token in text.lower()]
        if text.count("add_api_route(") != allowed_add_api_route.get(rel, 0):
            problems.append(f"{rel}: unexpected add_api_route( count")
    assert problems == []


def test_unknown_path_404_with_problem_json_and_no_store() -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json() == {"type": "about:blank", "title": "Not found", "status": 404}


def test_plan_without_model_data_is_503_no_store() -> None:
    r = client.post("/api/v1/plan", json={})
    assert r.status_code == 503
    assert r.headers["cache-control"] == "no-store"


def test_wrong_method_is_an_uncached_problem() -> None:
    r = client.post("/api/v1/health")
    assert r.status_code == 405
    assert r.headers["cache-control"] == "no-store"
    assert r.json()["status"] == 405


def test_extra_query_params_are_ignored_and_not_reflected() -> None:
    r = client.get("/api/v1/health?mv=<script>alert(1)</script>")
    assert r.status_code == 200
    assert "script" not in r.text


def test_docs_and_openapi_are_not_exposed() -> None:
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404


def test_nosniff_header_present() -> None:
    assert client.get("/api/v1/health").headers["x-content-type-options"] == "nosniff"


def test_validation_errors_never_echo_input() -> None:
    from fastapi import Query

    test_app: FastAPI = create_app()

    @test_app.get("/api/v1/_t")
    def _t(n: int = Query(ge=0, le=10)) -> dict[str, int]:
        return {"n": n}

    c = TestClient(test_app, raise_server_exceptions=False)
    r = c.get("/api/v1/_t?n=SECRET")
    assert r.status_code == 422
    assert r.headers["cache-control"] == "no-store"
    assert "SECRET" not in r.text


def test_unexpected_errors_hide_details_and_are_not_cached() -> None:
    test_app: FastAPI = create_app()

    @test_app.get("/api/v1/_boom")
    def _boom() -> None:
        raise RuntimeError("internal path /srv/secret")

    c = TestClient(test_app, raise_server_exceptions=False)
    r = c.get("/api/v1/_boom")
    assert r.status_code == 500
    assert r.headers["cache-control"] == "no-store"
    assert "secret" not in r.text
    assert "Traceback" not in r.text
