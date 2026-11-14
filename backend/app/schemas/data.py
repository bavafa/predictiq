"""Response bodies of the data endpoints. Scores are rounded to 6 decimals to keep responses small."""

from typing import Literal

from pydantic import BaseModel, ConfigDict

Status = Literal["alert", "below_cutoff"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class FleetCards(_Strict):
    machines_shown: int
    machines_in_alert: int
    highest_score: float | None
    scored_hour: str


class DistributionBin(_Strict):
    low: float
    high: float
    count: int


class LatestError(_Strict):
    error: str
    time: str


class FleetRow(_Strict):
    rank: int
    machine_id: int
    model: str
    age: int
    score: float
    status: Status
    latest_error: LatestError | None


class Fleet(_Strict):
    model_version: str
    at: str
    cutoff_percent: int
    cards: FleetCards
    distribution: list[DistributionBin]
    rows: list[FleetRow]


class TrendPoint(_Strict):
    hour: str
    machines_in_alert: int


class FleetTrend(_Strict):
    model_version: str
    at: str
    cutoff_percent: int
    range: Literal["24h", "7d"]
    machines_in_population: int
    points: list[TrendPoint]


class ScorePoint(_Strict):
    hour: str
    score: float


class ErrorRecord(_Strict):
    time: str
    error: str


class RepairRecord(_Strict):
    time: str
    component: str


class FailureRecord(_Strict):
    time: str
    components: list[str]


class Asset(_Strict):
    model_version: str
    machine_id: int
    model: str
    age: int
    at: str
    cutoff_percent: int
    score: float
    status: Status
    past_estimates: list[ScorePoint]
    errors: list[ErrorRecord]
    repairs: list[RepairRecord]
    failures: list[FailureRecord]


class TelemetryRow(_Strict):
    hour: str
    volt: float | None
    rotate: float | None
    pressure: float | None
    vibration: float | None


class Telemetry(_Strict):
    model_version: str
    machine_id: int
    at: str
    range: Literal["24h", "7d"]
    rows: list[TelemetryRow]


class Contribution(_Strict):
    feature: str
    contribution: float


class Explanation(_Strict):
    model_version: str
    machine_id: int
    at: str
    score: float
    unit: str
    base_value: float
    contributions: list[Contribution]
    all_others: float
    caveat: str
