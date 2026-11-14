// Model Performance helpers. Every number on the page is read from the saved evaluation
// (GET /model/metrics = evaluation.json, GET /model/threshold-analysis = threshold_analysis.json).
// Nothing is recomputed from scores. The only arithmetic is on saved counts and is listed in decision 68.

export type ModelKey = "main" | "baseline";
export const MODEL_KEYS: readonly ModelKey[] = ["main", "baseline"];
export const MODEL_NAME: Record<ModelKey, string> = { main: "Main model", baseline: "Simple baseline" };

/** One row of the saved cut-off table (all 100 machines). `precision` is null when no alert was raised. */
export type CutoffRow = {
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

export type CalibrationBin = { bin: number; mean_score: number; n: number; observed_rate: number; positives: number };

export type ModelSummary = {
  pr_auc: number;
  brier: number;
  n_machine_hours: number;
  n_positive_hours: number;
  n_machines: number;
  calibration_curve: CalibrationBin[];
  default_cutoff_percent: number | null;
};

export type Results = {
  modelVersion: string;
  testWindow: { start: string; end: string; hours: number };
  models: Record<ModelKey, { summary: ModelSummary; cutoffs: CutoffRow[] }>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const ROW_FIELDS = [
  "cutoff",
  "alerts",
  "events_caught",
  "events_full_lookback",
  "false_alerts",
  "false_alerts_per_100_machine_days",
  "fn",
  "fp",
  "tn",
  "tp",
  "recall",
  "share_events_caught",
];

function parseRow(v: unknown): CutoffRow | null {
  if (!isRecord(v)) return null;
  if (!ROW_FIELDS.every((k) => isNum(v[k]))) return null;
  if (v.precision !== null && !isNum(v.precision)) return null;
  return v as unknown as CutoffRow;
}

function parseBin(v: unknown): CalibrationBin | null {
  if (!isRecord(v)) return null;
  return ["bin", "mean_score", "n", "observed_rate", "positives"].every((k) => isNum(v[k])) ? (v as unknown as CalibrationBin) : null;
}

/**
 * Read the two saved files. Returns null when they do not hold what the page needs (for example, a deployment
 * whose evaluation has not been written yet): the page then says results are not available and shows no numbers.
 */
export function parseResults(metrics: unknown, threshold: unknown): Results | null {
  if (!isRecord(metrics) || !isRecord(threshold)) return null;
  const tw = metrics.test_window;
  if (typeof metrics.model_version !== "string" || !isRecord(tw)) return null;
  if (typeof tw.start !== "string" || typeof tw.end !== "string" || !isNum(tw.hours)) return null;
  const em = metrics.models;
  const tm = threshold.models;
  if (!isRecord(em) || !isRecord(tm)) return null;

  const out: Partial<Results["models"]> = {};
  for (const key of MODEL_KEYS) {
    const e = em[key];
    const t = tm[key];
    if (!isRecord(e) || !isRecord(t)) return null;
    const groups = e.groups;
    const all = isRecord(groups) ? groups.all : null;
    if (!isRecord(all) || !Array.isArray(t.all)) return null;
    if (![all.pr_auc, all.brier, all.n_machine_hours, all.n_positive_hours, all.n_machines].every(isNum)) return null;
    if (!Array.isArray(all.calibration_curve)) return null;
    const bins = all.calibration_curve.map(parseBin);
    const rows = t.all.map(parseRow);
    if (bins.length === 0 || rows.length === 0 || bins.some((b) => b === null) || rows.some((r) => r === null)) return null;
    out[key] = {
      summary: {
        pr_auc: all.pr_auc as number,
        brier: all.brier as number,
        n_machine_hours: all.n_machine_hours as number,
        n_positive_hours: all.n_positive_hours as number,
        n_machines: all.n_machines as number,
        calibration_curve: bins as CalibrationBin[],
        default_cutoff_percent: isNum(e.default_cutoff_percent) ? e.default_cutoff_percent : null,
      },
      cutoffs: rows as CutoffRow[],
    };
  }
  return { modelVersion: metrics.model_version, testWindow: { start: tw.start, end: tw.end, hours: tw.hours }, models: out as Results["models"] };
}

// --- formats ------------------------------------------------------------------------------------------------

export const DASH = "—";
const grouped = new Intl.NumberFormat("en-GB");
export const count = (n: number) => grouped.format(n);
/** A saved fraction (0.971112) as "97.1%". */
export const pct = (fraction: number) => `${(Math.round(fraction * 1000) / 10).toFixed(1)}%`;
const pct2 = (fraction: number) => `${(Math.round(fraction * 10000) / 100).toFixed(2)}%`;
/** A saved share as "100%" or "97.2%". */
export const sharePct = (fraction: number) => `${Math.round(fraction * 1000) / 10}%`;

export type Cell = { text: string; detail?: string; reason?: string };

export type Better = "higher" | "lower";
export type MeasureRow = {
  key: string;
  label: string;
  /** What the row is, in plain words. */
  definition: string;
  better: Better;
  /** "covers all cut-offs" and the like, shown next to the label. */
  note?: string;
  /** The row does not change with the cut-off. */
  allCutoffs: boolean;
  cells: Record<ModelKey, Cell>;
};

const NOT_SAVED = "not in the saved cut-off table";

export function rowAt(results: Results, model: ModelKey, cutoff: number): CutoffRow | null {
  return results.models[model].cutoffs.find((r) => r.cutoff === cutoff) ?? null;
}

const atCutoff = (results: Results, cutoff: number, pick: (row: CutoffRow) => Cell): Record<ModelKey, Cell> => {
  const cell = (m: ModelKey): Cell => {
    const row = rowAt(results, m, cutoff);
    return row ? pick(row) : { text: DASH, reason: NOT_SAVED };
  };
  return { main: cell("main"), baseline: cell("baseline") };
};
const numberCell = (n: number): Cell => ({ text: count(n) });

/** The comparison table, one entry per measure, every cut-off row read at the shared cut-off. */
export function comparisonRows(results: Results, cutoff: number): MeasureRow[] {
  const s = results.models;
  return [
    {
      key: "precision",
      label: "Precision",
      definition: "Of the machine-hours the model flagged, the share that really were followed by a recorded failure within 24 hours.",
      better: "higher",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => (r.precision === null ? { text: DASH, reason: "no alerts at this cut-off" } : { text: pct(r.precision) })),
    },
    {
      key: "recall",
      label: "Recall",
      definition: "Of the machine-hours followed by a recorded failure within 24 hours, the share the model flagged.",
      better: "higher",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => ({ text: pct(r.recall) })),
    },
    {
      key: "pr_area",
      label: "Precision–recall area",
      note: "covers all cut-offs",
      definition: "One number for how well the model separates failing from non-failing hours across every cut-off at once. 1.000 would be perfect. It does not change with the cut-off.",
      better: "higher",
      allCutoffs: true,
      cells: { main: { text: s.main.summary.pr_auc.toFixed(3) }, baseline: { text: s.baseline.summary.pr_auc.toFixed(3) } },
    },
    {
      key: "caught",
      label: "Caught (machine-hours)",
      definition: "Machine-hours the model flagged that were followed by a recorded failure within 24 hours.",
      better: "higher",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => numberCell(r.tp)),
    },
    {
      key: "false_alert_hours",
      label: "False alerts (machine-hours)",
      definition: "Machine-hours the model flagged that were not followed by a recorded failure within 24 hours.",
      better: "lower",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => numberCell(r.fp)),
    },
    {
      key: "missed",
      label: "Missed (machine-hours)",
      definition: "Machine-hours followed by a recorded failure within 24 hours that the model did not flag.",
      better: "lower",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => numberCell(r.fn)),
    },
    {
      key: "quiet",
      label: "Quiet and correct (machine-hours)",
      definition: "Machine-hours the model did not flag and that were not followed by a recorded failure within 24 hours.",
      better: "higher",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => numberCell(r.tn)),
    },
    {
      key: "false_per_100",
      label: "False alerts per 100 machine-days",
      note: "consecutive alert hours on one machine count as one alert",
      definition:
        "Alerts with no recorded failure in the next 24 hours, per 100 machine-days of the test period. A run of consecutive alert hours on one machine counts as one alert.",
      better: "lower",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => ({
        text: r.false_alerts_per_100_machine_days.toFixed(2),
        detail: `${count(r.false_alerts)} false of ${count(r.alerts)} alerts`,
      })),
    },
    {
      key: "events_caught",
      label: "Share of failure events caught",
      definition:
        "A failure event counts as caught if the model raised an alert on that machine in the 24 hours before it. Only events with their whole 24-hour lookback inside the test period are counted.",
      better: "higher",
      allCutoffs: false,
      cells: atCutoff(results, cutoff, (r) => ({
        text: `${count(r.events_caught)} of ${count(r.events_full_lookback)} (${sharePct(r.share_events_caught)})`,
      })),
    },
    {
      key: "calibration",
      label: "Calibration gap (Brier score)",
      note: "covers all cut-offs",
      definition:
        "How far the predicted chances are from what happened, on average. 0 would be perfect; lower is better. It does not change with the cut-off. See the calibration chart below.",
      better: "lower",
      allCutoffs: true,
      cells: { main: { text: s.main.summary.brier.toFixed(4) }, baseline: { text: s.baseline.summary.brier.toFixed(4) } },
    },
  ];
}

// --- charts -------------------------------------------------------------------------------------------------

export type CutoffPoint = { cutoff: number; precision: number | null; recall: number; alertsPerDay: number };

/** Alerts per day = saved alert count / (test-period hours / 24). Arithmetic on two saved numbers (decision 68). */
export function cutoffPoints(results: Results, model: ModelKey): CutoffPoint[] {
  const days = results.testWindow.hours / 24;
  return results.models[model].cutoffs.map((r) => ({
    cutoff: r.cutoff,
    precision: r.precision === null ? null : r.precision * 100,
    recall: r.recall * 100,
    alertsPerDay: days > 0 ? r.alerts / days : 0,
  }));
}

export const perDay = (n: number) => n.toFixed(2);

/** Points of the precision-recall curve (cut-offs with no alerts have no precision and are left out). */
export function prCurve(results: Results, model: ModelKey): { cutoff: number; recall: number; precision: number }[] {
  const points: { cutoff: number; recall: number; precision: number }[] = [];
  for (const r of results.models[model].cutoffs) {
    if (r.precision !== null) points.push({ cutoff: r.cutoff, recall: r.recall * 100, precision: r.precision * 100 });
  }
  return points.sort((a, b) => a.recall - b.recall || a.cutoff - b.cutoff);
}

// --- why accuracy misleads ----------------------------------------------------------------------------------

export type AccuracyRow = { key: string; rule: string; right: string; failuresCaught: string };

/**
 * Accuracy is the share of machine-hours called right. From saved counts only: an always-"no failure" rule is
 * right on every machine-hour with no failure ahead and wrong on all the others.
 */
export function accuracyFigures(
  results: Results,
  cutoff: number,
): { failureShare: string; total: string; failureHours: string; rows: AccuracyRow[] } | null {
  const { n_machine_hours: total, n_positive_hours: positive } = results.models.main.summary;
  if (total <= 0) return null;
  const rows: AccuracyRow[] = [
    { key: "never", rule: "Always say “no failure”", right: pct2((total - positive) / total), failuresCaught: `0 of ${count(positive)}` },
  ];
  for (const m of MODEL_KEYS) {
    const r = rowAt(results, m, cutoff);
    const sum = r ? r.tp + r.tn + r.fp + r.fn : NaN;
    rows.push({
      key: m,
      rule: `${MODEL_NAME[m]} at the ${cutoff}% cut-off`,
      right: r && sum === total ? pct2((r.tp + r.tn) / total) : DASH,
      failuresCaught: r ? `${count(r.tp)} of ${count(r.tp + r.fn)}` : DASH,
    });
  }
  return { failureShare: pct(positive / total), total: count(total), failureHours: count(positive), rows };
}
