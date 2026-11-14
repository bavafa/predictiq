import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MaintenancePlannerPage from "@/app/maintenance-planner/page";
import { check, defaultFields, answersInputs, wholeNumber } from "@/lib/planner";
import type { MachineModel, Metadata, PlanRequest, PlanResponse, PlanRow, ReadyMetadata } from "@/lib/types";
import { fakeFetch, json, noModelMetadata, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/maintenance-planner" }));

// Six machines (percent chance, machine model).
const FLEET: { id: number; model: MachineModel; score: number }[] = [
  { id: 1, model: "model1", score: 0.9 },
  { id: 2, model: "model2", score: 0.8 },
  { id: 3, model: "model3", score: 0.7 },
  { id: 4, model: "model1", score: 0.6 },
  { id: 5, model: "model4", score: 0.3 },
  { id: 6, model: "model1", score: 0.1 },
];

/** A small stand-in for POST /plan that follows the service's rules (decision 63). */
function plan(body: PlanRequest): PlanResponse {
  const cutoff = (body.cutoff_percent ?? 51) / 100;
  const by = body.failure_cost_by_model ?? {};
  const cost = (m: MachineModel) => by[m] ?? body.failure_cost;
  const listed = FLEET.filter((m) => body.include_below_cutoff || m.score >= cutoff);
  const byChance = [...listed].sort((a, b) => b.score - a.score).map((m) => m.id);
  const differ = new Set(["model1", "model2", "model3", "model4"].map((m) => cost(m as MachineModel))).size > 1;
  const ordered = [...listed].sort((a, b) => b.score * cost(b.model) - a.score * cost(a.model) || b.score - a.score || a.id - b.id);
  let used = 0;
  let exposure = 0;
  const rows: PlanRow[] = ordered.map((m, i) => {
    const e = m.score * cost(m.model);
    const alert = m.score >= cutoff;
    const short = alert && used < body.crew_slots;
    if (short) {
      used += 1;
      exposure += e;
    }
    const r = body.risk_reduction_percent;
    return {
      rank: i + 1,
      machine_id: m.id,
      model: m.model,
      age: 5,
      score: m.score,
      status: alert ? "alert" : "below_cutoff",
      failure_cost: cost(m.model),
      expected_exposure: e,
      listing: short ? "shortlisted" : alert ? "over_capacity" : "below_cutoff",
      slot: short ? used : null,
      moved: differ ? byChance.indexOf(m.id) - i : null,
      net_benefit: short && r !== null && r !== undefined ? (e * r) / 100 - body.planned_cost : null,
    };
  });
  const r = body.risk_reduction_percent ?? null;
  const atOrAbove = FLEET.filter((m) => m.score >= cutoff).length;
  return {
    model_version: "piq-test-1",
    at: body.at,
    label: "illustrative",
    unit: "illustrative currency units",
    assumptions: {
      cutoff_percent: body.cutoff_percent ?? 51,
      failure_cost: body.failure_cost,
      failure_cost_by_model: by,
      planned_cost: body.planned_cost,
      crew_slots: body.crew_slots,
      risk_reduction_percent: r,
      include_below_cutoff: body.include_below_cutoff ?? false,
    },
    order_changed: differ ? JSON.stringify(rows.map((x) => x.machine_id)) !== JSON.stringify(byChance) : null,
    order_note: differ ? "Some machine models have a higher failure cost than others, so their machines moved. Compared with the order by chance alone." : null,
    summary: {
      machines_at_or_above_cutoff: atOrAbove,
      machines_listed: rows.length,
      crew_slots: body.crew_slots,
      slots_used: used,
      spare_slots: body.crew_slots - used,
      shortlist_exposure: exposure,
      planned_spend: used * body.planned_cost,
      net_benefit: r === null ? null : rows.reduce((s, x) => s + (x.net_benefit ?? 0), 0),
      net_benefit_label: r === null ? null : "Expected net benefit (estimate)",
    },
    rows,
    formulas: {
      expected_exposure: "Expected exposure = predicted chance of a failure in the next 24 hours x the cost if a failure happens.",
      ranking: "Machines are ranked by expected exposure, highest first.",
      shortlist: "The first N machines at or above the alert cut-off are shortlisted.",
      planned_spend: "Planned spend = shortlisted machines x planned maintenance cost. Illustrative.",
      net_benefit: "Estimate, shown only when a risk reduction is assumed.",
    },
  };
}

let bodies: PlanRequest[] = [];
const server = (opts: { fail?: () => boolean; meta?: ReadyMetadata } = {}) =>
  fakeFetch(
    ((opts.meta as Metadata | undefined) ??
      readyMetadata({
        planner_defaults: { label: "illustrative", unit: "illustrative currency units", failure_cost: {}, planned_repair_cost: {}, crew_slots: 5 },
      })) as never,
    async (input, init) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/plan")) {
      const body = JSON.parse(String(init?.body)) as PlanRequest;
      bodies.push(body);
      if (opts.fail?.()) return problem(500, "boom");
      return json(plan(body));
    }
    return problem(404, "Not found");
  });

const ids = () => screen.getAllByTestId("plan-row").map((r) => r.getAttribute("data-machine"));
const slots = () => screen.getAllByTestId("slot").map((r) => r.textContent);
const ready = async () => {
  await screen.findByTestId("plan-table");
  await waitFor(() => expect(screen.getByTestId("planner-ready")).not.toHaveAttribute("aria-busy", "true"));
};

beforeEach(() => {
  bodies = [];
  setAddress("", "/maintenance-planner");
});

describe("planner helpers", () => {
  it("reads whole numbers only, with optional thousands commas", () => {
    expect(wholeNumber("10,000")).toBe(10000);
    expect(wholeNumber("7")).toBe(7);
    for (const bad of ["", "-5", "1.5", "1e3", "abc", "1,00", " "]) expect(wholeNumber(bad)).toBeNull();
  });

  it("starts from the single documented defaults and checks every field's range", () => {
    const f = defaultFields(readyMetadata() as ReadyMetadata);
    const ok = check(f);
    expect(ok.ok && ok.inputs).toMatchObject({ failure_cost: 10000, planned_cost: 2500, crew_slots: 5, risk_reduction_percent: null });
    expect(check({ ...f, failureCost: "10000001" }).ok).toBe(false);
    expect(check({ ...f, plannedCost: "-1" }).ok).toBe(false);
    expect(check({ ...f, crewSlots: "101" }).ok).toBe(false);
    expect(check({ ...f, byModel: { ...f.byModel, model2: "x" } }).ok).toBe(false);
  });

  it("matches an answer to the inputs it was computed from", () => {
    const a = plan({ at: "x", failure_cost: 1, planned_cost: 2, crew_slots: 3 }).assumptions;
    expect(answersInputs(a, { failure_cost: 1, planned_cost: 2, crew_slots: 3 })).toBe(true);
    expect(answersInputs(a, { failure_cost: 1, planned_cost: 2, crew_slots: 4 })).toBe(false);
    expect(answersInputs(a, { failure_cost: 1, planned_cost: 2, crew_slots: 3, failure_cost_by_model: { model3: 9 } })).toBe(false);
  });
});

describe("Maintenance Planner screen", () => {
  it("asks the service for the starting values and shows the ranked list with units and labels", async () => {
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    expect(bodies[0]).toMatchObject({ failure_cost: 10000, planned_cost: 2500, crew_slots: 5, risk_reduction_percent: null, include_below_cutoff: false });
    expect(bodies[0]!.failure_cost_by_model).toBeUndefined();
    expect(ids()).toEqual(["1", "2", "3", "4"]); // at or above the 51% cut-off, by exposure
    expect(slots()).toEqual(["✓ Slot 1", "✓ Slot 2", "✓ Slot 3", "✓ Slot 4"]);
    expect(screen.getByLabelText(/Cost if a failure happens \(illustrative currency units per failure\)/)).toHaveValue("10000");
    expect(screen.getByLabelText(/Planned maintenance cost \(illustrative currency units per machine\)/)).toHaveValue("2500");
    expect(screen.getByLabelText(/Crew slots available/)).toHaveValue("5");
    expect(screen.getByTestId("planner-banner")).toHaveTextContent(/illustrative assumptions you set, not real costs/);
    expect(screen.getAllByText("Illustrative").length).toBeGreaterThan(3);
    expect(screen.queryByTestId("moved")).toBeNull(); // no per-model costs, so no Moved column
    // reduction is off: no net benefit anywhere
    expect(screen.queryByTestId("net-benefit")).toBeNull();
    expect(screen.queryByTestId("net-benefit-summary")).toBeNull();
    expect(screen.getByTestId("reduction-toggle")).not.toBeChecked();
  });

  it("links each machine to Asset Details at the same time and cut-off", async () => {
    setAddress("?at=2015-11-02T00:00&cutoff=40", "/maintenance-planner");
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const link = within(screen.getAllByTestId("plan-row")[0]!).getByRole("link");
    expect(link).toHaveAttribute("href", "/asset-details?at=2015-11-02T00%3A00&cutoff=40&machine=1");
    expect(bodies.at(-1)).toMatchObject({ at: "2015-11-02T00:00", cutoff_percent: 40 });
  });

  it("a cost per machine model reorders the list, shows Moved marks and explains why", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    await user.click(screen.getByText("Set cost per machine model (optional)"));
    await user.type(screen.getByLabelText(/^model3 \(/), "50000");
    await waitFor(() => expect(ids()).toEqual(["3", "1", "2", "4"]));
    const moved = screen.getAllByTestId("moved").map((c) => c.textContent);
    expect(moved).toEqual(["▲ up 2", "▼ down 1", "▼ down 1", "no change"]);
    expect(screen.getByTestId("order-note")).toHaveTextContent(/Order changed\./);
    expect(screen.getByText(/\(model3\)/)).toBeInTheDocument();
    expect(bodies.at(-1)!.failure_cost_by_model).toEqual({ model3: 50000 });
  });

  it("the shared failure cost scales exposure but not the order; planned cost changes spend only", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const before = ids();
    const exposureBefore = screen.getAllByTestId("exposure")[0]!.textContent;
    const field = screen.getByLabelText(/Cost if a failure happens/);
    await user.clear(field);
    await user.type(field, "20000");
    await waitFor(() => expect(screen.getAllByTestId("exposure")[0]!.textContent).not.toBe(exposureBefore));
    expect(ids()).toEqual(before);
    const planned = screen.getByLabelText(/Planned maintenance cost/);
    await user.clear(planned);
    await user.type(planned, "1000");
    await waitFor(() => expect(screen.getByTestId("summary-spend")).toHaveTextContent("4,000"));
    expect(ids()).toEqual(before);
  });

  it("crew slots (typed and −/+) change the shortlist and spare slots, not the order", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const before = ids();
    await user.click(screen.getByRole("button", { name: "Fewer crew slots" }));
    await waitFor(() => expect(slots()).toEqual(["✓ Slot 1", "✓ Slot 2", "✓ Slot 3", "✓ Slot 4"].slice(0, 4)));
    await user.click(screen.getByRole("button", { name: "Fewer crew slots" }));
    await user.click(screen.getByRole("button", { name: "Fewer crew slots" }));
    await waitFor(() => expect(slots()).toEqual(["✓ Slot 1", "✓ Slot 2", "— Over capacity", "— Over capacity"]));
    expect(ids()).toEqual(before);
    const field = screen.getByLabelText(/Crew slots available/);
    await user.clear(field);
    await user.type(field, "8");
    await waitFor(() => expect(screen.getByTestId("spare-slots")).toHaveTextContent(/4 spare slots stay empty/));
    expect(screen.getByTestId("summary-slots")).toHaveTextContent("Shortlist: 4 of 8 crew slots used");
  });

  it("also listing machines below the cut-off adds them, marked, never shortlisted", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    await user.click(screen.getByLabelText(/Also list machines below the cut-off/));
    await waitFor(() => expect(ids()).toEqual(["1", "2", "3", "4", "5", "6"]));
    expect(slots().slice(4)).toEqual(["○ Below cut-off", "○ Below cut-off"]);
  });

  it("a different cut-off (from the address) changes which machines are listed", async () => {
    setAddress("?cutoff=75", "/maintenance-planner");
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    expect(ids()).toEqual(["1", "2"]);
  });

  it("the risk-reduction assumption is off by default; turning it on adds the net benefit column and total, labelled estimate", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    await user.click(screen.getByTestId("reduction-toggle"));
    await waitFor(() => expect(screen.getAllByTestId("net-benefit")).toHaveLength(4));
    expect(screen.getByTestId("net-benefit-summary")).toHaveTextContent(/Expected net benefit \(estimate\)/);
    expect(screen.getByTestId("net-benefit-summary")).toHaveTextContent(/kept apart from expected exposure/);
    expect(screen.getByRole("columnheader", { name: /Expected net benefit \(estimate\)/ })).toBeInTheDocument();
    expect(screen.getByTestId("reduction-value")).toHaveTextContent("20%");
    expect(bodies.at(-1)!.risk_reduction_percent).toBe(20);
    await user.click(screen.getByTestId("reduction-toggle"));
    await waitFor(() => expect(screen.queryByTestId("net-benefit-summary")).toBeNull());
  });

  it("the reduction slider is a native range, 0 to 90 in 5-point steps", async () => {
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const slider = screen.getByRole("slider", { name: "Reduction" });
    expect(slider).toHaveAttribute("min", "0");
    expect(slider).toHaveAttribute("max", "90");
    expect(slider).toHaveAttribute("step", "5");
    expect(slider).toBeDisabled();
    await userEvent.setup().click(screen.getByTestId("reduction-toggle"));
    fireEvent.change(screen.getByRole("slider", { name: "Reduction" }), { target: { value: "45" } });
    await waitFor(() => expect(bodies.at(-1)!.risk_reduction_percent).toBe(45));
  });

  it("refuses an out-of-range value with a message, marks the field and keeps the last valid result", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const calls = bodies.length;
    const field = screen.getByLabelText(/Cost if a failure happens/);
    await user.clear(field);
    await user.type(field, "-500");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/Enter a whole number from 0 to 10,000,000\./);
    expect(screen.getByRole("alert")).toHaveTextContent(/The list still shows your last valid inputs\./);
    expect(screen.getByTestId("invalid-note")).toHaveTextContent("Showing results for your last valid inputs.");
    expect(ids()).toEqual(["1", "2", "3", "4"]);
    // no request was made for the invalid values (the last valid one was asked once more at most)
    expect(bodies.slice(calls).every((b) => b.failure_cost >= 0)).toBe(true);
    await user.clear(field);
    await user.type(field, "99999999");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "10000");
    await waitFor(() => expect(screen.queryByTestId("invalid-note")).toBeNull());
    expect(field).toHaveAttribute("aria-invalid", "false");
  });

  it("crew slots above 100 are refused with the allowed range", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const field = screen.getByLabelText(/Crew slots available/);
    await user.clear(field);
    await user.type(field, "101");
    expect(screen.getByRole("alert")).toHaveTextContent(/from 0 to 100/);
  });

  it("Reset to defaults restores the starting values and is unavailable when nothing changed", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const reset = screen.getByRole("button", { name: "Reset to defaults" });
    expect(reset).toHaveAttribute("aria-disabled", "true");
    const planned = screen.getByLabelText(/Planned maintenance cost/);
    await user.clear(planned);
    await user.type(planned, "9");
    await user.click(screen.getByTestId("reduction-toggle"));
    expect(reset).toHaveAttribute("aria-disabled", "false");
    await user.click(reset);
    expect(planned).toHaveValue("2500");
    expect(screen.getByTestId("reduction-toggle")).not.toBeChecked();
  });

  it("'How this is calculated' shows the formula in plain words", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const button = screen.getByRole("button", { name: "How this is calculated" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(/Ranked by/)).toHaveTextContent(/expected exposure = predicted chance of failure in 24 h × cost if a failure happens/);
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("formula")).toBeVisible();
    expect(screen.getByTestId("formula")).toHaveTextContent(/Expected exposure = predicted chance/);
  });

  it("never says savings; the only 'saving' is the denial", async () => {
    const user = userEvent.setup();
    const { container } = renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    await user.click(screen.getByTestId("reduction-toggle"));
    await user.click(screen.getByRole("button", { name: "How this is calculated" }));
    await waitFor(() => expect(screen.getByTestId("net-benefit-summary")).toBeInTheDocument());
    const text = (container.textContent ?? "").replace("It is not a saving.", "");
    expect(text).not.toMatch(/saving|saved|return on investment|avoided cost/i);
    expect(text).not.toMatch(/\blive\b|real-time/i);
  });

  it("no machines at or above the cut-off: says so and offers to list those below", async () => {
    setAddress("?cutoff=99", "/maintenance-planner");
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    expect(await screen.findByTestId("planner-empty")).toHaveTextContent("No machines are at or above the cut-off at this time.");
    await user.click(screen.getByRole("button", { name: "Also list machines below the cut-off" }));
    await waitFor(() => expect(ids()).toHaveLength(6));
    expect(slots().every((s) => s === "○ Below cut-off")).toBe(true);
  });

  it("loading: grey rows and the loading line while the assumptions stay usable", async () => {
    let release: (r: Response) => void = () => {};
    const slow = fakeFetch(readyMetadata(), () => new Promise<Response>((r) => (release = r)));
    renderWithData(<MaintenancePlannerPage />, slow);
    expect(await screen.findByText("Loading predicted chances for this hour…")).toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Cost if a failure happens/)).toBeEnabled();
    release(json(plan({ at: "2015-11-01T06:00", failure_cost: 1, planned_cost: 1, crew_slots: 1 })));
  });

  it("error: says what failed with Try again, keeps the assumptions, shows no stale list or summary", async () => {
    let failing = true;
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server({ fail: () => failing }));
    expect(await screen.findByTestId("service-error")).toHaveTextContent(/Couldn.t load the predicted chances for 1 Nov 2015|Couldn.t load the predicted chances for/);
    expect(screen.queryByTestId("plan-table")).toBeNull();
    expect(screen.queryByTestId("summary")).toBeNull();
    expect(screen.getByLabelText(/Planned maintenance cost/)).toHaveValue("2500");
    failing = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await ready();
    expect(ids()).toHaveLength(4);
  });

  it("no model data: says so, no numbers", async () => {
    const { container } = renderWithData(<MaintenancePlannerPage />, fakeFetch(noModelMetadata()));
    expect(await screen.findByTestId("no-model-data")).toBeInTheDocument();
    expect(container.querySelector("input, table")).toBeNull();
  });

  it("a service 503 on /plan shows the no-model-data state, not a number", async () => {
    renderWithData(
      <MaintenancePlannerPage />,
      fakeFetch(readyMetadata(), async () => problem(503, "Model data unavailable")),
    );
    expect(await screen.findByTestId("no-model-data")).toBeInTheDocument();
  });

  it("the summary counts exactly the shortlisted rows of the same answer", async () => {
    renderWithData(<MaintenancePlannerPage />, server());
    await ready();
    const shortlisted = slots().filter((s) => s?.startsWith("✓")).length;
    expect(screen.getByTestId("summary-slots")).toHaveTextContent(`${shortlisted} of 5 crew slots used`);
    // 0.9+0.8+0.7+0.6 = 3.0 × 10,000
    expect(screen.getByTestId("summary-exposure")).toHaveTextContent("30,000");
    expect(screen.getByTestId("summary-spend")).toHaveTextContent("10,000");
  });
});
