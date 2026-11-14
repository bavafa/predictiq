"""POST /plan: contract, strict validation, caching, determinism, and answers against the saved scores.

The second half recomputes the plan from the bundle's score array by an independent route (plain floats and
Python sorting, not the service's integer arithmetic) and compares. It runs on the synthetic bundle in CI and,
opt-in (`pytest -m realbundle`), on the real bundle in artifacts/<version>/bundle."""

import json
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from app import bundle as reader
from app.bundle import Bundle
from fastapi.testclient import TestClient

V = "/api/v1"
ROOT = Path(__file__).resolve().parents[2]
MID = "2015-12-01T12:00:00"
BODY: dict[str, Any] = {
    "at": MID,
    "cutoff_percent": 10,
    "failure_cost": 10_000,
    "planned_cost": 2_000,
    "crew_slots": 5,
}


def post(client: TestClient, b: Bundle, body: object, mv: str | None = "current") -> Any:
    url = f"{V}/plan" + ("" if mv is None else f"?mv={b.model_version if mv == 'current' else mv}")
    if isinstance(body, bytes):
        return client.post(url, content=body, headers={"content-type": "application/json"})
    return client.post(url, json=body)


def _real_dir() -> Path | None:
    for meta in sorted(ROOT.glob("artifacts/piq-*/bundle/meta.json"), reverse=True):
        if json.loads(meta.read_text()).get("synthetic") is False:
            return meta.parent
    return None


@pytest.fixture(params=["synthetic", pytest.param("real", marks=pytest.mark.realbundle)])
def served(request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch, synthetic_dir: Path) -> Bundle:
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


# ---- headers, versions, no model data ----------------------------------------------------------------------


def test_plan_is_never_cached_and_has_the_expected_shape(client: TestClient, with_bundle: Bundle) -> None:
    r = post(client, with_bundle, BODY)
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["content-type"].startswith("application/json")
    d = r.json()
    assert d["model_version"] == with_bundle.model_version and d["at"] == MID
    assert d["label"] == "illustrative" and "illustrative" in d["unit"]
    assert d["assumptions"]["cutoff_percent"] == 10
    assert d["summary"]["net_benefit"] is None and d["summary"]["net_benefit_label"] is None
    assert d["order_changed"] is None and all(row["moved"] is None for row in d["rows"])
    assert len(d["rows"]) == d["summary"]["machines_listed"] <= with_bundle.n_machines


def test_other_model_versions_are_404_no_store_and_missing_is_400(
    client: TestClient, with_bundle: Bundle
) -> None:
    r = post(client, with_bundle, BODY, mv="piq-19990101-00000000")
    assert r.status_code == 404 and r.headers["cache-control"] == "no-store"
    assert r.headers["content-type"].startswith("application/problem+json")
    r = post(client, with_bundle, BODY, mv=None)
    assert r.status_code == 400 and r.headers["cache-control"] == "no-store"


def test_503_when_no_model_data_is_installed(client: TestClient) -> None:
    r = client.post(f"{V}/plan?mv=x", json=BODY)
    assert r.status_code == 503 and r.headers["cache-control"] == "no-store"
    assert r.json()["title"] == "Model data unavailable"


def test_get_is_not_allowed_and_nothing_is_stored(client: TestClient, with_bundle: Bundle) -> None:
    r = client.get(f"{V}/plan?mv={with_bundle.model_version}")
    assert r.status_code == 405 and r.headers["cache-control"] == "no-store"


# ---- strict validation -------------------------------------------------------------------------------------

SECRET = "secret-value"  # noqa: S105  (a marker that must never be echoed back, not a credential)


def refused(client: TestClient, b: Bundle, body: object, expect: str | None = None) -> None:
    r = post(client, b, body)
    assert r.status_code == 422, body
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.headers["cache-control"] == "no-store"
    assert SECRET not in r.text and "Traceback" not in r.text
    if expect is not None:
        assert expect in r.json()["detail"], r.json()


@pytest.mark.parametrize(
    ("field", "value", "range_text"),
    [
        ("failure_cost", -1, "0 to 10,000,000"),
        ("failure_cost", 10_000_001, "0 to 10,000,000"),
        ("failure_cost", 100.5, "whole number"),
        ("failure_cost", 100.0, "whole number"),
        ("failure_cost", "100", "whole number"),
        ("failure_cost", True, "whole number"),
        ("failure_cost", None, "whole number"),
        ("planned_cost", -1, "0 to 10,000,000"),
        ("planned_cost", 10_000_001, "0 to 10,000,000"),
        ("planned_cost", 1.5, "whole number"),
        ("crew_slots", -1, "0 to 100"),
        ("crew_slots", 101, "0 to 100"),
        ("crew_slots", 2.5, "whole number"),
        ("crew_slots", 3.0, "whole number"),
        ("cutoff_percent", -1, "0 to 100"),
        ("cutoff_percent", 101, "0 to 100"),
        ("cutoff_percent", 50.5, "whole number"),
        ("risk_reduction_percent", 91, "0 to 90"),
        ("risk_reduction_percent", 95, "0 to 90"),
        ("risk_reduction_percent", -5, "0 to 90"),
        ("risk_reduction_percent", 12, "steps of 5"),
        ("risk_reduction_percent", 10.0, "whole number"),
        ("risk_reduction_percent", "10", "whole number"),
        ("include_below_cutoff", "yes", "true or false"),
        ("include_below_cutoff", 1, "true or false"),
        ("at", MID.replace(":00:00", ":30:00"), "whole hour"),
        ("at", "2015-10-31T23:00:00", "at must be from"),
        ("at", "2016-01-01T00:00:00", "at must be from"),
        ("at", 12345, "whole hour"),
        ("at", f"{SECRET}", "whole hour"),
        ("failure_cost_by_model", [1, 2], "object"),
        ("failure_cost_by_model", {"model5": 1}, "model1 to model4"),
        ("failure_cost_by_model", {"model1": -1}, "0 to 10,000,000"),
        ("failure_cost_by_model", {"model1": 10_000_001}, "0 to 10,000,000"),
        ("failure_cost_by_model", {"model2": 1.5}, "whole number"),
        ("failure_cost_by_model", {"model2": None}, "whole number"),
    ],
)
def test_out_of_range_and_non_integer_values_are_refused_with_the_allowed_range(
    client: TestClient, with_bundle: Bundle, field: str, value: object, range_text: str
) -> None:
    refused(client, with_bundle, {**BODY, field: value}, range_text)


def test_values_on_the_boundaries_are_accepted(client: TestClient, with_bundle: Bundle) -> None:
    for patch in (
        {"failure_cost": 0, "planned_cost": 0, "crew_slots": 0},
        {"failure_cost": 10_000_000, "planned_cost": 10_000_000, "crew_slots": 100},
        {"cutoff_percent": 0},
        {"cutoff_percent": 100},
        {"risk_reduction_percent": 0},
        {"risk_reduction_percent": 90},
        {"risk_reduction_percent": None},
        {"failure_cost_by_model": dict.fromkeys(("model1", "model2", "model3", "model4"), 10000000)},
        {"at": "2015-11-01T00:00:00"},
        {"at": "2015-11-01T00:00"},
    ):
        r = post(client, with_bundle, {**BODY, **patch})
        assert r.status_code == 200, patch


def test_unknown_missing_and_malformed_bodies_are_refused(client: TestClient, with_bundle: Bundle) -> None:
    refused(client, with_bundle, {**BODY, SECRET: 1}, "Unknown field")
    for field in ("at", "failure_cost", "planned_cost", "crew_slots"):
        missing = {k: v for k, v in BODY.items() if k != field}
        refused(client, with_bundle, missing, f"Missing field: {field}")
    for raw in (b"", b"not json", b"[1, 2]", b'"text"', b"null", b'{"at": NaN}', b'{"crew_slots": Infinity}'):
        refused(client, with_bundle, raw, "JSON object")


def test_oversized_bodies_are_refused_not_read_into_the_plan(client: TestClient, with_bundle: Bundle) -> None:
    r = post(client, with_bundle, json.dumps({**BODY, "pad": "x" * 5000}).encode())
    assert r.status_code == 413 and r.headers["content-type"].startswith("application/problem+json")
    assert r.headers["cache-control"] == "no-store" and "xxxx" not in r.text


def test_nothing_is_echoed_and_a_refusal_does_not_change_later_answers(
    client: TestClient, with_bundle: Bundle
) -> None:
    first = post(client, with_bundle, BODY).json()
    refused(client, with_bundle, {**BODY, "crew_slots": 1000})
    assert post(client, with_bundle, BODY).json() == first


# ---- wording -----------------------------------------------------------------------------------------------


def test_no_savings_wording_and_everything_is_labelled_illustrative(
    client: TestClient, with_bundle: Bundle
) -> None:
    body = {**BODY, "risk_reduction_percent": 20, "failure_cost_by_model": {"model1": 20_000}}
    r = post(client, with_bundle, body)
    text = r.text.lower()
    assert "saving" not in text and "save" not in text
    d = r.json()
    assert d["label"] == "illustrative"
    assert d["summary"]["net_benefit_label"] == "Expected net benefit (estimate)"
    assert "estimate" in d["formulas"]["net_benefit"].lower()
    assert all("illustrative" in d["formulas"][k].lower() for k in ("expected_exposure", "planned_spend"))


# ---- determinism and bounds --------------------------------------------------------------------------------


def test_same_inputs_give_byte_identical_responses(client: TestClient, with_bundle: Bundle) -> None:
    body = {**BODY, "risk_reduction_percent": 30, "failure_cost_by_model": {"model2": 30_000}}
    a, b = post(client, with_bundle, body), post(client, with_bundle, dict(reversed(body.items())))
    assert a.content == b.content  # key order in the request does not matter either


def test_at_most_100_machines_and_the_largest_response_is_small(
    client: TestClient, with_bundle: Bundle
) -> None:
    body = {
        **BODY,
        "cutoff_percent": 0,
        "include_below_cutoff": True,
        "risk_reduction_percent": 90,
        "crew_slots": 100,
        "failure_cost": 10_000_000,
        "planned_cost": 10_000_000,
        "failure_cost_by_model": dict.fromkeys(("model1", "model2", "model3", "model4"), 9999999),
    }
    r = post(client, with_bundle, body)
    assert r.status_code == 200
    assert len(r.json()["rows"]) == 100 and len(r.content) < 256 * 1024


# ---- answers against the saved scores ----------------------------------------------------------------------


def _hours(b: Bundle) -> list[int]:
    rng = np.random.default_rng(11)
    picks = {b.first_index, b.last_index, (b.first_index + b.last_index) // 2}
    picks |= {int(i) for i in rng.integers(b.first_index, b.last_index + 1, 6)}
    return sorted(picks)


def _expected(b: Bundle, idx: int, body: dict[str, Any]) -> list[tuple[int, float, bool]]:
    """(machine, exposure, shortlisted) in order, from the raw array and plain float arithmetic."""
    raw = np.asarray(b.scores["main"])
    by_model = body.get("failure_cost_by_model", {})
    rows = []
    for i, info in enumerate(b.meta["machines"]):
        chance = round(float(raw[i, idx]), 6)
        above = chance >= body["cutoff_percent"] / 100
        if not above and not body.get("include_below_cutoff"):
            continue
        cost = by_model.get(info["model"], body["failure_cost"])
        rows.append((i + 1, chance, cost * chance, above))
    rows.sort(key=lambda r: (-round(r[2], 6), -r[1], r[0]))
    out, used = [], 0
    for machine, _, exposure, above in rows:
        take = above and used < body["crew_slots"]
        used += take
        out.append((machine, round(exposure, 6), take))
    return out


@pytest.mark.parametrize(
    "patch",
    [
        {},
        {"cutoff_percent": 0, "crew_slots": 3},
        {"cutoff_percent": 25, "include_below_cutoff": True, "crew_slots": 7},
        {"failure_cost_by_model": {"model1": 30_000, "model3": 1_000}, "cutoff_percent": 5},
        {"crew_slots": 0},
        {"cutoff_percent": 100},
    ],
)
def test_plan_matches_the_saved_scores_for_sampled_hours(
    client: TestClient, served: Bundle, patch: dict[str, Any]
) -> None:
    for idx in _hours(served):
        body = {**BODY, **patch, "at": served.hour_at(idx).isoformat()}
        r = post(client, served, body)
        assert r.status_code == 200, body
        d = r.json()
        got = [
            (row["machine_id"], row["expected_exposure"], row["listing"] == "shortlisted")
            for row in d["rows"]
        ]
        assert got == _expected(served, idx, body), (idx, patch)
        fleet = client.get(
            f"{V}/fleet?mv={served.model_version}&at={body['at']}&cutoff={body['cutoff_percent']}"
        ).json()
        scores = {r_["machine_id"]: r_["score"] for r_ in fleet["rows"]}
        for row in d["rows"]:
            assert row["score"] == scores[row["machine_id"]]  # same number as the Fleet screen
            assert row["status"] == (
                "alert" if row["score"] >= body["cutoff_percent"] / 100 else "below_cutoff"
            )
        s = d["summary"]
        assert s["machines_at_or_above_cutoff"] == fleet["cards"]["machines_in_alert"]
        assert s["slots_used"] == sum(1 for row in d["rows"] if row["listing"] == "shortlisted")
        assert s["planned_spend"] == s["slots_used"] * body["planned_cost"]
        assert s["shortlist_exposure"] == pytest.approx(
            sum(row["expected_exposure"] for row in d["rows"] if row["listing"] == "shortlisted"), abs=1e-5
        )


def test_per_model_costs_reorder_against_the_saved_scores_and_mark_moves(
    client: TestClient, served: Bundle
) -> None:
    idx = served.last_index
    at = served.hour_at(idx).isoformat()
    base = {**BODY, "at": at, "cutoff_percent": 0, "crew_slots": 5}
    plain = post(client, served, base).json()
    assert plain["order_changed"] is None
    by_chance = [row["machine_id"] for row in plain["rows"]]
    raised = post(client, served, {**base, "failure_cost_by_model": {"model2": 10_000_000}}).json()
    assert raised["order_changed"] is True and raised["order_note"]
    ranked = [row["machine_id"] for row in raised["rows"]]
    assert ranked != by_chance
    models = {m["machine_id"]: m["model"] for m in served.meta["machines"]}
    assert models[ranked[0]] == "model2"
    chance_rank = {m: i for i, m in enumerate(by_chance, start=1)}
    for row in raised["rows"]:
        assert row["moved"] == chance_rank[row["machine_id"]] - row["rank"]
    # The shortlist changed too: the first five now start with model2 machines.
    assert [row["machine_id"] for row in raised["rows"] if row["slot"]] == ranked[:5]
    assert [row["machine_id"] for row in plain["rows"] if row["slot"]] == by_chance[:5]
