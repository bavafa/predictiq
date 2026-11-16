import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AlertsPage from "@/app/alerts/page";
import { rankByCost, sinceText } from "@/components/alerts-screen";
import { typeCounts } from "@/components/overview-screen";
import { parseJobs } from "@/lib/jobs";
import type { Fleet, FleetRow, PlanResponse } from "@/lib/types";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/alerts" }));

const row = (id: number, score: number, latest: FleetRow["latest_error"] = null): FleetRow => ({
  rank: 0,
  machine_id: id,
  model: "model1",
  age: 4 + id,
  score,
  status: score >= 0.51 ? "alert" : "below_cutoff",
  latest_error: latest,
});

const fleetOf = (scores: Record<number, number>, at: string): Fleet => {
  const rows = Object.entries(scores).map(([id, s], i) => ({ ...row(Number(id), s, Number(id) === 1 ? { error: "error5", time: "2015-10-31T06:00:00" } : null), rank: i + 1 }));
  return {
    model_version: "piq-test-1",
    at,
    cutoff_percent: 51,
    cards: { machines_shown: rows.length, machines_in_alert: rows.filter((r) => r.status === "alert").length, highest_score: 0.9, scored_hour: at },
    distribution: [],
    rows,
  };
};

const planOf = (exposure: Record<number, number>) =>
  ({
    model_version: "piq-test-1",
    at: "x",
    label: "illustrative",
    unit: "units",
    assumptions: {},
    order_changed: null,
    order_note: null,
    summary: {},
    rows: Object.entries(exposure).map(([id, e], i) => ({ rank: i + 1, machine_id: Number(id), expected_exposure: e })),
    formulas: {},
  }) as unknown as PlanResponse;

type Opts = { now: Record<number, number>; before?: Record<number, number>; exposure?: Record<number, number>; parts?: Record<number, boolean>; planFails?: boolean };

function server(o: Opts, components = false) {
  const meta = readyMetadata(components ? ({ component_planner: { default_horizon_days: 14 } } as never) : {});
  return fakeFetch(meta, async (input, init) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/fleet")) {
      const at = url.searchParams.get("at")!;
      // the replay start is 06:00; one hour earlier is 05:00
      return json(fleetOf(at.includes("T05:") ? (o.before ?? o.now) : o.now, at));
    }
    if (url.pathname.endsWith("/plan")) return o.planFails ? problem(500, "boom") : json(planOf(o.exposure ?? {}));
    const m = /\/assets\/(\d+)\/components$/.exec(url.pathname);
    if (m && components) {
      const warn = o.parts?.[Number(m[1])] ?? false;
      return json({
        model_version: "piq-test-1",
        machine_id: Number(m[1]),
        parts: [
          { part: "comp1", part_name: "Motor winding", wear_chance: 0.1, chance_before_window: 0.1, warning_chance_48h: 0.2, warning_active: false, warning_cutoff_percent: 30, days_since_replacement: 5 },
          { part: "comp3", part_name: "Seal / valve", wear_chance: 0.1, chance_before_window: 0.1, warning_chance_48h: 0.9, warning_active: warn, warning_cutoff_percent: 30, days_since_replacement: 5 },
        ],
      });
    }
    void init;
    return problem(404, "Not found");
  });
}

beforeEach(() => {
  localStorage.clear();
  setAddress("");
});

describe("Alerts page", () => {
  it("ranks alerts by cost at risk, says so, and shows each cost with the Illustrative tag", async () => {
    // machine 2 is likelier (0.9) but machine 1 costs more at risk
    renderWithData(<AlertsPage />, server({ now: { 1: 0.8, 2: 0.9, 3: 0.1 }, exposure: { 1: 9000, 2: 5000 } }));
    const cards = await screen.findAllByTestId("alert-card", {}, { timeout: 8000 });
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent("Priority 1");
    expect(cards[0]).toHaveTextContent(/9,000/);
    expect(within(cards[0]!).getByTestId("cost-at-risk")).toHaveTextContent("Illustrative");
    expect(cards[1]).toHaveTextContent("Priority 2");
    expect(screen.getByTestId("rank-note")).toHaveTextContent(/not the order of chance/);
    expect(screen.getByTestId("alerts")).toHaveTextContent("Normal means below the Act today level. It is not a guarantee.");
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\blive\b|real-time|right now|savings/);
  }, 15_000);

  it("shows Likely part only for a machine with an active 48-hour warning", async () => {
    renderWithData(<AlertsPage />, server({ now: { 1: 0.8, 2: 0.7 }, exposure: { 1: 9000, 2: 5000 }, parts: { 2: true } }, true));
    const cards = await screen.findAllByTestId("alert-card", {}, { timeout: 8000 });
    await within(cards[1]!).findByTestId("likely-part", {}, { timeout: 8000 });
    expect(within(cards[1]!).getByTestId("likely-part")).toHaveTextContent(/Seal \/ valve/);
    expect(within(cards[1]!).getByTestId("likely-part")).toHaveTextContent(/48-hour warning/);
    expect(within(cards[0]!).queryByTestId("likely-part")).not.toBeInTheDocument();
  }, 15_000);

  it("says what changed since the last hour", async () => {
    renderWithData(<AlertsPage />, server({ now: { 1: 0.8, 2: 0.7 }, before: { 1: 0.75, 2: 0.2 }, exposure: { 1: 9000, 2: 5000 } }));
    const line = await screen.findByTestId("since-last-hour", {}, { timeout: 8000 });
    expect(line).toHaveTextContent(/Since the last hour: 1 new alert \(.* 2\)/);
  }, 15_000);

  it("falls back to chance order and hides cost when the plan is not available", async () => {
    renderWithData(<AlertsPage />, server({ now: { 1: 0.7, 2: 0.9 }, planFails: true }));
    const cards = await screen.findAllByTestId("alert-card", {}, { timeout: 8000 });
    expect(cards[0]).toHaveTextContent("90.0%");
    expect(screen.queryByTestId("cost-at-risk")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rank-note")).not.toBeInTheDocument();
  }, 15_000);

  it("Add to work plan keeps the job in the browser, and a dismissed alert is left out", async () => {
    localStorage.setItem("piq-dismissed", "[2]");
    renderWithData(<AlertsPage />, server({ now: { 1: 0.8, 2: 0.9 }, exposure: { 1: 9000, 2: 5000 } }));
    const cards = await screen.findAllByTestId("alert-card", {}, { timeout: 8000 });
    expect(cards).toHaveLength(1);
    fireEvent.click(within(cards[0]!).getByRole("button", { name: /Add to work plan/ }));
    expect(localStorage.getItem("piq-jobs")).toBe("[1]");
  }, 15_000);

  it("says so when nothing is at the Act today level", async () => {
    renderWithData(<AlertsPage />, server({ now: { 1: 0.1, 2: 0.2 } }));
    expect(await screen.findByTestId("no-alerts", {}, { timeout: 8000 })).toHaveTextContent("No machine is at the Act today level");
  }, 15_000);
});

describe("helpers", () => {
  it("rankByCost orders by cost, reports a different order, and falls back to chance", () => {
    const a = [row(1, 0.8), row(2, 0.9)];
    const r = rankByCost(a, planOf({ 1: 9000, 2: 5000 }));
    expect(r.rows.map((x) => x.machine_id)).toEqual([1, 2]);
    expect(r.differs).toBe(true);
    const same = rankByCost(a, planOf({ 2: 9000, 1: 5000 }));
    expect(same.differs).toBe(false);
    expect(rankByCost(a, null).rows.map((x) => x.machine_id)).toEqual([2, 1]);
  });
  it("sinceText has nothing without an earlier hour", () => {
    expect(sinceText([row(1, 0.9)], null)).toBeNull();
  });
  it("counts alerts per equipment type, alerts first", () => {
    const t = typeCounts([row(1, 0.1), row(2, 0.9), row(3, 0.1)]);
    expect(t.reduce((n, x) => n + x.total, 0)).toBe(3);
    expect(t[0]?.alerts).toBe(Math.max(...t.map((x) => x.alerts)));
  });
  it("parseJobs ignores junk", () => {
    expect(parseJobs("nope")).toEqual([]);
    expect(parseJobs('[1,"x",2.5,3]')).toEqual([1, 3]);
  });
});
