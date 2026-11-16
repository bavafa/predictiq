import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FleetOverviewPage from "@/app/assets/page";
import { sortRows } from "@/lib/fleet";
import type { FleetRow, MachineModel } from "@/lib/types";
import { fakeFetch, json, noModelMetadata, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

// A tiny fleet: scores by machine id, two machine models.
const SCORES: Record<number, number> = { 1: 0.9, 2: 0.7, 3: 0.55, 4: 0.35, 5: 0.1, 6: 0.02 };
const MODEL = (id: number): MachineModel => (id % 2 === 0 ? "model2" : "model1");

function fleetAnswer(params: URLSearchParams) {
  const cutoff = Number(params.get("cutoff") ?? 51);
  const model = params.get("machine_model");
  const status = params.get("status");
  const machine = params.get("machine");
  const rows: FleetRow[] = Object.entries(SCORES)
    .map(([id, score]) => ({
      machine_id: Number(id),
      model: MODEL(Number(id)),
      age: 5 + Number(id),
      score,
      status: (score * 100 >= cutoff ? "alert" : "below_cutoff") as FleetRow["status"],
      latest_error: Number(id) === 1 ? { error: "error3", time: "2015-10-30T14:00:00" } : null,
    }))
    .filter((r) => (!model || r.model === model) && (!status || r.status === status) && (!machine || r.machine_id === Number(machine)))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  const bins = Array.from({ length: 10 }, (_, i) => ({
    low: i / 10,
    high: (i + 1) / 10,
    count: rows.filter((r) => Math.min(9, Math.floor(r.score * 10)) === i).length,
  }));
  return {
    model_version: "piq-test-1",
    at: params.get("at"),
    cutoff_percent: cutoff,
    cards: {
      machines_shown: rows.length,
      machines_in_alert: rows.filter((r) => r.status === "alert").length,
      highest_score: rows[0]?.score ?? null,
      scored_hour: params.get("at"),
    },
    distribution: bins,
    rows,
  };
}

function trendAnswer(params: URLSearchParams) {
  const f = fleetAnswer(params);
  return {
    model_version: "piq-test-1",
    at: params.get("at"),
    cutoff_percent: f.cutoff_percent,
    range: params.get("range"),
    machines_in_population: f.rows.length,
    points: [
      { hour: "2015-11-01T05:00:00", machines_in_alert: f.cards.machines_in_alert },
      { hour: "2015-11-01T06:00:00", machines_in_alert: f.cards.machines_in_alert },
    ],
  };
}

const server = () =>
  fakeFetch(readyMetadata(), async (input) => {
    const url = new URL(input, "http://x");
    if (url.pathname.endsWith("/fleet/trend")) return json(trendAnswer(url.searchParams));
    if (url.pathname.endsWith("/fleet")) return json(fleetAnswer(url.searchParams));
    return problem(404, "Not found");
  });

beforeEach(() => {
  window.sessionStorage.clear();
  setAddress("");
});
afterEach(() => vi.useRealTimers());

const alertCount = () => Number(screen.getByTestId("card-alert").textContent);
const tableRows = () => screen.getAllByTestId("fleet-row");
const alertRows = () => tableRows().filter((r) => r.getAttribute("data-status") === "alert").length;

describe("Fleet Overview", () => {
  it("shows the cards, both charts and a table ranked riskiest first, all labelled", async () => {
    renderWithData(<FleetOverviewPage />, server());
    expect(await screen.findByTestId("card-shown")).toHaveTextContent("6");
    expect(alertCount()).toBe(3); // 90, 70, 55 at cut-off 51
    expect(screen.getByTestId("card-highest")).toHaveTextContent("90.0%");
    expect(screen.getByTestId("risk-chart-summary")).toHaveTextContent("3 at or above the 51% cut-off");
    expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
    expect(tableRows().map((r) => r.getAttribute("data-machine"))).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(document.querySelectorAll('[data-value-label="Predicted"]').length).toBeGreaterThan(2);
    expect(document.querySelectorAll('[data-value-label="Historical"]').length).toBeGreaterThan(0);
    expect(screen.getByRole("table")).toHaveAccessibleName(/ranked by predicted chance/);
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\blive\b|real-time|savings/);
  });

  it("links each machine to Asset Details with the replay time and cut-off", async () => {
    setAddress("?at=2015-11-02T00:00&cutoff=40");
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    const link = within(tableRows()[0]!).getByRole("link", { name: "Exhaust fan 1" });
    const url = new URL(link.getAttribute("href")!, "http://x");
    expect(url.pathname).toBe("/asset-details");
    expect(url.searchParams.get("machine")).toBe("1");
    expect(url.searchParams.get("at")).toBe("2015-11-02T00:00");
    expect(url.searchParams.get("cutoff")).toBe("40");
  });

  it("the Alert count equals the Alert rows in the table under every filter", async () => {
    const user = userEvent.setup();
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    expect(alertRows()).toBe(alertCount());
    await user.selectOptions(screen.getByLabelText("Machine model"), "model2"); // machines 2, 4, 6
    await waitFor(() => expect(screen.getByTestId("card-shown")).toHaveTextContent("3"));
    expect(tableRows()).toHaveLength(3);
    expect(alertCount()).toBe(1);
    expect(alertRows()).toBe(1);
    await user.selectOptions(screen.getByLabelText("Status"), "alert");
    await waitFor(() => expect(tableRows()).toHaveLength(1));
    expect(screen.getByTestId("card-shown")).toHaveTextContent("1");
    expect(alertCount()).toBe(1);
    expect(window.location.search).toContain("machine_model=model2");
    expect(window.location.search).toContain("status=alert");
  });

  it("changing the cut-off updates the count, the table tags and the chart line together", async () => {
    const user = userEvent.setup();
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    expect(screen.getByTestId("cutoff-value")).toHaveTextContent("51% (default)");
    expect(screen.getByRole("button", { name: "Reset to default" })).toHaveAttribute("aria-disabled", "true");
    const slider = screen.getByRole("slider", { name: "Alert cut-off" });
    fireEvent.change(slider, { target: { value: "31" } }); // a key press: machines 1-4 are in Alert at 31%
    await waitFor(() => expect(alertCount()).toBe(4));
    expect(alertRows()).toBe(4);
    expect(screen.getByTestId("cutoff-value")).toHaveTextContent("31% (custom)");
    expect(screen.getByTestId("risk-chart-summary")).toHaveTextContent("4 at or above the 31% cut-off");
    expect(screen.getByTestId("cutoff-note")).toHaveTextContent("Cut-off changed to 31%");
    await waitFor(() => expect(screen.getByTestId("fleet-announcer")).toHaveTextContent("Cut-off 31 percent. 4 machines are in Alert."));
    expect(window.location.search).toContain("cutoff=31");
    await user.click(screen.getByRole("button", { name: "Reset to default" }));
    await waitFor(() => expect(alertCount()).toBe(3));
    expect(window.location.search).not.toContain("cutoff");
  });

  it("EMPTY FILTER RESULT: zero everywhere, filters kept visible, Clear filters recovers", async () => {
    const user = userEvent.setup();
    setAddress("?machine_number=6&status=alert");
    renderWithData(<FleetOverviewPage />, server());
    const empty = await screen.findByTestId("empty-result");
    expect(empty).toHaveTextContent("No machines match these filters at");
    expect(empty).toHaveTextContent('status "Act today" and machine number 6');
    expect(screen.getByTestId("card-shown")).toHaveTextContent("0");
    expect(alertCount()).toBe(0);
    expect(screen.getByTestId("card-highest")).toHaveTextContent("None");
    expect(screen.getByTestId("risk-chart-summary")).toHaveTextContent("0 machines match these filters. Every bar is 0.");
    expect(screen.getByTestId("trend-chart-summary")).toHaveTextContent("the count is 0 at every hour");
    expect(screen.getByLabelText("Status")).toHaveValue("alert");
    expect(screen.getByLabelText("Machine number")).toHaveValue("6");
    await user.click(within(empty).getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(tableRows()).toHaveLength(6));
  });

  it("a machine number outside the sample is refused with a message, not applied", async () => {
    const user = userEvent.setup();
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    await user.click(screen.getByLabelText("Machine number"));
    await user.paste("250");
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a machine number from 1 to 100.");
    expect(window.location.search).not.toContain("machine_number");
  });

  it("shows the charts as tables on request, with the same numbers", async () => {
    const user = userEvent.setup();
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    const risk = screen.getByTestId("risk-chart");
    await user.click(within(risk).getByRole("button", { name: "View as table" }));
    const table = within(risk).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(11); // header + 10 bins
    expect(within(table).getByRole("row", { name: /90–100% 1/ })).toBeInTheDocument();
    const trend = screen.getByTestId("trend-chart");
    await user.click(within(trend).getByRole("button", { name: "View as table" }));
    expect(within(trend).getByRole("table")).toBeInTheDocument();
  });

  it("sorting by a column header reorders the rows and sets aria-sort", async () => {
    const user = userEvent.setup();
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    await user.click(screen.getByRole("button", { name: /Age \(years\)/ }));
    expect(tableRows()[0]).toHaveAttribute("data-machine", "6"); // oldest first
    expect(screen.getByRole("columnheader", { name: /Age/ })).toHaveAttribute("aria-sort", "descending");
    await user.click(screen.getByRole("button", { name: /Predicted chance, 24 h/ }));
    expect(tableRows()[0]).toHaveAttribute("data-machine", "1");
  });

  it("LOADING: grey blocks first; ERROR: what failed with Try again, filters kept; recovers", async () => {
    const user = userEvent.setup();
    let fail = true;
    const f = fakeFetch(readyMetadata(), async (input) => {
      const url = new URL(input, "http://x");
      if (url.pathname.endsWith("/fleet/trend")) return json(trendAnswer(url.searchParams));
      if (fail) return problem(500, "boom");
      return json(fleetAnswer(url.searchParams));
    });
    setAddress("?status=alert");
    renderWithData(<FleetOverviewPage />, f);
    expect((await screen.findAllByTestId("skeleton")).length).toBeGreaterThan(0);
    const err = await screen.findByTestId("service-error");
    expect(err).toHaveTextContent("Couldn't load the fleet at");
    expect(err).toHaveTextContent("Your settings are kept.");
    expect(screen.getByLabelText("Status")).toHaveValue("alert");
    expect(screen.queryByTestId("card-alert")).not.toBeInTheDocument(); // no stale or made-up numbers
    fail = false;
    await user.click(within(err).getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("card-alert")).toHaveTextContent("3");
  });

  it("one failed panel (the trend) does not blank the rest", async () => {
    const f = fakeFetch(readyMetadata(), async (input) => {
      const url = new URL(input, "http://x");
      if (url.pathname.endsWith("/fleet/trend")) return problem(500, "boom");
      return json(fleetAnswer(url.searchParams));
    });
    renderWithData(<FleetOverviewPage />, f);
    expect(await screen.findByTestId("card-alert")).toBeInTheDocument();
    expect(await screen.findByTestId("service-error")).toHaveTextContent("Couldn't load the Alert trend");
    expect(tableRows().length).toBe(6);
  });

  it("NO MODEL DATA: the plain statement, no numbers, no table", async () => {
    const { container } = renderWithData(<FleetOverviewPage />, fakeFetch(noModelMetadata()));
    expect(await screen.findByTestId("no-model-data")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[0-9]/);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("has no guide card (decision 82)", async () => {
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    expect(screen.queryByTestId("guide")).not.toBeInTheDocument();
  });

  it("pages the table 25 at a time", async () => {
    const many = (params: URLSearchParams) => {
      const rows = Array.from({ length: 60 }, (_, i) => ({
        rank: i + 1,
        machine_id: i + 1,
        model: "model1" as const,
        age: 3,
        score: 0.9 - i * 0.01,
        status: (i < 10 ? "alert" : "below_cutoff") as "alert" | "below_cutoff",
      }));
      return { ...fleetAnswer(params), cards: { machines_shown: 60, machines_in_alert: 10, highest_score: 0.9, scored_hour: "x" }, rows };
    };
    const user = userEvent.setup();
    renderWithData(
      <FleetOverviewPage />,
      fakeFetch(readyMetadata(), async (input) => {
        const url = new URL(input, "http://x");
        return json(url.pathname.endsWith("/trend") ? trendAnswer(url.searchParams) : many(url.searchParams));
      }),
    );
    await screen.findByTestId("card-shown");
    expect(tableRows()).toHaveLength(25);
    expect(screen.getByTestId("table-count")).toHaveTextContent("Showing 1–25 of 60");
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByTestId("table-count")).toHaveTextContent("Showing 26–50 of 60");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });
});

describe("latest error column", () => {
  it("shows the newest error type and hour, or None yet", async () => {
    setAddress("");
    renderWithData(<FleetOverviewPage />, server());
    await screen.findByTestId("card-shown");
    const cells = screen.getAllByTestId("latest-error").map((c) => c.textContent);
    expect(cells[0]).toBe("error3 · 30 Oct 2015, 14:00"); // machine 1 is ranked first
    expect(cells.slice(1).every((c) => c === "None yet")).toBe(true);
    expect(screen.getByRole("columnheader", { name: "Latest error" })).toBeInTheDocument();
  });
});

describe("sortRows", () => {
  const rows: FleetRow[] = [
    { rank: 1, machine_id: 9, model: "model2", age: 3, score: 0.9, status: "alert", latest_error: null },
    { rank: 2, machine_id: 2, model: "model1", age: 10, score: 0.2, status: "below_cutoff", latest_error: null },
  ];
  it("orders by the chosen column", () => {
    expect(sortRows(rows, { key: "machine", dir: "asc" }).map((r) => r.machine_id)).toEqual([2, 9]);
    expect(sortRows(rows, { key: "score", dir: "asc" }).map((r) => r.machine_id)).toEqual([2, 9]);
    expect(sortRows(rows, { key: "score", dir: "desc" }).map((r) => r.machine_id)).toEqual([9, 2]);
    expect(sortRows(rows, { key: "status", dir: "asc" }).map((r) => r.machine_id)).toEqual([9, 2]);
  });
});
