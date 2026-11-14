// Maintenance Planner helpers: starting values, input checking and number formats.
// Every money figure is an illustrative assumption (ux-spec, Labeling rules). Planner inputs are local to the
// page; only the replay hour and the alert cut-off live in the web address.
import type { MachineModel, PlanRequest, PlanResponse, ReadyMetadata } from "@/lib/types";

export const MAX_COST = 10_000_000;
export const MAX_SLOTS = 100;
export const MAX_REDUCTION = 90;
export const REDUCTION_STEP = 5;
/** The starting value of the risk-reduction slider when the assumption is turned on (illustrative). */
export const DEFAULT_REDUCTION = 20;
/** Decision 55's example costs per machine model (illustrative); used if /metadata does not supply them. */
export const FALLBACK_FAILURE_BY_MODEL: Record<MachineModel, number> = { model1: 10_000, model2: 8_000, model3: 12_000, model4: 9_000 };
export const FALLBACK_PLANNED_BY_MODEL: Record<MachineModel, number> = { model1: 2_500, model2: 2_000, model3: 3_000, model4: 2_250 };
/** The shared "Set every machine model to" values start at model1's numbers; they change nothing until "Apply to all models". */
export const FALLBACK_PLANNED_COST = 2_500;
export const FALLBACK_FAILURE_COST = 10_000;
export const FALLBACK_CREW_SLOTS = 5;

export const MODELS: readonly MachineModel[] = ["model1", "model2", "model3", "model4"];

/** What the fields hold as typed (text), so a half-typed or wrong value can be shown and marked. */
export type PlannerFields = {
  failureCost: string;
  byModel: Record<MachineModel, string>;
  plannedCost: string;
  plannedByModel: Record<MachineModel, string>;
  crewSlots: string;
  includeBelow: boolean;
  reductionOn: boolean;
  reduction: number;
};

export function defaultFields(meta: ReadyMetadata): PlannerFields {
  const d = meta.planner_defaults;
  const perModel = (from: Record<string, number> | undefined, fallback: Record<MachineModel, number>) =>
    Object.fromEntries(MODELS.map((m) => [m, String(from?.[m] ?? fallback[m])])) as Record<MachineModel, string>;
  return {
    failureCost: String(d.failure_cost?.model1 ?? FALLBACK_FAILURE_COST),
    byModel: perModel(d.failure_cost, FALLBACK_FAILURE_BY_MODEL),
    plannedByModel: perModel(d.planned_repair_cost, FALLBACK_PLANNED_BY_MODEL),
    plannedCost: String(d.planned_repair_cost?.model1 ?? FALLBACK_PLANNED_COST),
    crewSlots: String(d.crew_slots ?? FALLBACK_CREW_SLOTS),
    includeBelow: false,
    reductionOn: false,
    reduction: DEFAULT_REDUCTION,
  };
}

export type PlannedKey = `planned_${MachineModel}`;
export type FieldKey = "failureCost" | "plannedCost" | "crewSlots" | MachineModel | PlannedKey;
export type FieldErrors = Partial<Record<FieldKey, string>>;

export const COST_RANGE_MESSAGE = `Enter a whole number from 0 to ${MAX_COST.toLocaleString("en-US")}.`;
export const SLOT_RANGE_MESSAGE = `Enter a whole number from 0 to ${MAX_SLOTS}.`;

/** Whole number with optional thousands commas; null when it is anything else (including negative or decimal). */
export function wholeNumber(text: string): number | null {
  const t = text.trim();
  if (!/^[0-9]{1,3}(,[0-9]{3})+$|^[0-9]+$/.test(t)) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

export type Checked = { ok: true; inputs: PlannerInputs } | { ok: false; errors: FieldErrors };

/** The part of the request the Planner inputs decide (the hour and cut-off come from the address). */
export type PlannerInputs = Omit<PlanRequest, "at" | "cutoff_percent">;

export function check(fields: PlannerFields): Checked {
  const errors: FieldErrors = {};
  const cost = (text: string, key: FieldKey): number | undefined => {
    const n = wholeNumber(text);
    if (n === null || n > MAX_COST) {
      errors[key] = COST_RANGE_MESSAGE;
      return undefined;
    }
    return n;
  };
  // The shared fields are only checked (message, last result kept); they reach the request only through "Apply to all models".
  cost(fields.failureCost, "failureCost");
  cost(fields.plannedCost, "plannedCost");
  const byModel: Partial<Record<MachineModel, number>> = {};
  const plannedByModel: Partial<Record<MachineModel, number>> = {};
  for (const m of MODELS) {
    const f = cost(fields.byModel[m], m);
    if (f !== undefined) byModel[m] = f;
    const p = cost(fields.plannedByModel[m], `planned_${m}`);
    if (p !== undefined) plannedByModel[m] = p;
  }
  const slots = wholeNumber(fields.crewSlots);
  if (slots === null || slots > MAX_SLOTS) errors.crewSlots = SLOT_RANGE_MESSAGE;
  if (Object.keys(errors).length > 0 || slots === null) return { ok: false, errors };
  // failure_cost and planned_cost are required by the service; they carry model1's current values.
  const inputs: PlannerInputs = {
    failure_cost: byModel.model1!,
    planned_cost: plannedByModel.model1!,
    crew_slots: slots,
    include_below_cutoff: fields.includeBelow,
    risk_reduction_percent: fields.reductionOn ? fields.reduction : null,
    failure_cost_by_model: byModel,
    planned_cost_by_model: plannedByModel,
  };
  return { ok: true, inputs };
}

/** "Apply to all models": the shared value written into the four per-model fields; null when it is out of range. */
export function applyToAll(text: string): Record<MachineModel, string> | null {
  const n = wholeNumber(text);
  if (n === null || n > MAX_COST) return null;
  return Object.fromEntries(MODELS.map((m) => [m, String(n)])) as Record<MachineModel, string>;
}

export const sameFields = (a: PlannerFields, b: PlannerFields) => JSON.stringify(a) === JSON.stringify(b);

/** "12,500" (whole units; the service computes to six decimals, the screen shows whole units). */
export function money(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Net benefit can be below zero; use a real minus sign. */
export function signedMoney(n: number): string {
  const r = Math.round(n);
  return r < 0 ? `−${Math.abs(r).toLocaleString("en-US")}` : money(r);
}

/** True when an answer was computed from exactly these inputs (so a late or older answer is never shown as current). */
export function answersInputs(a: PlanResponse["assumptions"], inputs: PlannerInputs): boolean {
  const want = inputs.failure_cost_by_model ?? {};
  const got = a.failure_cost_by_model ?? {};
  const wantPlanned = inputs.planned_cost_by_model ?? {};
  const gotPlanned = a.planned_cost_by_model ?? {};
  return (
    a.failure_cost === inputs.failure_cost &&
    a.planned_cost === inputs.planned_cost &&
    a.crew_slots === inputs.crew_slots &&
    a.include_below_cutoff === (inputs.include_below_cutoff ?? false) &&
    (a.risk_reduction_percent ?? null) === (inputs.risk_reduction_percent ?? null) &&
    MODELS.every((m) => (want[m] ?? null) === (got[m] ?? null) && (wantPlanned[m] ?? null) === (gotPlanned[m] ?? null))
  );
}

export function movedText(moved: number | null): string {
  if (moved === null) return "";
  if (moved === 0) return "no change";
  return moved > 0 ? `▲ up ${moved}` : `▼ down ${Math.abs(moved)}`;
}
