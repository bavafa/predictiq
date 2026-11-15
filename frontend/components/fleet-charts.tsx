"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { Skeleton } from "@/components/states";
import { ChartCard, ScrollRegion, td, th } from "@/components/chart-card";
import { Button } from "@/components/ui/button";
import { binLabel, binOfCutoff } from "@/lib/fleet";
import { shortHour, parseHour } from "@/lib/time";
import type { Fleet, FleetTrend, Range } from "@/lib/types";

const INK = "#363636";
const INK2 = "#425563";
const BAR = "#475569";
const LINE_EDGE = "#e5e7eb";

export function DistributionChart({ fleet, shownOf }: { fleet: Fleet; shownOf: number }) {
  const bins = fleet.distribution;
  const data = bins.map((b) => ({ bin: binLabel(b.low, b.high), count: b.count }));
  const shown = fleet.cards.machines_shown;
  const cutBin = data[binOfCutoff(fleet.cutoff_percent, bins.length)]?.bin;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const atOrAbove = fleet.cards.machines_in_alert;
  const summary =
    shown === 0
      ? `0 machines match these filters. Every bar is 0. Cut-off ${fleet.cutoff_percent}%.`
      : `${shown} machines shown: ${atOrAbove} at or above the ${fleet.cutoff_percent}% cut-off, ${shown - atOrAbove} below it. The fullest bar is ${
          data[bins.findIndex((b) => b.count === Math.max(...bins.map((x) => x.count)))]?.bin
        } with ${Math.max(...bins.map((x) => x.count))} machines.`;
  return (
    <ChartCard
      testId="risk-chart"
      title="Predicted risk across the fleet"
      caption={`Number of machines shown (${shown} of ${shownOf} after filters) by predicted chance of failure in the next 24 h. Dashed line = cut-off.`}
      summary={summary}
      chart={
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} margin={{ top: 16, right: 12, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={LINE_EDGE} vertical={false} />
              <XAxis dataKey="bin" tickFormatter={(b: string) => b.split("–")[0] ?? b} tick={{ fontSize: 11, fill: INK2 }} interval={0} label={{ value: "Predicted chance (%), 10-point bars", position: "insideBottom", offset: -18, fontSize: 12, fill: INK2 }} />
              <YAxis allowDecimals={false} domain={[0, max]} tick={{ fontSize: 11, fill: INK2 }} label={{ value: "Machines", angle: -90, position: "insideLeft", fontSize: 12, fill: INK2 }} />
              <Bar dataKey="count" fill={BAR} isAnimationActive={false} />
              {cutBin && (
                <ReferenceLine x={cutBin} stroke={INK} strokeDasharray="5 4" strokeWidth={2} label={{ value: `Cut-off ${fleet.cutoff_percent}%`, position: "top", fontSize: 11, fill: INK }} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <table className="w-full border-collapse">
          <caption className="sr-only">Machines shown by predicted chance of failure in the next 24 hours</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>Predicted chance</th>
              <th scope="col" className={`${th} text-right`}>Machines</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.bin}>
                <th scope="row" className={`${td} text-left font-normal`}>{d.bin}</th>
                <td className={`${td} text-right`}>{d.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  );
}

export function TrendChart({
  trend,
  range,
  onRange,
  shownOf,
}: {
  trend: FleetTrend;
  range: Range;
  onRange: (r: Range) => void;
  shownOf: number;
}) {
  const pts = trend.points.map((p) => {
    const h = parseHour(p.hour);
    return { hour: p.hour, label: h === null ? p.hour : shortHour(h), count: p.machines_in_alert };
  });
  const values = pts.map((p) => p.count);
  const max = Math.max(0, ...values);
  const summary =
    pts.length === 0
      ? "No hours to show."
      : max === 0
        ? "No machine is in Alert at any of these hours, so the count is 0 at every hour."
        : `Machines in Alert: ${values[values.length - 1]} at the replay time; lowest ${Math.min(...values)}, highest ${max} over the last ${
            range === "24h" ? "24 hours" : "7 days"
          }.`;
  const filtered = trend.machines_in_population;
  return (
    <ChartCard
      testId="trend-chart"
      note={pts.length > 0 && pts.length < (range === "24h" ? 24 : 168) ? `Only ${pts.length} ${pts.length === 1 ? "hour" : "hours"} of history before this point.` : undefined}
      title="Machines in Alert over time"
      caption={`Count of machines shown (${filtered} of ${shownOf} after filters) at or above the cut-off, each hour up to the replay time.`}
      summary={filtered === 0 ? "0 machines match these filters, so the count is 0 at every hour." : summary}
      actions={
        <div role="radiogroup" aria-label="Time span" className="flex gap-2">
          {(["24h", "7d"] as const).map((r) => (
            <Button
              key={r}
              role="radio"
              aria-checked={range === r}
              variant={range === r ? "primary" : "outline"}
              onClick={() => onRange(r)}
            >
              {r === "24h" ? "24 h" : "7 days"}
            </Button>
          ))}
        </div>
      }
      chart={
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={pts} margin={{ top: 16, right: 12, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={LINE_EDGE} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK2 }} minTickGap={48} label={{ value: "Replay time (historical)", position: "insideBottom", offset: -18, fontSize: 12, fill: INK2 }} />
              <YAxis allowDecimals={false} domain={[0, Math.max(1, max)]} tick={{ fontSize: 11, fill: INK2 }} label={{ value: "Machines in Alert", angle: -90, position: "insideLeft", fontSize: 12, fill: INK2 }} />
              <Line type="stepAfter" dataKey="count" stroke={INK} strokeWidth={2} dot={pts.length <= 30 ? { r: 3, fill: INK } : false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <ScrollRegion label="Machines in Alert by hour table">
          <table className="w-full border-collapse">
            <caption className="sr-only">Machines in Alert at each hour up to the replay time</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Hour</th>
                <th scope="col" className={`${th} text-right`}>Machines in Alert</th>
              </tr>
            </thead>
            <tbody>
              {[...pts].reverse().map((p) => (
                <tr key={p.hour}>
                  <th scope="row" className={`${td} text-left font-normal`}>{p.label}</th>
                  <td className={`${td} text-right`}>{p.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      }
    />
  );
}

export function ChartSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 sm:p-5">
      <Skeleton className="h-72 w-full" label={label} />
    </div>
  );
}
