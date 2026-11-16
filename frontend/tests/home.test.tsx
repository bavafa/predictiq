import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/page";
import type { FleetRow } from "@/lib/types";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const row = (id: number, score: number): FleetRow => ({
  rank: id,
  machine_id: id,
  model: "model1",
  age: 4,
  score,
  status: score >= 0.51 ? "alert" : "below_cutoff",
  latest_error: null,
});

const METRICS = {
  model_version: "piq-test-1",
};

function server(scores: number[], withAccuracy = false) {
  return fakeFetch(readyMetadata(), async (input) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/fleet")) {
      const rows = scores.map((sc, i) => row(i + 1, sc));
      return json({
        model_version: "piq-test-1",
        at: url.searchParams.get("at"),
        cutoff_percent: 51,
        cards: { machines_shown: rows.length, machines_in_alert: rows.filter((r) => r.status === "alert").length, highest_score: 0.9, scored_hour: url.searchParams.get("at") },
        distribution: [],
        rows,
      });
    }
    if (withAccuracy && url.pathname.endsWith("/model/metrics")) return json(METRICS);
    return problem(404, "Not found");
  });
}

beforeEach(() => {
  localStorage.clear();
  setAddress("");
});

describe("Home", () => {
  it("opens on what the product is, with a button to the alerts and the plant at the simulated plant time", async () => {
    renderWithData(<HomePage />, server([0.9, 0.7, 0.1, 0.2]));
    const hero = await screen.findByTestId("home-hero");
    expect(hero).toHaveTextContent("Predictive maintenance");
    expect(hero).toHaveTextContent(/likely to fail before they do/);
    expect(screen.getByTestId("see-alerts")).toHaveTextContent("See the 2 alerts");
    expect(screen.getByTestId("see-alerts")).toHaveAttribute("href", expect.stringContaining("/alerts"));
    const plant = screen.getByTestId("plant-status");
    expect(plant).toHaveTextContent("Demo plant at the simulated plant time");
    expect(screen.getByTestId("stat-act")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-normal")).toHaveTextContent("2");
    expect(screen.getByTestId("stat-slots")).toHaveTextContent("0 / 5");
    expect(plant).toHaveTextContent("It is not a guarantee");
  });

  it("explains how it works, who it is for and what is real, and never says live, right now or real-time", async () => {
    renderWithData(<HomePage />, server([0.9]));
    await screen.findByTestId("home-hero");
    for (const t of ["How it works", "Where to go", "Who it is for", "What is real and what is not"]) {
      expect(screen.getByRole("heading", { name: t })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "How it would fit a real plant" })).toHaveAttribute("href", expect.stringContaining("/real-plant"));
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\blive\b|real-time|right now|savings/);
  });

  it("shows the top three alerts and Add to work plan keeps the job in the browser", async () => {
    renderWithData(<HomePage />, server([0.95, 0.9, 0.8, 0.7, 0.1]));
    const box = await screen.findByTestId("home-alerts");
    expect(within(box).getAllByTestId("alert-card")).toHaveLength(3);
    fireEvent.click(within(box).getAllByRole("button", { name: /Add to work plan/ })[0]!);
    expect(localStorage.getItem("piq-jobs")).toBe("[1]");
    expect(within(box).getByRole("link", { name: /In work plan/ })).toBeInTheDocument();
  });

  it("says so when nothing is at the Act today level", async () => {
    renderWithData(<HomePage />, server([0.1, 0.2]));
    expect(await screen.findByTestId("see-alerts")).toHaveTextContent("See the alerts");
    expect(screen.getByTestId("home-alerts")).toHaveTextContent("No machine is at the Act today level");
    expect(screen.queryByTestId("alert-card")).not.toBeInTheDocument();
  });

  it("counts booked crew slots from the scheduled jobs", async () => {
    localStorage.setItem("piq-jobs", "[1]");
    localStorage.setItem("piq-status", '{"1":"scheduled"}');
    renderWithData(<HomePage />, server([0.9]));
    await screen.findByTestId("home-hero");
    expect(screen.getByTestId("stat-slots")).toHaveTextContent("1 / 5");
  });

  it("keeps the simulated-test caveat beside the accuracy fact even when the result is not available", async () => {
    renderWithData(<HomePage />, server([0.9]));
    const card = (await screen.findByRole("heading", { name: "Alert accuracy" })).closest("article")!;
    expect(card).toHaveTextContent(/simulated/i);
    expect(card).toHaveTextContent("Real equipment would score lower");
  });
});
