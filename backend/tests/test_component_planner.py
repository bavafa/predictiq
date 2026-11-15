"""Component planner arithmetic, worked by hand (spec step 3; decisions 77, 79). All illustrative."""

from datetime import datetime

import pytest
from app.services.component_planner import (
    ComponentInputs,
    PartScore,
    chance_before_window,
    compute_component_plan,
    next_window_start,
)

SUN = {"weekday": 6, "start_hour": 6, "hours": 12}
MON = {"weekday": 0, "start_hour": 6, "hours": 12}
WINDOWS = {"model1": SUN, "model2": MON}
AT = datetime(2015, 11, 4, 12, 0)  # a Wednesday
INPUTS = ComponentInputs(
    horizon_days=14,
    failure_cost=1000,
    failure_cost_by_part={"comp2": 3000},
    planned_cost=100,
    planned_cost_by_part={},
    crew_slots=1,
    risk_reduction_percent=None,
)


def part(m: int, model: str, comp: str, wear: float, warn: float = 0.0, active: bool = False) -> PartScore:
    return PartScore(m, model, 5, comp, wear, warn, active, 40.0)


def test_next_window_is_strictly_after_now() -> None:
    assert next_window_start(AT, SUN) == datetime(2015, 11, 8, 6, 0)
    assert next_window_start(datetime(2015, 11, 8, 6, 0), SUN) == datetime(2015, 11, 15, 6, 0)  # at the start
    assert next_window_start(datetime(2015, 11, 8, 10, 0), SUN) == datetime(2015, 11, 15, 6, 0)  # inside it
    assert next_window_start(datetime(2015, 11, 8, 5, 0), SUN) == datetime(2015, 11, 8, 6, 0)


def test_chance_before_window() -> None:
    assert chance_before_window(0.2, 7.0, 14.0) == pytest.approx(1 - 0.8**0.5)
    assert chance_before_window(0.2, 20.0, 14.0) == pytest.approx(0.2)  # never above the horizon's chance
    assert chance_before_window(0.2, 0.0, 14.0) == 0.0
    assert chance_before_window(0.5, 1.0, 2.0) == pytest.approx(1 - 0.5**0.5)


def test_ranking_by_exposure_slots_per_window_and_spend() -> None:
    # model1 window is in 3.75 days, model2's in 4.75 days; wear chance is scaled to each
    parts = [
        part(1, "model1", "comp1", 0.10),  # cost 1000
        part(2, "model1", "comp2", 0.05),  # cost 3000 -> higher exposure than machine 1 comp1
        part(3, "model2", "comp1", 0.10),  # other window: has its own slot
        part(4, "model2", "comp3", 0.0),  # no chance: no exposure, never shortlisted
    ]
    plan = compute_component_plan(parts, AT, INPUTS, WINDOWS, rows_max=100)
    by_id = {r.score.machine_id: r for r in plan.rows}
    exp = {
        m: chance_before_window(p.wear_chance, 3.75 if p.model == "model1" else 4.75, 14.0)
        for m, p in ((1, parts[0]), (3, parts[2]))
    }
    assert by_id[3].chance_before_window == pytest.approx(exp[3], abs=1e-6)
    assert by_id[2].listing == "shortlisted" and by_id[2].slot == 1  # first in the model1 window
    assert by_id[1].listing == "over_capacity" and by_id[1].slot is None  # one slot per window
    assert by_id[3].listing == "shortlisted" and by_id[3].slot == 1  # model2 window has its own slot
    assert by_id[4].listing == "no_exposure" and by_id[4].expected_exposure == 0.0
    s = plan.summary
    assert (s.parts_ranked, s.slots_used, s.planned_spend) == (3, 2, 200)
    assert [w.models for w in s.windows] == [("model1",), ("model2",)]
    assert s.net_benefit is None and all(r.net_benefit is None for r in plan.rows)


def test_net_benefit_only_with_a_reduction() -> None:
    parts = [part(1, "model1", "comp2", 0.10)]
    on = ComponentInputs(14, 1000, {"comp2": 3000}, 100, {}, 1, 50)
    plan = compute_component_plan(parts, AT, on, WINDOWS, 100)
    exposure = plan.rows[0].expected_exposure
    assert plan.summary.net_benefit == pytest.approx(exposure * 0.5 - 100, abs=1e-6)
    assert plan.rows[0].net_benefit == plan.summary.net_benefit


def test_warning_drives_the_signal_and_the_chance() -> None:
    parts = [
        part(1, "model1", "comp1", 0.01, warn=0.8, active=True),
        part(2, "model1", "comp1", 0.01, warn=0.8),
    ]
    rows = {r.score.machine_id: r for r in compute_component_plan(parts, AT, INPUTS, WINDOWS, 100).rows}
    assert rows[1].signal == "warning" and rows[2].signal == "wear"  # the cut-off flag decides the label
    assert rows[1].chance_before_window == pytest.approx(0.8, abs=1e-6)  # window is over 2 days away
    assert rows[1].chance_before_window == rows[2].chance_before_window  # same numbers either way


def test_rows_are_capped_but_counts_are_not() -> None:
    parts = [part(i, "model1", "comp1", 0.05) for i in range(1, 11)]
    plan = compute_component_plan(parts, AT, INPUTS, WINDOWS, rows_max=3)
    assert len(plan.rows) == 3 and plan.summary.rows_returned == 3 and plan.summary.parts_ranked == 10


def test_ties_go_to_the_lower_machine_number_then_part() -> None:
    parts = [part(2, "model1", "comp1", 0.1), part(1, "model1", "comp1", 0.1)]
    assert [r.score.machine_id for r in compute_component_plan(parts, AT, INPUTS, WINDOWS, 100).rows] == [
        1,
        2,
    ]
