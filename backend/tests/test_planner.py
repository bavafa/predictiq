"""Planner arithmetic on hand-made cases, and what each input changes (docs/ux-spec.md table)."""

from dataclasses import replace

import pytest
from app.services.planner import MICRO, MachineScore, PlanInputs, compute_plan

MODELS = ("model1", "model2", "model3", "model4")


def ms(machine_id: int, model: str, chance: float, age: int = 5) -> MachineScore:
    return MachineScore(machine_id, model, age, round(chance * MICRO))


FLEET = [
    ms(1, "model1", 0.90),
    ms(2, "model2", 0.80),
    ms(3, "model3", 0.60),
    ms(4, "model4", 0.40),
    ms(5, "model1", 0.10),
]
BASE = PlanInputs(
    cutoff_percent=50,
    failure_cost=1000,
    failure_cost_by_model={},
    planned_cost=100,
    crew_slots=2,
    risk_reduction_percent=None,
)


def order(plan_rows: object) -> list[int]:
    return [r.machine_id for r in plan_rows]  # type: ignore[attr-defined]


def test_hand_arithmetic() -> None:
    p = compute_plan(FLEET, BASE, MODELS)
    assert order(p.rows) == [1, 2, 3]  # below the cut-off (0.4, 0.1) are not listed
    assert [r.expected_exposure for r in p.rows] == [900.0, 800.0, 600.0]
    assert [r.listing for r in p.rows] == ["shortlisted", "shortlisted", "over_capacity"]
    assert [r.slot for r in p.rows] == [1, 2, None]
    s = p.summary
    assert (s.machines_at_or_above_cutoff, s.machines_listed) == (3, 3)
    assert (s.slots_used, s.spare_slots) == (2, 0)
    assert s.shortlist_exposure == 1700.0
    assert s.planned_spend == 200
    assert s.net_benefit is None
    assert p.costs_differ is False and p.order_changed is None
    assert all(r.moved is None and r.net_benefit is None for r in p.rows)


def test_net_benefit_only_when_a_reduction_is_assumed() -> None:
    p = compute_plan(FLEET, replace(BASE, risk_reduction_percent=50), MODELS)
    # shortlisted exposure 1700 x 50% - spend 200 = 650; per row 900 x 50% - 100, 800 x 50% - 100.
    assert p.summary.net_benefit == 650.0
    assert [r.net_benefit for r in p.rows] == [350.0, 300.0, None]
    zero = compute_plan(FLEET, replace(BASE, risk_reduction_percent=0), MODELS)
    assert zero.summary.net_benefit == -200.0  # assumed 0% reduction: only the spend
    off = compute_plan(FLEET, BASE, MODELS)
    assert off.summary.net_benefit is None


def test_cut_off_is_inclusive() -> None:
    fleet = [ms(1, "model1", 0.5), ms(2, "model1", 0.499999)]
    p = compute_plan(fleet, BASE, MODELS)
    assert order(p.rows) == [1]


def test_shared_cost_scales_exposure_but_not_order_or_shortlist() -> None:
    a = compute_plan(FLEET, BASE, MODELS)
    b = compute_plan(FLEET, replace(BASE, failure_cost=3000), MODELS)
    assert order(a.rows) == order(b.rows)
    assert [r.listing for r in a.rows] == [r.listing for r in b.rows]
    assert [r.expected_exposure for r in b.rows] == [3 * r.expected_exposure for r in a.rows]
    assert b.summary.shortlist_exposure == 3 * a.summary.shortlist_exposure
    assert b.summary.planned_spend == a.summary.planned_spend


def test_per_model_costs_change_order_and_shortlist_and_mark_moves() -> None:
    p = compute_plan(FLEET, replace(BASE, failure_cost_by_model={"model3": 2000}), MODELS)
    assert order(p.rows) == [3, 1, 2]  # 1200, 900, 800
    assert [r.listing for r in p.rows] == ["shortlisted", "shortlisted", "over_capacity"]
    assert [r.moved for r in p.rows] == [2, -1, -1]  # versus the order by chance: 1, 2, 3
    assert p.costs_differ is True and p.order_changed is True
    assert p.summary.shortlist_exposure == 2100.0
    assert p.summary.planned_spend == 200  # planned spend does not depend on the costs


def test_per_model_costs_that_do_not_change_the_order_say_so() -> None:
    p = compute_plan(FLEET, replace(BASE, failure_cost_by_model={"model4": 2000}), MODELS)
    # model4 is below the cut-off and unlisted: costs differ, nothing moved.
    assert p.costs_differ is True and p.order_changed is False
    assert [r.moved for r in p.rows] == [0, 0, 0]


def test_equal_per_model_costs_count_as_one_cost() -> None:
    same = dict.fromkeys(MODELS, 1000)
    p = compute_plan(FLEET, replace(BASE, failure_cost_by_model=same), MODELS)
    assert p.costs_differ is False and p.order_changed is None


def test_crew_slots_change_the_shortlist_not_the_order() -> None:
    orders = set()
    for slots in (0, 1, 2, 3, 10):
        p = compute_plan(FLEET, replace(BASE, crew_slots=slots), MODELS)
        orders.add(tuple(order(p.rows)))
        assert p.summary.slots_used == min(slots, 3)
        assert p.summary.spare_slots == slots - min(slots, 3)
        assert p.summary.planned_spend == min(slots, 3) * 100
    assert len(orders) == 1
    none = compute_plan(FLEET, replace(BASE, crew_slots=0), MODELS)
    assert none.summary.shortlist_exposure == 0.0
    assert all(r.listing == "over_capacity" for r in none.rows)


def test_spare_slots_stay_empty_and_below_cutoff_is_never_shortlisted() -> None:
    p = compute_plan(FLEET, replace(BASE, crew_slots=5, include_below_cutoff=True), MODELS)
    assert order(p.rows) == [1, 2, 3, 4, 5]
    assert [r.listing for r in p.rows] == ["shortlisted"] * 3 + ["below_cutoff"] * 2
    assert p.summary.slots_used == 3 and p.summary.spare_slots == 2
    assert [r.slot for r in p.rows] == [1, 2, 3, None, None]
    assert p.summary.machines_at_or_above_cutoff == 3 and p.summary.machines_listed == 5


def test_below_cutoff_machines_slot_in_by_exposure_but_never_take_a_slot() -> None:
    # model4 is costly enough that machine 4 outranks the alert machines, yet it stays "below the cut-off".
    inputs = replace(BASE, failure_cost_by_model={"model4": 100_000}, include_below_cutoff=True, crew_slots=1)
    p = compute_plan(FLEET, inputs, MODELS)
    assert order(p.rows)[0] == 4 and p.rows[0].listing == "below_cutoff" and p.rows[0].slot is None
    assert [r.listing for r in p.rows if r.machine_id == 1] == ["shortlisted"]
    assert p.summary.slots_used == 1


def test_cut_off_changes_which_machines_are_listed_but_not_their_relative_order() -> None:
    full = compute_plan(FLEET, replace(BASE, cutoff_percent=0), MODELS)
    cut = compute_plan(FLEET, replace(BASE, cutoff_percent=70), MODELS)
    assert order(cut.rows) == [1, 2]
    assert order(cut.rows) == [m for m in order(full.rows) if m in order(cut.rows)]
    assert cut.summary.machines_listed == 2
    # Listing below the cut-off adds machines without reordering those already listed.
    plus = compute_plan(FLEET, replace(BASE, cutoff_percent=70, include_below_cutoff=True), MODELS)
    assert order(plus.rows) == order(full.rows)


def test_planned_cost_changes_spend_and_net_benefit_not_order() -> None:
    a = compute_plan(FLEET, replace(BASE, risk_reduction_percent=50), MODELS)
    b = compute_plan(FLEET, replace(BASE, risk_reduction_percent=50, planned_cost=300), MODELS)
    assert order(a.rows) == order(b.rows)
    assert [r.listing for r in a.rows] == [r.listing for r in b.rows]
    assert [r.expected_exposure for r in a.rows] == [r.expected_exposure for r in b.rows]
    assert (a.summary.planned_spend, b.summary.planned_spend) == (200, 600)
    assert (a.summary.net_benefit, b.summary.net_benefit) == (650.0, 250.0)


def test_risk_reduction_changes_only_net_benefit() -> None:
    a = compute_plan(FLEET, replace(BASE, risk_reduction_percent=10), MODELS)
    b = compute_plan(FLEET, replace(BASE, risk_reduction_percent=90), MODELS)
    assert [r.expected_exposure for r in a.rows] == [r.expected_exposure for r in b.rows]
    assert a.summary.planned_spend == b.summary.planned_spend
    assert (a.summary.net_benefit, b.summary.net_benefit) == (-30.0, 1330.0)


def test_ties_go_to_the_higher_chance_then_the_lower_machine_number() -> None:
    fleet = [
        ms(7, "model1", 0.50),
        ms(3, "model2", 0.80),
        ms(9, "model1", 0.50),
        ms(2, "model1", 0.50),
    ]
    inputs = replace(BASE, cutoff_percent=0, failure_cost_by_model={"model2": 625})
    p = compute_plan(fleet, inputs, MODELS)
    # All four expose 500: the 0.80 chance first, then equal chances by machine number.
    assert [r.expected_exposure for r in p.rows] == [500.0] * 4
    assert order(p.rows) == [3, 2, 7, 9]


def test_zero_costs_still_rank_by_chance() -> None:
    p = compute_plan(FLEET, replace(BASE, failure_cost=0, cutoff_percent=0), MODELS)
    assert order(p.rows) == [1, 2, 3, 4, 5]
    assert p.summary.shortlist_exposure == 0.0


def test_no_machine_in_alert() -> None:
    p = compute_plan(FLEET, replace(BASE, cutoff_percent=100), MODELS)
    assert p.rows == () and p.summary.slots_used == 0 and p.summary.spare_slots == 2
    assert p.summary.machines_at_or_above_cutoff == 0


def test_money_is_exact_for_awkward_chances() -> None:
    p = compute_plan([ms(1, "model1", 0.333333)], replace(BASE, failure_cost=7, cutoff_percent=0), MODELS)
    assert p.rows[0].expected_exposure == pytest.approx(2.333331, abs=1e-9)
    big = compute_plan(
        [ms(1, "model1", 0.999999)], replace(BASE, failure_cost=10_000_000, cutoff_percent=0), MODELS
    )
    assert big.rows[0].expected_exposure == 9_999_990.0


def test_same_inputs_give_identical_plans() -> None:
    inputs = replace(BASE, failure_cost_by_model={"model3": 2000}, risk_reduction_percent=25)
    assert compute_plan(FLEET, inputs, MODELS) == compute_plan(list(reversed(FLEET)), inputs, MODELS)
