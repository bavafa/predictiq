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
    planned_cost_by_model: dict[str, int]
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
    planned_cost: int
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


class ComponentPlanAssumptions(_Strict):
    horizon_days: int
    failure_cost: int
    failure_cost_by_part: dict[str, int]
    planned_cost: int
    planned_cost_by_part: dict[str, int]
    crew_slots_per_window: int
    risk_reduction_percent: int | None


class ComponentRowOut(_Strict):
    rank: int
    machine_id: int
    model: str
    age: int
    part: str
    part_name: str
    wear_chance: float  # within the horizon (weak signal in this data)
    warning_chance_48h: float
    warning_active: bool
    signal: Literal["warning", "wear"]
    days_since_replacement: float
    window_start: str
    days_to_window: float
    chance_before_window: float
    failure_cost: int
    planned_cost: int
    expected_exposure: float
    listing: Literal["shortlisted", "over_capacity", "no_exposure"]
    slot: int | None
    action: Literal["act_before_window", "replace_in_window", "over_capacity", "watch"]
    net_benefit: float | None


class WindowOut(_Strict):
    models: list[str]
    start: str
    shortlisted: int


class ComponentSummaryOut(_Strict):
    parts_ranked: int
    rows_returned: int
    warning_parts: int
    crew_slots_per_window: int
    slots_used: int
    shortlist_exposure: float
    planned_spend: int
    net_benefit: float | None
    net_benefit_label: str | None
    windows: list[WindowOut]


class ComponentPlanOut(_Strict):
    level: Literal["component"]
    model_version: str
    component_model_version: str
    at: str
    label: str
    unit: str
    horizon_days: int
    honesty: str
    assumptions: ComponentPlanAssumptions
    summary: ComponentSummaryOut
    rows: list[ComponentRowOut]
    names: dict[str, str]
    names_note: str
    windows_note: str
    notes: list[str]
    formulas: dict[str, str]


class ComponentPartOut(_Strict):
    part: str
    part_name: str
    wear_chance: float
    chance_before_window: float
    warning_chance_48h: float
    warning_active: bool
    warning_cutoff_percent: int
    days_since_replacement: float


class ComponentsOut(_Strict):
    model_version: str
    component_model_version: str
    machine_id: int
    model: str
    age: int
    at: str
    horizon_days: int
    window_start: str
    days_to_window: float
    honesty: str
    names_note: str
    windows_note: str
    parts: list[ComponentPartOut]
