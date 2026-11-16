import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import OverviewPage from "@/app/page";
import { headline, typeCounts } from "@/components/overview-screen";
import { parseJobs } from "@/lib/jobs";
import type { FleetRow } from "@/lib/types";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const row = (id: number, score: number, cutoff = 51): FleetRow => ({
  rank: 0,
  machine_id: id,
  model: "model1",
  age: 4 + id,
  score,
  status: score * 100 >= cutoff ? "alert" : "below_cutoff",
  latest_error: id === 1 ? { error: "error5", time: "2015-10-31T06:00:00" } : null,
});

const server = (scores: Record<number, number>) =>
  fakeFetch(readyMetadata(), async (input) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/fleet")) {
      const rows = Object.entries(scores).map(([id, s], i) => ({ ...row(Number(id), s), rank: i + 1 }));
      return json({
        model_version: "piq-test-1",
        at: url.searchParams.get("at"),
        cutoff_percent: 51,
        cards: { machines_shown: rows.length, machines_in_alert: rows.filter((r) => r.status === "alert").length, highest_score: 0.9, scored_hour: url.searchParams.get("at") },
        distribution: [],
        rows,
      });
    }
    return problem(404, "Not found");
  });

beforeEach(() => {
  localStorage.clear();
  setAddress("");
});
afterEach(() => setAddress(""));

describe("Overview", () => {
  it("opens on a plain headline, an alert card per alert with its reason, and status by equipment type", async () => {
    renderWithData(<OverviewPage />, server({ 1: 0.9, 2: 0.7, 3: 0.1 }));
    expect(await screen.findByTestId("overview-headline")).toHaveTextContent("2 assets have a high chance of failing in the next 24 hours");
    expect(screen.getAllByTestId("alert-card")).toHaveLength(2);
    expect(screen.getAllByTestId("alert-card")[0]).toHaveTextContent("90.0% chance of failure within 24 h");
    expect(screen.getAllByTestId("alert-card")[0]).toHaveTextContent(/error5/);
    expect(screen.getByRole("heading", { name: "Plant status by equipment type" })).toBeInTheDocument();
    expect(screen.queryByTestId("guide")).not.toBeInTheDocument();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\blive\b|real-time|savings/);
  });

  it("Add to work plan saves the job in the browser and the button becomes a link to the plan", async () => {
    renderWithData(<OverviewPage />, server({ 1: 0.9, 2: 0.1 }));
    fireEvent.click(await screen.findByRole("button", { name: /Add to work plan/ }));
    expect(parseJobs(localStorage.getItem("piq-jobs") ?? "")).toEqual([1]);
    expect(screen.getByRole("link", { name: /In work plan/ })).toHaveAttribute("href", expect.stringContaining("/maintenance-planner"));
    expect(screen.getByTestId("workplan-summary")).toHaveTextContent("1 job added");
  });

  it("says so when nothing is in alert", async () => {
    renderWithData(<OverviewPage />, server({ 1: 0.1, 2: 0.2 }));
    expect(await screen.findByTestId("overview-headline")).toHaveTextContent("No assets have a high chance");
    expect(screen.queryByTestId("alert-card")).not.toBeInTheDocument();
  });

  it("falls back honestly when the test result is not available", async () => {
    renderWithData(<OverviewPage />, server({ 1: 0.9 }));
    expect(await screen.findByTestId("trust-summary", {}, { timeout: 5000 })).toHaveTextContent(/isn't available|Loading/);
  });
});

describe("helpers", () => {
  it("headline is singular and plural", () => {
    expect(headline(1)).toMatch(/^1 asset has/);
    expect(headline(0)).toMatch(/^No assets/);
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
