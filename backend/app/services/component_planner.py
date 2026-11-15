"""Component planner: pure, deterministic arithmetic (spec step 3; decisions 77 and 79).

Everything is ILLUSTRATIVE or an ESTIMATE: costs are user-set assumptions, shutdown windows are assumed, and
the 7 to 14 day wear chance is a weak ranking signal in this simulated data (no alert cut-off).

Rules:
- each machine-part pair has a wear chance (within the horizon, scored daily) and a 48-hour warning chance;
- chance before the next window assumes failures are spread evenly over the horizon:
  wear = 1 - (1 - p_wear) ^ (min(days to window, horizon) / horizon);
  warning = 1 - (1 - p_48h) ^ (min(days to window, 2) / 2); the larger of the two is used;
- the window is the machine model's next weekly window start strictly after the scoring hour;
- expected exposure = chance before window x the part's failure cost;
- ranked by exposure, highest first; ties go to the higher chance, then the lower machine number, then
  the part;
- crew slots are PER WINDOW: the first `crew_slots` ranked pairs with some exposure in each window are
  shortlisted, the rest of that window are over capacity;
- planned spend = sum of the shortlisted parts' planned costs; net benefit only when a risk reduction is
  assumed: shortlisted exposure x reduction - planned spend.

Exposure is exact: chances are rounded to millionths, costs are whole units."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from fractions import Fraction
from typing import Literal

MICRO = 1_000_000
Listing = Literal["shortlisted", "over_capacity", "no_exposure"]
Signal = Literal["warning", "wear"]


@dataclass(frozen=True)
class PartScore:
    machine_id: int
    model: str
    age: int
    part: str
    wear_chance: float  # within the horizon
    warning_chance: float  # within 48 hours
    warning_active: bool  # 48-hour chance at or above the part's warning cut-off
    days_since: float


@dataclass(frozen=True)
class ComponentInputs:
    horizon_days: int
    failure_cost: int
    failure_cost_by_part: Mapping[str, int]
    planned_cost: int
    planned_cost_by_part: Mapping[str, int]
    crew_slots: int
    risk_reduction_percent: int | None


@dataclass(frozen=True)
class PartRow:
    rank: int
    score: PartScore
    window_start: datetime
    days_to_window: float
    chance_before_window: float
    signal: Signal
    failure_cost: int
    planned_cost: int
    expected_exposure: float
    listing: Listing
    slot: int | None
    net_benefit: float | None


@dataclass(frozen=True)
class WindowSummary:
    models: tuple[str, ...]
    start: datetime
    shortlisted: int


@dataclass(frozen=True)
class ComponentSummary:
    parts_ranked: int
    rows_returned: int
    warning_parts: int
    crew_slots_per_window: int
    slots_used: int
    shortlist_exposure: float
    planned_spend: int
    net_benefit: float | None
    windows: tuple[WindowSummary, ...]


@dataclass(frozen=True)
class ComponentPlan:
    rows: tuple[PartRow, ...]
    summary: ComponentSummary


def next_window_start(at: datetime, window: Mapping[str, int]) -> datetime:
    """The weekly window's start strictly after `at` (inside a window now, it is the following week's)."""
    ahead = (window["weekday"] - at.weekday()) % 7
    start = at.replace(hour=window["start_hour"], minute=0, second=0, microsecond=0) + timedelta(days=ahead)
    return start if start > at else start + timedelta(days=7)


def chance_before_window(p: float, days_to_window: float, span_days: float) -> float:
    """Chance of failing within `span_days`, scaled to the days left before the window (even spread)."""
    return float(1.0 - (1.0 - p) ** (min(days_to_window, span_days) / span_days))


def _units(micro_units: int | Fraction) -> float:
    return round(float(Fraction(micro_units) / MICRO), 6)


def compute_component_plan(
    parts: Sequence[PartScore],
    at: datetime,
    inputs: ComponentInputs,
    windows: Mapping[str, Mapping[str, int]],
    rows_max: int,
) -> ComponentPlan:
    start_of = {m: next_window_start(at, w) for m, w in windows.items()}
    scored = []
    for p in parts:
        start = start_of[p.model]
        d = (start - at) / timedelta(days=1)
        wear = chance_before_window(p.wear_chance, d, inputs.horizon_days)
        warn = chance_before_window(p.warning_chance, d, 2.0)
        micro = round(max(wear, warn) * MICRO)
        signal: Signal = "warning" if p.warning_active and warn >= wear else "wear"
        cost = inputs.failure_cost_by_part.get(p.part, inputs.failure_cost)
        scored.append((p, start, d, micro, signal, cost))

    scored.sort(key=lambda r: (-r[3] * r[5], -r[3], r[0].machine_id, r[0].part))
    reduction = inputs.risk_reduction_percent
    used: dict[datetime, int] = {}
    rows: list[PartRow] = []
    spend = shortlist_exposure = 0
    benefit = Fraction(0)
    n_exposed = 0
    for rank, (p, start, d, micro, signal, cost) in enumerate(scored, start=1):
        planned = inputs.planned_cost_by_part.get(p.part, inputs.planned_cost)
        exposure = micro * cost
        listing: Listing = "no_exposure"
        slot: int | None = None
        net: float | None = None
        if exposure > 0:
            n_exposed += 1
            if used.get(start, 0) < inputs.crew_slots:
                used[start] = used.get(start, 0) + 1
                slot, listing = used[start], "shortlisted"
                spend += planned
                shortlist_exposure += exposure
                if reduction is not None:
                    row_net = Fraction(exposure * reduction, 100) - planned * MICRO
                    benefit += row_net
                    net = _units(row_net)
            else:
                listing = "over_capacity"
        if rank <= rows_max:
            rows.append(
                PartRow(
                    rank=rank,
                    score=p,
                    window_start=start,
                    days_to_window=round(d, 4),
                    chance_before_window=micro / MICRO,
                    signal=signal,
                    failure_cost=cost,
                    planned_cost=planned,
                    expected_exposure=_units(exposure),
                    listing=listing,
                    slot=slot,
                    net_benefit=net,
                )
            )
    summary = ComponentSummary(
        parts_ranked=n_exposed,
        rows_returned=len(rows),
        warning_parts=sum(1 for r in scored if r[4] == "warning"),
        crew_slots_per_window=inputs.crew_slots,
        slots_used=sum(used.values()),
        shortlist_exposure=_units(shortlist_exposure),
        planned_spend=spend,
        net_benefit=_units(benefit) if reduction is not None else None,
        windows=tuple(
            WindowSummary(
                models=tuple(sorted(m for m, st in start_of.items() if st == s)), start=s, shortlisted=n
            )
            for s, n in sorted(used.items())
        ),
    )
    return ComponentPlan(rows=tuple(rows), summary=summary)
