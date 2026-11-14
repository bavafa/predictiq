from typing import Literal

from pydantic import BaseModel, ConfigDict


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Health(_Strict):
    status: Literal["ok"]
    model_version: str | None


class Dataset(_Strict):
    name: str
    publisher: str
    source: str
    pinned_commit: str
    simulated: Literal[True]


class ReplayWindow(_Strict):
    start: str
    end: str
    status: Literal["planned"]


class Metadata(_Strict):
    app_name: str
    version: str
    dataset: Dataset
    model_version: str | None
    model_available: bool
    replay_window: ReplayWindow


class Problem(_Strict):
    """Standard problem-details error body (RFC 9457). Never carries stack traces."""

    type: str = "about:blank"
    title: str
    status: int
    detail: str | None = None
