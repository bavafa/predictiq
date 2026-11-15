// Asset Details helpers: plain names for the model's inputs, number formats, and the range slicing.
// Every record the page shows is stamped strictly before the replay hour (the data service guarantees it);
// `strictlyBefore` is a second check so a record at or after the replay hour can never reach the screen.
import { parseHour } from "@/lib/time";
import type { Asset, Range, Telemetry } from "@/lib/types";

export const SENSORS = [
  { key: "volt", label: "Voltage" },
  { key: "rotate", label: "Rotation" },
  { key: "pressure", label: "Pressure" },
  { key: "vibration", label: "Vibration" },
] as const;
export type SensorKey = (typeof SENSORS)[number]["key"];

const SENSOR_NAME: Record<string, string> = { volt: "voltage", rotate: "rotation", pressure: "pressure", vibration: "vibration" };

export const RANGE_HOURS: Record<Range, number> = { "24h": 24, "7d": 168 };

export const CAVEAT_LINE = "These are patterns the model found in the data, not causes. They are not repair advice.";

export type InputName = { name: string; meaning: string };

/** A plain name and a one-line meaning (with the time window) for one of the model's 35 inputs. */
export function inputName(feature: string): InputName {
  let m = /^(volt|rotate|pressure|vibration)_(mean|std)_(3h|24h)$/.exec(feature);
  if (m) {
    const sensor = SENSOR_NAME[m[1]!]!;
    const hours = m[3] === "3h" ? "3 hours" : "24 hours";
    return m[2] === "mean"
      ? { name: `Average ${sensor}, past ${hours}`, meaning: `The average ${sensor} reading over the ${hours} before the scored hour.` }
      : {
          name: `Variation in ${sensor}, past ${hours}`,
          meaning: `How much the ${sensor} reading moved up and down (its spread) over the ${hours} before the scored hour.`,
        };
  }
  m = /^(volt|rotate|pressure|vibration)_last$/.exec(feature);
  if (m) {
    const sensor = SENSOR_NAME[m[1]!]!;
    return { name: `Latest ${sensor} reading`, meaning: `The ${sensor} reading from the hour just before the scored hour.` };
  }
  m = /^(volt|rotate|pressure|vibration)_slope_24h$/.exec(feature);
  if (m) {
    const sensor = SENSOR_NAME[m[1]!]!;
    return {
      name: `Trend in ${sensor}, past 24 hours`,
      meaning: `Whether the ${sensor} reading drifted up or down over the 24 hours before the scored hour.`,
    };
  }
  m = /^error([0-9])_count_24h$/.exec(feature);
  if (m) {
    return {
      name: `Errors of type ${m[1]}, past 24 hours`,
      meaning: `How many error ${m[1]} records this machine logged in the 24 hours before the scored hour.`,
    };
  }
  m = /^hours_since_comp([0-9])$/.exec(feature);
  if (m) {
    return {
      name: `Hours since component ${m[1]} was last replaced`,
      meaning: `Hours from the most recent replacement of component ${m[1]} (from records before the scored hour) to the scored hour.`,
    };
  }
  if (feature === "machine_model") return { name: "Machine model", meaning: "Which of the four machine models this is." };
  if (feature === "age") return { name: "Machine age", meaning: "The machine's age in years, as recorded in the sample." };
  return { name: feature.replace(/_/g, " "), meaning: "An input the model uses." };
}

/** "+0.82" / "−1.40": the push in log-odds, two decimals, a real minus sign. */
export function signed(value: number): string {
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  if (rounded === 0) return "0.00";
  return `${value > 0 ? "+" : "−"}${rounded.toFixed(2)}`;
}

export const effectWord = (value: number) => (value > 0 ? "Raises the chance" : value < 0 ? "Lowers the chance" : "No effect");

/** Hours since the epoch for "2015-11-14T06:00:00" (extra seconds ignored); null when unreadable. */
export function parseHourLoose(text: string): number | null {
  return parseHour(text.slice(0, 16));
}

export const strictlyBefore = (time: string, at: string): boolean => {
  const t = parseHourLoose(time);
  const a = parseHourLoose(at);
  return t !== null && a !== null && t < a;
};

/** The records of an answer that are before the replay hour, newest first. Defensive; the service already filters. */
export function recentFirst<T extends { time: string }>(rows: readonly T[], at: string): T[] {
  return rows.filter((r) => strictlyBefore(r.time, at)).sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0));
}

/** Past estimates for the chosen range: the last 24 or 168 hours up to and including the replay hour. */
export function pastInRange(asset: Asset, range: Range) {
  return asset.past_estimates.slice(-RANGE_HOURS[range]);
}

export type EventMark = { hour: string; kind: "failure" | "repair" | "error"; text: string };

/** "2015-11-14T06:00" from a service time. */
export const rowHour = (t: string) => t.slice(0, 16);

/** The failures, repairs and errors that fall on the hours shown in a chart. */
export function marksFor(asset: Asset, shown: ReadonlySet<string>): EventMark[] {
  const out: EventMark[] = [];
  for (const f of asset.failures) {
    if (strictlyBefore(f.time, asset.at)) out.push({ hour: rowHour(f.time), kind: "failure", text: `Recorded failure: ${f.components.join(", ")}` });
  }
  for (const r of asset.repairs) {
    if (strictlyBefore(r.time, asset.at)) out.push({ hour: rowHour(r.time), kind: "repair", text: `Repair: ${r.component}` });
  }
  for (const e of asset.errors) {
    if (strictlyBefore(e.time, asset.at)) out.push({ hour: rowHour(e.time), kind: "error", text: `Error: ${e.error}` });
  }
  return out.filter((m) => shown.has(m.hour));
}

export function sensorSummary(t: Telemetry, key: SensorKey, label: string): string {
  const values = t.rows.map((r) => r[key]).filter((v): v is number => v !== null);
  if (values.length === 0) return `No ${label.toLowerCase()} readings in this range.`;
  const last = values[values.length - 1]!;
  return `${label}: latest ${last.toFixed(1)}, lowest ${Math.min(...values).toFixed(1)}, highest ${Math.max(...values).toFixed(1)} over ${values.length} hourly readings.`;
}

/**
 * True when an answer belongs to the view now on screen: the same replay hour, cut-off (when the answer has
 * one) and model version. Answers that fail this are from an earlier view and are not shown beside new ones.
 */
export function sameAnswer(
  answer: { at: string; model_version: string; cutoff_percent?: number },
  want: { at: string; cutoff?: number; modelVersion: string },
): boolean {
  const a = parseHour(answer.at.slice(0, 16));
  return (
    a !== null &&
    a === parseHour(want.at.slice(0, 16)) &&
    answer.model_version === want.modelVersion &&
    (answer.cutoff_percent === undefined || want.cutoff === undefined || answer.cutoff_percent === want.cutoff)
  );
}
