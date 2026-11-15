"""POST /plan: the maintenance planner (decisions 6, 16, 21, 23). Stores nothing; never cached.

The body is JSON (see `validation.parse_plan_body`); `mv` is a query parameter like on every other endpoint.
Predicted chances are the saved main-model scores at `at`, rounded to 6 decimals exactly as /fleet serves
them, so a planner row and the Fleet row for the same machine, hour and cut-off show the same number."""

from __future__ import annotations

from datetime import datetime

import numpy as np
from fastapi import APIRouter, Request, Response

from app import config
from app.api.data import BundleDep, Mv, Param
from app.bundle import Bundle, Components
from app.problems import ProblemError
from app.schemas.plan import (
    ComponentPartOut,
    ComponentPlanAssumptions,
    ComponentPlanOut,
    ComponentRowOut,
    ComponentsOut,
    ComponentSummaryOut,
    PlanAssumptions,
    PlanOut,
    PlanRowOut,
    PlanSummaryOut,
    WindowOut,
)
from app.services.component_planner import (
    ComponentInputs,
    ComponentPlan,
    PartScore,
    chance_before_window,
    compute_component_plan,
    next_window_start,
)
from app.services.planner import MICRO, MachineScore, Plan, PlanInputs, compute_plan
from app.validation import (
    check_mv,
    parse_at,
    parse_component_plan_body,
    parse_horizon,
    parse_json_object,
    parse_machine,
    parse_plan_body,
    plan_level,
    read_limited_body,
)

router = APIRouter()

LABEL = "illustrative"
UNIT = "illustrative currency units"

FORMULAS = {
    "expected_exposure": (
        "Expected exposure = predicted chance of a failure in the next 24 hours x the cost if a failure "
        "happens (the machine model's own cost where one is set, otherwise the shared cost). "
        "Illustrative: the costs are assumptions, not data."
    ),
    "ranking": (
        "Machines are ranked by expected exposure, highest first. Ties go to the higher predicted chance, "
        "then the lower machine number."
    ),
    "shortlist": (
        "The first N machines at or above the alert cut-off, going down the list, are shortlisted, "
        "where N is the crew slots. Machines below the cut-off are never shortlisted. "
        "Spare slots stay empty."
    ),
    "planned_spend": (
        "Planned spend = the sum, over the shortlisted machines, of the planned maintenance cost for "
        "each one's machine model (the shared cost where a model has none set). Illustrative."
    ),
    "net_benefit": (
        "Estimate, shown only when a risk reduction is assumed: expected exposure of the shortlisted "
        "machines x the assumed reduction - planned spend. It depends entirely on that assumption."
    ),
}


def _machine_scores(b_meta_machines: list[dict[str, object]], scores: np.ndarray) -> list[MachineScore]:
    out = []
    for i, info in enumerate(b_meta_machines):
        out.append(
            MachineScore(
                machine_id=i + 1,
                model=str(info["model"]),
                age=int(str(info["age"])),
                score_micro=int(round(float(scores[i]) * MICRO)),
            )
        )
    return out


def _response(model_version: str, at: str, inputs: PlanInputs, plan: Plan) -> PlanOut:
    s = plan.summary
    order_note = None
    if plan.order_changed is not None:
        order_note = (
            "The order differs from the order by predicted chance alone because the failure costs differ by "
            "machine model."
            if plan.order_changed
            else "Failure costs differ by machine model, but the order matches the order by predicted chance."
        )
    return PlanOut(
        model_version=model_version,
        at=at,
        label=LABEL,
        unit=UNIT,
        assumptions=PlanAssumptions(
            cutoff_percent=inputs.cutoff_percent,
            failure_cost=inputs.failure_cost,
            failure_cost_by_model=dict(inputs.failure_cost_by_model),
            planned_cost=inputs.planned_cost,
            planned_cost_by_model=dict(inputs.planned_cost_by_model),
            crew_slots=inputs.crew_slots,
            risk_reduction_percent=inputs.risk_reduction_percent,
            include_below_cutoff=inputs.include_below_cutoff,
        ),
        order_changed=plan.order_changed,
        order_note=order_note,
        summary=PlanSummaryOut(
            machines_at_or_above_cutoff=s.machines_at_or_above_cutoff,
            machines_listed=s.machines_listed,
            crew_slots=s.crew_slots,
            slots_used=s.slots_used,
            spare_slots=s.spare_slots,
            shortlist_exposure=s.shortlist_exposure,
            planned_spend=s.planned_spend,
            net_benefit=s.net_benefit,
            net_benefit_label=None if s.net_benefit is None else "Expected net benefit (estimate)",
        ),
        rows=[
            PlanRowOut(
                rank=r.rank,
                machine_id=r.machine_id,
                model=r.model,
                age=r.age,
                score=r.score,
                status="alert" if r.at_or_above_cutoff else "below_cutoff",
                failure_cost=r.failure_cost,
                planned_cost=r.planned_cost,
                expected_exposure=r.expected_exposure,
                listing=r.listing,
                slot=r.slot,
                moved=r.moved,
                net_benefit=r.net_benefit,
            )
            for r in plan.rows
        ],
        formulas=FORMULAS,
    )


COMPONENT_NOTES = [
    "Chance before the window assumes failures are spread evenly over the horizon (an estimate).",
    "The 7 to 14 day wear chance is a ranking with a weak signal in this data; it has no alert cut-off.",
    "Only the 48-hour warning has a cut-off (chosen on validation); the larger of the two chances is used.",
    "Crew slots apply per shutdown window. Shutdown windows and all costs are assumed or illustrative.",
]
COMPONENT_FORMULAS = {
    "chance_before_window": (
        "Wear: 1 - (1 - chance within the horizon) ^ (days to the window / horizon days). Warning: the same "
        "idea over 2 days. The larger is used. An estimate that assumes failures are spread evenly."
    ),
    "expected_exposure": (
        "Expected exposure = chance before the next window x the part's failure cost. Illustrative."
    ),
    "ranking": (
        "Parts are ranked by expected exposure, highest first. Ties go to the higher chance, then the lower "
        "machine number, then the part."
    ),
    "shortlist": (
        "In each machine model's next shutdown window, the first N ranked parts with some exposure are "
        "shortlisted, where N is the crew slots per window. The rest of that window are over capacity."
    ),
    "planned_spend": "Planned spend = the sum of the shortlisted parts' planned costs. Illustrative.",
    "net_benefit": (
        "Estimate, shown only when a risk reduction is assumed: shortlisted exposure x the assumed "
        "reduction - planned spend."
    ),
}


def _components(b: Bundle) -> Components:
    if b.components is None:
        raise ProblemError(
            503, "Component data unavailable", "This deployment's bundle has no component scores."
        )
    return b.components


def _part_scores(b: Bundle, c: Components, idx: int, at: datetime, horizon: int) -> list[PartScore]:
    day = c.day_index(at)
    if not 0 <= day < c.n_days:
        raise ProblemError(503, "Component data unavailable", "No wear score covers this hour.")
    wear = np.round(np.asarray(c.wear[c.horizons.index(horizon), :, day, :], dtype=np.float64), 6)
    warn = np.round(np.asarray(c.warning[:, idx, :], dtype=np.float64), 6)
    since = np.asarray(c.since[:, day, :], dtype=np.float64)
    cut = c.meta["warning_cutoff_percent"]
    out = []
    for i, info in enumerate(b.meta["machines"]):
        for k, part in enumerate(c.parts):
            out.append(
                PartScore(
                    machine_id=i + 1,
                    model=str(info["model"]),
                    age=int(str(info["age"])),
                    part=part,
                    wear_chance=float(wear[i, k]),
                    warning_chance=float(warn[i, k]),
                    warning_active=bool(warn[i, k] >= int(cut[part]) / 100.0),
                    days_since=float(since[i, k]),
                )
            )
    return out


def _action(signal: str, listing: str) -> str:
    if signal == "warning":
        return "act_before_window"
    return {"shortlisted": "replace_in_window", "over_capacity": "over_capacity"}.get(listing, "watch")


def _component_response(
    b: Bundle, c: Components, at: str, inputs: ComponentInputs, plan: ComponentPlan
) -> ComponentPlanOut:
    s = plan.summary
    return ComponentPlanOut(
        level="component",
        model_version=b.model_version,
        component_model_version=c.version,
        at=at,
        label=LABEL,
        unit=UNIT,
        horizon_days=inputs.horizon_days,
        honesty=config.COMPONENT_HONESTY,
        assumptions=ComponentPlanAssumptions(
            horizon_days=inputs.horizon_days,
            failure_cost=inputs.failure_cost,
            failure_cost_by_part=dict(inputs.failure_cost_by_part),
            planned_cost=inputs.planned_cost,
            planned_cost_by_part=dict(inputs.planned_cost_by_part),
            crew_slots_per_window=inputs.crew_slots,
            risk_reduction_percent=inputs.risk_reduction_percent,
        ),
        summary=ComponentSummaryOut(
            parts_ranked=s.parts_ranked,
            rows_returned=s.rows_returned,
            warning_parts=s.warning_parts,
            crew_slots_per_window=s.crew_slots_per_window,
            slots_used=s.slots_used,
            shortlist_exposure=s.shortlist_exposure,
            planned_spend=s.planned_spend,
            net_benefit=s.net_benefit,
            net_benefit_label=None if s.net_benefit is None else "Expected net benefit (estimate)",
            windows=[
                WindowOut(models=list(w.models), start=w.start.isoformat(), shortlisted=w.shortlisted)
                for w in s.windows
            ],
        ),
        rows=[
            ComponentRowOut(
                rank=r.rank,
                machine_id=r.score.machine_id,
                model=r.score.model,
                age=r.score.age,
                part=r.score.part,
                part_name=config.COMPONENT_NAMES[r.score.part],
                wear_chance=r.score.wear_chance,
                warning_chance_48h=r.score.warning_chance,
                warning_active=r.score.warning_active,
                signal=r.signal,
                days_since_replacement=round(r.score.days_since, 2),
                window_start=r.window_start.isoformat(),
                days_to_window=r.days_to_window,
                chance_before_window=r.chance_before_window,
                failure_cost=r.failure_cost,
                planned_cost=r.planned_cost,
                expected_exposure=r.expected_exposure,
                listing=r.listing,
                slot=r.slot,
                action=_action(r.signal, r.listing),  # type: ignore[arg-type]
                net_benefit=r.net_benefit,
            )
            for r in plan.rows
        ],
        names=config.COMPONENT_NAMES,
        names_note=config.COMPONENT_NAMES_NOTE,
        windows_note=config.SHUTDOWN_WINDOWS_NOTE,
        notes=COMPONENT_NOTES,
        formulas=COMPONENT_FORMULAS,
    )


@router.post("/plan", response_model=PlanOut | ComponentPlanOut)
async def plan(
    request: Request, response: Response, b: BundleDep, mv: Mv = None
) -> PlanOut | ComponentPlanOut:
    response.headers["Cache-Control"] = config.CACHE_NO_STORE
    check_mv(b, mv)
    body = parse_json_object(await read_limited_body(request))
    if plan_level(body) == "component":
        creq = parse_component_plan_body(b, body)
        c = _components(b)
        parts = _part_scores(b, c, creq.at_index, creq.at, creq.inputs.horizon_days)
        cplan = compute_component_plan(
            parts, creq.at, creq.inputs, config.SHUTDOWN_WINDOWS, config.COMPONENT_ROWS_MAX
        )
        return _component_response(b, c, creq.at.isoformat(), creq.inputs, cplan)
    body = {k: v for k, v in body.items() if k != "level"}
    req = parse_plan_body(b, body)
    scores = np.round(np.asarray(b.scores["main"][:, req.at_index], dtype=np.float64), 6)
    machines = _machine_scores(b.meta["machines"], scores)
    result = compute_plan(machines, req.inputs, config.MACHINE_MODELS)
    return _response(b.model_version, req.at.isoformat(), req.inputs, result)


@router.get("/assets/{machine_id}/components", response_model=ComponentsOut)
def asset_components(
    machine_id: str,
    response: Response,
    b: BundleDep,
    mv: Mv = None,
    at: Param = None,
    horizon_days: Param = None,
) -> ComponentsOut:
    m = parse_machine(b, machine_id)
    check_mv(b, mv)
    idx, t = parse_at(b, at)
    horizon = (
        config.COMPONENT_DEFAULT_HORIZON
        if horizon_days is None
        else parse_horizon(
            int(horizon_days) if horizon_days.isascii() and horizon_days.isdigit() else horizon_days,
            "horizon_days",
        )
    )
    c = _components(b)
    info = b.meta["machines"][m - 1]
    start = next_window_start(t, config.SHUTDOWN_WINDOWS[str(info["model"])])
    d = (start - t).total_seconds() / 86400.0
    parts = [p for p in _part_scores(b, c, idx, t, horizon) if p.machine_id == m]
    response.headers["Cache-Control"] = config.CACHE_DATA
    return ComponentsOut(
        model_version=b.model_version,
        component_model_version=c.version,
        machine_id=m,
        model=str(info["model"]),
        age=int(info["age"]),
        at=t.isoformat(),
        horizon_days=horizon,
        window_start=start.isoformat(),
        days_to_window=round(d, 4),
        honesty=config.COMPONENT_HONESTY,
        names_note=config.COMPONENT_NAMES_NOTE,
        windows_note=config.SHUTDOWN_WINDOWS_NOTE,
        parts=[
            ComponentPartOut(
                part=p.part,
                part_name=config.COMPONENT_NAMES[p.part],
                wear_chance=p.wear_chance,
                chance_before_window=round(
                    max(
                        chance_before_window(p.wear_chance, d, horizon),
                        chance_before_window(p.warning_chance, d, 2.0),
                    ),
                    6,
                ),
                warning_chance_48h=p.warning_chance,
                warning_active=p.warning_active,
                warning_cutoff_percent=int(c.meta["warning_cutoff_percent"][p.part]),
                days_since_replacement=round(p.days_since, 2),
            )
            for p in parts
        ],
    )
