"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { ChartCard, ScrollRegion, td, th } from "@/components/chart-card";
import { Button } from "@/components/ui/button";
import {
  SENSORS,
  marksFor,
  pastInRange,
  rowHour,
  sensorSummary,
  strictlyBefore,
  type EventMark,
  type SensorKey,
} from "@/lib/asset";
import { parseHour, shortHour } from "@/lib/time";
import type { Asset, Range, Telemetry } from "@/lib/types";

// Chart colours from docs/design/tokens.md (each measured at 3:1 or better on white).
const SENSOR = "#1d4ed8";
const RISK = "#0d9488";
const CUTOFF = "#b45309";
const FAILURE = "#b91c1c";
const REPAIR = "#475569";
const ERROR = "#6b7280";
const INK2 = "#4b5563";
const GRID = "#e5e7eb";

const label = (hour: string) => {
  const h = parseHour(hour.slice(0, 16));
  return h === null ? hour : shortHour(h);
};

/** The screen is narrow (the sensor charts become tabs). Server and first render assume wide. */
function useNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia("(max-width: 767px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(max-width: 767px)").matches : false),
    () => false,
  );
}

/**
 * Marker shapes differ, so colour is never the only signal: filled diamond (failure), square (repair), triangle
 * (error). A failure and its repair usually share an hour, so repairs sit a little left and errors a little right.
 */
function Marker({ cx, cy, kind }: { cx?: number; cy?: number; kind: EventMark["kind"] }) {
  if (cx === undefined || cy === undefined) return null;
  if (kind === "failure") return <path d={`M${cx} ${cy - 7} L${cx + 7} ${cy} L${cx} ${cy + 7} L${cx - 7} ${cy} Z`} fill={FAILURE} />;
  if (kind === "repair") return <rect x={cx - 15} y={cy - 5} width={10} height={10} fill={REPAIR} />;
  return <path d={`M${cx + 11} ${cy - 6} L${cx + 17} ${cy + 5} L${cx + 5} ${cy + 5} Z`} fill={ERROR} />;
}

function markCounts(marks: EventMark[]): string {
  const n = (k: EventMark["kind"]) => marks.filter((m) => m.kind === k).length;
  const parts = [`${n("failure")} recorded ${n("failure") === 1 ? "failure" : "failures"}`, `${n("repair")} ${n("repair") === 1 ? "repair" : "repairs"}`, `${n("error")} ${n("error") === 1 ? "error" : "errors"}`];
  return parts.join(", ");
}

function SensorChart({ telemetry, asset, sensor, range }: { telemetry: Telemetry; asset: Asset | null; sensor: (typeof SENSORS)[number]; range: Range }) {
  const rows = telemetry.rows.filter((r) => strictlyBefore(r.hour, telemetry.at));
  const data = rows.map((r) => ({ hour: r.hour, label: label(r.hour), value: r[sensor.key] === null ? null : r[sensor.key]! * sensor.scale }));
  const byHour = new Map(data.map((d) => [rowHour(d.hour), d]));
  const marks = asset ? marksFor(asset, new Set(byHour.keys())) : [];
  const wanted = range === "24h" ? 24 : 168;
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;
  const pad = (hi - lo || 1) * 0.1;
  return (
    <ChartCard
      testId={`sensor-${sensor.key}`}
      kind="Historical"
      title={sensor.label}
      summary={`${sensorSummary(telemetry, sensor.key, sensor.label, sensor.unit, sensor.scale)}${asset ? (marks.length ? ` Markers: ${markCounts(marks)}.` : "") : " Markers are not available because the machine record did not load."}`}
      note={data.length < wanted ? `Only ${data.length} ${data.length === 1 ? "hour" : "hours"} of history before this point.` : undefined}
      chart={
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK2 }} minTickGap={48} label={{ value: "Time (historical)", position: "insideBottom", offset: -18, fontSize: 12, fill: INK2 }} />
              <YAxis width={52} domain={[lo - pad, hi + pad]} tickFormatter={(v: number) => v.toFixed(sensor.scale < 1 ? 1 : 0)} tick={{ fontSize: 11, fill: INK2 }} label={{ value: `${sensor.unit} (assumed)`, angle: -90, position: "insideLeft", fontSize: 12, fill: INK2 }} />
              <Line type="monotone" dataKey="value" stroke={SENSOR} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
              {marks.map((m, i) => {
                const d = byHour.get(m.hour)!;
                return (
                  <ReferenceDot key={`${m.kind}-${m.hour}-${i}`} x={d.label} y={d.value ?? lo} r={0} ifOverflow="visible" shape={(p: { cx?: number; cy?: number }) => <Marker cx={p.cx} cy={p.cy} kind={m.kind} />} />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <ScrollRegion label={`${sensor.label} table`}>
          <table className="w-full border-collapse">
            <caption className="sr-only">{sensor.label} readings by hour, with recorded failures, repairs and errors on the same hour</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Hour</th>
                <th scope="col" className={`${th} text-right`}>{sensor.label} reading</th>
                <th scope="col" className={th}>Recorded on this hour</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.hour}>
                  <th scope="row" className={`${td} text-left font-normal`}>{d.label}</th>
                  <td className={`${td} text-right`}>{d.value === null ? "—" : d.value.toFixed(1)}</td>
                  <td className={td}>
                    {marks
                      .filter((m) => m.hour === rowHour(d.hour))
                      .map((m) => m.text)
                      .join("; ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      }
    />
  );
}

/** Four sensor charts: a two-by-two grid on wide screens, tabs (one chart at a time) on narrow ones. */
/** `asset` can be null when only the asset answer failed: the charts then show no markers. */
export function SensorCharts({ telemetry, asset, range }: { telemetry: Telemetry; asset: Asset | null; range: Range }) {
  const narrow = useNarrow();
  const [active, setActive] = useState<SensorKey>("volt");
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const focusAfter = useRef<SensorKey | null>(null);
  useEffect(() => {
    if (focusAfter.current) {
      tabs.current[focusAfter.current]?.focus();
      focusAfter.current = null;
    }
  });

  if (!narrow) {
    return (
      <div className="grid gap-4 md:grid-cols-2" data-testid="sensor-grid">
        {SENSORS.map((s) => (
          <SensorChart key={s.key} telemetry={telemetry} asset={asset} sensor={s} range={range} />
        ))}
      </div>
    );
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = SENSORS.findIndex((s) => s.key === active);
    const move = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -i : e.key === "End" ? SENSORS.length - 1 - i : 0;
    if (!move) return;
    e.preventDefault();
    const next = SENSORS[(i + move + SENSORS.length) % SENSORS.length]!;
    focusAfter.current = next.key;
    setActive(next.key);
  };
  const current = SENSORS.find((s) => s.key === active)!;
  return (
    <div data-testid="sensor-tabs">
      <div role="tablist" aria-label="Sensor" className="mb-3 flex flex-wrap gap-2">
        {SENSORS.map((s) => (
          <Button
            key={s.key}
            role="tab"
            id={`tab-${s.key}`}
            ref={(el) => {
              tabs.current[s.key] = el;
            }}
            aria-selected={active === s.key}
            aria-controls="sensor-panel"
            tabIndex={active === s.key ? 0 : -1}
            variant={active === s.key ? "primary" : "outline"}
            onKeyDown={onKey}
            onClick={() => setActive(s.key)}
          >
            {s.label}
          </Button>
        ))}
      </div>
      <div role="tabpanel" id="sensor-panel" aria-labelledby={`tab-${active}`}>
        <SensorChart telemetry={telemetry} asset={asset} sensor={current} range={range} />
      </div>
    </div>
  );
}

export function PastEstimatesChart({ asset, range }: { asset: Asset; range: Range }) {
  const points = pastInRange(asset, range).filter((p) => !strictlyBefore(asset.at, p.hour));
  const data = points.map((p) => ({ hour: p.hour, label: label(p.hour), pct: Math.round(p.score * 1000) / 10 }));
  const byHour = new Map(data.map((d) => [rowHour(d.hour), d]));
  const failures = asset.failures.filter((f) => strictlyBefore(f.time, asset.at));
  const onChart = failures.filter((f) => byHour.has(rowHour(f.time)));
  const cutoff = asset.cutoff_percent;
  const last = data[data.length - 1];
  const summary =
    data.length === 0
      ? "No past estimates to show."
      : `Predicted chance at the replay time ${last!.pct.toFixed(1)}%; over this range lowest ${Math.min(...data.map((d) => d.pct)).toFixed(1)}%, highest ${Math.max(...data.map((d) => d.pct)).toFixed(1)}%. Cut-off ${cutoff}%. ${failures.length} recorded ${failures.length === 1 ? "failure" : "failures"} in the 7 days before the replay time${failures.length ? ": " + failures.map((f) => `${label(f.time)} (${f.components.join(", ")})`).join("; ") : ""}.`;
  const wanted = range === "24h" ? 24 : 168;
  return (
    <ChartCard
      testId="past-estimates"
      title="Past estimates beside recorded failures"
      caption={`Predicted chance of a recorded failure in the next 24 hours, each hour up to and including the replay time. ◆ marks a recorded failure (simulated sample data). Dashed line = cut-off ${cutoff}%.`}
      summary={summary}
      note={data.length < wanted ? `Only ${data.length} ${data.length === 1 ? "hour" : "hours"} of history before this point.` : undefined}
      chart={
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={data} margin={{ top: 12, right: 12, bottom: 28, left: 4 }} accessibilityLayer={false}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: INK2 }} minTickGap={48} label={{ value: "Replay time (historical)", position: "insideBottom", offset: -18, fontSize: 12, fill: INK2 }} />
              <YAxis width={52} domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: INK2 }} label={{ value: "Chance (%)", angle: -90, position: "insideLeft", fontSize: 12, fill: INK2 }} />
              <ReferenceLine y={cutoff} stroke={CUTOFF} strokeDasharray="6 4" strokeWidth={2} label={{ value: `Cut-off ${cutoff}%`, position: "insideTopRight", fontSize: 11, fill: CUTOFF }} />
              <Line type="monotone" dataKey="pct" stroke={RISK} strokeWidth={2} dot={false} isAnimationActive={false} />
              {onChart.map((f, i) => {
                const d = byHour.get(rowHour(f.time))!;
                return <ReferenceDot key={`${f.time}-${i}`} x={d.label} y={d.pct} r={0} ifOverflow="visible" shape={(p: { cx?: number; cy?: number }) => <Marker cx={p.cx} cy={p.cy} kind="failure" />} />;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <ScrollRegion label="Predicted chance by hour table">
          <table className="w-full border-collapse">
            <caption className="sr-only">Predicted chance of a recorded failure in the next 24 hours, by hour, beside recorded failures</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Hour</th>
                <th scope="col" className={`${th} text-right`}>Predicted chance</th>
                <th scope="col" className={th}>Recorded failure (simulated)</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.hour}>
                  <th scope="row" className={`${td} text-left font-normal`}>{d.label}</th>
                  <td className={`${td} text-right`}>{d.pct.toFixed(1)}%</td>
                  <td className={td}>
                    {failures
                      .filter((f) => rowHour(f.time) === rowHour(d.hour))
                      .map((f) => f.components.join(", "))
                      .join("; ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      }
    />
  );
}
