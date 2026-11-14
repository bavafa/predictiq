"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";

import { CutoffControl } from "@/components/cutoff-control";
import { useData } from "@/components/data-provider";
import { StatusTag } from "@/components/fleet-table";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ValueLabel } from "@/components/value-label";
import { ApiError } from "@/lib/api";
import { sameAnswer } from "@/lib/asset";
import { percent } from "@/lib/fleet";
import {
  MAX_REDUCTION,
  MAX_SLOTS,
  MODELS,
  REDUCTION_STEP,
  answersInputs,
  applyToAll,
  check,
  defaultFields,
  money,
  movedText,
  sameFields,
  signedMoney,
  wholeNumber,
  type FieldErrors,
  type PlannerFields,
  type PlannerInputs,
} from "@/lib/planner";
import { parseHour, readableHour } from "@/lib/time";
import type { MachineModel, PlanResponse, PlanRow } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery, useSettledSet } from "@/lib/use-api-query";
import { cn } from "@/lib/utils";

export const INVALID_NOTE = "Showing results for your last valid inputs.";
export const FORMULA_LINE =
  "Expected exposure = predicted chance of failure in 24 h × cost if a failure happens (the machine model's own cost, if set).";

const inputClass = "min-h-11 w-full rounded-md border bg-card px-2 text-sm";

export function PlannerScreen() {
  const { meta, view } = useData();
  if (meta.status !== "ready" || !view) return null;
  return <PlannerBody />;
}

function hourText(text: string): string {
  const h = parseHour(text.slice(0, 16));
  return h === null ? text : readableHour(h);
}

function PlannerBody() {
  const { client, meta, view, search } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const v = view!;
  const { at, cutoff } = v;
  const modelVersion = ready!.model_version;
  const unit = ready!.planner_defaults.unit || "illustrative currency units";

  const defaults = useMemo(() => defaultFields(ready!), [ready]);
  const [fields, setFields] = useState<PlannerFields>(defaults);
  const checked = check(fields);
  const [lastValid, setLastValid] = useState<PlannerInputs>(() => {
    const c = check(defaults);
    if (!c.ok) throw new Error("The planner's starting values must be valid.");
    return c.inputs;
  });
  if (checked.ok && JSON.stringify(checked.inputs) !== JSON.stringify(lastValid)) setLastValid(checked.inputs);
  const inputsKey = JSON.stringify(checked.ok ? checked.inputs : lastValid);
  const inputs = useMemo<PlannerInputs>(() => JSON.parse(inputsKey) as PlannerInputs, [inputsKey]);
  const errors: FieldErrors = checked.ok ? {} : checked.errors;
  const invalid = !checked.ok;

  const set = (changes: Partial<PlannerFields>) => setFields((f) => ({ ...f, ...changes }));
  const isDefault = sameFields(fields, defaults);

  const plan = useApiQuery<PlanResponse>(
    (signal) => client.plan({ at, cutoff_percent: cutoff, ...inputs }, { signal }),
    [client, modelVersion, at, cutoff, inputsKey],
  );

  // One settled answer: everything in the list and summary comes from the same hour, cut-off, model version and
  // inputs. While the next answer loads, the last one stays, dimmed; after a failure nothing stale is shown.
  const data = plan.status === "ready" ? plan.data : null;
  const candidate = useMemo(() => {
    if (!data) return null;
    if (!sameAnswer({ at: data.at, model_version: data.model_version, cutoff_percent: data.assumptions.cutoff_percent }, { at, cutoff, modelVersion }))
      return null;
    if (!answersInputs(data.assumptions, inputs)) return null;
    return { plan: data };
  }, [data, at, cutoff, modelVersion, inputs]);
  const { shown, current } = useSettledSet(candidate);
  const shownPlan = plan.status === "error" ? null : (shown?.plan ?? null);
  const busy = !current && plan.status !== "error";

  const announcement = current && shownPlan
    ? `Plan updated for ${hourText(shownPlan.at)}: ${shownPlan.summary.slots_used} of ${shownPlan.summary.crew_slots} crew slots used, ${shownPlan.summary.machines_listed} machines listed.`
    : "";

  return (
    <div className="flex flex-col gap-4">
      <p
        data-testid="planner-banner"
        className="m-0 rounded-lg border border-l-4 border-input-edge bg-card px-4 py-3 text-sm leading-5"
      >
        <strong>All money figures here are illustrative assumptions you set, not real costs.</strong> Expected exposure is an estimate of
        cost at risk. It is not a saving.
      </p>
      <p className="sr-only" role="status" aria-live="polite" data-testid="planner-announcer">
        {announcement}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
        <Assumptions
          fields={fields}
          set={set}
          errors={errors}
          unit={unit}
          isDefault={isDefault}
          onReset={() => setFields(defaults)}
        />
        <section aria-labelledby="priority-title" className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" data-testid="priority-list">
          <ListBody
            plan={shownPlan}
            busy={busy}
            invalid={invalid}
            error={plan.status === "error" ? plan.error : null}
            onRetry={plan.retry}
            hourLabel={hourText(shownPlan?.at ?? at)}
            search={search}
            unit={unit}
            includeBelow={fields.includeBelow}
            onIncludeBelow={() => set({ includeBelow: true })}
          />
        </section>
      </div>
    </div>
  );
}

// --- assumptions panel -------------------------------------------------------------------------------------

function Assumptions({
  fields,
  set,
  errors,
  unit,
  isDefault,
  onReset,
}: {
  fields: PlannerFields;
  set: (c: Partial<PlannerFields>) => void;
  errors: FieldErrors;
  unit: string;
  isDefault: boolean;
  onReset: () => void;
}) {
  const slotId = useId();
  const slots = wholeNumber(fields.crewSlots);
  const bump = (d: number) => set({ crewSlots: String(Math.min(MAX_SLOTS, Math.max(0, (slots ?? 0) + d))) });

  return (
    <section aria-labelledby="assumptions-title" className="rounded-lg border border-line bg-card p-4 sm:p-5" data-testid="assumptions">
      <h2 id="assumptions-title" className="m-0 flex flex-wrap items-center gap-2 text-lg leading-7 font-semibold">
        Assumptions <ValueLabel kind="Illustrative" />
      </h2>

      <div className="mt-3 flex flex-col gap-4">
        <section aria-labelledby="failure-costs-title" data-testid="failure-costs" className="flex flex-col gap-3">
          <h3 id="failure-costs-title" className="m-0 text-sm font-semibold">
            Cost if a failure happens ({unit} per failure)
          </h3>
          <p className="m-0 text-xs leading-5 text-ink-2">
            One field per machine model, starting with the example costs. Equal costs for all models give the order by predicted chance alone
            and leave Moved empty. Failure costs that differ by model can change the order and, at some hours, who is shortlisted. Illustrative.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MODELS.map((m) => (
              <TextField
                key={m}
                label={`${m}: cost if a failure happens`}
                value={fields.byModel[m]}
                onChange={(text) => set({ byModel: { ...fields.byModel, [m]: text } })}
                error={errors[m]}
                testId={`cost-${m}`}
              />
            ))}
          </div>
          <ApplyAll
            label="Set every machine model's failure cost to"
            value={fields.failureCost}
            onChange={(failureCost) => set({ failureCost })}
            error={errors.failureCost}
            onApply={() => {
              const all = applyToAll(fields.failureCost);
              if (all) set({ byModel: all });
            }}
            testId="failure-cost"
            help="Writes this value into the four failure-cost fields above. Nothing else changes until you press the button."
          />
        </section>

        <section aria-labelledby="planned-costs-title" data-testid="planned-costs" className="flex flex-col gap-3">
          <h3 id="planned-costs-title" className="m-0 text-sm font-semibold">
            Planned maintenance cost ({unit} per machine)
          </h3>
          <p className="m-0 text-xs leading-5 text-ink-2">
            One field per machine model, starting with the example costs. Planned cost changes planned spend and, if turned on, net benefit.
            It never changes the order or who is shortlisted. Illustrative.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {MODELS.map((m) => (
              <TextField
                key={m}
                label={`${m}: planned maintenance cost`}
                value={fields.plannedByModel[m]}
                onChange={(text) => set({ plannedByModel: { ...fields.plannedByModel, [m]: text } })}
                error={errors[`planned_${m}` as const]}
                testId={`planned-${m}`}
              />
            ))}
          </div>
          <ApplyAll
            label="Set every machine model's planned cost to"
            value={fields.plannedCost}
            onChange={(plannedCost) => set({ plannedCost })}
            error={errors.plannedCost}
            onApply={() => {
              const all = applyToAll(fields.plannedCost);
              if (all) set({ plannedByModel: all });
            }}
            testId="planned-cost"
            help="Writes this value into the four planned-cost fields above. Changes planned spend only."
          />
        </section>

        <div>
          <label htmlFor={slotId} className="text-sm font-semibold">
            Crew slots available (machines that can be serviced)
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button
              aria-label="Fewer crew slots"
              aria-disabled={slots !== null && slots <= 0}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              onClick={() => bump(-1)}
            >
              −
            </Button>
            <input
              id={slotId}
              data-testid="crew-slots"
              inputMode="numeric"
              value={fields.crewSlots}
              aria-invalid={Boolean(errors.crewSlots)}
              aria-describedby={errors.crewSlots ? `${slotId}-err` : `${slotId}-help`}
              onChange={(e) => set({ crewSlots: e.target.value })}
              className={cn(inputClass, "w-20 text-center", errors.crewSlots ? "border-2 border-alert-edge" : "border-input-edge")}
            />
            <Button
              aria-label="More crew slots"
              aria-disabled={slots !== null && slots >= MAX_SLOTS}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              onClick={() => bump(1)}
            >
              +
            </Button>
            <span className="text-xs text-ink-2">0–{MAX_SLOTS}</span>
          </div>
          {errors.crewSlots && <FieldError id={`${slotId}-err`}>{errors.crewSlots}</FieldError>}
          <p id={`${slotId}-help`} className="mt-1 mb-0 text-xs leading-5 text-ink-2">
            Changes how many machines are shortlisted. Does not change the order. Illustrative.
          </p>
        </div>

        <div>
          <CutoffControl />
          <p className="mt-1 mb-0 text-xs leading-5 text-ink-2">Changes which machines are listed and can be shortlisted.</p>
        </div>

        <label className="flex min-h-11 items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={fields.includeBelow}
            onChange={(e) => set({ includeBelow: e.target.checked })}
            className="mt-1 size-5 accent-brand"
          />
          Also list machines below the cut-off (for context; never shortlisted)
        </label>

        <ReductionControl
          on={fields.reductionOn}
          value={fields.reduction}
          onOn={(reductionOn) => set({ reductionOn })}
          onValue={(reduction) => set({ reduction })}
        />

        <div>
          <Button
            aria-disabled={isDefault}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => {
              if (!isDefault) onReset();
            }}
          >
            Reset to defaults
          </Button>
          <p className="mt-1 mb-0 text-xs leading-5 text-ink-2">
            Restores the illustrative starting values (the example costs for each machine model). The alert cut-off is shared and has its own reset.
          </p>
        </div>
      </div>
    </section>
  );
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1 mb-0 text-xs leading-5 font-semibold text-alert-text">
      <span aria-hidden="true">⚠ </span>
      {children} The list still shows your last valid inputs.
    </p>
  );
}

function ApplyAll({
  label,
  value,
  onChange,
  error,
  onApply,
  help,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  onApply: () => void;
  help: string;
  testId: string;
}) {
  const bad = applyToAll(value) === null;
  return (
    <div className="rounded-md border border-line bg-subtle p-3">
      <TextField label={label} value={value} onChange={onChange} error={error} help={help} testId={testId} />
      <Button
        className="mt-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        aria-disabled={bad}
        data-testid={`${testId}-apply`}
        onClick={() => {
          if (!bad) onApply();
        }}
      >
        Apply to all models
      </Button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  error,
  help,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  help?: string;
  testId: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        inputMode="numeric"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : help ? `${id}-help` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputClass, "mt-1", error ? "border-2 border-alert-edge" : "border-input-edge")}
      />
      {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
      {help && (
        <p id={`${id}-help`} className="mt-1 mb-0 text-xs leading-5 text-ink-2">
          {help}
        </p>
      )}
    </div>
  );
}

/** Off by default. A native range input, 0 to 90 in 5-point steps; keys apply at once, a drag applies on release. */
function ReductionControl({
  on,
  value,
  onOn,
  onValue,
}: {
  on: boolean;
  value: number;
  onOn: (on: boolean) => void;
  onValue: (v: number) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const dragging = useRef(false);
  const shown = draft ?? value;
  const commit = () => {
    if (draftRef.current !== null) onValue(draftRef.current);
    draftRef.current = null;
    setDraft(null);
  };
  return (
    <div>
      <label className="flex min-h-11 items-start gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          data-testid="reduction-toggle"
          checked={on}
          onChange={(e) => onOn(e.target.checked)}
          className="mt-1 size-5 accent-brand"
        />
        Assume maintenance lowers the chance of failure
      </label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label htmlFor={id} className="text-sm font-semibold">
          Reduction
        </label>
        <span className="text-xs text-ink-2">0%</span>
        <input
          id={id}
          type="range"
          min={0}
          max={MAX_REDUCTION}
          step={REDUCTION_STEP}
          value={shown}
          disabled={!on}
          aria-valuetext={`${shown} percent, illustrative`}
          className="h-11 min-w-32 max-w-xs flex-1 cursor-pointer accent-brand disabled:cursor-not-allowed"
          onChange={(e) => {
            const next = Number(e.target.value);
            if (dragging.current) {
              draftRef.current = next;
              setDraft(next);
            } else onValue(next);
          }}
          onPointerDown={() => {
            dragging.current = true;
            const release = () => {
              document.removeEventListener("pointerup", release);
              document.removeEventListener("pointercancel", release);
              dragging.current = false;
              commit();
            };
            document.addEventListener("pointerup", release);
            document.addEventListener("pointercancel", release);
          }}
          onKeyDown={(e) => {
            if (e.key === "PageUp" || e.key === "PageDown") {
              e.preventDefault();
              const delta = (e.key === "PageUp" ? 10 : -10) * REDUCTION_STEP;
              onValue(Math.min(MAX_REDUCTION, Math.max(0, value + delta)));
            }
          }}
        />
        <span className="text-xs text-ink-2">{MAX_REDUCTION}%</span>
        <span data-testid="reduction-value" className="tabular text-sm font-bold">
          {on ? `${shown}%` : "off"}
        </span>
      </div>
      <p className="mt-1 mb-0 text-xs leading-5 text-ink-2">
        Off by default. Adds an estimated net benefit column. Does not change the order. Illustrative: the figure is your guess, not something
        the data shows.
      </p>
    </div>
  );
}

// --- the ranked list ---------------------------------------------------------------------------------------

function useAssetHref() {
  const { search } = useData();
  return (id: number) => {
    const params = new URLSearchParams(carriedSearch(search));
    params.set("machine", String(id));
    return `/asset-details?${params.toString()}`;
  };
}

function ListBody({
  plan,
  busy,
  invalid,
  error,
  onRetry,
  hourLabel,
  search,
  unit,
  includeBelow,
  onIncludeBelow,
}: {
  plan: PlanResponse | null;
  busy: boolean;
  invalid: boolean;
  error: ApiError | null;
  onRetry: () => void;
  hourLabel: string;
  search: string;
  unit: string;
  includeBelow: boolean;
  onIncludeBelow: () => void;
}) {
  void search;
  const [formula, setFormula] = useState(false);
  const formulaId = useId();
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="priority-title" className="m-0 text-lg leading-7 font-semibold">
          Priority list at {hourLabel}
        </h2>
        <Button aria-expanded={formula} aria-controls={formulaId} onClick={() => setFormula((f) => !f)}>
          How this is calculated
        </Button>
      </div>
      <p className="mt-2 mb-0 text-sm leading-5 text-ink-2">
        Ranked by <strong>expected exposure = predicted chance of failure in 24 h × cost if a failure happens</strong> (the machine model&apos;s
        own cost, if set). Ties: higher chance first, then lower machine number. The top machines at or above the cut-off fill the crew slots.
      </p>
      <div id={formulaId} hidden={!formula} data-testid="formula" className="mt-3 rounded-md border border-line bg-subtle p-3 text-sm leading-5">
        <h3 className="m-0 text-sm font-semibold">How this is calculated</h3>
        <ul className="mt-1 mb-0 pl-5">
          {formulaLines(plan).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {error ? (
        error.kind === "no-model-data" ? (
          <div className="mt-3">
            <NoModelData />
          </div>
        ) : (
          <div className="mt-3" data-testid="planner-error">
            <ServiceError what={`the predicted chances for ${hourLabel}`} error={error} onRetry={onRetry} />
          </div>
        )
      ) : plan === null ? (
        <div className="mt-3 flex flex-col gap-2" data-testid="planner-loading">
          <p className="m-0 text-sm text-ink-2">Loading predicted chances for this hour…</p>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" label="Loading predicted chances for this hour" />
          ))}
        </div>
      ) : (
        <div className={busy ? "opacity-60" : undefined} aria-busy={busy} data-testid="planner-ready">
          {invalid && (
            <p role="note" data-testid="invalid-note" className="mt-3 mb-0 rounded-md border border-l-4 border-input-edge bg-card px-2 py-2 text-sm">
              {INVALID_NOTE}
            </p>
          )}
          {plan.order_note && plan.order_changed !== false && (
            <p role="note" data-testid="order-note" className="mt-3 mb-0 rounded-md border border-l-4 border-input-edge bg-card px-2 py-2 text-sm">
              <strong>Order changed.</strong> {plan.order_note}
            </p>
          )}
          {plan.summary.machines_at_or_above_cutoff === 0 && !includeBelow ? (
            <div data-testid="planner-empty" className="mt-3 rounded-lg border border-dashed border-input-edge p-6 text-center">
              <p className="m-0 text-sm font-semibold">No machines are at or above the cut-off at this time.</p>
              <p className="mx-0 mt-1 mb-4 text-sm text-ink-2">Lower the cut-off, or also list machines below it.</p>
              <Button variant="primary" onClick={onIncludeBelow}>
                Also list machines below the cut-off
              </Button>
            </div>
          ) : (
            <RankedList plan={plan} unit={unit} />
          )}
          <Summary plan={plan} unit={unit} />
        </div>
      )}
    </>
  );
}

export function formulaLines(plan: PlanResponse | null): string[] {
  if (!plan) return [FORMULA_LINE];
  const f = plan.formulas;
  const lines = [f.expected_exposure, f.ranking, f.shortlist, f.planned_spend].filter((x): x is string => Boolean(x));
  if (plan.assumptions.risk_reduction_percent !== null && f.net_benefit) lines.push(f.net_benefit);
  return lines.length > 0 ? lines : [FORMULA_LINE];
}

function costCell(r: PlanRow, plan: PlanResponse) {
  const own = plan.assumptions.failure_cost_by_model?.[r.model as MachineModel] !== undefined;
  return (
    <>
      {money(r.failure_cost)}
      {own && <span className="block text-xs font-semibold">({r.model})</span>}
    </>
  );
}

function slotText(r: PlanRow): string {
  if (r.listing === "shortlisted") return `✓ Slot ${r.slot}`;
  if (r.listing === "over_capacity") return "— Over capacity";
  return "○ Below cut-off";
}

function Th({ children, label, right }: { children: ReactNode; label?: ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={cn("border-b border-line bg-subtle px-2 py-2 align-top text-xs font-semibold text-ink-2", right ? "text-right" : "text-left")}>
      {children}
      {label && <div className="mt-1 font-normal">{label}</div>}
    </th>
  );
}

function RankedList({ plan, unit }: { plan: PlanResponse; unit: string }) {
  const href = useAssetHref();
  const showMoved = plan.rows.some((r) => r.moved !== null);
  const showNet = plan.assumptions.risk_reduction_percent !== null;
  return (
    <>
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left" data-testid="plan-table">
          <caption className="sr-only">
            Machines ranked by expected exposure, highest first. Money columns are illustrative, in {unit}. Predicted chance is predicted;
            machine model is historical.
          </caption>
          <thead>
            <tr>
              <Th right>Rank</Th>
              <Th>Machine</Th>
              <Th label={<ValueLabel kind="Historical" />}>Machine model</Th>
              <Th right label={<ValueLabel kind="Predicted" />}>
                Predicted chance
              </Th>
              <Th right label={<ValueLabel kind="Illustrative" />}>
                Cost if failure
              </Th>
              <Th right label={<ValueLabel kind="Illustrative" />}>
                Expected exposure
              </Th>
              <Th right label={<ValueLabel kind="Illustrative" />}>
                Planned cost
              </Th>
              {showMoved && <Th>Moved</Th>}
              {showNet && (
                <Th right label={<ValueLabel kind="Illustrative" />}>
                  Expected net benefit (estimate)
                </Th>
              )}
              <Th>Shortlist</Th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={r.machine_id} data-testid="plan-row" data-machine={r.machine_id} data-listing={r.listing} className="border-b border-line">
                <td className="tabular px-2 py-2 text-right text-sm">{r.rank}</td>
                <td className="px-2 py-2 text-sm">
                  <Link href={href(r.machine_id)} className="inline-flex min-h-11 items-center text-link underline">
                    Machine {r.machine_id}
                  </Link>
                </td>
                <td className="px-2 py-2 text-sm">{r.model}</td>
                <td className="px-2 py-2 text-right">
                  <div className="tabular text-sm">{percent(r.score)}</div>
                  <StatusTag status={r.status} />
                </td>
                <td className="tabular px-2 py-2 text-right text-sm">{costCell(r, plan)}</td>
                <td className="tabular px-2 py-2 text-right text-sm" data-testid="exposure">
                  {money(r.expected_exposure)}
                </td>
                <td className="tabular px-2 py-2 text-right text-sm">{r.listing === "shortlisted" ? money(r.planned_cost) : "—"}</td>
                {showMoved && (
                  <td className="px-2 py-2 text-sm whitespace-nowrap" data-testid="moved">
                    {movedText(r.moved)}
                  </td>
                )}
                {showNet && (
                  <td className="tabular px-2 py-2 text-right text-sm" data-testid="net-benefit">
                    {r.net_benefit === null ? "—" : signedMoney(r.net_benefit)}
                  </td>
                )}
                <td className="px-2 py-2 text-sm whitespace-nowrap" data-testid="slot">
                  {slotText(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 mb-0 text-xs text-ink-2">Money columns are in {unit}.</p>
      </div>

      <ul className="m-0 mt-3 list-none p-0 md:hidden" aria-label="Machines ranked by expected exposure" data-testid="plan-cards">
        {plan.rows.map((r) => (
          <li key={r.machine_id} data-testid="plan-card" data-machine={r.machine_id} className="border-b border-line py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={href(r.machine_id)} className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline">
                  {r.rank} · Machine {r.machine_id}
                </Link>{" "}
                <StatusTag status={r.status} />
              </div>
              <span className="text-right text-sm font-semibold">{slotText(r)}</span>
            </div>
            <p className="m-0 text-xs leading-5 text-ink-2">
              model {r.model} (historical) · chance {percent(r.score)} (predicted) · cost if failure {money(r.failure_cost)}
              {plan.assumptions.failure_cost_by_model?.[r.model as MachineModel] !== undefined ? ` (${r.model}'s own)` : ""} · exposure{" "}
              {money(r.expected_exposure)} · planned {r.listing === "shortlisted" ? money(r.planned_cost) : "—"} (illustrative)
              {r.moved !== null ? ` · moved ${movedText(r.moved)}` : ""}
              {showNet && r.net_benefit !== null ? ` · net benefit (estimate) ${signedMoney(r.net_benefit)}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Summary({ plan, unit }: { plan: PlanResponse; unit: string }) {
  const s = plan.summary;
  return (
    <div data-testid="summary" className="mt-4 rounded-lg border border-line bg-subtle p-4 text-sm leading-6">
      <p className="m-0">
        <strong data-testid="summary-slots">
          Shortlist: {s.slots_used} of {s.crew_slots} crew slots used
        </strong>{" "}
        · total expected exposure <span data-testid="summary-exposure">{money(s.shortlist_exposure)}</span> <ValueLabel kind="Illustrative" /> estimate ·
        planned spend <span data-testid="summary-spend">{money(s.planned_spend)}</span> <ValueLabel kind="Illustrative" />
      </p>
      <p className="mt-1 mb-0 text-xs text-ink-2">Amounts are in {unit}.</p>
      {s.spare_slots > 0 && (
        <p data-testid="spare-slots" className="mt-1 mb-0 text-xs text-ink-2">
          {s.spare_slots} spare {s.spare_slots === 1 ? "slot stays" : "slots stay"} empty: only {s.machines_at_or_above_cutoff}{" "}
          {s.machines_at_or_above_cutoff === 1 ? "machine is" : "machines are"} at or above the cut-off, and machines below it are never shortlisted.
        </p>
      )}
      {s.net_benefit !== null && plan.assumptions.risk_reduction_percent !== null && (
        <div data-testid="net-benefit-summary" className="mt-3 border-t border-line pt-3">
          <p className="m-0">
            <strong>{s.net_benefit_label ?? "Expected net benefit (estimate)"}:</strong> {signedMoney(s.net_benefit)} <ValueLabel kind="Illustrative" />
          </p>
          <p className="mt-1 mb-0 text-xs text-ink-2">
            Uses your assumed {plan.assumptions.risk_reduction_percent}% lower chance of failure: shortlisted expected exposure × that
            reduction − planned spend. It rests on that guess alone and is kept apart from expected exposure above.
          </p>
        </div>
      )}
    </div>
  );
}
