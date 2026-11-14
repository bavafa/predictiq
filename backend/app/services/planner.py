"""Maintenance planner: pure, deterministic arithmetic (decisions 6, 16, 21, 23).

Everything is ILLUSTRATIVE: the dataset has no money figures, so every cost is a user-set assumption.

Rules (docs/ux-spec.md, "Maintenance Planner" and "What each Planner input changes"):
- expected exposure = predicted chance of failure in the next 24 hours x failure cost (the machine model's own
  cost where one is set, else the shared cost);
- the list is ranked by exposure, highest first; ties go to the higher chance, then the lower machine number;
- the list holds the machines at or above the alert cut-off, plus the ones below it if asked (marked, and
  never shortlisted, decision 23);
- the shortlist is the first `crew_slots` machines at or above the cut-off going down the list; the rest of
  those are "over capacity"; spare slots stay empty;
- planned spend = shortlisted machines x planned cost;
- net benefit exists ONLY when a risk-reduction assumption is set: shortlisted exposure x reduction - planned
  spend. It is an estimate under that assumption, not a measured result;
- when per-model costs differ, each row's `moved` is its rank in the order by predicted chance alone minus its
  rank now (positive = moved up).

Arithmetic is exact: scores arrive rounded to 6 decimals and are turned into whole millionths, costs are whole
units, so exposure is an integer count of millionths of a unit and ties are real ties, not float noise."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from fractions import Fraction
from typing import Literal

MICRO = 1_000_000
Listing = Literal["shortlisted", "over_capacity", "below_cutoff"]


@dataclass(frozen=True)
class MachineScore:
    machine_id: int
    model: str
    age: int
    score_micro: int  # predicted chance in millionths (0..1_000_000)


@dataclass(frozen=True)
class PlanInputs:
    cutoff_percent: int
    failure_cost: int  # shared cost, whole units
    failure_cost_by_model: Mapping[str, int]  # overrides for some machine models
    planned_cost: int  # per shortlisted machine, whole units
    crew_slots: int
    risk_reduction_percent: int | None  # None = off
    include_below_cutoff: bool = False


@dataclass(frozen=True)
class PlanRow:
    rank: int
    machine_id: int
    model: str
    age: int
    score: float
    at_or_above_cutoff: bool
    failure_cost: int
    expected_exposure: float
    listing: Listing
    slot: int | None
    moved: int | None
    net_benefit: float | None


@dataclass(frozen=True)
class PlanSummary:
    machines_at_or_above_cutoff: int
    machines_listed: int
    crew_slots: int
    slots_used: int
    spare_slots: int
    shortlist_exposure: float
    planned_spend: int
    net_benefit: float | None


@dataclass(frozen=True)
class Plan:
    rows: tuple[PlanRow, ...]
    summary: PlanSummary
    costs_differ: bool
    order_changed: bool | None  # None when per-model costs do not differ


def _units(micro_units: int | Fraction) -> float:
    """Millionths of a unit -> units, as a number with at most 6 decimals."""
    return round(float(Fraction(micro_units) / MICRO), 6)


def cost_for(model: str, inputs: PlanInputs) -> int:
    return inputs.failure_cost_by_model.get(model, inputs.failure_cost)


def compute_plan(machines: Sequence[MachineScore], inputs: PlanInputs, models: Sequence[str]) -> Plan:
    """`models` is every machine model that exists (to decide whether per-model costs differ)."""
    cutoff_micro = inputs.cutoff_percent * (MICRO // 100)
    costs_differ = len({cost_for(m, inputs) for m in models}) > 1

    listed = [m for m in machines if inputs.include_below_cutoff or m.score_micro >= cutoff_micro]
    # Exposure in millionths of a unit: exact integers.
    exposure = {m.machine_id: m.score_micro * cost_for(m.model, inputs) for m in listed}

    def by_exposure(m: MachineScore) -> tuple[int, int, int]:
        return (-exposure[m.machine_id], -m.score_micro, m.machine_id)

    def by_chance(m: MachineScore) -> tuple[int, int]:
        return (-m.score_micro, m.machine_id)

    ordered = sorted(listed, key=by_exposure)
    chance_rank = {m.machine_id: i for i, m in enumerate(sorted(listed, key=by_chance), start=1)}

    reduction = inputs.risk_reduction_percent
    planned = inputs.planned_cost
    rows: list[PlanRow] = []
    slots_used = 0
    shortlist_exposure = 0
    benefit_total = Fraction(0)
    for rank, m in enumerate(ordered, start=1):
        above = m.score_micro >= cutoff_micro
        slot: int | None = None
        listing: Listing = "below_cutoff"
        if above:
            if slots_used < inputs.crew_slots:
                slots_used += 1
                slot = slots_used
                listing = "shortlisted"
            else:
                listing = "over_capacity"
        net: float | None = None
        if listing == "shortlisted":
            shortlist_exposure += exposure[m.machine_id]
            if reduction is not None:
                row_net = Fraction(exposure[m.machine_id] * reduction, 100) - planned * MICRO
                benefit_total += row_net
                net = _units(row_net)
        rows.append(
            PlanRow(
                rank=rank,
                machine_id=m.machine_id,
                model=m.model,
                age=m.age,
                score=m.score_micro / MICRO,
                at_or_above_cutoff=above,
                failure_cost=cost_for(m.model, inputs),
                expected_exposure=_units(exposure[m.machine_id]),
                listing=listing,
                slot=slot,
                moved=chance_rank[m.machine_id] - rank if costs_differ else None,
                net_benefit=net,
            )
        )
    summary = PlanSummary(
        machines_at_or_above_cutoff=sum(1 for m in machines if m.score_micro >= cutoff_micro),
        machines_listed=len(rows),
        crew_slots=inputs.crew_slots,
        slots_used=slots_used,
        spare_slots=inputs.crew_slots - slots_used,
        shortlist_exposure=_units(shortlist_exposure),
        planned_spend=slots_used * planned,
        net_benefit=_units(benefit_total) if reduction is not None else None,
    )
    order_changed = any(r.moved for r in rows) if costs_differ else None
    return Plan(rows=tuple(rows), summary=summary, costs_differ=costs_differ, order_changed=order_changed)
