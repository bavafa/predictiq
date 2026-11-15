// Component (part-level) planner helpers: starting values, input checking and number formats (spec step 4;
// decisions 77 and 79). Part names, shutdown windows and every cost are assumed or illustrative; the 7 to 14 day
// chance is a weak ranking in this simulated data, so there is no alert cut-off for it.
import { MAX_COST, MAX_SLOTS, wholeNumber } from "@/lib/planner";
import type { ComponentAction, ComponentPlanRequest, ComponentPlanResponse, ComponentPlanRow, ComponentPlannerInfo, PartId } from "@/lib/types";

export const PARTS: readonly PartId[] = ["comp1", "comp2", "comp3", "comp4"];
export const FALLBACK_HORIZON = 14;
export const HORIZONS = [7, 14] as const;
export const FALLBACK_FAILURE: Record<PartId, number> = { comp1: 9_000, comp2: 6_000, comp3: 4_000, comp4: 5_000 };
export const FALLBACK_PLANNED: Record<PartId, number> = { comp1: 2_500, comp2: 1_500, comp3: 1_000, comp4: 1_200 };

/** The sentence the page shows next to the horizon switch (the service sends the same words). */
export const HONESTY =
  "In this simulated data, warning signs appear about 2 days before a failure. The 7 to 14 day view is a wear estimate from part age and history, not an early warning.";
export const WEAR_LABEL = "Wear estimate: weak signal in this data";

export type ComponentFields = {
  horizon: number;
  failureByPart: Record<PartId, string>;
  plannedByPart: Record<PartId, string>;
  crewSlots: string;
  reductionOn: boolean;
  reduction: number;
};

export function defaultComponentFields(info: ComponentPlannerInfo | null | undefined, crewSlots = 5): ComponentFields {
  const pick = (from: Partial<Record<PartId, number>> | undefined, fallback: Record<PartId, number>) =>
    Object.fromEntries(PARTS.map((p) => [p, String(from?.[p] ?? fallback[p])])) as Record<PartId, string>;
  return {
    horizon: info?.default_horizon_days ?? FALLBACK_HORIZON,
    failureByPart: pick(info?.default_failure_cost, FALLBACK_FAILURE),
    plannedByPart: pick(info?.default_planned_cost, FALLBACK_PLANNED),
    crewSlots: String(crewSlots),
    reductionOn: false,
    reduction: 20,
  };
}

export type ComponentFieldKey = "crewSlots" | `failure_${PartId}` | `planned_${PartId}`;
export type ComponentErrors = Partial<Record<ComponentFieldKey, string>>;
export type ComponentInputs = Omit<ComponentPlanRequest, "level" | "at">;
export type ComponentChecked = { ok: true; inputs: ComponentInputs } | { ok: false; errors: ComponentErrors };

export const COST_MESSAGE = `Enter a whole number from 0 to ${MAX_COST.toLocaleString("en-US")}.`;
export const SLOT_MESSAGE = `Enter a whole number from 0 to ${MAX_SLOTS}.`;

export function checkComponent(f: ComponentFields): ComponentChecked {
  const errors: ComponentErrors = {};
  const failure: Partial<Record<PartId, number>> = {};
  const planned: Partial<Record<PartId, number>> = {};
  for (const p of PARTS) {
    const a = wholeNumber(f.failureByPart[p]);
    if (a === null || a > MAX_COST) errors[`failure_${p}`] = COST_MESSAGE;
    else failure[p] = a;
    const b = wholeNumber(f.plannedByPart[p]);
    if (b === null || b > MAX_COST) errors[`planned_${p}`] = COST_MESSAGE;
    else planned[p] = b;
  }
  const slots = wholeNumber(f.crewSlots);
  if (slots === null || slots > MAX_SLOTS) errors.crewSlots = SLOT_MESSAGE;
  if (Object.keys(errors).length > 0 || slots === null) return { ok: false, errors };
  return {
    ok: true,
    inputs: {
      horizon_days: f.horizon,
      // required by the service; each part's own value overrides them
      failure_cost: failure.comp1!,
      planned_cost: planned.comp1!,
      failure_cost_by_part: failure,
      planned_cost_by_part: planned,
      crew_slots: slots,
      risk_reduction_percent: f.reductionOn ? f.reduction : null,
    },
  };
}

/** True when an answer was computed from exactly these inputs (a late or older answer is never shown as current). */
export function answersComponentInputs(a: ComponentPlanResponse["assumptions"], i: ComponentInputs): boolean {
  return (
    a.horizon_days === i.horizon_days &&
    a.failure_cost === i.failure_cost &&
    a.planned_cost === i.planned_cost &&
    a.crew_slots_per_window === i.crew_slots &&
    (a.risk_reduction_percent ?? null) === (i.risk_reduction_percent ?? null) &&
    PARTS.every(
      (p) =>
        (a.failure_cost_by_part[p] ?? null) === (i.failure_cost_by_part?.[p] ?? null) &&
        (a.planned_cost_by_part[p] ?? null) === (i.planned_cost_by_part?.[p] ?? null),
    )
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Sun 13 Dec, 06:00" from a service time like 2015-12-13T06:00:00 (the data's own clock, no time zone). */
export function windowText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${m[4]}:${m[5]}`;
}

/** "in 2.8 days" / "in 5 hours". */
export function untilText(days: number): string {
  return days < 1 ? `in ${Math.max(1, Math.round(days * 24))} hours` : `in ${days.toFixed(1).replace(/\.0$/, "")} days`;
}

export const ACTION_TEXT: Record<ComponentAction, string> = {
  act_before_window: "Act before window",
  replace_in_window: "Replace in window",
  over_capacity: "Over capacity",
  watch: "Watch",
};

/** What the Signal line says under a row's chance. The part's illustrative name leads; the raw id stays in the title. */
export function signalText(r: ComponentPlanRow): string {
  return r.signal === "warning" ? `Warning: ${r.part_name} signature` : WEAR_LABEL;
}

export function slotText(r: ComponentPlanRow): string {
  if (r.listing === "shortlisted") return `✓ Slot ${r.slot}`;
  if (r.listing === "over_capacity") return "— Over capacity";
  return "○ No exposure";
}
