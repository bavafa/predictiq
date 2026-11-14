"""Exact request validation for the data endpoints (docs/architecture.md, "Validation").

Out-of-range values are refused with problem+json, never adjusted. Messages name the parameter, never the
submitted value."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal, cast

from app import config
from app.bundle import Bundle
from app.problems import ProblemError

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
