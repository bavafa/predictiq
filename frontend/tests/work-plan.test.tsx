import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WorkPlanPage from "@/app/maintenance-planner/page";
import { buildJobs } from "@/components/work-plan";
import { jobLabel, parseStatus } from "@/lib/jobs";
import { machineInputs, parseSettings } from "@/lib/plan-settings";
import type { ComponentPlanResponse, FleetRow, PlanRequest, PlanResponse, ReadyMetadata } from "@/lib/types";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/maintenance-planner" }));

const row = (id: number, score: number): FleetRow => ({ rank: id, machine_id: id, model: "model1", age: 5, score, status: score >= 0.51 ? "alert" : "below_cutoff", latest_error: null });
const plan = (exposure: Record<number, number>) =>
  ({ rows: Object.entries(exposure).map(([id, e]) => ({ machine_id: Number(id), expected_exposure: e })) }) as unknown as PlanResponse;
const crow = (id: number, part: string, signal: "warning" | "wear", listing: string, exposure: number) => ({
  machine_id: id,
  part,
  part_name: part === "comp3" ? "Seal / valve" : "Bearing",
  signal,
  listing,
  window_start: "2015-11-02T06:00:00",
  expected_exposure: exposure,
});
const parts = (rows: ReturnType<typeof crow>[]) => ({ rows, summary: { windows: [{ start: "2015-11-02T06:00:00", models: [], shortlisted: rows.length }] } }) as unknown as ComponentPlanResponse;

const base = { dismissed: [] as number[], added: [] as number[], status: {} };

describe("buildJobs", () => {
  it("puts Act today first by cost at risk, then 48 h warnings, then wear jobs, then added machines", () => {
    const jobs = buildJobs({
      ...base,
      fleetRows: [row(1, 0.9), row(2, 0.8), row(3, 0.1)],
      plan: plan({ 1: 5000, 2: 9000 }),
      parts: parts([crow(7, "comp3", "warning", "shortlisted", 4000), crow(8, "comp2", "wear", "shortlisted", 6000), crow(9, "comp2", "wear", "over_capacity", 9999)]),
      added: [3],
    });
    expect(jobs.map((j) => j.key)).toEqual(["2", "1", "7:comp3", "8:comp2", "3"]);
    expect(jobs.map((j) => j.urgency)).toEqual(["act", "act", "warning", "wear", "added"]);
    expect(jobs[3]!.title).toBe("Replace: Bearing");
  });

  it("names the part on an Act today job only when that machine has a 48 h warning, and never lists it twice", () => {
    const jobs = buildJobs({ ...base, fleetRows: [row(1, 0.9)], plan: plan({ 1: 5000 }), parts: parts([crow(1, "comp3", "warning", "shortlisted", 4000)]) });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.title).toBe("Inspect: Seal / valve");
  });

  it("leaves out a dismissed alert unless the visitor added it, and carries added machines as Added", () => {
    const jobs = buildJobs({ ...base, fleetRows: [row(1, 0.9), row(2, 0.9)], plan: null, parts: null, dismissed: [1, 2], added: [2] });
    expect(jobs.map((j) => [j.key, j.label])).toEqual([["2", "Added"]]);
  });

  it("takes the label from the saved status", () => {
    const jobs = buildJobs({ ...base, fleetRows: [row(1, 0.9), row(2, 0.8)], plan: plan({ 1: 2, 2: 1 }), parts: null, status: { "1": "done", "2": "scheduled" } });
    expect(jobs.map((j) => j.label)).toEqual(["Done", "Scheduled"]);
  });
});

describe("job state and settings helpers", () => {
  it("parses part keys and ignores junk", () => {
    expect(parseStatus('{"1":"scheduled","8:comp2":"done","x":"done","3":"nope"}')).toEqual({ "1": "scheduled", "8:comp2": "done" });
    expect(jobLabel(undefined)).toBe("Recommended");
    expect(jobLabel(undefined, true)).toBe("Added");
    expect(jobLabel("done", true)).toBe("Done");
  });
  it("validates stored settings", () => {
    expect(parseSettings('{"crewSlots":3,"failureByModel":{"model1":9000,"model2":-1,"model9":5}}')).toEqual({ crewSlots: 3, failureByModel: { model1: 9000 } });
    expect(parseSettings("nope")).toEqual({ crewSlots: null, failureByModel: {} });
  });
  it("puts the settings into the plan request", () => {
    const meta = readyMetadata() as ReadyMetadata;
    const inputs = machineInputs(meta, { crewSlots: 2, failureByModel: { model2: 7777 } });
    expect(inputs?.crew_slots).toBe(2);
    expect(inputs?.failure_cost_by_model?.model2).toBe(7777);
  });
});

let bodies: PlanRequest[] = [];
function server(scores: Record<number, number>, exposure: Record<number, number>, crew = 2) {
  const meta = readyMetadata({ planner_defaults: { label: "illustrative", unit: "units", failure_cost: {}, planned_repair_cost: {}, crew_slots: crew } });
  return fakeFetch(meta, async (input, init) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/fleet")) {
      const rows = Object.entries(scores).map(([id, s]) => row(Number(id), s));
      return json({ model_version: "piq-test-1", at: url.searchParams.get("at"), cutoff_percent: 51, cards: { machines_shown: rows.length, machines_in_alert: rows.length, highest_score: 0.9, scored_hour: "x" }, distribution: [], rows });
    }
    if (url.pathname.endsWith("/plan")) {
      bodies.push(JSON.parse(String(init?.body)) as PlanRequest);
      return json(plan(exposure));
    }
    return problem(404, "Not found");
  });
}

beforeEach(() => {
  localStorage.clear();
  bodies = [];
  setAddress("", "/maintenance-planner");
});

describe("Work plan page", () => {
  it("lists the jobs in one table, schedules into the crew slots, refuses when full, and frees a slot when done", async () => {
    const user = userEvent.setup();
    renderWithData(<WorkPlanPage />, server({ 1: 0.9, 2: 0.8, 3: 0.7 }, { 1: 9000, 2: 5000, 3: 1000 }, 1));
    const rows = await screen.findAllByTestId("job-row", {}, { timeout: 8000 });
    expect(rows.map((r) => r.getAttribute("data-job-key"))).toEqual(["1", "2", "3"]);
    expect(within(rows[0]!).getByTestId("job-status")).toHaveTextContent("Recommended");
    expect(screen.getByTestId("slots-used")).toHaveTextContent("Slots used: 0 of 1");
    await user.click(within(rows[0]!).getByRole("button", { name: /Schedule/ }));
    expect(screen.getByTestId("slots-used")).toHaveTextContent("Slots used: 1 of 1");
    await user.click(within(rows[1]!).getByRole("button", { name: /Schedule/ }));
    expect(screen.getByTestId("slots-full")).toBeInTheDocument();
    expect(within(rows[1]!).getByTestId("job-status")).toHaveTextContent("Recommended");
    await user.click(within(rows[0]!).getByRole("button", { name: /Mark done/ }));
    expect(screen.getByTestId("slots-used")).toHaveTextContent("Slots used: 0 of 1");
    expect(localStorage.getItem("piq-status")).toBe('{"1":"done"}');
  }, 20_000);

  it("shows machines added earlier as Added jobs and lets the visitor remove them; Reset demo clears state and settings", async () => {
    const user = userEvent.setup();
    localStorage.setItem("piq-jobs", "[1]");
    localStorage.setItem("piq-dismissed", "[2]");
    localStorage.setItem("piq-plan-settings", '{"crewSlots":3,"failureByModel":{}}');
    renderWithData(<WorkPlanPage />, server({ 1: 0.9, 2: 0.8 }, { 1: 100, 2: 50 }));
    const rows = await screen.findAllByTestId("job-row", {}, { timeout: 8000 });
    expect(rows).toHaveLength(1); // machine 2 was dismissed
    expect(within(rows[0]!).getByTestId("job-status")).toHaveTextContent("Added");
    expect(screen.getByTestId("slots-used")).toHaveTextContent("of 3");
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(localStorage.getItem("piq-jobs")).toBe("[]");
    expect(localStorage.getItem("piq-dismissed")).toBe("[]");
    expect(localStorage.getItem("piq-status")).toBe("{}");
    expect(parseSettings(localStorage.getItem("piq-plan-settings") ?? "")).toEqual({ crewSlots: null, failureByModel: {} });
    await waitFor(() => expect(screen.getAllByTestId("job-row")).toHaveLength(2)); // both recommended again
  }, 20_000);

  it("Plan settings change the crew slots and the costs sent to the plan, and refuse a bad number", async () => {
    const user = userEvent.setup();
    renderWithData(<WorkPlanPage />, server({ 1: 0.9 }, { 1: 100 }, 5));
    await screen.findAllByTestId("job-row", {}, { timeout: 8000 });
    await user.click(screen.getByRole("button", { name: "Plan settings" }));
    const crew = screen.getByLabelText("Crew slots this shift");
    await user.clear(crew);
    await user.type(crew, "2");
    expect(screen.getByTestId("slots-used")).toHaveTextContent("of 2");
    const pumps = screen.getByLabelText("Centrifugal pumps");
    await user.clear(pumps);
    await user.type(pumps, "12345");
    await waitFor(() => expect(bodies.some((b) => b.failure_cost_by_model?.model1 === 12345 && b.crew_slots === 2)).toBe(true), { timeout: 8000 });
    await user.clear(crew);
    await user.type(crew, "-1");
    expect(await screen.findByRole("alert")).toHaveTextContent(/whole number from 0 to 100/);
    expect(screen.getByTestId("slots-used")).toHaveTextContent("of 2"); // the last valid value stays
  }, 25_000);

  it("keeps the detailed planners closed until asked, and says it is not a booking of real crews or an early warning", async () => {
    renderWithData(<WorkPlanPage />, server({ 1: 0.9 }, { 1: 100 }));
    const button = await screen.findByRole("button", { name: /Advanced planner/ }, { timeout: 8000 });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("failure-cost")).toBeNull();
    expect(screen.getByTestId("job-list")).toHaveTextContent(/does not book real crews/);
    expect(screen.getByTestId("job-list")).toHaveTextContent(/wear estimate, not an early warning/);
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\blive\b|real-time|right now|savings/);
  }, 15_000);

  it("says so when there are no jobs", async () => {
    renderWithData(<WorkPlanPage />, server({ 1: 0.1 }, {}));
    expect(await screen.findByTestId("no-jobs", {}, { timeout: 8000 })).toBeInTheDocument();
  }, 15_000);
});
