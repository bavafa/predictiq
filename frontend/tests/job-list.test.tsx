import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MaintenancePlannerPage from "@/app/maintenance-planner/page";
import { jobLabel, parseStatus, slotsUsed } from "@/lib/jobs";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/maintenance-planner" }));

const rows = [1, 2, 3].map((id, i) => ({
  rank: i + 1,
  machine_id: id,
  model: "model1" as const,
  age: 5,
  score: 0.9 - i * 0.1,
  status: "alert" as const,
  latest_error: null,
}));

const server = (crew = 1) =>
  fakeFetch(readyMetadata({ planner_defaults: { label: "illustrative", unit: "units", failure_cost: {}, planned_repair_cost: {}, crew_slots: crew } }), async (input) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/fleet"))
      return json({ model_version: "piq-test-1", at: url.searchParams.get("at"), cutoff_percent: 51, cards: {}, distribution: [], rows });
    return problem(404, "Not found");
  });

beforeEach(() => {
  localStorage.clear();
  setAddress("", "/maintenance-planner");
});

describe("Work plan: My jobs", () => {
  it("says so when there are no jobs", async () => {
    renderWithData(<MaintenancePlannerPage />, server());
    expect(await screen.findByTestId("no-jobs")).toBeInTheDocument();
    expect(screen.getByTestId("slots-used")).toHaveTextContent("Slots used: 0 of 1");
  });

  it("schedules a job into a free slot, refuses a second when the slots are full, and marks it done to free the slot", async () => {
    const user = userEvent.setup();
    localStorage.setItem("piq-jobs", "[1,2]");
    renderWithData(<MaintenancePlannerPage />, server(1));
    const list = await screen.findByTestId("job-list");
    const jobRows = await within(list).findAllByTestId("job-row", {}, { timeout: 5000 });
    expect(within(jobRows[0]!).getByTestId("job-status")).toHaveTextContent("Added");
    await user.click(within(jobRows[0]!).getByRole("button", { name: /Schedule/ }));
    expect(screen.getByTestId("slots-used")).toHaveTextContent("Slots used: 1 of 1");
    expect(within(jobRows[0]!).getByTestId("job-status")).toHaveTextContent("Scheduled");
    await user.click(within(jobRows[1]!).getByRole("button", { name: /Schedule/ }));
    expect(screen.getByTestId("slots-full")).toHaveTextContent("All 1 slots");
    expect(within(jobRows[1]!).getByTestId("job-status")).toHaveTextContent("Added");
    await user.click(within(jobRows[0]!).getByRole("button", { name: /Mark done/ }));
    expect(screen.getByTestId("slots-used")).toHaveTextContent("Slots used: 0 of 1");
    await user.click(within(jobRows[1]!).getByRole("button", { name: /Schedule/ }));
    expect(within(jobRows[1]!).getByTestId("job-status")).toHaveTextContent("Scheduled");
  });

  it("Remove drops a job and Reset demo clears jobs, status and dismissed alerts", async () => {
    const user = userEvent.setup();
    localStorage.setItem("piq-jobs", "[1,2]");
    localStorage.setItem("piq-dismissed", "[3]");
    localStorage.setItem("piq-status", '{"1":"scheduled"}');
    renderWithData(<MaintenancePlannerPage />, server(3));
    const list = await screen.findByTestId("job-list");
    await within(list).findAllByTestId("job-row", {}, { timeout: 5000 });
    await user.click(within(list).getAllByRole("button", { name: /Remove/ })[1]!);
    expect(localStorage.getItem("piq-jobs")).toBe("[1]");
    await user.click(screen.getByRole("button", { name: "Reset demo" }));
    expect(localStorage.getItem("piq-jobs")).toBe("[]");
    expect(localStorage.getItem("piq-dismissed")).toBe("[]");
    expect(localStorage.getItem("piq-status")).toBe("{}");
    expect(await screen.findByTestId("no-jobs")).toBeInTheDocument();
  });
});

describe("job helpers", () => {
  it("parses and counts status, ignoring junk", () => {
    expect(parseStatus('{"1":"scheduled","2":"done","3":"x"}')).toEqual({ 1: "scheduled", 2: "done" });
    expect(parseStatus("nope")).toEqual({});
    expect(parseStatus("[1]")).toEqual({});
    expect(slotsUsed({ 1: "scheduled", 2: "done", 4: "scheduled" })).toBe(2);
    expect(jobLabel(undefined)).toBe("Added");
    expect(jobLabel("done")).toBe("Done");
  });
});
