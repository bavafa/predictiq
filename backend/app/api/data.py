"""Read-only data endpoints served from the bundle (docs/architecture.md, "Data service contract").

Every record is stamped strictly before the hour asked about (`at`), as the model saw it: sensor rows, errors,
repairs and failures all have a time < at. The score for hour `at` itself is allowed: it was computed only
from records before `at`."""

from __future__ import annotations

import math
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Any

import numpy as np
from fastapi import APIRouter, Depends, Query, Response

from app import config
from app.bundle import SENSORS, Bundle, BundleError, get_bundle
from app.problems import ProblemError
from app.schemas.data import (
    Asset,
    Contribution,
    DistributionBin,
    ErrorRecord,
    Explanation,
    FailureRecord,
    Fleet,
    FleetCards,
    FleetRow,
    FleetTrend,
    RepairRecord,
    ScorePoint,
    Status,
    Telemetry,
    TelemetryRow,
    TrendPoint,
)
from app.validation import (
    RANGE_HOURS,
    check_mv,
    parse_at,
    parse_cutoff,
    parse_machine,
    parse_machine_model,
    parse_range,
    parse_status,
)

router = APIRouter()

CAVEAT = (
    "These are patterns the model used, not proven causes. Pushes are in log-odds of a failure within 24 "
    "hours; positive pushes raise the estimate, negative ones lower it. Simulated data."
)


def require_bundle() -> Bundle:
    try:
        bundle = get_bundle()
    except BundleError:
        raise ProblemError(503, "Model data unavailable", "The serving bundle could not be read.") from None
    if bundle is None:
        raise ProblemError(
            503, "Model data unavailable", "No serving bundle is installed in this deployment."
        )
    return bundle


BundleDep = Annotated[Bundle, Depends(require_bundle)]
Mv = Annotated[str | None, Query()]
Param = Annotated[str | None, Query()]


def _cached(response: Response) -> None:
    response.headers["Cache-Control"] = config.CACHE_DATA


def _iso(t: datetime) -> str:
    return t.isoformat()


def _r(x: float) -> float:
    return round(float(x), 6)


def _scores(a: Any) -> np.ndarray:
    """Scores as served: 6 decimals. Ranking, status and alert counts all use these same numbers."""
    return np.round(np.asarray(a, dtype=np.float64), 6)


def _status(score: float, cutoff: int) -> Status:
    return "alert" if score >= cutoff / 100.0 else "below_cutoff"


def _population(
    b: Bundle, idx: int, cutoff: int, machine_model: str | None, status: str | None, machine: str | None
) -> np.ndarray:
    """Boolean mask over machines (rows) matching the filters at hour index `idx`."""
    mask = np.ones(b.n_machines, dtype=bool)
    machines = b.meta["machines"]
    if machine_model is not None:
        mask &= np.array([m["model"] == machine_model for m in machines])
    if machine is not None:
        mask &= np.arange(1, b.n_machines + 1) == parse_machine(b, machine)
    if status is not None:
        alert = _scores(b.scores["main"][:, idx]) >= cutoff / 100.0
        mask &= alert if status == "alert" else ~alert
    return mask


@router.get("/fleet", response_model=Fleet)
def fleet(
    response: Response,
    b: BundleDep,
    mv: Mv = None,
    at: Param = None,
    cutoff: Param = None,
    machine_model: Param = None,
    status: Param = None,
    machine: Param = None,
) -> Fleet:
    check_mv(b, mv)
    idx, t = parse_at(b, at)
    cut = parse_cutoff(b, cutoff)
    model, st = parse_machine_model(machine_model), parse_status(status)
    mask = _population(b, idx, cut, model, st, machine)
    scores = _scores(b.scores["main"][:, idx])
    ids = np.flatnonzero(mask)
    # Rank: highest score first, ties to the lower machine number (stable sort on a descending key).
    order = ids[np.argsort(-scores[ids], kind="stable")]
    rows = []
    for rank, i in enumerate(order, start=1):
        info = b.meta["machines"][int(i)]
        s = float(scores[i])
        rows.append(
            FleetRow(
                rank=rank,
                machine_id=int(i) + 1,
                model=info["model"],
                age=int(info["age"]),
                score=_r(s),
                status=_status(s, cut),
            )
        )
    in_alert = sum(1 for r in rows if r.status == "alert")
    bins = np.minimum((scores[ids] * 10).astype(int), 9)
    counts = np.bincount(bins, minlength=10) if len(ids) else np.zeros(10, dtype=int)
    _cached(response)
    return Fleet(
        model_version=b.model_version,
        at=_iso(t),
        cutoff_percent=cut,
        cards=FleetCards(
            machines_shown=len(rows),
            machines_in_alert=in_alert,
            highest_score=rows[0].score if rows else None,
            scored_hour=_iso(t),
        ),
        distribution=[
            DistributionBin(low=k / 10, high=(k + 1) / 10, count=int(counts[k])) for k in range(10)
        ],
        rows=rows,
    )


@router.get("/fleet/trend", response_model=FleetTrend)
def fleet_trend(
    response: Response,
    b: BundleDep,
    mv: Mv = None,
    at: Param = None,
    cutoff: Param = None,
    range: Param = None,  # noqa: A002  (the query parameter is called `range`)
    machine_model: Param = None,
    status: Param = None,
    machine: Param = None,
) -> FleetTrend:
    check_mv(b, mv)
    idx, t = parse_at(b, at)
    cut = parse_cutoff(b, cutoff)
    rng = parse_range(range)
    mask = _population(b, idx, cut, parse_machine_model(machine_model), parse_status(status), machine)
    # Hours (at - range + 1) .. at, never before the first scored hour (no scores exist earlier).
    lo = max(idx - RANGE_HOURS[rng] + 1, 0)
    block = _scores(b.scores["main"][mask][:, lo : idx + 1])
    alerts = (block >= cut / 100.0).sum(axis=0)
    points = [
        TrendPoint(hour=_iso(b.hour_at(lo + k)), machines_in_alert=int(n)) for k, n in enumerate(alerts)
    ]
    _cached(response)
    return FleetTrend(
        model_version=b.model_version,
        at=_iso(t),
        cutoff_percent=cut,
        range=rng,
        machines_in_population=int(mask.sum()),
        points=points,
    )


def _window(b: Bundle, idx: int) -> tuple[int, int]:
    """Telemetry-grid hour offsets [from, to) of the 7 days strictly before the test-grid hour `idx`."""
    end = b.tel_index(b.hour_at(idx))
    return max(end - RANGE_HOURS["7d"], 0), end


def _pick(records: dict[int, list[tuple[int, Any]]], machine: int, lo: int, hi: int) -> list[tuple[int, Any]]:
    return [(h, v) for h, v in records.get(machine, []) if lo <= h < hi]


@router.get("/assets/{machine_id}", response_model=Asset)
def asset(
    machine_id: str,
    response: Response,
    b: BundleDep,
    mv: Mv = None,
    at: Param = None,
    cutoff: Param = None,
) -> Asset:
    m = parse_machine(b, machine_id)
    check_mv(b, mv)
    idx, t = parse_at(b, at)
    cut = parse_cutoff(b, cutoff)
    info = b.meta["machines"][m - 1]
    score = float(_scores(b.scores["main"][m - 1, idx]))
    lo, hi = _window(b, idx)
    first = max(idx - RANGE_HOURS["7d"] + 1, 0)
    past = _scores(b.scores["main"][m - 1, first : idx + 1])
    _cached(response)
    return Asset(
        model_version=b.model_version,
        machine_id=m,
        model=info["model"],
        age=int(info["age"]),
        at=_iso(t),
        cutoff_percent=cut,
        score=_r(score),
        status=_status(score, cut),
        past_estimates=[ScorePoint(hour=_iso(b.hour_at(first + k)), score=_r(s)) for k, s in enumerate(past)],
        errors=[ErrorRecord(time=_iso(b.tel_hour_at(h)), error=v) for h, v in _pick(b.errors, m, lo, hi)],
        repairs=[
            RepairRecord(time=_iso(b.tel_hour_at(h)), component=v) for h, v in _pick(b.repairs, m, lo, hi)
        ],
        failures=[
            FailureRecord(time=_iso(b.tel_hour_at(h)), components=list(v))
            for h, v in _pick(b.failures, m, lo, hi)
        ],
    )


def _num(x: float) -> float | None:
    return None if math.isnan(x) else round(float(x), 3)


@router.get("/assets/{machine_id}/telemetry", response_model=Telemetry)
def telemetry(
    machine_id: str,
    response: Response,
    b: BundleDep,
    mv: Mv = None,
    at: Param = None,
    range: Param = None,  # noqa: A002
) -> Telemetry:
    m = parse_machine(b, machine_id)
    check_mv(b, mv)
    idx, t = parse_at(b, at)
    rng = parse_range(range)
    end = b.tel_index(b.hour_at(idx))  # readings stamped before `at` are rows < end
    start = max(end - RANGE_HOURS[rng], 0)
    block = b.telemetry[m - 1, start:end, :]
    rows = [
        TelemetryRow(hour=_iso(b.tel_hour_at(start + k)), **dict(zip(SENSORS, map(_num, row), strict=True)))
        for k, row in enumerate(block.tolist())
    ]
    _cached(response)
    return Telemetry(model_version=b.model_version, machine_id=m, at=_iso(t), range=rng, rows=rows)


@router.get("/assets/{machine_id}/explanation", response_model=Explanation)
def explanation(
    machine_id: str,
    response: Response,
    b: BundleDep,
    mv: Mv = None,
    at: Param = None,
) -> Explanation:
    m = parse_machine(b, machine_id)
    check_mv(b, mv)
    idx, t = parse_at(b, at)
    features: list[str] = b.meta["features"]
    codes = b.codes[m - 1, idx]
    values = b.values[m - 1, idx]
    _cached(response)
    return Explanation(
        model_version=b.model_version,
        machine_id=m,
        at=_iso(t),
        score=_r(b.scores["main"][m - 1, idx]),
        unit="log-odds",
        base_value=_r(b.meta["contribution"]["base_value"]),
        contributions=[
            Contribution(feature=features[int(c)], contribution=_r(v))
            for c, v in zip(codes.tolist(), values.tolist(), strict=True)
        ],
        all_others=_r(b.other[m - 1, idx]),
        caveat=CAVEAT,
    )


def _static(getter: Callable[[Bundle], dict[str, Any]]) -> Callable[..., dict[str, Any]]:
    def endpoint(response: Response, b: BundleDep, mv: Mv = None) -> dict[str, Any]:
        check_mv(b, mv)
        _cached(response)
        return getter(b)

    return endpoint


router.add_api_route("/model/metrics", _static(lambda b: b.evaluation), methods=["GET"])
router.add_api_route("/model/threshold-analysis", _static(lambda b: b.threshold), methods=["GET"])
