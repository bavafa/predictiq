"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useData } from "@/components/data-provider";
import { CutoffControl } from "@/components/cutoff-control";
import { PlannerLevels } from "@/components/planner-levels";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ValueLabel } from "@/components/value-label";
import { ApiError } from "@/lib/api";
import { checkComponent, defaultComponentFields, windowText } from "@/lib/component-planner";
import { jobLabel, slotsUsed, useJobs, type JobStatus } from "@/lib/jobs";
import { machineName } from "@/lib/machine-types";
import { MAX_COST, MAX_SLOTS, MODELS, money } from "@/lib/planner";
import { MODEL_TYPES, crewSlots, isWhole, machineInputs, usePlanSettings } from "@/lib/plan-settings";
import type { ComponentPlanResponse, Fleet, FleetRow, PlanResponse, ReadyMetadata } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useStoredFlag } from "@/lib/stored-flag";
import { useApiQuery, useSettledSet } from "@/lib/use-api-query";
import { cn } from "@/lib/utils";

const card = "rounded-lg border border-line bg-card p-4 sm:p-5";
const th = "border-b border-line bg-subtle px-3 py-2 text-left text-xs font-semibold text-ink-2";

export type Urgency = "act" | "warning" | "wear" | "added";
export type Job = {
  key: string;
  machineId: number;
  title: string;
  urgency: Urgency;
  when: string;
  cost: number | null;
  label: "Recommended" | "Added" | "Scheduled" | "Done";
  removable: boolean;
};

const URGENCY_TEXT: Record<Urgency, string> = { act: "▲ Act today", warning: "▲ 48 h warning", wear: "Wear risk", added: "Added by you" };
const ORDER: Record<Urgency, number> = { act: 0, warning: 1, wear: 2, added: 3 };

type Inputs = {
  fleetRows: readonly FleetRow[];
  plan: PlanResponse | null;
  parts: ComponentPlanResponse | null;
  dismissed: readonly number[];
  added: readonly number[];
  status: Record<string, JobStatus>;
};

/** One list of jobs (decisions 88 and 89): Act today machines, 48-hour part warnings, wear-risk parts, and machines the
 *  visitor added. Act today first, then by cost at risk. Recommended jobs come from the model; status is the visitor's. */
function inspectTitle(part: string, warnings: number): string {
  const more = warnings - 1;
  return more > 0 ? `Inspect: ${part}, +${more} more ${more === 1 ? "part" : "parts"} with a warning` : `Inspect: ${part}`;
}

export function buildJobs({ fleetRows, plan, parts, dismissed, added, status }: Inputs): Job[] {
  const cost = new Map<number, number>();
  plan?.rows.forEach((r) => cost.set(r.machine_id, r.expected_exposure));
  // The part a machine's job names is the one with the highest 48-hour warning chance, as on Alerts and the Machine page.
  const warn = new Map<number, ComponentPlanResponse["rows"][number]>();
  const warnCount = new Map<number, number>();
  for (const r of parts?.rows ?? []) {
    if (r.signal !== "warning") continue;
    warnCount.set(r.machine_id, (warnCount.get(r.machine_id) ?? 0) + 1);
    const best = warn.get(r.machine_id);
    if (!best || r.warning_chance_48h > best.warning_chance_48h) warn.set(r.machine_id, r);
  }
  const label = (key: string, id: number, isMachineJob: boolean) => jobLabel(status[key], isMachineJob && added.includes(id));
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const r of fleetRows) {
    if (r.status !== "alert" || (dismissed.includes(r.machine_id) && !added.includes(r.machine_id))) continue;
    const key = String(r.machine_id);
    const w = warn.get(r.machine_id);
    seen.add(key);
    jobs.push({ key, machineId: r.machine_id, title: w ? inspectTitle(w.part_name, warnCount.get(r.machine_id) ?? 1) : "Inspect machine", urgency: "act", when: "This shift", cost: cost.get(r.machine_id) ?? null, label: label(key, r.machine_id, true), removable: added.includes(r.machine_id) });
  }
  for (const r of parts?.rows ?? []) {
    if (r.listing !== "shortlisted") continue;
    const key = `${r.machine_id}:${r.part}`;
    if (r.signal === "warning") {
      if (seen.has(String(r.machine_id))) continue; // already the machine's Act today job
      jobs.push({ key, machineId: r.machine_id, title: `Inspect: ${r.part_name}`, urgency: "warning", when: `Before ${windowText(r.window_start)}`, cost: r.expected_exposure, label: label(key, r.machine_id, false), removable: false });
    } else {
      jobs.push({ key, machineId: r.machine_id, title: `Replace: ${r.part_name}`, urgency: "wear", when: `${windowText(r.window_start)} window`, cost: r.expected_exposure, label: label(key, r.machine_id, false), removable: false });
    }
  }
  for (const id of added) {
    const key = String(id);
    if (seen.has(key)) continue;
    jobs.push({ key, machineId: id, title: "Inspect machine", urgency: "added", when: "—", cost: null, label: label(key, id, true), removable: true });
  }
  return jobs.sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency] || (b.cost ?? -1) - (a.cost ?? -1) || a.machineId - b.machineId);
}

export function WorkPlan() {
  const { client, meta, view, search } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const { settings } = usePlanSettings();
  const at = view?.at;
  const cutoff = view?.cutoff;
  const fleet = useApiQuery<Fleet>(
    (signal) => client.fleet({ at: at!, cutoff }, { signal }),
    [client, ready?.model_version, at, cutoff],
  );
  const mInputs = useMemo(() => (ready ? machineInputs(ready as ReadyMetadata, settings) : null), [ready, settings]);
  const plan = useApiQuery<PlanResponse | null>(
    (signal) => (mInputs ? client.plan({ at: at!, cutoff_percent: cutoff, ...mInputs }, { signal }) : Promise.resolve(null)),
    [client, ready?.model_version, at, cutoff, JSON.stringify(mInputs)],
  );
  const info = ready?.component_planner ?? null;
  const cInputs = useMemo(() => {
    if (!info || !ready) return null;
    const c = checkComponent(defaultComponentFields(info, crewSlots(ready as ReadyMetadata, settings)));
    return c.ok ? c.inputs : null;
  }, [info, ready, settings]);
  const parts = useApiQuery<ComponentPlanResponse | null>(
    (signal) => (cInputs ? client.componentPlan({ level: "component", at: at!, ...cInputs }, { signal }) : Promise.resolve(null)),
    [client, ready?.model_version, at, JSON.stringify(cInputs)],
  );
  const fresh = fleet.status === "ready" && plan.status !== "loading" && parts.status !== "loading";
  const candidate = useMemo(
    () => (fresh && fleet.status === "ready" ? { fleet: fleet.data, plan: plan.status === "ready" ? plan.data : null, parts: parts.status === "ready" ? parts.data : null } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fresh, fleet.status === "ready" ? fleet.data : null, plan.status === "ready" ? plan.data : null, parts.status === "ready" ? parts.data : null],
  );
  const { shown, current } = useSettledSet(candidate);
  if (!ready || !view) return null;
  if (fleet.status === "error") {
    if (fleet.error.kind === "no-model-data") return <NoModelData />;
    // The job list needs the fleet; the detailed planners below do not, so they stay available.
    return (
      <div className="flex flex-col gap-4">
        <ServiceError what="the job list" error={fleet.error as ApiError} onRetry={fleet.retry} />
        <Advanced />
      </div>
    );
  }
  // While a changed setting or hour is being re-read, keep showing the last answers (dimmed) so open panels stay open.
  if (!shown) {
    return (
      <div className="flex flex-col gap-4" data-testid="workplan-loading">
        <Skeleton className="h-24 w-full" label="Loading the work plan" />
        <Skeleton className="h-48 w-full" label="Loading the jobs" />
      </div>
    );
  }
  return (
    <div className={current ? undefined : "opacity-60"} aria-busy={!current}>
      <Body fleet={shown.fleet} plan={shown.plan} parts={shown.parts} ready={ready as ReadyMetadata} carried={carriedSearch(search)} />
    </div>
  );
}

function Body({ fleet, plan, parts, ready, carried }: { fleet: Fleet; plan: PlanResponse | null; parts: ComponentPlanResponse | null; ready: ReadyMetadata; carried: string }) {
  const { jobs: added, dismissed, status, setStatus, remove, reset } = useJobs();
  const { settings, reset: resetSettings } = usePlanSettings();
  const [full, setFull] = useState(false);
  const [panel, setPanel] = useState(false);
  const crew = crewSlots(ready, settings);
  const used = slotsUsed(status);
  const list = buildJobs({ fleetRows: fleet.rows, plan, parts, dismissed, added, status });
  const open = list.filter((j) => j.label !== "Done");
  const actCost = list.filter((j) => j.urgency === "act" && j.label !== "Done").reduce((n, j) => n + (j.cost ?? 0), 0);
  const window = parts?.summary.windows[0]?.start;
  const assetHref = (id: number) => {
    const p = new URLSearchParams(carried);
    p.set("machine", String(id));
    return `/asset-details?${p.toString()}`;
  };
  const schedule = (key: string) => {
    if (used >= crew) return setFull(true);
    setFull(false);
    setStatus(key, "scheduled");
  };
  return (
    <div className="flex flex-col gap-4" data-testid="work-plan">
      <p className="m-0 max-w-3xl text-sm leading-6 text-ink-2">
        One list of jobs, costliest risk first. <strong>Act today</strong> jobs need a crew before the end of the shift. Wear-risk jobs can wait for the next shutdown
        window. Schedule a job to book a crew slot. Plan follows the simulated plant time.
      </p>

      <section aria-label="Plan summary" className={cn(card, "grid gap-4 sm:grid-cols-3")}>
        <Fact label="Crew slots this shift" testId="slots-used">
          Slots used: {used} of {crew}
        </Fact>
        <Fact label="Next shutdown window">
          {window ? <>{windowText(window)} (assumed)</> : "—"}
        </Fact>
        <Fact label="Cost at risk, Act today jobs">
          <span className="tabular">{money(actCost)}</span> <ValueLabel kind="Illustrative" />
        </Fact>
      </section>

      <section aria-labelledby="jobs-title" className={card} data-testid="job-list">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="jobs-title" className="m-0 text-lg leading-7 font-semibold">
            Jobs
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button aria-expanded={panel} aria-controls="plan-settings" onClick={() => setPanel(!panel)}>
              Plan settings
            </Button>
            <Button
              onClick={() => {
                setFull(false);
                reset();
                resetSettings();
              }}
            >
              Reset demo
            </Button>
          </div>
        </div>
        {panel && <SettingsPanel ready={ready} />}
        {list.length === 0 ? (
          <div data-testid="no-jobs">
            <p className="mt-2 mb-0 text-sm">No jobs at this simulated plant time: no machine is at the Act today level and no part is shortlisted.</p>
            <Link href={`/alerts${carried}`} className="flex min-h-11 w-fit items-center text-sm font-semibold">
              Go to Alerts
            </Link>
          </div>
        ) : (
          <>
          <div className="relative mt-3 hidden overflow-x-auto lg:block">{/* relative: the screen-reader-only text in the buttons must not widen the page */}
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Jobs, Act today first, then by cost at risk, with their status and actions.</caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>#</th>
                  <th scope="col" className={th}>Machine and job</th>
                  <th scope="col" className={th}>Urgency</th>
                  <th scope="col" className={th}>When</th>
                  <th scope="col" className={cn(th, "text-right")}>
                    Cost at risk <ValueLabel kind="Illustrative" />
                  </th>
                  <th scope="col" className={th}>Status</th>
                  <th scope="col" className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((j, i) => (
                  <tr key={j.key} className={cn("border-b border-line", j.label === "Done" && "text-ink-2")} data-testid="job-row" data-job-key={j.key}>
                    <td className="tabular px-3 py-2">{i + 1}</td>
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <Link href={assetHref(j.machineId)} className="inline-flex min-h-11 items-center">
                        {machineName(j.machineId)}
                      </Link>
                      <br />
                      <span className="text-xs text-ink-2">{j.title}</span>
                    </th>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {URGENCY_TEXT[j.urgency]}
                      {j.urgency === "act" || j.urgency === "warning" ? <span className="sr-only">, predicted</span> : null}
                    </td>
                    <td className="px-3 py-2">{j.when}</td>
                    <td className="tabular px-3 py-2 text-right">{j.cost === null ? "—" : money(j.cost)}</td>
                    <td className="px-3 py-2 font-semibold" data-testid="job-status">
                      {j.label}
                    </td>
                    <td className="px-3 py-2">
                      <JobActions j={j} schedule={schedule} setStatus={setStatus} remove={remove} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0 lg:hidden" data-testid="job-cards">
            {list.map((j, i) => (
              <li key={j.key} className={cn("flex flex-col gap-1 rounded-md border border-line p-3 text-sm", j.label === "Done" && "text-ink-2")} data-testid="job-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={assetHref(j.machineId)} className="inline-flex min-h-11 items-center font-semibold">
                    {i + 1}. {machineName(j.machineId)}
                  </Link>
                  <span className="font-semibold" data-testid="job-card-status">
                    {j.label}
                  </span>
                </div>
                <p className="m-0 text-ink-2">{j.title}</p>
                <p className="m-0">
                  {URGENCY_TEXT[j.urgency]}
                  {j.urgency === "act" || j.urgency === "warning" ? <span className="sr-only">, predicted</span> : null} · {j.when}
                </p>
                <p className="m-0">
                  Cost at risk: <span className="tabular">{j.cost === null ? "—" : money(j.cost)}</span> <ValueLabel kind="Illustrative" />
                </p>
                <JobActions j={j} schedule={schedule} setStatus={setStatus} remove={remove} />
              </li>
            ))}
          </ul>
          </>
        )}
        {full && (
          <p role="alert" className="mt-2 mb-0 text-sm text-alert-text" data-testid="slots-full">
            All {crew} slots are taken. Mark a job done or unschedule one first, or raise the crew slots in Plan settings.
          </p>
        )}
        <p className="mt-2 mb-0 text-xs text-ink-2">
          {open.length} open {open.length === 1 ? "job" : "jobs"}. Recommended jobs come from the model; Scheduled and Done are kept in this browser only and do not change
          when the simulated plant time moves. The 7 to 14 day part view is a wear estimate, not an early warning. This demo does not book real crews. Money figures are
          illustrative. Parts and window names are assumed.
        </p>
      </section>

      <Advanced />
    </div>
  );
}

function JobActions({
  j,
  schedule,
  setStatus,
  remove,
}: {
  j: Job;
  schedule: (key: string) => void;
  setStatus: (key: string, s: JobStatus | null) => void;
  remove: (machine: number) => void;
}) {
  const who = <span className="sr-only">: {machineName(j.machineId)}, {j.title}</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {(j.label === "Recommended" || j.label === "Added") && <Button onClick={() => schedule(j.key)}>Schedule{who}</Button>}
      {j.label === "Scheduled" && (
        <>
          <Button variant="primary" onClick={() => setStatus(j.key, "done")}>
            Mark done{who}
          </Button>
          <Button onClick={() => setStatus(j.key, null)}>Unschedule{who}</Button>
        </>
      )}
      {j.label === "Done" && <Button onClick={() => setStatus(j.key, null)}>Reopen{who}</Button>}
      {j.removable && j.label !== "Done" && <Button onClick={() => remove(j.machineId)}>Remove{who}</Button>}
    </div>
  );
}

function Fact({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div>
      <p className="m-0 text-xs font-semibold text-ink-2">{label}</p>
      <p className="mt-1 mb-0 text-base font-semibold" data-testid={testId}>
        {children}
      </p>
    </div>
  );
}

/** Crew slots, the example cost of a failure per equipment type, and the shared Act today level. */
function SettingsPanel({ ready }: { ready: ReadyMetadata }) {
  const { settings, save, reset } = usePlanSettings();
  const defaults = ready.planner_defaults;
  const [text, setText] = useState<Record<string, string>>({});
  const value = (k: string, fallback: number) => text[k] ?? String(fallback);
  const commit = (k: string, raw: string) => {
    setText((t) => ({ ...t, [k]: raw }));
    if (k === "crew") {
      const n = isWhole(raw, MAX_SLOTS);
      if (n !== null) save({ ...settings, crewSlots: n });
    } else {
      const n = isWhole(raw, MAX_COST);
      if (n !== null) save({ ...settings, failureByModel: { ...settings.failureByModel, [k]: n } });
    }
  };
  const bad = (k: string, max: number) => text[k] !== undefined && isWhole(text[k], max) === null;
  const input = "min-h-11 w-32 rounded-md border border-input-edge bg-card px-2 text-sm";
  return (
    <aside id="plan-settings" aria-label="Plan settings" className="mt-3 rounded-md border border-line bg-subtle p-4" data-testid="plan-settings">
      <p className="m-0 text-sm text-ink-2">Example values. Change them and the plan reorders. Whole numbers only.</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="ps-crew" className="min-w-56 text-sm font-semibold">
            Crew slots this shift
          </label>
          <input id="ps-crew" inputMode="numeric" className={input} value={value("crew", crewSlots(ready, settings))} aria-invalid={bad("crew", MAX_SLOTS)} onChange={(e) => commit("crew", e.target.value)} />
          {bad("crew", MAX_SLOTS) && <span role="alert" className="text-xs text-alert-text">Enter a whole number from 0 to {MAX_SLOTS}.</span>}
        </div>
        <h3 className="m-0 text-sm font-semibold">
          Cost of one failure <ValueLabel kind="Illustrative" />
        </h3>
        {MODELS.map((m) => (
          <div key={m} className="flex flex-wrap items-center gap-2">
            <label htmlFor={`ps-${m}`} className="min-w-56 text-sm">
              {MODEL_TYPES[m]}
            </label>
            <input id={`ps-${m}`} inputMode="numeric" className={input} value={value(m, settings.failureByModel[m] ?? defaults.failure_cost?.[m] ?? 0)} aria-invalid={bad(m, MAX_COST)} onChange={(e) => commit(m, e.target.value)} />
            {bad(m, MAX_COST) && <span role="alert" className="text-xs text-alert-text">Enter a whole number from 0 to {MAX_COST.toLocaleString("en-US")}.</span>}
          </div>
        ))}
        <div>
          <p className="m-0 text-sm font-semibold">Act today level</p>
          <CutoffControl />
        </div>
        <div>
          <Button
            onClick={() => {
              setText({});
              reset();
            }}
          >
            Reset settings
          </Button>
        </div>
      </div>
    </aside>
  );
}

/** The detailed machine and parts planners (assumptions, formulas, every column), closed until asked for. */
function Advanced() {
  const [open, setOpen] = useStoredFlag("piq-advanced-planner");
  return (
    <section className="flex flex-col gap-3">
      <Button aria-expanded={open} aria-controls="advanced-planner" className="h-auto max-w-full self-start py-2 text-left whitespace-normal" onClick={() => setOpen(!open)}>
        Advanced planner: detailed machine and parts plans
      </Button>
      <div id="advanced-planner" hidden={!open}>
        {open && <PlannerLevels />}
      </div>
    </section>
  );
}
