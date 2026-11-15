import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MaintenancePlannerPage from "@/app/maintenance-planner/page";
import AssetDetailsPage from "@/app/asset-details/page";
import {
  PARTS,
  answersComponentInputs,
  checkComponent,
  defaultComponentFields,
  signalText,
  untilText,
  windowText,
  HONESTY,
  WEAR_LABEL,
} from "@/lib/component-planner";
import type {
  ComponentPlanRequest,
  ComponentPlanResponse,
  ComponentPlanRow,
  ComponentPlannerInfo,
  MachineComponents,
  Metadata,
  PartId,
} from "@/lib/types";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/maintenance-planner" }));

const INFO: ComponentPlannerInfo = {
  component_model_version: "comp-test-1",
  names: { comp1: "Motor winding", comp2: "Bearing", comp3: "Seal / valve", comp4: "Coupling" },
  names_note: "Illustrative names, assumed, not stated by the source.",
  horizons_days: [7, 14],
  default_horizon_days: 14,
  shutdown_windows: { model1: { weekday: 6, start_hour: 6, hours: 12 } },
  windows_note: "Assumed, not from the data: one weekly window per machine model.",
  default_failure_cost: { comp1: 9000, comp2: 6000, comp3: 4000, comp4: 5000 },
  default_planned_cost: { comp1: 2500, comp2: 1500, comp3: 1000, comp4: 1200 },
  warning_cutoff_percent: { comp1: 27, comp2: 35, comp3: 36, comp4: 40 },
  honesty: HONESTY,
};

const row = (rank: number, machine: number, part: PartId, over: Partial<ComponentPlanRow> = {}): ComponentPlanRow => ({
  rank,
  machine_id: machine,
  model: "model1",
  age: 5,
  part,
  part_name: INFO.names[part],
  wear_chance: 0.12,
  warning_chance_48h: 0.01,
  warning_active: false,
  signal: "wear",
  days_since_replacement: 61,
  window_start: "2015-11-01T06:00:00",
  days_to_window: 2.75,
  chance_before_window: 0.05,
  failure_cost: 6000,
  planned_cost: 1500,
  expected_exposure: 300,
  listing: "shortlisted",
  slot: 1,
  action: "replace_in_window",
  net_benefit: null,
  ...over,
});

function planFor(body: ComponentPlanRequest): ComponentPlanResponse {
  const r = body.risk_reduction_percent ?? null;
  return {
    level: "component",
    model_version: "piq-test-1",
    component_model_version: "comp-test-1",
    at: body.at,
    label: "illustrative",
    unit: "illustrative currency units",
    horizon_days: body.horizon_days,
    honesty: HONESTY,
    assumptions: {
      horizon_days: body.horizon_days,
      failure_cost: body.failure_cost,
      failure_cost_by_part: body.failure_cost_by_part ?? {},
      planned_cost: body.planned_cost,
      planned_cost_by_part: body.planned_cost_by_part ?? {},
      crew_slots_per_window: body.crew_slots,
      risk_reduction_percent: r,
    },
    summary: {
      parts_ranked: 250,
      rows_returned: 3,
      warning_parts: 1,
      crew_slots_per_window: body.crew_slots,
      slots_used: 2,
      shortlist_exposure: 1500,
      planned_spend: 3000,
      net_benefit: r === null ? null : 400,
      net_benefit_label: r === null ? null : "Expected net benefit (estimate)",
      windows: [{ models: ["model1"], start: "2015-11-01T06:00:00", shortlisted: 2 }],
    },
    rows: [
      row(1, 58, "comp2", {
        signal: "warning",
        warning_active: true,
        warning_chance_48h: 0.98,
        chance_before_window: 0.98,
        action: "act_before_window",
        expected_exposure: 5880,
        net_benefit: r === null ? null : 900,
      }),
      row(2, 7, "comp4", { expected_exposure: 900, slot: 2 }),
      row(3, 9, "comp1", { listing: "over_capacity", slot: null, action: "over_capacity", expected_exposure: 400 }),
    ],
    names: INFO.names,
    names_note: INFO.names_note,
    windows_note: INFO.windows_note,
    notes: ["Chance before the window assumes failures are spread evenly over the horizon (an estimate)."],
    formulas: { expected_exposure: "Expected exposure = chance before the next window x the part's failure cost. Illustrative." },
  };
}

const machinesFor = (n: number): MachineComponents => ({
  model_version: "piq-test-1",
  component_model_version: "comp-test-1",
  machine_id: n,
  model: "model1",
  age: 5,
  at: "2015-11-02T00:00:00",
  horizon_days: 14,
  window_start: "2015-11-08T06:00:00",
  days_to_window: 6.25,
  honesty: HONESTY,
  names_note: INFO.names_note,
  windows_note: INFO.windows_note,
  parts: PARTS.map((p, i) => ({
    part: p,
    part_name: INFO.names[p],
    wear_chance: 0.1 + i / 100,
    chance_before_window: 0.04,
    warning_chance_48h: i === 1 ? 0.9 : 0.01,
    warning_active: i === 1,
    warning_cutoff_percent: INFO.warning_cutoff_percent[p],
    days_since_replacement: 40 + i,
  })),
});

/** The smallest valid machine plan: nobody listed. */
const machinePlan = (body: { at: string; failure_cost: number; planned_cost: number; crew_slots: number }) => ({
  model_version: "piq-test-1",
  at: body.at,
  label: "illustrative",
  unit: "illustrative currency units",
  assumptions: {
    cutoff_percent: 51,
    failure_cost: body.failure_cost,
    failure_cost_by_model: {},
    planned_cost: body.planned_cost,
    planned_cost_by_model: {},
    crew_slots: body.crew_slots,
    risk_reduction_percent: null,
    include_below_cutoff: false,
  },
  order_changed: null,
  order_note: null,
  summary: { machines_at_or_above_cutoff: 0, machines_listed: 0, crew_slots: body.crew_slots, slots_used: 0, spare_slots: body.crew_slots, shortlist_exposure: 0, planned_spend: 0, net_benefit: null, net_benefit_label: null },
  rows: [],
  formulas: {},
});

let bodies: ComponentPlanRequest[] = [];
let componentCalls: string[] = [];
const meta = (withParts = true): Metadata =>
  readyMetadata(withParts ? { component_planner: INFO } : {});
const server = (opts: { withParts?: boolean; failPlan?: boolean } = {}) =>
  fakeFetch(meta(opts.withParts ?? true) as never, async (input, init) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/plan")) {
      const body = JSON.parse(String(init?.body)) as ComponentPlanRequest & { level?: string };
      if (body.level !== "component") return json(machinePlan(body as never)); // the machine plan is not under test here
      bodies.push(body);
      return opts.failPlan ? problem(500, "boom") : json(planFor(body));
    }
    if (url.pathname.includes("/components")) {
      componentCalls.push(url.search);
      return json({ ...machinesFor(7), at: url.searchParams.get("at") ?? "", horizon_days: Number(url.searchParams.get("horizon_days") ?? 14) });
    }
    // the other Asset Details panels are not under test: a 500 shows their own error and keeps the page
    if (/\/assets\/\d+(\/telemetry|\/explanation)?$/.test(url.pathname)) return problem(500, "boom");
    return problem(404, "Not found");
  });

beforeEach(() => {
  bodies = [];
  componentCalls = [];
  setAddress("", "/maintenance-planner");
});

describe("component planner helpers", () => {
  it("starts valid and checks every field's range", () => {
    const f = defaultComponentFields(INFO);
    const ok = checkComponent(f);
    expect(ok.ok && ok.inputs.horizon_days).toBe(14);
    expect(ok.ok && ok.inputs.failure_cost_by_part?.comp2).toBe(6000);
    expect(ok.ok && ok.inputs.risk_reduction_percent).toBeNull();
    const bad = checkComponent({ ...f, crewSlots: "101", failureByPart: { ...f.failureByPart, comp3: "-1" } });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(["crewSlots", "failure_comp3"]);
  });

  it("an answer counts only for exactly the inputs it was computed from", () => {
    const f = defaultComponentFields(INFO);
    const c = checkComponent(f);
    if (!c.ok) throw new Error("valid");
    const plan = planFor({ level: "component", at: "2015-11-02T00:00", ...c.inputs });
    expect(answersComponentInputs(plan.assumptions, c.inputs)).toBe(true);
    expect(answersComponentInputs(plan.assumptions, { ...c.inputs, horizon_days: 7 })).toBe(false);
    expect(answersComponentInputs(plan.assumptions, { ...c.inputs, crew_slots: 6 })).toBe(false);
  });

  it("formats windows, waits and signals in plain words", () => {
    expect(windowText("2015-11-08T06:00:00")).toBe("Sun 8 Nov, 06:00");
    expect(untilText(2.75)).toBe("in 2.8 days");
    expect(untilText(5)).toBe("in 5 days");
    expect(untilText(0.25)).toBe("in 6 hours");
    expect(signalText(row(1, 1, "comp2"))).toBe(WEAR_LABEL);
    expect(signalText(row(1, 1, "comp2", { signal: "warning" }))).toBe("Warning: Bearing signature");
  });
});

describe("Planner: Parts plan", () => {
  it("is not offered when the deployment has no component scores", async () => {
    renderWithData(<MaintenancePlannerPage />, server({ withParts: false }));
    await screen.findByTestId("assumptions");
    expect(screen.queryByTestId("level-switch")).toBeNull();
  });

  it("switches to Parts, asks for the 14 day view by default and says what the numbers are", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await screen.findByTestId("level-switch");
    await user.click(screen.getByTestId("level-parts"));
    await screen.findByTestId("parts-table");
    expect(bodies.at(-1)).toMatchObject({ level: "component", horizon_days: 14, crew_slots: 5 });
    expect(bodies.at(-1)).not.toHaveProperty("cutoff_percent"); // the wear view has no alert cut-off
    expect(screen.getByTestId("honesty")).toHaveTextContent("not an early warning");
    expect(screen.getByTestId("component-banner")).toHaveTextContent("assumed or illustrative");
    expect(screen.getByTestId("component-banner")).toHaveTextContent("Illustrative names, assumed, not stated by the source");
    const first = screen.getAllByTestId("part-row")[0]!;
    expect(first).toHaveAttribute("data-action", "act_before_window");
    expect(within(first).getByTestId("signal")).toHaveTextContent("Warning: Bearing signature");
    expect(within(screen.getAllByTestId("part-row")[1]!).getByTestId("signal")).toHaveTextContent(WEAR_LABEL);
    expect(within(first).getByTitle("comp2")).toHaveTextContent("Bearing"); // the raw id stays in the tooltip and the cell
    expect(screen.getByTestId("windows")).toHaveTextContent("Assumed");
    expect(screen.getByTestId("windows")).toHaveTextContent("Sun 1 Nov, 06:00");
    expect(screen.getByTestId("component-summary")).toHaveTextContent("1 part shows a 48-hour warning");
    expect(screen.getByTestId("component-summary")).toHaveTextContent("top 3 of 250");
  });

  it("the horizon switch and the crew slots change the request; net benefit appears only when assumed", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await user.click(await screen.findByTestId("level-parts"));
    await screen.findByTestId("parts-table");
    expect(screen.queryByTestId("part-net")).toBeNull();
    await user.click(screen.getByTestId("horizon-7"));
    await waitFor(() => expect(bodies.at(-1)?.horizon_days).toBe(7));
    expect(screen.getByTestId("horizon-7")).toHaveAttribute("aria-pressed", "true");
    const slots = screen.getByTestId("part-crew-slots");
    await user.clear(slots);
    await user.type(slots, "2");
    await waitFor(() => expect(bodies.at(-1)?.crew_slots).toBe(2));
    await user.click(within(screen.getByTestId("component-assumptions")).getByTestId("reduction-toggle"));
    await waitFor(() => expect(screen.getAllByTestId("part-net").length).toBeGreaterThan(0));
    expect(screen.getByTestId("component-net")).toHaveTextContent("estimate");
  });

  it("a bad value keeps the last valid answer and says so", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server());
    await user.click(await screen.findByTestId("level-parts"));
    await screen.findByTestId("parts-table");
    const before = bodies.length;
    await user.clear(screen.getByTestId("part-cost-comp2"));
    await user.type(screen.getByTestId("part-cost-comp2"), "abc");
    await screen.findByTestId("component-invalid-note");
    expect(bodies.length).toBe(before); // nothing invalid is ever sent
    expect(screen.getAllByTestId("part-row").length).toBe(3);
  });

  it("a failed request shows its own error with Try again, and the machine plan stays", async () => {
    const user = userEvent.setup();
    renderWithData(<MaintenancePlannerPage />, server({ failPlan: true }));
    await screen.findByTestId("assumptions");
    await user.click(screen.getByTestId("level-parts"));
    const err = await screen.findByTestId("component-error");
    expect(within(err).getByRole("button", { name: /try again/i })).toBeVisible();
    await user.click(screen.getByTestId("level-machine"));
    expect(screen.getByTestId("assumptions")).toBeVisible();
  });
});

describe("Asset Details: parts panel", () => {
  it("shows the four parts with the honest labels, and the 7 day switch asks again", async () => {
    setAddress("?machine=7&at=2015-11-02T00:00", "/asset-details");
    const user = userEvent.setup();
    renderWithData(<AssetDetailsPage />, server());
    const panel = await screen.findByTestId("component-panel");
    await within(panel).findByTestId("component-table");
    expect(within(panel).getAllByTestId("component-row")).toHaveLength(4);
    expect(within(panel).getByTestId("component-honesty")).toHaveTextContent("not an early warning");
    expect(within(panel).getByTestId("component-window")).toHaveTextContent("Sun 8 Nov, 06:00");
    expect(within(panel).getAllByText(WEAR_LABEL)).toHaveLength(4);
    const warned = within(panel).getAllByTestId("component-row").filter((r) => r.getAttribute("data-warning") === "true");
    expect(warned).toHaveLength(1);
    expect(warned[0]).toHaveTextContent("Warning: Bearing signature");
    await user.click(within(panel).getByTestId("panel-horizon-7"));
    await waitFor(() => expect(componentCalls.some((c) => c.includes("horizon_days=7"))).toBe(true));
  });

  it("makes no request and shows nothing without component scores", async () => {
    setAddress("?machine=7&at=2015-11-02T00:00", "/asset-details");
    renderWithData(<AssetDetailsPage />, server({ withParts: false }));
    await screen.findByTestId("facts");
    expect(screen.queryByTestId("component-panel")).toBeNull();
    expect(componentCalls).toHaveLength(0);
  });
});
