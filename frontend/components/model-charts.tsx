"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard, ScrollRegion, td, th } from "@/components/chart-card";
import {
  MODEL_NAME,
  cutoffPoints,
  pct,
  perDay,
  prCurve,
  rowAt,
  type Results,
} from "@/lib/model-performance";

// Chart colours from docs/design/tokens.md: main model teal (solid, circles), baseline violet (dashed, squares).
const MAIN = "#0d9488";
const BASELINE = "#7c3aed";
const CUTOFF = "#b45309";
const SLATE = "#475569";
const INK2 = "#4b5563";
const GRID = "#e5e7eb";

// Legend text is body-text colour (text.secondary, 7:1 on white). Recharts would colour it with the series colour, and the
// teal main-model colour is only 3.7:1, which is enough for a line (3:1) but not for text (4.5:1). The coloured key beside it stays.
const legendText = (value: ReactNode) => <span style={{ color: INK2 }}>{value}</span>;

const axisLabel = (value: string, extra: Record<string, unknown> = {}) => ({ value, fontSize: 12, fill: INK2, ...extra });
const one = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function Table({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <ScrollRegion label={`${caption} (table)`}>
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`${th} ${i === 0 ? "" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </ScrollRegion>
  );
}

const num = `${td} text-right`;

/** Precision and recall by cut-off, main model, with the cut-off in use marked. */
export function PrecisionRecallByCutoff({ results, cutoff }: { results: Results; cutoff: number }) {
  const data = cutoffPoints(results, "main");
  const at = rowAt(results, "main", cutoff);
  const here = data.find((d) => d.cutoff === cutoff);
  const summary =
    here && at
      ? `At the ${cutoff}% cut-off the main model's precision is ${at.precision === null ? "— (no alerts)" : pct(at.precision)} and its recall is ${pct(at.recall)}. The chart covers every cut-off from 0% to 100%.`
      : `The saved cut-off table has no values at ${cutoff}%. The chart covers the cut-offs that are saved.`;
  return (
    <ChartCard
      testId="chart-precision-recall"
      title="Precision and recall by cut-off (main model)"
      caption="Solid teal line: precision. Dashed slate line: recall. Amber vertical line: the cut-off in use. Held-out test period."
      summary={summary}
      chart={
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis type="number" dataKey="cutoff" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Alert cut-off (percent)", { position: "insideBottom", offset: -18 })} />
              <YAxis domain={[0, 100]} width={48} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Percent", { angle: -90, position: "insideLeft" })} />
              <Legend verticalAlign="top" height={28} formatter={legendText} />
              <Line name="Precision" type="monotone" dataKey="precision" stroke={MAIN} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line name="Recall" type="monotone" dataKey="recall" stroke={SLATE} strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
              <ReferenceLine x={cutoff} stroke={CUTOFF} strokeWidth={2} label={{ value: `Cut-off ${cutoff}%`, position: "insideBottomRight", fontSize: 11, fill: CUTOFF }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <Table caption="Main model precision and recall at every saved cut-off" head={["Cut-off", "Precision", "Recall"]}>
          {data.map((d) => (
            <tr key={d.cutoff} data-current={d.cutoff === cutoff ? "true" : undefined}>
              <th scope="row" className={`${td} text-left font-normal`}>
                {d.cutoff}%{d.cutoff === cutoff ? " (in use)" : ""}
              </th>
              <td className={num}>{d.precision === null ? "— (no alerts)" : `${one(d.precision)}%`}</td>
              <td className={num}>{one(d.recall)}%</td>
            </tr>
          ))}
        </Table>
      }
    />
  );
}

/** Alerts per day by cut-off, main model. */
export function AlertsPerDayByCutoff({ results, cutoff }: { results: Results; cutoff: number }) {
  const data = cutoffPoints(results, "main");
  const here = data.find((d) => d.cutoff === cutoff);
  const days = results.testWindow.hours / 24;
  return (
    <ChartCard
      testId="chart-alerts-per-day"
      title="Alerts per day by cut-off (main model)"
      caption={`Alerts raised across all machines, divided by the days in the test period. A run of consecutive alert hours on one machine is one alert. Amber vertical line: the cut-off in use.`}
      summary={
        here
          ? `At the ${cutoff}% cut-off the main model raises ${perDay(here.alertsPerDay)} alerts per day across all machines (saved alert count divided by ${days.toFixed(1)} days).`
          : `The saved cut-off table has no values at ${cutoff}%.`
      }
      chart={
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis type="number" dataKey="cutoff" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Alert cut-off (percent)", { position: "insideBottom", offset: -18 })} />
              <YAxis width={48} tickFormatter={(v: number) => String(Math.round(v * 10) / 10)} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Alerts per day", { angle: -90, position: "insideLeft" })} />
              <Line name="Alerts per day" type="monotone" dataKey="alertsPerDay" stroke={MAIN} strokeWidth={2} dot={false} isAnimationActive={false} />
              <ReferenceLine x={cutoff} stroke={CUTOFF} strokeWidth={2} label={{ value: `Cut-off ${cutoff}%`, position: "insideBottomRight", fontSize: 11, fill: CUTOFF }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <Table caption="Main model alerts per day at every saved cut-off" head={["Cut-off", "Alerts per day"]}>
          {data.map((d) => (
            <tr key={d.cutoff} data-current={d.cutoff === cutoff ? "true" : undefined}>
              <th scope="row" className={`${td} text-left font-normal`}>
                {d.cutoff}%{d.cutoff === cutoff ? " (in use)" : ""}
              </th>
              <td className={num}>{perDay(d.alertsPerDay)}</td>
            </tr>
          ))}
        </Table>
      }
    />
  );
}

/** Precision-recall curves, both models. Each point is one saved cut-off. */
export function PrecisionRecallCurves({ results }: { results: Results }) {
  const main = prCurve(results, "main");
  const base = prCurve(results, "baseline");
  const byCutoff = new Map<number, { main?: (typeof main)[number]; base?: (typeof base)[number] }>();
  for (const p of main) byCutoff.set(p.cutoff, { ...byCutoff.get(p.cutoff), main: p });
  for (const p of base) byCutoff.set(p.cutoff, { ...byCutoff.get(p.cutoff), base: p });
  const rows = [...byCutoff.entries()].sort((a, b) => a[0] - b[0]);
  return (
    <ChartCard
      testId="chart-pr-curves"
      title="Precision–recall curves"
      caption="Each point is one cut-off. Solid teal line: main model. Dashed violet line: simple baseline. Further up and to the right is better."
      summary={`Precision–recall area: main model ${results.models.main.summary.pr_auc.toFixed(3)}, simple baseline ${results.models.baseline.summary.pr_auc.toFixed(3)} (higher is better; 1.000 is perfect).`}
      chart={
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="recall" domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Recall (percent)", { position: "insideBottom", offset: -18 })} />
              <YAxis type="number" dataKey="precision" domain={[0, 100]} width={48} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Precision (%)", { angle: -90, position: "insideLeft" })} />
              <Legend verticalAlign="top" height={28} formatter={legendText} />
              <Line name={MODEL_NAME.main} data={main} dataKey="precision" stroke={MAIN} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line name={MODEL_NAME.baseline} data={base} dataKey="precision" stroke={BASELINE} strokeWidth={2} strokeDasharray="6 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <Table
          caption="Precision and recall for both models at every saved cut-off"
          head={["Cut-off", "Main precision", "Main recall", "Baseline precision", "Baseline recall"]}
        >
          {rows.map(([c, v]) => (
            <tr key={c}>
              <th scope="row" className={`${td} text-left font-normal`}>{c}%</th>
              <td className={num}>{v.main ? `${one(v.main.precision)}%` : "—"}</td>
              <td className={num}>{v.main ? `${one(v.main.recall)}%` : "—"}</td>
              <td className={num}>{v.base ? `${one(v.base.precision)}%` : "—"}</td>
              <td className={num}>{v.base ? `${one(v.base.recall)}%` : "—"}</td>
            </tr>
          ))}
        </Table>
      }
    />
  );
}

/** Calibration: mean predicted chance against how often a failure followed, in ten equal-size groups of hours. */
export function CalibrationChart({ results }: { results: Results }) {
  const mk = (m: "main" | "baseline") =>
    results.models[m].summary.calibration_curve.map((b) => ({ x: b.mean_score * 100, y: b.observed_rate * 100, n: b.n, bin: b.bin }));
  const main = mk("main");
  const base = mk("baseline");
  const top = Math.min(100, Math.max(10, Math.ceil(Math.max(...main.map((p) => Math.max(p.x, p.y)), ...base.map((p) => Math.max(p.x, p.y))) / 10) * 10));
  const bins = Math.max(main.length, base.length);
  return (
    <ChartCard
      testId="chart-calibration"
      title="Calibration: predicted chance against what happened"
      caption="Hours are sorted by predicted chance and split into ten equal groups. Circles: main model. Squares: simple baseline. The dashed diagonal is a perfect match."
      summary={`Calibration gap (Brier score): main model ${results.models.main.summary.brier.toFixed(4)}, simple baseline ${results.models.baseline.summary.brier.toFixed(4)} (lower is better). Points on the diagonal mean the predicted chance matched how often a failure followed.`}
      chart={
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={GRID} />
              <XAxis type="number" dataKey="x" name="Predicted" domain={[0, top]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Average predicted chance in the group (percent)", { position: "insideBottom", offset: -18 })} />
              <YAxis type="number" dataKey="y" name="Observed" domain={[0, top]} width={48} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: INK2 }} label={axisLabel("Followed by a failure (%)", { angle: -90, position: "insideLeft" })} />
              <Legend verticalAlign="top" height={28} formatter={legendText} />
              <ReferenceLine segment={[{ x: 0, y: 0 }, { x: top, y: top }]} stroke={INK2} strokeDasharray="4 4" ifOverflow="hidden" />
              <Scatter name={MODEL_NAME.main} data={main} fill={MAIN} shape="circle" isAnimationActive={false} />
              <Scatter name={MODEL_NAME.baseline} data={base} fill={BASELINE} shape="square" isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <Table
          caption="Calibration groups for both models: average predicted chance and share followed by a failure"
          head={["Group", "Main predicted", "Main happened", "Baseline predicted", "Baseline happened"]}
        >
          {Array.from({ length: bins }, (_, i) => (
            <tr key={i}>
              <th scope="row" className={`${td} text-left font-normal`}>{i + 1} of {bins}</th>
              <td className={num}>{main[i] ? `${main[i]!.x.toFixed(3)}%` : "—"}</td>
              <td className={num}>{main[i] ? `${main[i]!.y.toFixed(2)}%` : "—"}</td>
              <td className={num}>{base[i] ? `${base[i]!.x.toFixed(3)}%` : "—"}</td>
              <td className={num}>{base[i] ? `${base[i]!.y.toFixed(2)}%` : "—"}</td>
            </tr>
          ))}
        </Table>
      }
    />
  );
}
