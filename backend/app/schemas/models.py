from typing import Literal

from pydantic import BaseModel, ConfigDict


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Health(_Strict):
    status: Literal["ok"]
    model_version: str | None
    model_available: bool


class Dataset(_Strict):
    name: str
    publisher: str
    source: str
    pinned_commit: str
    simulated: Literal[True]


class ReplayWindow(_Strict):
    start: str
    end: str
    status: Literal["planned", "ready"]


class MachineInfo(_Strict):
    machine_id: int
    model: str
    age: int
    unseen: bool


class PlannerDefaults(_Strict):
    """Example costs for the planner. Illustrative, not real; the owner has not confirmed them."""

    label: Literal["illustrative"]
    unit: str
    failure_cost: dict[str, int]
    planned_repair_cost: dict[str, int]
    crew_slots: int


class ComponentPlannerInfo(_Strict):
    """Component planner facts the screen shows. Names, windows and costs are assumed or illustrative."""

    component_model_version: str
    names: dict[str, str]
    names_note: str
    horizons_days: list[int]
    default_horizon_days: int
    shutdown_windows: dict[str, dict[str, int]]
    windows_note: str
    default_failure_cost: dict[str, int]
    default_planned_cost: dict[str, int]
    warning_cutoff_percent: dict[str, int]
    honesty: str


class Metadata(_Strict):
    app_name: str
    version: str
    dataset: Dataset
    model_version: str | None
    model_available: bool
    replay_window: ReplayWindow
    planner_defaults: PlannerDefaults
    # Everything below stays empty until a bundle is present. Never filled with placeholders.
    synthetic: bool = False
    model_created: str | None = None
    default_cutoff_percent: int | None = None
    splits: dict[str, list[str]] | None = None
    replay_start: str | None = (
        None  # where playback begins (decision 30); the window itself starts earlier or here
    )
    replay_start_branch: str | None = None
    data_credit: str | None = None
    machines: list[MachineInfo] = []
    unseen_machines: list[int] = []
    component_planner: ComponentPlannerInfo | None = None


class Problem(_Strict):
    """Standard problem-details error body (RFC 9457). Never carries stack traces."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
