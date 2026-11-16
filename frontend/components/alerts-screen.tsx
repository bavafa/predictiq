"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useData } from "@/components/data-provider";
import { AlertCard, TypeGrid } from "@/components/overview-screen";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { ValueLabel } from "@/components/value-label";
import { ApiError } from "@/lib/api";
import { percent } from "@/lib/fleet";
import { useJobs } from "@/lib/jobs";
import { machineName } from "@/lib/machine-types";
import { check, defaultFields, money } from "@/lib/planner";
import { formatHour, parseHour } from "@/lib/time";
import type { Fleet, FleetRow, PlanResponse, ReadyMetadata } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery } from "@/lib/use-api-query";

/** The alerts in the order a planner works them: biggest cost at risk first (decision 88). Without costs, by chance. */
export function rankByCost(alerts: readonly FleetRow[], plan: PlanResponse | null): { rows: FleetRow[]; cost: Map<number, number>; differs: boolean } {
  const cost = new Map<number, number>();
  plan?.rows.forEach((r) => cost.set(r.machine_id, r.expected_exposure));
  const byChance = [...alerts].sort((a, b) => b.score - a.score || a.machine_id - b.machine_id);
  if (cost.size === 0) return { rows: byChance, cost, differs: false };
  const rows = [...alerts].sort((a, b) => (cost.get(b.machine_id) ?? -1) - (cost.get(a.machine_id) ?? -1) || b.score - a.score);
  return { rows, cost, differs: rows.some((r, i) => r.machine_id !== byChance[i]?.machine_id) };
}

/** "Since the last hour": new alerts and the biggest change in chance among the machines that are alerts now. */
export function sinceText(now: readonly FleetRow[], before: Fleet | null): string | null {
  if (!before) return null;
  const was = new Map(before.rows.map((r) => [r.machine_id, r]));
  const fresh = now.filter((r) => was.get(r.machine_id)?.status !== "alert");
  const head = fresh.length === 0 ? "no new alerts" : `${fresh.length} new ${fresh.length === 1 ? "alert" : "alerts"} (${fresh.map((r) => machineName(r.machine_id)).join(", ")})`;
  let best: { r: FleetRow; from: number } | null = null;
  for (const r of now) {
    const prev = was.get(r.machine_id);
    if (!prev) continue;
    if (!best || Math.abs(r.score - prev.score) > Math.abs(best.r.score - best.from)) best = { r, from: prev.score };
  }
  const move = best && Math.abs(best.r.score - best.from) >= 0.001 ? ` ${machineName(best.r.machine_id)} ${best.r.score > best.from ? "rose" : "fell"} from ${percent(best.from)} to ${percent(best.r.score)}.` : "";
  return `Since the last hour: ${head}.${move}`;
}

export function AlertsScreen() {
  const { client, meta, view, search, replay } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const at = view?.at;
  const cutoff = view?.cutoff;
  const fleet = useApiQuery<Fleet>(
    (signal) => client.fleet({ at: at!, cutoff }, { signal }),
    [client, ready?.model_version, at, cutoff],
  );
  const hour = at ? parseHour(at.slice(0, 16)) : null;
  const prevAt = hour !== null && replay && hour - 1 >= replay.first ? formatHour(hour - 1) : null;
  const before = useApiQuery<Fleet | null>(
    (signal) => (prevAt ? client.fleet({ at: prevAt, cutoff }, { signal }) : Promise.resolve(null)),
    [client, ready?.model_version, prevAt, cutoff],
  );
  const inputs = useMemo(() => {
    if (!ready) return null;
    const c = check(defaultFields(ready as ReadyMetadata));
    return c.ok ? c.inputs : null;
  }, [ready]);
  const plan = useApiQuery<PlanResponse | null>(
    (signal) => (inputs ? client.plan({ at: at!, cutoff_percent: cutoff, ...inputs }, { signal }) : Promise.resolve(null)),
    [client, ready?.model_version, at, cutoff, inputs],
  );
  if (!ready || !view) return null;
  if (fleet.status === "error") {
    return fleet.error.kind === "no-model-data" ? (
      <NoModelData />
    ) : (
      <ServiceError what="the alerts" error={fleet.error as ApiError} onRetry={fleet.retry} />
    );
  }
  if (fleet.status !== "ready" || plan.status === "loading") {
    return (
      <div className="flex flex-col gap-4" data-testid="alerts-loading">
        <Skeleton className="h-16 w-full" label="Loading the alerts" />
        <Skeleton className="h-32 w-full" label="Loading the alerts" />
      </div>
    );
  }
  return (
    <Body
      fleet={fleet.data}
      plan={plan.status === "ready" ? plan.data : null}
      before={before.status === "ready" ? before.data : null}
      carried={carriedSearch(search)}
      at={view.at}
      modelVersion={ready.model_version}
      hasParts={!!ready.component_planner}
    />
  );
}

function Body({ fleet, plan, before, carried, at, modelVersion, hasParts }: { fleet: Fleet; plan: PlanResponse | null; before: Fleet | null; carried: string; at: string; modelVersion: string; hasParts: boolean }) {
  const { jobs, dismissed, add } = useJobs();
  const all = fleet.rows.filter((r) => r.status === "alert");
  const open = all.filter((r) => !dismissed.includes(r.machine_id));
  const { rows, cost, differs } = rankByCost(open, plan);
  const since = sinceText(all, before);
  const normal = fleet.rows.length - all.length;
  return (
    <div className="flex max-w-[1120px] flex-col gap-7" data-testid="alerts">
      <div className="flex max-w-3xl flex-col gap-2">
        <p className="m-0 text-base leading-7 text-ink-2">
          A machine shows <strong>Act today</strong> when the model gives it a high chance of failing in the next 24 hours (at or above {fleet.cutoff_percent}%).
          The list is ranked by cost at risk, so the top job matters most. Open a machine to see the evidence, or add it straight to the work plan.
        </p>
        {since && (
          <p className="m-0 text-sm font-semibold" data-testid="since-last-hour">
            {since}
          </p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="m-0 text-base" data-testid="no-alerts">
          {all.length > 0 ? "Every alert has been dismissed. Reset demo on the Work plan brings them back." : "No machine is at the Act today level at this simulated plant time."}
        </p>
      ) : (
        <section aria-labelledby="ranked" className="flex flex-col gap-3">
          <h2 id="ranked" className="m-0 text-[13px] font-semibold tracking-wide text-ink-2 uppercase">
            {rows.length} {rows.length === 1 ? "machine" : "machines"} to act on, most cost at risk first
          </h2>
          {plan && (
            <p className="m-0 text-sm text-ink-2" data-testid="rank-note">
              Cost at risk is the chance of failure times an example cost of a failure for that equipment type.{" "}
              {differs ? "The order is not the order of chance: a costlier machine can rank above a likelier one." : "Here the order matches the order of chance."}
            </p>
          )}
          {rows.map((r, i) => (
            <AlertCard
              key={r.machine_id}
              r={r}
              priority={i + 1}
              added={jobs.includes(r.machine_id)}
              onAdd={() => add(r.machine_id)}
              carried={carried}
              extra={
                <>
                  {cost.has(r.machine_id) && (
                    <p className="m-0 text-sm" data-testid="cost-at-risk">
                      Cost at risk: <strong className="tabular">{money(cost.get(r.machine_id)!)}</strong> <ValueLabel kind="Illustrative" />
                    </p>
                  )}
                  {hasParts && <LikelyPart id={r.machine_id} at={at} modelVersion={modelVersion} />}
                </>
              }
            />
          ))}
        </section>
      )}

      <TypeGrid
        rows={fleet.rows}
        carried={carried}
        title="The rest of the plant"
        note={
          <>
            {normal} {normal === 1 ? "machine is" : "machines are"} Normal. Normal means below the Act today level. It is not a guarantee. Equipment types are
            illustrative names, not stated by the data source.
          </>
        }
      />
      <Link href={`/maintenance-planner${carried}`} className="flex min-h-11 w-fit items-center text-[15px] font-semibold">
        Open the work plan
      </Link>
    </div>
  );
}

/** "Likely part", only while the 48-hour warning is active for a part (decision 85). Nothing otherwise. */
function LikelyPart({ id, at, modelVersion }: { id: number; at: string; modelVersion: string }) {
  const { client } = useData();
  const q = useApiQuery((signal) => client.components(id, { at }, { signal }), [client, modelVersion, id, at]);
  if (q.status !== "ready") return null;
  const warned = q.data.parts.filter((p) => p.warning_active).sort((a, b) => b.warning_chance_48h - a.warning_chance_48h)[0];
  if (!warned) return null;
  return (
    <p className="m-0 text-sm" data-testid="likely-part">
      Likely part: <strong>{warned.part_name}</strong>. 48-hour warning, {percent(warned.warning_chance_48h)} chance within 48 hours. Part names are assumed.
    </p>
  );
}
