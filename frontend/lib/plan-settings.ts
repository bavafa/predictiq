import { useSyncExternalStore } from "react";

import { MAX_COST, MAX_SLOTS, MODELS, check, defaultFields, wholeNumber, type PlannerInputs } from "@/lib/planner";
import type { MachineModel, ReadyMetadata } from "@/lib/types";

// Plan settings shared by Alerts and the Work plan (decisions 87 to 89): crew slots and the example cost of a failure
// per machine model. Kept in this browser only; every value is an illustrative assumption.
const KEY = "piq-plan-settings";
const EVENT = "piq-plan-settings-changed";

export type PlanSettings = { crewSlots: number | null; failureByModel: Partial<Record<MachineModel, number>> };
export const EMPTY: PlanSettings = { crewSlots: null, failureByModel: {} };

/** The equipment types behind each machine model, in plain words (illustrative names, decision 75). */
export const MODEL_TYPES: Record<MachineModel, string> = {
  model1: "Centrifugal pumps",
  model2: "Air compressors",
  model3: "Mixers and fans",
  model4: "Spindles and conveyor drives",
};

export function parseSettings(text: string): PlanSettings {
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== "object" || v === null) return EMPTY;
    const o = v as Record<string, unknown>;
    const crew = typeof o.crewSlots === "number" && Number.isInteger(o.crewSlots) && o.crewSlots >= 0 && o.crewSlots <= MAX_SLOTS ? o.crewSlots : null;
    const failureByModel: Partial<Record<MachineModel, number>> = {};
    const f = typeof o.failureByModel === "object" && o.failureByModel !== null ? (o.failureByModel as Record<string, unknown>) : {};
    for (const m of MODELS) {
      const n = f[m];
      if (typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= MAX_COST) failureByModel[m] = n;
    }
    return { crewSlots: crew, failureByModel };
  } catch {
    return EMPTY;
  }
}

let memory = "{}"; // used only when storage is blocked

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return memory;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function write(next: PlanSettings) {
  memory = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function usePlanSettings(): { settings: PlanSettings; save: (next: PlanSettings) => void; reset: () => void } {
  const text = useSyncExternalStore(subscribe, read, () => "{}");
  return { settings: parseSettings(text), save: write, reset: () => write(EMPTY) };
}

export const isWhole = (text: string, max: number) => {
  const n = wholeNumber(text);
  return n !== null && n <= max ? n : null;
};

/** Crew slots per shift: the visitor's setting, else the example default. */
export function crewSlots(meta: ReadyMetadata, s: PlanSettings): number {
  return s.crewSlots ?? meta.planner_defaults.crew_slots;
}

/** The machine plan request body for these settings (null if the defaults themselves were invalid). */
export function machineInputs(meta: ReadyMetadata, s: PlanSettings): PlannerInputs | null {
  const f = defaultFields(meta);
  if (s.crewSlots !== null) f.crewSlots = String(s.crewSlots);
  for (const m of MODELS) if (s.failureByModel[m] !== undefined) f.byModel[m] = String(s.failureByModel[m]);
  const c = check(f);
  return c.ok ? c.inputs : null;
}
