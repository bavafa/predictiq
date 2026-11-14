"""POST /plan: the maintenance planner (decisions 6, 16, 21, 23). Stores nothing; never cached.

The body is JSON (see `validation.parse_plan_body`); `mv` is a query parameter like on every other endpoint.
Predicted chances are the saved main-model scores at `at`, rounded to 6 decimals exactly as /fleet serves
them, so a planner row and the Fleet row for the same machine, hour and cut-off show the same number."""

from __future__ import annotations

import numpy as np
from fastapi import APIRouter, Request, Response

from app import config
from app.api.data import BundleDep, Mv
from app.schemas.plan import PlanAssumptions, PlanOut, PlanRowOut, PlanSummaryOut
from app.services.planner import MICRO, MachineScore, Plan, PlanInputs, compute_plan
from app.validation import check_mv, parse_json_object, parse_plan_body

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
    "planned_spend": "Planned spend = shortlisted machines x planned maintenance cost. Illustrative.",
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


@router.post("/plan", response_model=PlanOut)
async def plan(request: Request, response: Response, b: BundleDep, mv: Mv = None) -> PlanOut:
    response.headers["Cache-Control"] = config.CACHE_NO_STORE
    check_mv(b, mv)
    req = parse_plan_body(b, parse_json_object(await request.body()))
    scores = np.round(np.asarray(b.scores["main"][:, req.at_index], dtype=np.float64), 6)
    machines = _machine_scores(b.meta["machines"], scores)
    result = compute_plan(machines, req.inputs, config.MACHINE_MODELS)
    return _response(b.model_version, req.at.isoformat(), req.inputs, result)
