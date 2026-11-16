// Shared view state lives in the web address (decision 13), so a view can be shared:
//   at=2015-11-14T06:00        replay hour
//   cutoff=51                  alert cut-off, whole percent 0-100
//   machine=7                  the selected machine (Asset Details)
//   machine_model=model2, status=alert, machine_number=12   Fleet Overview filters
// Everything is validated on read. A bad value is ignored (the default is used) and reported in `issues`;
// the page never fails because of the address.
import { formatHour, parseHour } from "@/lib/time";
import type { MachineModel, ReadyMetadata, Status } from "@/lib/types";

export const MACHINE_MODELS: readonly MachineModel[] = ["model1", "model2", "model3", "model4"];
export const STATUSES: readonly Status[] = ["alert", "below_cutoff"];

/** Keys that travel with the reader from page to page. Filters belong to Fleet Overview and stay there. */
export const SHARED_KEYS = ["at", "cutoff", "machine"] as const;

export type SelectedMachine =
  | { kind: "none" }
  | { kind: "ok"; id: number }
  | { kind: "out-of-range"; text: string };

export type UrlState = {
  /** Replay hour, "YYYY-MM-DDTHH:00", always inside the replay window. */
  at: string;
  cutoff: number;
  machine: SelectedMachine;
  filters: { machine_model: MachineModel | null; status: Status | null; machine_number: number | null };
  /** Plain-language notes about address values that were ignored. */
  issues: string[];
};

const WHOLE = /^[0-9]{1,3}$/;
const DIGITS = /^[0-9]{1,6}$/;

export function machineCount(meta: ReadyMetadata): number {
  return meta.machines?.length || 100;
}

/** Window bounds as hours since the Unix epoch. */
export function windowHours(meta: ReadyMetadata): { first: number; last: number; start: number } {
  const first = parseHour(meta.replay_window.start);
  const last = parseHour(meta.replay_window.end);
  const start = parseHour(meta.replay_start);
  if (first === null || last === null || start === null) {
    throw new Error("The data service sent a replay window that can't be read.");
  }
  return { first, last, start };
}

export function parseUrlState(search: string | URLSearchParams, meta: ReadyMetadata): UrlState {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const { first, last, start } = windowHours(meta);
  const issues: string[] = [];

  let at = start;
  const rawAt = params.get("at");
  if (rawAt !== null) {
    const hour = parseHour(rawAt);
    if (hour !== null && hour >= first && hour <= last) at = hour;
    else issues.push("The simulated plant time in this link isn't an hour inside the simulated data, so it starts at its usual hour.");
  }

  let cutoff = meta.default_cutoff_percent;
  const rawCutoff = params.get("cutoff");
  if (rawCutoff !== null) {
    if (WHOLE.test(rawCutoff) && Number(rawCutoff) <= 100) cutoff = Number(rawCutoff);
    else issues.push("The alert cut-off in this link isn't a whole percent from 0 to 100, so the default is used.");
  }

  const count = machineCount(meta);
  let machine: SelectedMachine = { kind: "none" };
  const rawMachine = params.get("machine");
  if (rawMachine !== null && rawMachine !== "") {
    const n = DIGITS.test(rawMachine) ? Number(rawMachine) : null;
    machine = n !== null && n >= 1 && n <= count ? { kind: "ok", id: n } : { kind: "out-of-range", text: n === null ? "" : String(n) };
  }

  const rawModel = params.get("machine_model");
  const rawStatus = params.get("status");
  const rawNumber = params.get("machine_number");
  const model = MACHINE_MODELS.find((m) => m === rawModel) ?? null;
  const status = STATUSES.find((s) => s === rawStatus) ?? null;
  let number: number | null = null;
  if (rawNumber !== null && rawNumber !== "") {
    const n = DIGITS.test(rawNumber) ? Number(rawNumber) : null;
    if (n !== null && n >= 1 && n <= count) number = n;
    else issues.push(`The machine number filter in this link isn't a machine from 1 to ${count}, so it is ignored.`);
  }
  if (rawModel !== null && model === null) issues.push("The machine model filter in this link isn't one of model1 to model4, so it is ignored.");
  if (rawStatus !== null && status === null) issues.push("The status filter in this link isn't Alert or Below cut-off, so it is ignored.");

  return {
    at: formatHour(at),
    cutoff,
    machine,
    filters: { machine_model: model, status, machine_number: number },
    issues,
  };
}

/** Changes to apply to an address; `null` removes a key. */
export type UrlChanges = Partial<{
  at: string | null;
  cutoff: number | null;
  machine: number | null;
  machine_model: MachineModel | null;
  status: Status | null;
  machine_number: number | null;
}>;

/**
 * The query string after applying `changes`. Values equal to their defaults are left out, so the address stays
 * short and a first visit has none. Keys this module does not own are kept as they are.
 */
export function applyChanges(search: string, changes: UrlChanges, meta: ReadyMetadata): string {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === undefined) params.delete(key);
    else params.set(key, String(value));
  }
  if (params.get("at") === meta.replay_start || params.get("at") === meta.replay_start.slice(0, 16)) params.delete("at");
  if (params.get("cutoff") === String(meta.default_cutoff_percent)) params.delete("cutoff");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The part of the address that follows the reader to another page (filters stay behind). */
export function carriedSearch(search: string): string {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of SHARED_KEYS) {
    const value = params.get(key);
    if (value !== null) kept.set(key, value);
  }
  const text = kept.toString();
  return text ? `?${text}` : "";
}
