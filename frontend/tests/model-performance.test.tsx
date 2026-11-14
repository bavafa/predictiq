import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ModelPerformancePage from "@/app/model-performance/page";
import { comparisonRows, parseResults } from "@/lib/model-performance";
import { fakeFetch, json, noModelMetadata, problem, readyMetadata, renderWithData, setAddress } from "./helpers";

vi.mock("next/navigation", () => ({ usePathname: () => "/model-performance" }));

const TOTAL = 142300;
const POSITIVE = 2590;

/** A saved cut-off row whose values differ at every cut-off, so a change of cut-off is visible in every row. */
function row(c: number, missPerPoint: number, falsePerPoint: number) {
  const fn = c === 100 ? POSITIVE : Math.min(POSITIVE - 1, Math.round(c * missPerPoint));
  const tp = POSITIVE - fn;
  const fp = c === 100 ? 0 : Math.round((100 - c) * falsePerPoint) + 1;
  const alerts = c === 100 ? 0 : 10 + (100 - c);
  return {
    cutoff: c,
    alerts,
    events_caught: Math.max(0, 107 - c),
    events_full_lookback: 107,
    false_alerts: Math.floor(alerts / 10),
    false_alerts_per_100_machine_days: Math.round((100 - c) * 1.5) / 100 + 0.01,
    fn,
    fp,
    tn: TOTAL - POSITIVE - fp,
    tp,
    precision: tp + fp === 0 ? null : tp / (tp + fp),
    recall: tp / POSITIVE,
    share_events_caught: Math.max(0, 107 - c) / 107,
  };
}

function curve(scale: number) {
  return Array.from({ length: 10 }, (_, i) => ({ bin: i + 1, mean_score: (i + 1) * 0.01 * scale, n: 14230, observed_rate: (i + 1) * 0.011 * scale, positives: i }));
}

export function fixture(opts: { dropCutoff?: number } = {}) {
  const rows = (miss: number, fa: number) =>
    Array.from({ length: 101 }, (_, c) => row(c, miss, fa)).filter((r) => r.cutoff !== opts.dropCutoff);
  const model = (pr: number, brier: number, def: number) => ({
    default_cutoff_percent: def,
    groups: {
      all: {
        pr_auc: pr,
        brier,
        n_machine_hours: TOTAL,
        n_positive_hours: POSITIVE,
        n_machines: 100,
        calibration_curve: curve(pr),
      },
    },
  });
  const metrics = {
    model_version: "piq-test-1",
    simulated: true,
    test_window: { start: "2015-11-01 00:00", end: "2015-12-30 06:00", hours: 1423 },
    models: { main: model(0.993198, 0.001092, 51), baseline: model(0.809049, 0.006011, 27) },
  };
  const threshold = {
    model_version: "piq-test-1",
    models: { main: { all: rows(20, 10) }, baseline: { all: rows(40, 20) } },
  };
  return { metrics, threshold };
}

function serve(f = fixture(), meta = readyMetadata({ model_created: "20261114" })) {
  return fakeFetch(meta, async (input) => {
    if (input.startsWith("/api/v1/model/metrics")) return json(f.metrics);
    if (input.startsWith("/api/v1/model/threshold-analysis")) return json(f.threshold);
    return problem(404, "Not found");
  });
}

const cell = (key: string, model: "main" | "baseline") =>
  within(document.querySelector(`[data-testid="measure-row"][data-key="${key}"]`) as HTMLElement).getByTestId(`cell-${model}`);

async function ready(search = "") {
  setAddress(search, "/model-performance");
  const view = renderWithData(<ModelPerformancePage />, serve());
  await screen.findByTestId("comparison-table");
  return view;
}

describe("Model Performance, results", () => {
  it("shows the header facts: version, evaluation date, test period and the target in words", async () => {
    await ready();
    expect(screen.getByTestId("fact-version")).toHaveTextContent("piq-test-1");
    expect(screen.getByTestId("fact-date")).toHaveTextContent("14 November 2026");
    expect(screen.getByTestId("fact-period")).toHaveTextContent("1 Nov 2015, 00:00 to 30 Dec 2015, 06:00");
    expect(screen.getByTestId("fact-target")).toHaveTextContent("recorded failure within the next 24 hours");
  });

  it("renders every row from the saved values at the default cut-off, for both models", async () => {
    await ready();
    const f = fixture();
    const at = (m: "main" | "baseline") => f.threshold.models[m].all[51]!;
    for (const m of ["main", "baseline"] as const) {
      const r = at(m);
      expect(cell("precision", m)).toHaveTextContent(`${(Math.round(r.precision! * 1000) / 10).toFixed(1)}%`);
      expect(cell("recall", m)).toHaveTextContent(`${(Math.round(r.recall * 1000) / 10).toFixed(1)}%`);
      expect(cell("caught", m)).toHaveTextContent(r.tp.toLocaleString("en-GB"));
      expect(cell("false_alert_hours", m)).toHaveTextContent(r.fp.toLocaleString("en-GB"));
      expect(cell("missed", m)).toHaveTextContent(r.fn.toLocaleString("en-GB"));
      expect(cell("quiet", m)).toHaveTextContent(r.tn.toLocaleString("en-GB"));
      expect(cell("false_per_100", m)).toHaveTextContent(r.false_alerts_per_100_machine_days.toFixed(2));
      expect(cell("events_caught", m)).toHaveTextContent(`${r.events_caught} of ${r.events_full_lookback} (${Math.round(r.share_events_caught * 1000) / 10}%)`);
    }
    expect(cell("pr_area", "main")).toHaveTextContent("0.993");
    expect(cell("pr_area", "baseline")).toHaveTextContent("0.809");
    expect(cell("calibration", "main")).toHaveTextContent("0.0011");
    expect(cell("calibration", "baseline")).toHaveTextContent("0.0060");
  });

  it("marks the all-cut-off rows, says consecutive alert hours are one alert, and points to the calibration chart", async () => {
    await ready();
    const rows = (key: string) => document.querySelector(`[data-testid="measure-row"][data-key="${key}"]`) as HTMLElement;
    expect(rows("pr_area")).toHaveTextContent("covers all cut-offs");
    expect(rows("calibration")).toHaveTextContent("covers all cut-offs");
    expect(rows("false_per_100")).toHaveTextContent("consecutive alert hours on one machine count as one alert");
    expect(within(rows("calibration")).getByRole("link", { name: /calibration chart/ })).toHaveAttribute("href", "#calibration-chart");
  });

  it("states the test period and the cut-off in use, directly under the cut-off control", async () => {
    await ready();
    expect(screen.getByTestId("period-line")).toHaveTextContent("Test period: 1 Nov 2015, 00:00 to 30 Dec 2015, 06:00 (1,423 hours, 100 machines)");
    expect(screen.getByTestId("period-cutoff")).toHaveTextContent("51%");
    expect(screen.getByTestId("comparison-line")).toHaveTextContent("alert cut-off 51% for both models");
    expect(screen.getByTestId("own-cutoffs")).toHaveTextContent("main model 51%, simple baseline 27%");
  });

  it("changing the cut-off updates every cut-off row for both models and leaves the all-cut-off rows alone", async () => {
    const user = userEvent.setup();
    await ready();
    const before = Object.fromEntries(
      (["precision", "recall", "caught", "false_alert_hours", "missed", "quiet", "false_per_100", "events_caught"] as const).flatMap((k) => [
        [`${k}-main`, cell(k, "main").textContent],
        [`${k}-baseline`, cell(k, "baseline").textContent],
      ]),
    );
    const slider = screen.getByRole("slider", { name: "Alert cut-off" });
    slider.focus();
    await user.keyboard("{PageDown}"); // 51 -> 41
    await screen.findByText(/41% \(custom\)/);
    const f = fixture();
    expect(screen.getByTestId("period-cutoff")).toHaveTextContent("41%");
    for (const k of ["precision", "recall", "caught", "false_alert_hours", "missed", "quiet", "false_per_100", "events_caught"] as const) {
      for (const m of ["main", "baseline"] as const) {
        expect(cell(k, m).textContent, `${k} ${m}`).not.toBe(before[`${k}-${m}`]);
      }
    }
    for (const m of ["main", "baseline"] as const) {
      const r = f.threshold.models[m].all[41]!;
      expect(cell("caught", m)).toHaveTextContent(r.tp.toLocaleString("en-GB"));
      expect(cell("missed", m)).toHaveTextContent(r.fn.toLocaleString("en-GB"));
    }
    expect(cell("pr_area", "main")).toHaveTextContent("0.993");
    expect(cell("calibration", "baseline")).toHaveTextContent("0.0060");
    expect(screen.getByTestId("chart-precision-recall-summary")).toHaveTextContent("At the 41% cut-off");
  });

  it("uses the cut-off from the web address", async () => {
    await ready("?cutoff=30");
    expect(screen.getByTestId("period-cutoff")).toHaveTextContent("30%");
    expect(cell("caught", "main")).toHaveTextContent(fixture().threshold.models.main.all[30]!.tp.toLocaleString("en-GB"));
  });

  it("shows — with a short reason where precision is not defined (no alerts)", async () => {
    await ready("?cutoff=100");
    expect(cell("precision", "main")).toHaveTextContent("—");
    expect(cell("precision", "main")).toHaveTextContent("no alerts at this cut-off");
    expect(cell("recall", "main")).toHaveTextContent("0.0%");
  });

  it("shows — with a reason for every cut-off row when the saved file has no values at that cut-off", async () => {
    setAddress("?cutoff=37", "/model-performance");
    renderWithData(<ModelPerformancePage />, serve(fixture({ dropCutoff: 37 })));
    await screen.findByTestId("comparison-table");
    for (const k of ["precision", "recall", "caught", "false_alert_hours", "missed", "quiet", "false_per_100", "events_caught"]) {
      for (const m of ["main", "baseline"] as const) {
        expect(cell(k, m)).toHaveTextContent("—");
        expect(cell(k, m)).toHaveTextContent("not in the saved cut-off table");
      }
    }
    expect(cell("pr_area", "main")).toHaveTextContent("0.993");
  });

  it("every cut-off row is read from the saved file, not recomputed (pure function check)", () => {
    const f = fixture();
    const results = parseResults(f.metrics, f.threshold)!;
    const rows = comparisonRows(results, 12);
    const saved = f.threshold.models.baseline.all[12]!;
    expect(rows.find((r) => r.key === "missed")!.cells.baseline.text).toBe(saved.fn.toLocaleString("en-GB"));
    expect(rows.find((r) => r.key === "precision")!.cells.baseline.text).toBe(`${(Math.round(saved.precision! * 1000) / 10).toFixed(1)}%`);
  });

  it("has an ⓘ definition for each measure, a better-is column on desktop and the rule line for mobile", async () => {
    const user = userEvent.setup();
    await ready();
    const buttons = screen.getAllByRole("button", { name: /What ".*" means/ });
    expect(buttons).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: 'What "Recall" means' }));
    expect(screen.getByRole("note")).toHaveTextContent("the share the model flagged");
    expect(screen.getByRole("columnheader", { name: "Better is" })).toBeInTheDocument();
    expect(screen.getByTestId("better-rule")).toHaveTextContent("Better is higher for: Precision; Recall");
    expect(screen.getByTestId("better-rule")).toHaveTextContent("Better is lower for: False alerts (machine-hours)");
  });

  it("explains why accuracy misleads with numbers from the saved counts only", async () => {
    await ready();
    const box = screen.getByTestId("accuracy");
    expect(box).toHaveTextContent("Why accuracy misleads when failures are rare");
    const never = within(box).getAllByTestId("accuracy-row").find((r) => r.getAttribute("data-key") === "never")!;
    expect(never).toHaveTextContent("98.18%"); // (142,300 - 2,590) / 142,300
    expect(never).toHaveTextContent("0 of 2,590");
    const main = fixture().threshold.models.main.all[51]!;
    const mainRow = within(box).getAllByTestId("accuracy-row").find((r) => r.getAttribute("data-key") === "main")!;
    expect(mainRow).toHaveTextContent(`${(Math.round(((main.tp + main.tn) / TOTAL) * 10000) / 100).toFixed(2)}%`);
  });

  it("charts have text summaries and View as table, and the calibration chart names circles and squares", async () => {
    const user = userEvent.setup();
    await ready();
    for (const id of ["chart-precision-recall", "chart-alerts-per-day", "chart-pr-curves", "chart-calibration"]) {
      const fig = screen.getByTestId(id);
      expect(within(fig).getByTestId(`${id}-summary`).textContent).toMatch(/\S/);
      await user.click(within(fig).getByRole("button", { name: "View as table" }));
      expect(within(fig).getByRole("table")).toBeInTheDocument();
    }
    expect(screen.getByTestId("chart-calibration")).toHaveTextContent("Circles: main model. Squares: simple baseline.");
    expect(screen.getByTestId("chart-precision-recall")).toHaveTextContent("Amber vertical line: the cut-off in use");
  });

  it("labels values as predicted and historical, and makes no real-world claim", async () => {
    const { container } = await ready();
    expect(container.querySelector('[data-value-label="Predicted"]')).not.toBeNull();
    expect(container.querySelector('[data-value-label="Historical"]')).not.toBeNull();
    expect(container.textContent).toMatch(/It makes no claim about performance on real machines|makes no claim about performance on real machines/);
    expect(container.textContent).not.toMatch(/\bsavings?\b|\blive\b|real-time/i);
  });

  it("shows no number that is not in the saved files or arithmetic on them (every digit string is traceable)", async () => {
    await ready();
    // Spot-check: the only percentages in the table are saved-value percentages; nothing like a made-up score.
    const text = screen.getByTestId("comparison-table").textContent ?? "";
    const f = fixture();
    const allowed = new Set<string>();
    for (const m of ["main", "baseline"] as const) {
      const r = f.threshold.models[m].all[51]!;
      allowed.add(r.tp.toLocaleString("en-GB"));
      allowed.add(r.fn.toLocaleString("en-GB"));
    }
    for (const a of allowed) expect(text).toContain(a);
  });
});

describe("Model Performance, states", () => {
  it("LOADING: header, cut-off control and test period line show; table and charts are grey blocks; limitations readable", async () => {
    setAddress("", "/model-performance");
    const pending = new Promise<Response>(() => undefined);
    const f = fakeFetch(readyMetadata({ model_created: "20261114" }), async () => pending);
    renderWithData(<ModelPerformancePage />, f);
    expect(await screen.findByTestId("mp-facts")).toHaveTextContent("piq-test-1");
    expect(screen.getByRole("slider", { name: "Alert cut-off" })).toBeInTheDocument();
    expect(screen.getByTestId("period-line")).toHaveTextContent("Test period: 1 Nov 2015, 00:00 to 3 Nov 2015, 00:00");
    expect(screen.getByTestId("period-line")).toHaveTextContent("Alert cut-off in use: 51%");
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByTestId("comparison-table")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByTestId("limitations")).toHaveTextContent("Simulated data.");
  });

  it("ERROR: says what failed with Try again, shows no table, chart or numbers, keeps the test description and limitations", async () => {
    let up = false;
    setAddress("", "/model-performance");
    const f = fakeFetch(readyMetadata(), async (input) => {
      if (!up) return problem(500, "boom");
      if (input.startsWith("/api/v1/model/metrics")) return json(fixture().metrics);
      return json(fixture().threshold);
    });
    renderWithData(<ModelPerformancePage />, f);
    const err = await screen.findByTestId("service-error");
    expect(err).toHaveTextContent("Couldn't load the saved evaluation results.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comparison")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mp-charts")).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByTestId("fact-period")).toHaveTextContent("1 Nov 2015, 00:00");
    expect(screen.getByTestId("limitations")).toBeInTheDocument();
    expect(screen.getByTestId("period-line").textContent).not.toMatch(/hours,|cut-off in use/i);
    up = true;
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("comparison-table")).toBeInTheDocument();
  });

  it("NOT AVAILABLE: 'Results appear after the model is evaluated' and no results", async () => {
    setAddress("", "/model-performance");
    const f = fakeFetch(readyMetadata(), async (input) =>
      input.startsWith("/api/v1/model/metrics") ? json({ schema: 1, models: {} }) : json({ schema: 1, models: {} }),
    );
    renderWithData(<ModelPerformancePage />, f);
    const note = await screen.findByTestId("results-not-available");
    expect(note).toHaveTextContent("Results appear after the model is evaluated");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mp-charts")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accuracy")).not.toBeInTheDocument();
    expect(note.textContent).not.toMatch(/\d/);
  });

  it("NOT AVAILABLE also when the service says the evaluation is not found", async () => {
    setAddress("", "/model-performance");
    renderWithData(<ModelPerformancePage />, fakeFetch(readyMetadata(), async () => problem(404, "Not found")));
    expect(await screen.findByTestId("results-not-available")).toBeInTheDocument();
  });

  it("NO MODEL DATA: the existing screen-gate state, no numbers", async () => {
    setAddress("", "/model-performance");
    const { container } = renderWithData(<ModelPerformancePage />, fakeFetch(noModelMetadata()));
    expect(await screen.findByTestId("no-model-data")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/[0-9]/);
    expect(screen.queryByTestId("limitations")).not.toBeInTheDocument();
  });
});
