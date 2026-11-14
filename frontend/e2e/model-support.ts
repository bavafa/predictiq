import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Helpers for the Model Performance specs: the saved files as the service serves them, and the page checked against them.

type Row = {
  cutoff: number;
  alerts: number;
  events_caught: number;
  events_full_lookback: number;
  false_alerts: number;
  false_alerts_per_100_machine_days: number;
  fn: number;
  fp: number;
  tn: number;
  tp: number;
  precision: number | null;
  recall: number;
  share_events_caught: number;
};
type Saved = {
  metrics: { model_version: string; models: Record<"main" | "baseline", { groups: { all: { pr_auc: number; brier: number } } }> };
  rows: Record<"main" | "baseline", Row[]>;
};

export async function readSaved(request: APIRequestContext): Promise<Saved> {
  const meta = await (await request.get("/api/v1/metadata")).json();
  const q = `?mv=${meta.model_version}`;
  const metricsRes = await request.get(`/api/v1/model/metrics${q}`);
  const thresholdRes = await request.get(`/api/v1/model/threshold-analysis${q}`);
  expect(metricsRes.ok()).toBe(true);
  expect(thresholdRes.ok()).toBe(true);
  const metrics = await metricsRes.json();
  const threshold = await thresholdRes.json();
  return { metrics, rows: { main: threshold.models.main.all, baseline: threshold.models.baseline.all } };
}

const pct1 = (x: number) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
const n = (x: number) => x.toLocaleString("en-GB");

const cell = (page: Page, key: string, model: "main" | "baseline") =>
  page.locator(`[data-testid="measure-row"][data-key="${key}"] [data-testid="cell-${model}"]`);

/** Every cut-off row of the table equals the saved file's row at `cutoff`, for both models. */
export async function expectTableMatches(page: Page, saved: Saved, cutoff: number) {
  await expect(page.getByTestId("period-cutoff")).toHaveText(`${cutoff}%`);
  for (const m of ["main", "baseline"] as const) {
    const r = saved.rows[m].find((x) => x.cutoff === cutoff)!;
    expect(r).toBeDefined();
    await expect(cell(page, "precision", m)).toContainText(r.precision === null ? "—" : pct1(r.precision));
    await expect(cell(page, "recall", m)).toContainText(pct1(r.recall));
    await expect(cell(page, "caught", m)).toContainText(n(r.tp));
    await expect(cell(page, "false_alert_hours", m)).toContainText(n(r.fp));
    await expect(cell(page, "missed", m)).toContainText(n(r.fn));
    await expect(cell(page, "quiet", m)).toContainText(n(r.tn));
    await expect(cell(page, "false_per_100", m)).toContainText(r.false_alerts_per_100_machine_days.toFixed(2));
    await expect(cell(page, "events_caught", m)).toContainText(
      `${n(r.events_caught)} of ${n(r.events_full_lookback)} (${Math.round(r.share_events_caught * 1000) / 10}%)`,
    );
    const all = saved.metrics.models[m].groups.all;
    await expect(cell(page, "pr_area", m)).toHaveText(all.pr_auc.toFixed(3));
    await expect(cell(page, "calibration", m)).toHaveText(all.brier.toFixed(4));
  }
}

