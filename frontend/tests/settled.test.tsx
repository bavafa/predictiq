import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AssetDetailsPage from "@/app/asset-details/page";
import FleetOverviewPage from "@/app/page";
import { createApiClient } from "@/lib/api";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

const gate = () => {
  let open!: () => void;
  const opened = new Promise<void>((r) => (open = r));
  return { opened, open };
};
const settle = () => new Promise((r) => setTimeout(r, 60));
const popstate = () => fireEvent(window, new PopStateEvent("popstate"));

// --- Fleet Overview ---------------------------------------------------------------------------------------------

function fleetBody(url: URL, mv = "piq-test-1") {
  const cutoff = Number(url.searchParams.get("cutoff") ?? 51);
  const at = url.searchParams.get("at");
  const alerts = cutoff < 40 ? 4 : 3;
  const rows = [0.9, 0.7, 0.55, 0.35].map((score, i) => ({
    rank: i + 1,
    machine_id: i + 1,
    model: "model1",
    age: 5,
    score,
    status: score * 100 >= cutoff ? "alert" : "below_cutoff",
    latest_error: null,
  }));
  return {
    model_version: mv,
    at,
    cutoff_percent: cutoff,
    cards: { machines_shown: 4, machines_in_alert: alerts, highest_score: 0.9, scored_hour: at },
    distribution: Array.from({ length: 10 }, (_, i) => ({ low: i / 10, high: (i + 1) / 10, count: i === 9 ? 4 : 0 })),
    rows,
  };
}
function trendBody(url: URL, mv = "piq-test-1") {
  const f = fleetBody(url, mv);
  return {
    model_version: mv,
    at: f.at,
    cutoff_percent: f.cutoff_percent,
    range: url.searchParams.get("range"),
    machines_in_population: 4,
    points: [
      { hour: "2015-11-01T05:00:00", machines_in_alert: f.cards.machines_in_alert },
      { hour: "2015-11-01T06:00:00", machines_in_alert: f.cards.machines_in_alert },
    ],
  };
}
const alertCount = () => screen.getByTestId("card-alert").textContent;

describe("Fleet Overview: every number comes from one settled set of answers", () => {
  beforeEach(() => {
    path = "/";
    window.sessionStorage.clear();
    setAddress("?at=2015-11-02T00:00");
  });

  it("keeps the old cards and trend, and does not claim 'updated together', until both answers for the new cut-off are in", async () => {
    const held = gate();
    const f = fakeFetch(readyMetadata(), async (input) => {
      const url = new URL(input, "http://x");
      if (url.pathname.endsWith("/fleet/trend")) {
        if (url.searchParams.get("cutoff") === "31") await held.opened;
        return json(trendBody(url));
      }
      return json(fleetBody(url));
    });
    renderWithData(<FleetOverviewPage />, f);
    await screen.findByTestId("card-shown");
    expect(alertCount()).toBe("3");
    fireEvent.change(screen.getByRole("slider", { name: "Alert cut-off" }), { target: { value: "31" } });
    await waitFor(() => expect(f.mock.calls.some((c) => c[0].includes("/fleet?") && c[0].includes("cutoff=31"))).toBe(true));
    await settle(); // the new fleet answer is in; the trend for 31% is not
    expect(alertCount()).toBe("3");
    expect(screen.getByTestId("risk-chart-summary")).toHaveTextContent("at or above the 51% cut-off");
    expect(screen.getByTestId("cutoff-note")).not.toHaveTextContent("updated together");
    held.open();
    await waitFor(() => expect(alertCount()).toBe("4"));
    expect(screen.getByTestId("cutoff-note")).toHaveTextContent("updated together");
  });

  it("labels the scored hour from the answer on screen, not from the newly selected replay time", async () => {
    const held = gate();
    const f = fakeFetch(readyMetadata(), async (input) => {
      const url = new URL(input, "http://x");
      if (url.searchParams.get("at") === "2015-11-02T05:00") await held.opened;
      return json(url.pathname.endsWith("/fleet/trend") ? trendBody(url) : fleetBody(url));
    });
    renderWithData(<FleetOverviewPage />, f);
    await screen.findByTestId("card-shown");
    const before = screen.getByTestId("card-hour").textContent;
    setAddress("?at=2015-11-02T05:00");
    popstate();
    await settle();
    expect(screen.getByTestId("card-hour").textContent).toBe(before);
    held.open();
    await waitFor(() => expect(screen.getByTestId("card-hour").textContent).not.toBe(before));
  });

  it("follows the refreshed /metadata after a stale model version: new default cut-off and version", async () => {
    let now = { mv: "piq-test-1", cutoff: 51 };
    let metaCalls = 0;
    const f = vi.fn(async (input: string) => {
      const url = new URL(input, "http://x");
      if (url.pathname.endsWith("/metadata")) {
        metaCalls += 1;
        const body = readyMetadata({ model_version: now.mv, default_cutoff_percent: now.cutoff });
        if (metaCalls === 1) now = { mv: "piq-test-2", cutoff: 60 }; // a release lands just after the page loaded
        return json(body);
      }
      if (url.searchParams.get("mv") !== now.mv) return problem(404, "Not found");
      return json(url.pathname.endsWith("/trend") ? trendBody(url, now.mv) : fleetBody(url, now.mv));
    });
    setAddress("");
    renderWithData(<FleetOverviewPage />, f);
    await waitFor(() => expect(screen.getByTestId("cutoff-value")).toHaveTextContent("60% (default)"));
    await waitFor(() => expect(screen.getByTestId("risk-chart-summary")).toHaveTextContent("at or above the 60% cut-off"));
  });
});

describe("api client", () => {
  it("tells listeners the new /metadata when a stale version made it re-read", async () => {
    let mv = "a";
    const f = fakeFetch(
      () => json(readyMetadata({ model_version: mv })),
      async (input) => (input.includes(`mv=${mv}`) ? json({ ok: true }) : problem(404, "Not found")),
    );
    const api = createApiClient(f);
    const seen: (string | null)[] = [];
    api.onMetadataRefreshed((m) => seen.push(m.model_version));
    await api.metadata();
    mv = "b";
    await api.fleet({ at: "2015-11-02T00:00" });
    expect(seen).toEqual(["b"]);
  });
});

// --- Asset Details ----------------------------------------------------------------------------------------------

describe("Asset Details: score, factors, charts and records belong to one hour", () => {
  beforeEach(() => {
    path = "/asset-details";
    setAddress("?machine=7&at=2015-11-02T00:00", "/asset-details");
  });

  it("keeps the old score, factors and hour label until every answer for the new hour is in", async () => {
    const held = gate();
    const f = fakeFetch(readyMetadata(), async (input) => {
      const url = new URL(input, "http://x");
      const at = url.searchParams.get("at") ?? "";
      const later = at.startsWith("2015-11-02T05");
      const base = { model_version: "piq-test-1", machine_id: 7, at: `${at}:00` };
      if (url.pathname.endsWith("/explanation")) {
        if (later) await held.opened;
        return json({ ...base, score: later ? 0.2 : 0.873, unit: "log-odds", base_value: -4, contributions: [], all_others: 0, caveat: "c" });
      }
      if (url.pathname.endsWith("/telemetry")) return json({ ...base, range: "24h", rows: [] });
      return json({
        ...base,
        model: "model3",
        age: 12,
        cutoff_percent: 51,
        score: later ? 0.2 : 0.873,
        status: later ? "below_cutoff" : "alert",
        past_estimates: [],
        errors: [],
        repairs: [],
        failures: [],
      });
    });
    renderWithData(<AssetDetailsPage />, f);
    await waitFor(() => expect(screen.getByTestId("asset-score")).toHaveTextContent("87.3%"));
    setAddress("?machine=7&at=2015-11-02T05:00", "/asset-details");
    popstate();
    await settle(); // the new score is in, its factors are not
    expect(screen.getByTestId("asset-score")).toHaveTextContent("87.3%");
    expect(screen.getByTestId("score-panel")).toHaveTextContent("00:00");
    held.open();
    await waitFor(() => expect(screen.getByTestId("asset-score")).toHaveTextContent("20.0%"));
    expect(screen.getByTestId("score-panel")).toHaveTextContent("05:00");
  });
});
