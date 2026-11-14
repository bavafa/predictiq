"""POST /plan response. Every money figure is illustrative; no field or label claims savings."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class PlanAssumptions(_Strict):
    cutoff_percent: int
    failure_cost: int
    failure_cost_by_model: dict[str, int]
    planned_cost: int
    crew_slots: int
    risk_reduction_percent: int | None
    include_below_cutoff: bool


class PlanRowOut(_Strict):
    rank: int
    machine_id: int
    model: str
    age: int
    score: float
    status: Literal["alert", "below_cutoff"]
    failure_cost: int
    expected_exposure: float
    listing: Literal["shortlisted", "over_capacity", "below_cutoff"]
    slot: int | None
    moved: int | None  # places moved up (+) or down (-) versus the order by predicted chance alone
    net_benefit: float | None  # estimate: shortlisted rows only, and only when a risk reduction is assumed


class PlanSummaryOut(_Strict):
    machines_at_or_above_cutoff: int
    machines_listed: int
    crew_slots: int
    slots_used: int
    spare_slots: int
    shortlist_exposure: float
    planned_spend: int
    net_benefit: float | None
    net_benefit_label: str | None


class PlanOut(_Strict):
    model_version: str
    at: str
    label: str
    unit: str
    assumptions: PlanAssumptions
    order_changed: bool | None
    order_note: str | None
    summary: PlanSummaryOut
    rows: list[PlanRowOut]
    formulas: dict[str, str]
