"""Exact request validation for the data endpoints (docs/architecture.md, "Validation").

Out-of-range values are refused with problem+json, never adjusted. Messages name the parameter, never the
submitted value."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, cast

from fastapi import Request

from app import config
from app.bundle import Bundle
from app.problems import ProblemError
from app.services.component_planner import ComponentInputs
from app.services.planner import PlanInputs

_AT = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:00(:00)?")
_WHOLE = re.compile(r"[0-9]{1,3}")
Range = Literal["24h", "7d"]
RANGE_HOURS = {"24h": 24, "7d": 168}


def check_mv(bundle: Bundle, mv: str | None) -> None:
    """Only the latest (the only) model version is served: other -> 404, none -> 400."""
    if mv is None or mv == "":
        raise ProblemError(400, "Missing model version", "Add mv=<model_version> from /metadata.")
    if mv != bundle.model_version:
        raise ProblemError(404, "Not found", "This model version is not served.")


def parse_at(bundle: Bundle, text: str | None) -> tuple[int, datetime]:
    """`at`: a whole hour inside the replay window, as 2015-11-01T00:00 or 2015-11-01T00:00:00."""
    if text is None:
        raise ProblemError(422, "Invalid request", "Missing parameter: at")
    if not _AT.fullmatch(text):
        raise ProblemError(
            422, "Invalid request", "Invalid parameter: at must be a whole hour, YYYY-MM-DDTHH:00"
        )
    try:
        t = datetime.fromisoformat(text)
    except ValueError:
        raise ProblemError(422, "Invalid request", "Invalid parameter: at is not a date") from None
    i = bundle.hour_index(t)
    if not bundle.first_index <= i <= bundle.last_index:
        raise ProblemError(
            422,
            "Outside the replay window",
            f"at must be from {bundle.test_start.isoformat()} to {bundle.replay_end.isoformat()}.",
        )
    return i, t


def parse_cutoff(bundle: Bundle, text: str | None) -> int:
    """`cutoff`: whole percent 0-100; defaults to the model's default cut-off."""
    if text is None:
        return bundle.default_cutoff
    if not _WHOLE.fullmatch(text) or int(text) > 100:
        raise ProblemError(
            422, "Invalid request", "Invalid parameter: cutoff must be a whole number, 0 to 100"
        )
    return int(text)


def parse_range(text: str | None) -> Range:
    if text is None:
        return "24h"
    if text not in RANGE_HOURS:
        raise ProblemError(422, "Invalid request", "Invalid parameter: range must be 24h or 7d")
    return cast(Range, text)


def parse_machine(bundle: Bundle, text: str | None) -> int:
    """Machine number 1..N; anything else (including text) is a 404."""
    if text is None or not text.isascii() or not text.isdigit() or not 1 <= int(text) <= bundle.n_machines:
        raise ProblemError(404, "Not found", "No such machine.")
    return int(text)


def parse_machine_model(text: str | None) -> str | None:
    if text is not None and text not in config.MACHINE_MODELS:
        raise ProblemError(
            422, "Invalid request", "Invalid parameter: machine_model must be model1 to model4"
        )
    return text


def parse_status(text: str | None) -> str | None:
    if text is not None and text not in config.STATUSES:
        raise ProblemError(422, "Invalid request", "Invalid parameter: status must be alert or below_cutoff")
    return text


# ---- POST /plan body -------------------------------------------------------------------------------------

COST_MAX = 10_000_000
SLOTS_MAX = 100
REDUCTION_MAX = 90
REDUCTION_STEP = 5
MAX_BODY_BYTES = 4096
PLAN_FIELDS = (
    "level",
    "at",
    "cutoff_percent",
    "failure_cost",
    "failure_cost_by_model",
    "planned_cost",
    "planned_cost_by_model",
    "crew_slots",
    "risk_reduction_percent",
    "include_below_cutoff",
)


COMPONENT_PLAN_FIELDS = (
    "level",
    "at",
    "horizon_days",
    "failure_cost",
    "failure_cost_by_part",
    "planned_cost",
    "planned_cost_by_part",
    "crew_slots",
    "risk_reduction_percent",
)


def _bad(detail: str) -> ProblemError:
    return ProblemError(422, "Invalid request", detail)


def _whole(value: object, name: str, low: int, high: int) -> int:
    """A JSON integer in [low, high]. Floats (even 5.0), strings, booleans and null are refused."""
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise _bad(f"Invalid field: {name} must be a whole number from {low:,} to {high:,}")
    return value


def too_large() -> ProblemError:
    return ProblemError(413, "Request too large", f"The request body can be at most {MAX_BODY_BYTES} bytes.")


def check_declared_length(content_length: str | None) -> None:
    """Refuse early when the declared Content-Length is already over the limit."""
    declared = content_length is not None and content_length.isascii() and content_length.isdigit()
    if declared and int(cast(str, content_length)) > MAX_BODY_BYTES:
        raise too_large()


async def read_limited_body(request: Request) -> bytes:
    """Read the body while enforcing the limit: a long declared length is refused before reading, and the
    stream is abandoned as soon as more than the limit has arrived (chunked or undeclared lengths too)."""
    check_declared_length(request.headers.get("content-length"))
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_BODY_BYTES:
            raise too_large()
        chunks.append(chunk)
    return b"".join(chunks)


def parse_json_object(raw: bytes) -> dict[str, object]:
    if len(raw) > MAX_BODY_BYTES:
        raise too_large()

    def refuse_constant(_: str) -> object:
        raise ValueError("not a JSON number")

    try:
        body = json.loads(raw, parse_constant=refuse_constant)
    except (ValueError, RecursionError):
        raise _bad("The request body must be a JSON object") from None
    if not isinstance(body, dict):
        raise _bad("The request body must be a JSON object")
    return body


def _by_model(body: dict[str, object], name: str) -> dict[str, int]:
    out: dict[str, int] = {}
    raw = body.get(name, {})
    if not isinstance(raw, dict):
        raise _bad(f"Invalid field: {name} must be an object keyed by machine model")
    for key, value in raw.items():
        if key not in config.MACHINE_MODELS:
            raise _bad(f"Invalid field: {name} keys must be model1 to model4")
        out[key] = _whole(value, f"{name}.{key}", 0, COST_MAX)
    return out


def _by_part(body: dict[str, object], name: str) -> dict[str, int]:
    out: dict[str, int] = {}
    raw = body.get(name, {})
    if not isinstance(raw, dict):
        raise _bad(f"Invalid field: {name} must be an object keyed by part")
    for key, value in raw.items():
        if key not in config.COMPONENTS:
            raise _bad(f"Invalid field: {name} keys must be comp1 to comp4")
        out[key] = _whole(value, f"{name}.{key}", 0, COST_MAX)
    return out


def plan_level(body: dict[str, object]) -> Literal["machine", "component"]:
    level = body.get("level", "machine")
    if level not in ("machine", "component"):
        raise _bad("Invalid field: level must be machine or component")
    return level


@dataclass(frozen=True)
class ComponentPlanRequest:
    at_index: int
    at: datetime
    inputs: ComponentInputs


def parse_horizon(value: object, name: str = "horizon_days") -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value not in config.COMPONENT_HORIZONS:
        raise _bad(f"Invalid field: {name} must be 7 or 14")
    return value


def parse_component_plan_body(bundle: Bundle, body: dict[str, object]) -> ComponentPlanRequest:
    """Same strictness as the machine plan. There is no alert cut-off for the wear view (decision 79)."""
    if any(k not in COMPONENT_PLAN_FIELDS for k in body):
        raise _bad("Unknown field in the request. Allowed fields: " + ", ".join(COMPONENT_PLAN_FIELDS))
    for required in ("at", "failure_cost", "planned_cost", "crew_slots"):
        if required not in body:
            raise _bad(f"Missing field: {required}")
    at = body["at"]
    if not isinstance(at, str):
        raise _bad("Invalid field: at must be a whole hour, YYYY-MM-DDTHH:00")
    idx, t = parse_at(bundle, at)
    horizon = (
        config.COMPONENT_DEFAULT_HORIZON
        if "horizon_days" not in body
        else parse_horizon(body["horizon_days"])
    )
    reduction: int | None = None
    if body.get("risk_reduction_percent") is not None:
        reduction = _whole(body["risk_reduction_percent"], "risk_reduction_percent", 0, REDUCTION_MAX)
        if reduction % REDUCTION_STEP:
            raise _bad("Invalid field: risk_reduction_percent must be off (null) or 0 to 90 in steps of 5")
    return ComponentPlanRequest(
        at_index=idx,
        at=t,
        inputs=ComponentInputs(
            horizon_days=horizon,
            failure_cost=_whole(body["failure_cost"], "failure_cost", 0, COST_MAX),
            failure_cost_by_part=_by_part(body, "failure_cost_by_part"),
            planned_cost=_whole(body["planned_cost"], "planned_cost", 0, COST_MAX),
            planned_cost_by_part=_by_part(body, "planned_cost_by_part"),
            crew_slots=_whole(body["crew_slots"], "crew_slots", 0, SLOTS_MAX),
            risk_reduction_percent=reduction,
        ),
    )


@dataclass(frozen=True)
class PlanRequest:
    at_index: int
    at: datetime
    inputs: PlanInputs


def parse_plan_body(bundle: Bundle, body: dict[str, object]) -> PlanRequest:
    """Strict: unknown fields, out-of-range values and non-integers are refused, never adjusted. Messages name
    the field and the allowed range, never the submitted value."""
    if any(k not in PLAN_FIELDS for k in body):
        raise _bad("Unknown field in the request. Allowed fields: " + ", ".join(PLAN_FIELDS))
    for required in ("at", "failure_cost", "planned_cost", "crew_slots"):
        if required not in body:
            raise _bad(f"Missing field: {required}")
    at = body["at"]
    if not isinstance(at, str):
        raise _bad("Invalid field: at must be a whole hour, YYYY-MM-DDTHH:00")
    idx, t = parse_at(bundle, at)
    cutoff = (
        bundle.default_cutoff
        if "cutoff_percent" not in body
        else _whole(body["cutoff_percent"], "cutoff_percent", 0, 100)
    )
    failure_cost = _whole(body["failure_cost"], "failure_cost", 0, COST_MAX)
    planned_cost = _whole(body["planned_cost"], "planned_cost", 0, COST_MAX)
    slots = _whole(body["crew_slots"], "crew_slots", 0, SLOTS_MAX)

    by_model = _by_model(body, "failure_cost_by_model")
    planned_by_model = _by_model(body, "planned_cost_by_model")

    reduction: int | None = None
    if body.get("risk_reduction_percent") is not None:
        reduction = _whole(body["risk_reduction_percent"], "risk_reduction_percent", 0, REDUCTION_MAX)
        if reduction % REDUCTION_STEP:
            raise _bad("Invalid field: risk_reduction_percent must be off (null) or 0 to 90 in steps of 5")
    below = body.get("include_below_cutoff", False)
    if not isinstance(below, bool):
        raise _bad("Invalid field: include_below_cutoff must be true or false")
    return PlanRequest(
        at_index=idx,
        at=t,
        inputs=PlanInputs(
            cutoff_percent=cutoff,
            failure_cost=failure_cost,
            failure_cost_by_model=by_model,
            planned_cost=planned_cost,
            planned_cost_by_model=planned_by_model,
            crew_slots=slots,
            risk_reduction_percent=reduction,
            include_below_cutoff=below,
        ),
    )
