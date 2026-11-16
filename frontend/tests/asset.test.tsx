import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AssetDetailsPage from "@/app/asset-details/page";
import { inputName, signed } from "@/lib/asset";
import type { Asset, Explanation, Telemetry } from "@/lib/types";
import { fakeFetch, json, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/asset-details" }));

const AT = "2015-11-02T00:00:00";

function asset(id: number, overrides: Partial<Asset> = {}): Asset {
  return {
    model_version: "piq-test-1",
    machine_id: id,
    model: "model3",
    age: 12,
    at: AT,
    cutoff_percent: 51,
    score: 0.873,
    status: "alert",
    past_estimates: Array.from({ length: 30 }, (_, i) => ({ hour: `2015-11-01T${String(i % 24).padStart(2, "0")}:00:00`, score: 0.1 })),
    errors: [
      { time: "2015-11-01T20:00:00", error: "error4" },
      { time: "2015-11-02T00:00:00", error: "error9-AT-THE-HOUR" }, // at the replay hour: must never be shown
      { time: "2015-11-02T03:00:00", error: "error8-AFTER" }, // after it: must never be shown
    ],
    repairs: [{ time: "2015-10-30T10:00:00", component: "comp2" }],
    failures: [{ time: "2015-10-31T08:00:00", components: ["comp1", "comp4"] }],
    ...overrides,
  };
}

const telemetry = (id: number, range: string): Telemetry => ({
  model_version: "piq-test-1",
  machine_id: id,
  at: AT,
  range: range as "24h",
  rows: Array.from({ length: 24 }, (_, i) => ({ hour: `2015-11-01T${String(i).padStart(2, "0")}:00:00`, volt: 170 + i, rotate: 440, pressure: 100, vibration: 40 })),
});

const features = ["vibration_mean_24h", "error3_count_24h", "hours_since_comp2", "rotate_slope_24h", "age", "machine_model", "volt_last", "pressure_std_3h"];
const explanation = (id: number): Explanation => ({
  model_version: "piq-test-1",
  machine_id: id,
  at: AT,
  score: 0.873,
  unit: "log-odds",
  base_value: -4.2,
  contributions: features.map((f, i) => ({ feature: f, contribution: i === 3 ? -0.5 : 2 - i * 0.2 })),
  all_others: 0.12,
  caveat: "These are patterns the model used, not proven causes.",
});

const openDetails = async () => {
  const b = await screen.findByRole("button", { name: /Model details/ });
  if (b.getAttribute("aria-expanded") !== "true") await userEvent.click(b);
};

type Fail = Partial<Record<"asset" | "telemetry" | "explanation", () => Response>>;

function server(fail: Fail = {}, seen: string[] = []) {
  return fakeFetch(readyMetadata(), async (input) => {
    seen.push(input);
    const url = new URL(input, "http://x");
    const m = /\/assets\/(\d+)(\/telemetry|\/explanation)?$/.exec(url.pathname);
    if (!m) return problem(404, "Not found");
    const id = Number(m[1]);
    const kind = m[2] === "/telemetry" ? "telemetry" : m[2] === "/explanation" ? "explanation" : "asset";
    const failing = fail[kind];
    if (failing) return failing();
    if (kind === "telemetry") return json(telemetry(id, url.searchParams.get("range") ?? "24h"));
    if (kind === "explanation") return json(explanation(id));
    return json(asset(id));
  });
}

const setNarrow = (narrow: boolean) =>
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: narrow && query.includes("max-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });

beforeEach(() => {
  localStorage.clear(); // Model details start closed
  setNarrow(false);
  setAddress("?machine=7&at=2015-11-02T00:00", "/asset-details");
});
afterEach(() => {
  // @ts-expect-error restore jsdom's lack of matchMedia
  delete window.matchMedia;
});

describe("Asset Details: states without a machine", () => {
  it("asks to choose a machine, with a selector and a link to Assets", async () => {
    setAddress("?at=2015-11-02T00:00&cutoff=40", "/asset-details");
    renderWithData(<AssetDetailsPage />, server());
    expect(await screen.findByText("Choose a machine to see its history and risk")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Machine" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to assets/ })).toHaveAttribute("href", "/assets?at=2015-11-02T00%3A00&cutoff=40");
    expect(screen.queryByTestId("explanation")).toBeNull();
  });

  it("says a machine outside 1 to 100 isn't in the sample, and still offers the selector and the fleet link", async () => {
    setAddress("?machine=250", "/asset-details");
    renderWithData(<AssetDetailsPage />, server());
    expect(await screen.findByText("Machine 250 isn't in the sample data.")).toBeInTheDocument();
    expect(screen.getByText("The sample has machines numbered 1 to 100.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Machine" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to assets/ })).toBeInTheDocument();
  });

  it("choosing a machine from the picker puts its number in the address", async () => {
    setAddress("", "/asset-details");
    renderWithData(<AssetDetailsPage />, server());
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Machine" }), "12");
    expect(window.location.search).toContain("machine=12");
    expect(await screen.findByTestId("facts")).toHaveTextContent("Industrial mixer 12");
  });
});

describe("Asset Details: a machine", () => {
  it("shows facts, score and status, labelled, with the patterns-not-causes caveat", async () => {
    renderWithData(<AssetDetailsPage />, server());
    expect(await screen.findByTestId("asset-score")).toHaveTextContent("87.3%");
    expect(screen.getByTestId("fact-model")).toHaveTextContent("model3");
    expect(screen.getByTestId("fact-age")).toHaveTextContent("12");
    expect(screen.getByTestId("asset-status")).toHaveAttribute("data-status", "alert");
    expect(screen.getByTestId("asset-status")).toHaveTextContent("Act today");
    expect(screen.getByTestId("cutoff-readout")).toHaveTextContent("Alert cut-off: 51%");
    expect(screen.getByTestId("why-caveat")).toHaveTextContent("These are patterns the model found in the data, not causes. They are not repair advice.");
    expect(document.querySelectorAll('[data-value-label="Predicted"]').length).toBeGreaterThan(1);
    expect(document.querySelectorAll('[data-value-label="Historical"]').length).toBeGreaterThan(2);
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\blive\b|real-time|savings/);
  });

  it("lists the top 8 inputs and all others in plain words, and shows the exact pushes on request", async () => {
    const user = userEvent.setup();
    renderWithData(<AssetDetailsPage />, server());
    await openDetails();
    await screen.findByTestId("explanation-table");
    const rows = screen.getAllByTestId("explanation-row");
    expect(rows).toHaveLength(9);
    expect(rows[0]).toHaveTextContent("Average vibration, past 24 hours");
    expect(rows[0]).toHaveTextContent("Raises the chance");
    expect(rows[3]).toHaveTextContent("Lowers the chance");
    expect(rows[0]).not.toHaveTextContent("+2.00");
    await user.click(screen.getByRole("button", { name: "Show exact numbers" }));
    expect(rows[0]).toHaveTextContent("+2.00");
    expect(rows[3]).toHaveTextContent("−0.50");
    expect(rows[8]).toHaveTextContent("All other inputs combined");
  });

  it("opens a plain definition from an input's ⓘ button and closes it with Escape", async () => {
    renderWithData(<AssetDetailsPage />, server());
    await openDetails();
    await screen.findByTestId("explanation-table");
    const button = screen.getByRole("button", { name: 'What "Average vibration, past 24 hours" means' });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toHaveTextContent("average vibration reading over the 24 hours before the scored hour");
    await userEvent.keyboard("{Escape}");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("shows an input's definition on hover, hides it on mouse-out, and keeps it when clicked", async () => {
    const user = userEvent.setup();
    renderWithData(<AssetDetailsPage />, server());
    await openDetails();
    await screen.findByTestId("explanation-table");
    const button = screen.getByRole("button", { name: 'What "Average vibration, past 24 hours" means' });
    await user.hover(button);
    expect(screen.getByRole("note")).toBeInTheDocument();
    await user.unhover(button);
    expect(screen.queryByRole("note")).toBeNull();
    await user.click(button); // pins it open
    await user.unhover(button);
    expect(screen.getByRole("note")).toBeInTheDocument();
    await user.click(button); // closes it
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("never lists a record at or after the replay hour, and shows errors, repairs and failures in one history", async () => {
    renderWithData(<AssetDetailsPage />, server());
    const list = await screen.findByTestId("history-list");
    await waitFor(() => expect(list).toHaveTextContent("error4"));
    expect(document.body.textContent).not.toMatch(/AT-THE-HOUR|AFTER/);
    for (const li of document.querySelectorAll("[data-record-time]")) {
      expect(li.getAttribute("data-record-time")! < AT).toBe(true);
    }
    expect(within(list).getByText(/Component 2 replaced/)).toBeInTheDocument();
    expect(within(list).getByText(/comp1, comp4/)).toBeInTheDocument();
    expect(list).toHaveTextContent("Simulated sample data");
    // newest first
    const times = [...list.querySelectorAll("[data-record-time]")].map((li) => li.getAttribute("data-record-time")!);
    expect(times).toEqual([...times].sort().reverse());
  });

  it("says so when there are no errors, repairs or failures in the 7 days", async () => {
    const quiet = fakeFetch(readyMetadata(), async (input) => {
      const url = new URL(input, "http://x");
      if (url.pathname.endsWith("/telemetry")) return json(telemetry(7, "24h"));
      if (url.pathname.endsWith("/explanation")) return json(explanation(7));
      return json(asset(7, { errors: [], repairs: [], failures: [] }));
    });
    renderWithData(<AssetDetailsPage />, quiet);
    expect(await screen.findByText("No errors, repairs or recorded failures in the 7 days up to this time.")).toBeInTheDocument();
  });

  it("draws four sensor charts with text summaries and a table alternative", async () => {
    renderWithData(<AssetDetailsPage />, server());
    for (const key of ["volt", "rotate", "pressure", "vibration"]) {
      expect(await screen.findByTestId(`sensor-${key}-summary`)).toHaveTextContent("hourly readings");
    }
    const card = screen.getByTestId("sensor-volt");
    await userEvent.click(within(card).getByRole("button", { name: "View as table" }));
    expect(within(card).getByRole("table")).toBeInTheDocument();
    expect(screen.getByTestId("past-estimates-summary")).toHaveTextContent("1 recorded failure");
    expect(screen.getByTestId("past-estimates")).toHaveTextContent("simulated sample data");
  });

  it("asks for 7 days of sensor history when the range changes", async () => {
    const seen: string[] = [];
    renderWithData(<AssetDetailsPage />, server({}, seen));
    await screen.findByTestId("sensor-volt");
    await userEvent.click(screen.getByRole("radio", { name: "7 days" }));
    await waitFor(() => expect(seen.some((u) => u.includes("/telemetry") && u.includes("range=7d"))).toBe(true));
    expect(screen.getByRole("radio", { name: "7 days" })).toHaveAttribute("aria-checked", "true");
  });

  it("on a narrow screen the sensors are tabs, one chart at a time, moved with the arrow keys", async () => {
    setNarrow(true);
    renderWithData(<AssetDetailsPage />, server());
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Voltage", "Rotation", "Pressure", "Vibration"]);
    expect(screen.getAllByTestId(/^sensor-(volt|rotate|pressure|vibration)$/)).toHaveLength(1);
    tabs[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Rotation" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Rotation" })).toHaveFocus();
    expect(await screen.findByTestId("sensor-rotate")).toBeInTheDocument();
  });
});

describe("Machine page header and What to check first", () => {
  it("links back to All alerts and says Act today starts at the cut-off", async () => {
    renderWithData(<AssetDetailsPage />, server());
    expect(await screen.findByRole("link", { name: /All alerts/ })).toHaveAttribute("href", expect.stringContaining("/alerts"));
    expect(await screen.findByTestId("score-panel")).toHaveTextContent("Act today starts at 51%.");
  });

  it("starts with Model details closed and opens the table on request", async () => {
    renderWithData(<AssetDetailsPage />, server());
    const button = await screen.findByRole("button", { name: /Model details/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("explanation-table")).toBeNull();
    await userEvent.click(button);
    expect(await screen.findByTestId("explanation-table")).toBeInTheDocument();
  });

  it("keeps 'What to check first' away when the deployment has no component scores", async () => {
    renderWithData(<AssetDetailsPage />, server());
    await screen.findByTestId("asset-score");
    expect(screen.queryByTestId("what-to-check")).not.toBeInTheDocument();
  });
});

describe("Asset page: actions and why it is flagged", () => {
  it("says why in sentences, from the biggest upward pushes and the latest error, with the patterns-not-causes line", async () => {
    renderWithData(<AssetDetailsPage />, server());
    const box = await screen.findByTestId("why-flagged");
    expect((await within(box).findAllByText(/pushed the estimate up\./, {}, { timeout: 5000 })).length).toBe(3);
    expect(box).toHaveTextContent("Why it is flagged");
    expect(box).toHaveTextContent(/Latest error record: error4/);
    expect(box).not.toHaveTextContent(/error9-AT-THE-HOUR|error8-AFTER/);
    expect(box).toHaveTextContent(/not causes/);
  });

  it("Add to work plan and Dismiss alert save in the browser only", async () => {
    const user = userEvent.setup();
    renderWithData(<AssetDetailsPage />, server());
    await user.click(await screen.findByRole("button", { name: "Add to work plan" }, { timeout: 5000 }));
    expect(localStorage.getItem("piq-jobs")).toBe("[7]");
    expect(screen.getByRole("link", { name: /In work plan/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss alert" }));
    expect(localStorage.getItem("piq-dismissed")).toBe("[7]");
    expect(screen.queryByRole("button", { name: "Dismiss alert" })).not.toBeInTheDocument();
    expect(screen.getByTestId("dismissed-note")).toBeInTheDocument();
  });

  it("offers no Dismiss for a machine that is below the cut-off", async () => {
    const f = fakeFetch(readyMetadata(), async (input) => {
      const url = new URL(input, "http://x");
      const m = /\/assets\/(\d+)(\/telemetry|\/explanation)?$/.exec(url.pathname);
      if (!m) return problem(404, "Not found");
      if (m[2] === "/telemetry") return json(telemetry(7, "24h"));
      if (m[2] === "/explanation") return json(explanation(7));
      return json(asset(7, { status: "below_cutoff", score: 0.1 }));
    });
    renderWithData(<AssetDetailsPage />, f);
    await screen.findByRole("button", { name: "Add to work plan" }, { timeout: 5000 });
    expect(screen.queryByRole("button", { name: "Dismiss alert" })).not.toBeInTheDocument();
    expect(screen.getByTestId("why-flagged")).toHaveTextContent("What the model sees");
  });
});

describe("Asset Details: when one panel fails", () => {
  it("shows the sensor error with Try again while the rest of the page stays correct", async () => {
    let broken = true;
    const seen: string[] = [];
    const base = server({ telemetry: () => (broken ? problem(500, "boom") : json(telemetry(7, "24h"))) }, seen);
    renderWithData(<AssetDetailsPage />, base);
    const error = await screen.findByTestId("sensor-error");
    expect(error).toHaveTextContent("Couldn't load the sensor history for this machine.");
    expect(error).toHaveTextContent("The rest of this page is still correct.");
    // everything else is intact
    expect(screen.getByTestId("asset-score")).toHaveTextContent("87.3%");
    await openDetails();
    expect(await screen.findAllByTestId("explanation-row")).toHaveLength(9);
    expect(screen.getByTestId("past-estimates")).toBeInTheDocument();
    expect(screen.getByTestId("history-list")).toHaveTextContent("error4");
    broken = false;
    await userEvent.click(within(error).getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("sensor-volt")).toBeInTheDocument();
    expect(screen.queryByTestId("sensor-error")).toBeNull();
  });

  it("shows the explanation error alone when only that request fails", async () => {
    renderWithData(<AssetDetailsPage />, server({ explanation: () => problem(500, "boom") }));
    await openDetails();
    expect(await screen.findByTestId("explanation-error")).toHaveTextContent("Couldn't load what pushed this estimate.");
    expect(screen.getByTestId("why-caveat")).toBeInTheDocument(); // the caveat never hides
    expect(await screen.findByTestId("asset-score")).toHaveTextContent("87.3%");
    expect(screen.getByTestId("sensor-volt")).toBeInTheDocument();
  });

  it("shows panel errors for the machine record and keeps the sensors and explanation", async () => {
    renderWithData(<AssetDetailsPage />, server({ asset: () => problem(500, "boom") }));
    expect(await screen.findByTestId("asset-error-score")).toBeInTheDocument();
    expect(screen.getByTestId("asset-error-facts")).toBeInTheDocument();
    expect(screen.getByTestId("history-error")).toBeInTheDocument();
    await openDetails();
    expect(await screen.findAllByTestId("explanation-row")).toHaveLength(9);
    expect(screen.getByTestId("sensor-volt")).toBeInTheDocument();
  });

  it("shows loading blocks while the answers are on their way", async () => {
    renderWithData(<AssetDetailsPage />, fakeFetch(readyMetadata(), () => new Promise<Response>(() => {})));
    await waitFor(() => expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(3));
    expect(screen.queryByTestId("asset-score")).toBeNull();
  });

  it("treats a 404 for the machine as not found", async () => {
    renderWithData(<AssetDetailsPage />, server({ asset: () => problem(404, "Machine not found") }));
    expect(await screen.findByTestId("machine-not-found")).toBeInTheDocument();
  });
});

describe("input names and number formats", () => {
  it("gives every model input a plain name with its time window", () => {
    for (const f of [
      "volt_last", "rotate_mean_3h", "pressure_std_24h", "vibration_slope_24h", "error5_count_24h", "hours_since_comp4", "machine_model", "age",
    ]) {
      const n = inputName(f);
      expect(n.name).not.toMatch(/_/);
      expect(n.meaning.length).toBeGreaterThan(10);
    }
    expect(inputName("rotate_mean_3h").name).toBe("Average rotation, past 3 hours");
    expect(inputName("hours_since_comp4").name).toBe("Hours since component 4 was last replaced");
  });
  it("signs pushes with a real minus", () => {
    expect(signed(0.824)).toBe("+0.82");
    expect(signed(-1.4)).toBe("−1.40");
    expect(signed(0.001)).toBe("0.00");
  });
});
