"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { useData } from "@/components/data-provider";
import { FieldError, ReductionControl, TextField, Th, inputClass } from "@/components/planner-screen";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ValueLabel } from "@/components/value-label";
import {
  ACTION_TEXT,
  HONESTY,
  HORIZONS,
  PARTS,
  answersComponentInputs,
  checkComponent,
  defaultComponentFields,
  signalText,
  slotText,
  untilText,
  windowText,
  type ComponentFields,
  type ComponentInputs,
} from "@/lib/component-planner";
import { percent } from "@/lib/fleet";
import { machineName } from "@/lib/machine-types";
import { MAX_SLOTS, money, signedMoney, wholeNumber } from "@/lib/planner";
import { parseHour, readableHour } from "@/lib/time";
import type { ComponentPlanResponse, ComponentPlanRow, PartId } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery, useSettledSet } from "@/lib/use-api-query";
import { cn } from "@/lib/utils";

const hourText = (text: string) => {
  const h = parseHour(text.slice(0, 16));
  return h === null ? text : readableHour(h);
};

function useAssetHref() {
  const { search } = useData();
  return (id: number) => {
    const params = new URLSearchParams(carriedSearch(search));
    params.set("machine", String(id));
    return `/asset-details?${params.toString()}`;
  };
}

export function ComponentPlanner() {
  const { meta, view } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const info = ready?.component_planner ?? null;
  if (!ready || !view || !info) return null;
  return <Body />;
}

function Body() {
  const { client, meta, view } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const info = ready!.component_planner!;
  const { at } = view!;
  const modelVersion = ready!.model_version;
  const unit = ready!.planner_defaults.unit || "illustrative currency units";
  const defaults = useMemo(() => defaultComponentFields(info, ready!.planner_defaults.crew_slots), [info, ready]);
  const [fields, setFields] = useState<ComponentFields>(defaults);
  const checked = checkComponent(fields);
  const [lastValid, setLastValid] = useState<ComponentInputs>(() => {
    const c = checkComponent(defaults);
    if (!c.ok) throw new Error("The component planner's starting values must be valid.");
    return c.inputs;
  });
  if (checked.ok && JSON.stringify(checked.inputs) !== JSON.stringify(lastValid)) setLastValid(checked.inputs);
  const inputsKey = JSON.stringify(checked.ok ? checked.inputs : lastValid);
  const inputs = useMemo(() => JSON.parse(inputsKey) as ComponentInputs, [inputsKey]);
  const errors = checked.ok ? {} : checked.errors;
  const set = (c: Partial<ComponentFields>) => setFields((f) => ({ ...f, ...c }));
  const isDefault = JSON.stringify(fields) === JSON.stringify(defaults);

  const plan = useApiQuery<ComponentPlanResponse>(
    (signal) => client.componentPlan({ level: "component", at, ...inputs }, { signal }),
    [client, modelVersion, at, inputsKey],
  );
  const data = plan.status === "ready" ? plan.data : null;
  const candidate = useMemo(() => {
    if (!data || data.at.slice(0, 16) !== at.slice(0, 16) || data.model_version !== modelVersion) return null;
    return answersComponentInputs(data.assumptions, inputs) ? { plan: data } : null;
  }, [data, at, modelVersion, inputs]);
  const { shown, current } = useSettledSet(candidate);
  const shownPlan = plan.status === "error" ? null : (shown?.plan ?? null);
  const busy = !current && plan.status !== "error";
  const announcement =
    current && shownPlan
      ? `Parts plan updated for ${hourText(shownPlan.at)}, ${shownPlan.horizon_days} day view: ${shownPlan.summary.slots_used} slots used, ${shownPlan.summary.warning_parts} parts with a 48-hour warning.`
      : "";

  return (
    <div className="flex flex-col gap-4" data-testid="component-planner">
      <p className="m-0 rounded-lg border border-l-4 border-input-edge bg-card px-4 py-3 text-sm leading-5" data-testid="component-banner">
        <strong>Part names, shutdown windows and all money figures here are assumed or illustrative, not from the data.</strong>{" "}
        {info.names_note} {info.windows_note}
      </p>
      <p className="sr-only" role="status" aria-live="polite" data-testid="component-announcer">
        {announcement}
      </p>
      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
        <Assumptions
          fields={fields}
          set={set}
          errors={errors}
          unit={unit}
          names={info.names}
          honesty={info.honesty || HONESTY}
          isDefault={isDefault}
          onReset={() => setFields(defaults)}
        />
        <section aria-labelledby="parts-title" className="min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" data-testid="parts-list">
          <ListBody
            plan={shownPlan}
            busy={busy}
            invalid={!checked.ok}
            error={plan.status === "error" ? plan.error : null}
            onRetry={plan.retry}
            hourLabel={hourText(shownPlan?.at ?? at)}
            unit={unit}
          />
        </section>
      </div>
    </div>
  );
}

function Assumptions({
  fields,
  set,
  errors,
  unit,
  names,
  honesty,
  isDefault,
  onReset,
}: {
  fields: ComponentFields;
  set: (c: Partial<ComponentFields>) => void;
  errors: Partial<Record<string, string>>;
  unit: string;
  names: Record<PartId, string>;
  honesty: string;
  isDefault: boolean;
  onReset: () => void;
}) {
  const slotId = useId();
  const slots = wholeNumber(fields.crewSlots);
  const bump = (d: number) => set({ crewSlots: String(Math.min(MAX_SLOTS, Math.max(0, (slots ?? 0) + d))) });
  return (
    <section aria-labelledby="comp-assumptions-title" className="rounded-lg border border-line bg-card p-4 sm:p-5" data-testid="component-assumptions">
      <h2 id="comp-assumptions-title" className="m-0 flex flex-wrap items-center gap-2 text-lg leading-7 font-semibold">
        Assumptions <ValueLabel kind="Illustrative" />
      </h2>
      <div className="mt-3 flex flex-col gap-4">
        <div role="group" aria-labelledby="horizon-title" data-testid="horizon">
          <h3 id="horizon-title" className="m-0 text-sm font-semibold">
            Look-ahead
          </h3>
          <div className="mt-1 flex gap-2">
            {HORIZONS.map((h) => (
              <Button key={h} aria-pressed={fields.horizon === h} data-testid={`horizon-${h}`} variant={fields.horizon === h ? "primary" : undefined} onClick={() => set({ horizon: h })}>
                {h} days
              </Button>
            ))}
          </div>
          <p className="mt-2 mb-0 text-xs leading-5 text-ink-2" data-testid="honesty">
            {honesty}
          </p>
        </div>

        <section aria-labelledby="comp-failure-title" className="flex flex-col gap-3" data-testid="component-failure-costs">
          <h3 id="comp-failure-title" className="m-0 text-sm font-semibold">
            Cost if a part fails ({unit})
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {PARTS.map((p) => (
              <TextField
                key={p}
                label={`${names[p]} (${p}): cost if it fails`}
                value={fields.failureByPart[p]}
                onChange={(text) => set({ failureByPart: { ...fields.failureByPart, [p]: text } })}
                error={errors[`failure_${p}`]}
                testId={`part-cost-${p}`}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="comp-planned-title" className="flex flex-col gap-3" data-testid="component-planned-costs">
          <h3 id="comp-planned-title" className="m-0 text-sm font-semibold">
            Planned replacement cost ({unit})
          </h3>
          <p className="m-0 text-xs leading-5 text-ink-2">Changes planned spend and, if turned on, net benefit. It never changes the order or who is shortlisted.</p>
          <div className="grid grid-cols-2 gap-3">
            {PARTS.map((p) => (
              <TextField
                key={p}
                label={`${names[p]} (${p}): planned cost`}
                value={fields.plannedByPart[p]}
                onChange={(text) => set({ plannedByPart: { ...fields.plannedByPart, [p]: text } })}
                error={errors[`planned_${p}`]}
                testId={`part-planned-${p}`}
              />
            ))}
          </div>
        </section>

        <div>
          <label htmlFor={slotId} className="text-sm font-semibold">
            Crew slots per shutdown window
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button aria-label="Fewer crew slots" aria-disabled={slots !== null && slots <= 0} className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50" onClick={() => bump(-1)}>
              −
            </Button>
            <input
              id={slotId}
              data-testid="part-crew-slots"
              inputMode="numeric"
              value={fields.crewSlots}
              aria-invalid={Boolean(errors.crewSlots)}
              aria-describedby={errors.crewSlots ? `${slotId}-err` : `${slotId}-help`}
              onChange={(e) => set({ crewSlots: e.target.value })}
              className={cn(inputClass, "w-20 text-center", errors.crewSlots ? "border-2 border-alert-edge" : "border-input-edge")}
            />
            <Button aria-label="More crew slots" aria-disabled={slots !== null && slots >= MAX_SLOTS} className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50" onClick={() => bump(1)}>
              +
            </Button>
            <span className="text-xs text-ink-2">0–{MAX_SLOTS}</span>
          </div>
          {errors.crewSlots && <FieldError id={`${slotId}-err`}>{errors.crewSlots}</FieldError>}
          <p id={`${slotId}-help`} className="mt-1 mb-0 text-xs leading-5 text-ink-2">
            Each machine model has its own assumed weekly window; these slots apply to each window. Illustrative.
          </p>
        </div>

        <ReductionControl on={fields.reductionOn} value={fields.reduction} onOn={(reductionOn) => set({ reductionOn })} onValue={(reduction) => set({ reduction })} />

        <div>
          <Button aria-disabled={isDefault} className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50" onClick={() => !isDefault && onReset()}>
            Reset to defaults
          </Button>
        </div>
      </div>
    </section>
  );
}

function ListBody({
  plan,
  busy,
  invalid,
  error,
  onRetry,
  hourLabel,
  unit,
}: {
  plan: ComponentPlanResponse | null;
  busy: boolean;
  invalid: boolean;
  error: import("@/lib/api").ApiError | null;
  onRetry: () => void;
  hourLabel: string;
  unit: string;
}) {
  const [formula, setFormula] = useState(false);
  const formulaId = useId();
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="parts-title" className="m-0 text-lg leading-7 font-semibold">
          Parts priority list at {hourLabel}
        </h2>
        <Button aria-expanded={formula} aria-controls={formulaId} onClick={() => setFormula((f) => !f)}>
          How this is calculated
        </Button>
      </div>
      <p className="mt-2 mb-0 text-sm leading-5 text-ink-2">
        Ranked by <strong>expected exposure = chance the part fails before its machine model&apos;s next shutdown window × cost if it fails</strong>. Ties:
        higher chance first, then lower machine number. The top parts in each window fill that window&apos;s crew slots. There is no alert cut-off for the 7 to 14
        day view: it ranks parts, it does not warn.
      </p>
      <div id={formulaId} hidden={!formula} data-testid="component-formula" className="mt-3 rounded-md border border-line bg-subtle p-3 text-sm leading-5">
        <h3 className="m-0 text-sm font-semibold">How this is calculated</h3>
        <ul className="mt-1 mb-0 pl-5">
          {(plan ? [...Object.values(plan.formulas), ...plan.notes] : ["Expected exposure = chance before the next window × the part's cost. Illustrative."]).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      {error ? (
        error.kind === "no-model-data" ? (
          <div className="mt-3">
            <NoModelData />
          </div>
        ) : (
          <div className="mt-3" data-testid="component-error">
            <ServiceError what={`the part chances for ${hourLabel}`} error={error} onRetry={onRetry} />
          </div>
        )
      ) : plan === null ? (
        <div className="mt-3 flex flex-col gap-2" data-testid="component-loading">
          <p className="m-0 text-sm text-ink-2">Loading part chances for this hour…</p>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" label="Loading part chances for this hour" />
          ))}
        </div>
      ) : (
        <div className={busy ? "opacity-60" : undefined} aria-busy={busy} data-testid="component-ready">
          {invalid && (
            <p role="note" data-testid="component-invalid-note" className="mt-3 mb-0 rounded-md border border-l-4 border-input-edge bg-card px-2 py-2 text-sm">
              Showing results for your last valid inputs.
            </p>
          )}
          <Windows plan={plan} />
          <PartsTable plan={plan} unit={unit} />
          <Summary plan={plan} unit={unit} />
        </div>
      )}
    </>
  );
}

function Windows({ plan }: { plan: ComponentPlanResponse }) {
  return (
    <div className="mt-3 rounded-md border border-line bg-subtle p-3 text-sm" data-testid="windows">
      <h3 className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold">
        Next shutdown windows <ValueLabel kind="Assumed" />
      </h3>
      <ul className="mt-1 mb-0 list-none p-0 text-xs leading-5 text-ink-2">
        {plan.summary.windows.length === 0 ? (
          <li>No part is shortlisted in any window.</li>
        ) : (
          plan.summary.windows.map((w) => (
            <li key={w.start} data-testid="window">
              {w.models.join(", ")}: {windowText(w.start)} · {w.shortlisted} of {plan.summary.crew_slots_per_window} slots used
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ChanceCell({ r }: { r: ComponentPlanRow }) {
  return (
    <>
      <div className="tabular text-sm">{percent(r.chance_before_window)}</div>
      <span className="block text-xs leading-4 font-semibold" data-testid="signal" data-signal={r.signal}>
        {r.signal === "warning" ? "⚠ " : ""}
        {signalText(r)}
      </span>
      <span className="block text-xs leading-4 text-ink-2">
        {r.signal === "warning" ? `48 h chance ${percent(r.warning_chance_48h)}` : `${plan14(r)} chance ${percent(r.wear_chance)}`}
      </span>
    </>
  );
}

const plan14 = (r: ComponentPlanRow) => `${r.days_since_replacement.toFixed(0)} days since replaced ·`;

function PartsTable({ plan, unit }: { plan: ComponentPlanResponse; unit: string }) {
  const href = useAssetHref();
  const showNet = plan.assumptions.risk_reduction_percent !== null;
  return (
    <>
      <div className="mt-3 hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left" data-testid="parts-table">
          <caption className="sr-only">
            Parts ranked by expected exposure, highest first, top {plan.rows.length} of {plan.summary.parts_ranked}. Money columns are illustrative, in {unit}.
            Chance is predicted. Machine model is historical. Part names and shutdown windows are assumed.
          </caption>
          <thead>
            <tr>
              <Th>Rank · machine</Th>
              <Th label="assumed name">Part</Th>
              <Th right label="predicted">
                Chance before window
              </Th>
              <Th label="assumed">Next window</Th>
              <Th right label="illustrative">
                Expected exposure
              </Th>
              <Th right label="illustrative">
                Planned cost
              </Th>
              {showNet && (
                <Th right label="illustrative estimate">
                  Net benefit
                </Th>
              )}
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {plan.rows.map((r) => (
              <tr key={`${r.machine_id}-${r.part}`} data-testid="part-row" data-machine={r.machine_id} data-part={r.part} data-listing={r.listing} data-action={r.action} className="border-b border-line">
                <td className="px-1.5 py-2 text-sm">
                  <Link href={href(r.machine_id)} className="inline-flex min-h-11 max-w-32 items-center text-link underline">
                    <span className="tabular mr-1 no-underline">{r.rank} ·</span> {machineName(r.machine_id)}
                  </Link>
                  <span className="block text-xs text-ink-2">{r.model} (historical)</span>
                </td>
                <td className="px-1.5 py-2 text-sm">
                  <span title={r.part}>{r.part_name}</span>
                  <span className="block text-xs text-ink-2">{r.part}</span>
                </td>
                <td className="px-1.5 py-2 text-right">
                  <ChanceCell r={r} />
                </td>
                <td className="px-1.5 py-2 text-sm">
                  {windowText(r.window_start)}
                  <span className="block text-xs text-ink-2">{untilText(r.days_to_window)}</span>
                </td>
                <td className="tabular px-1.5 py-2 text-right text-sm" data-testid="part-exposure">
                  {money(r.expected_exposure)}
                  <span className="block text-xs text-ink-2">cost {money(r.failure_cost)}</span>
                </td>
                <td className="tabular px-1.5 py-2 text-right text-sm">{r.listing === "shortlisted" ? money(r.planned_cost) : "—"}</td>
                {showNet && (
                  <td className="tabular px-1.5 py-2 text-right text-sm" data-testid="part-net">
                    {r.net_benefit === null ? "—" : signedMoney(r.net_benefit)}
                  </td>
                )}
                <td className="px-1.5 py-2 text-sm">
                  <strong>{ACTION_TEXT[r.action]}</strong>
                  <span className="block text-xs text-ink-2" data-testid="part-slot">
                    {slotText(r)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 mb-0 text-xs text-ink-2">Money columns are in {unit}.</p>
      </div>

      <ul className="m-0 mt-3 list-none p-0 md:hidden" aria-label="Parts ranked by expected exposure" data-testid="part-cards">
        {plan.rows.map((r) => (
          <li key={`${r.machine_id}-${r.part}`} data-testid="part-card" data-machine={r.machine_id} data-part={r.part} className="border-b border-line py-3">
            <div className="flex items-start justify-between gap-3">
              <Link href={href(r.machine_id)} className="inline-flex min-h-11 items-center text-sm font-semibold text-link underline">
                {r.rank} · {machineName(r.machine_id)} · {r.part_name}
              </Link>
              <span className="text-right text-sm font-semibold">{ACTION_TEXT[r.action]}</span>
            </div>
            <p className="m-0 text-xs leading-5 text-ink-2">
              {r.part} (assumed name) · model {r.model} (historical) · chance before window {percent(r.chance_before_window)} (predicted) · {signalText(r)} · next window{" "}
              {windowText(r.window_start)} (assumed) · exposure {money(r.expected_exposure)} · {slotText(r)}
              {showNet && r.net_benefit !== null ? ` · net benefit (estimate) ${signedMoney(r.net_benefit)}` : ""} (illustrative)
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}

function Summary({ plan, unit }: { plan: ComponentPlanResponse; unit: string }) {
  const s = plan.summary;
  return (
    <div data-testid="component-summary" className="mt-4 rounded-lg border border-line bg-subtle p-4 text-sm leading-6">
      <p className="m-0">
        <strong data-testid="component-slots">
          Shortlist: {s.slots_used} slots used ({s.crew_slots_per_window} per window)
        </strong>{" "}
        · {s.warning_parts} {s.warning_parts === 1 ? "part shows" : "parts show"} a 48-hour warning · total expected exposure{" "}
        <span data-testid="component-exposure">{money(s.shortlist_exposure)}</span> <ValueLabel kind="Illustrative" /> estimate · planned spend{" "}
        <span data-testid="component-spend">{money(s.planned_spend)}</span> <ValueLabel kind="Illustrative" />
      </p>
      <p className="mt-1 mb-0 text-xs text-ink-2">
        Showing the top {s.rows_returned} of {s.parts_ranked} parts with some exposure. Amounts are in {unit}.
      </p>
      {s.net_benefit !== null && plan.assumptions.risk_reduction_percent !== null && (
        <p data-testid="component-net" className="mt-3 mb-0 border-t border-line pt-3">
          <strong>{s.net_benefit_label ?? "Expected net benefit (estimate)"}:</strong> {signedMoney(s.net_benefit)} <ValueLabel kind="Illustrative" /> · rests on your assumed{" "}
          {plan.assumptions.risk_reduction_percent}% lower chance of failure.
        </p>
      )}
    </div>
  );
}
