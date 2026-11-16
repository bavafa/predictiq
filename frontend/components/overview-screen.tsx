"use client";

import Link from "next/link";

import { useData } from "@/components/data-provider";
import { latestErrorText } from "@/components/fleet-table";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { percent } from "@/lib/fleet";
import { useJobs } from "@/lib/jobs";
import { machineName, machineType } from "@/lib/machine-types";
import { parseResults, rowAt } from "@/lib/model-performance";
import type { Fleet, FleetRow } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery } from "@/lib/use-api-query";
import { cn } from "@/lib/utils";

const MAX_CARDS = 5;
const card = "rounded-lg border border-line bg-card p-4 sm:p-5";
const h2 = "m-0 text-[13px] font-semibold tracking-wide text-ink-2 uppercase";

/** "Why: error type 5 logged 31 Oct 06:00" from the latest error record (patterns, not causes). */
function whyText(e: FleetRow["latest_error"]): string {
  return e ? `Why: its latest error record is ${latestErrorText(e)}.` : "Why: no error record yet; the model flags this from sensor and age patterns.";
}

export function typeCounts(rows: readonly FleetRow[]): { type: string; total: number; alerts: number }[] {
  const by = new Map<string, { type: string; total: number; alerts: number }>();
  for (const r of rows) {
    const type = machineType(r.machine_id);
    const e = by.get(type) ?? { type, total: 0, alerts: 0 };
    e.total += 1;
    if (r.status === "alert") e.alerts += 1;
    by.set(type, e);
  }
  return [...by.values()].sort((a, b) => b.alerts - a.alerts || a.type.localeCompare(b.type));
}

export function headline(alerts: number): string {
  if (alerts === 0) return "No assets have a high chance of failing in the next 24 hours";
  return `${alerts} ${alerts === 1 ? "asset has" : "assets have"} a high chance of failing in the next 24 hours`;
}

export function OverviewScreen() {
  const { client, meta, view, search } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const at = view?.at;
  const cutoff = view?.cutoff;
  const fleet = useApiQuery<Fleet>(
    (signal) => client.fleet({ at: at!, cutoff }, { signal }),
    [client, ready?.model_version, at, cutoff],
  );
  if (!ready || !view) return null;
  if (fleet.status === "error") {
    return fleet.error.kind === "no-model-data" ? (
      <NoModelData />
    ) : (
      <ServiceError what="the plant overview" error={fleet.error as ApiError} onRetry={fleet.retry} />
    );
  }
  if (fleet.status !== "ready") {
    return (
      <div className="flex flex-col gap-4" data-testid="overview-loading">
        <Skeleton className="h-16 w-full" label="Loading the plant overview" />
        <Skeleton className="h-32 w-full" label="Loading the alerts" />
        <Skeleton className="h-32 w-full" label="Loading the equipment status" />
      </div>
    );
  }
  return <Body fleet={fleet.data} carried={carriedSearch(search)} />;
}

function Body({ fleet, carried }: { fleet: Fleet; carried: string }) {
  const alerts = fleet.rows.filter((r) => r.status === "alert");
  const { jobs, dismissed, add } = useJobs();
  const open = alerts.filter((r) => !dismissed.includes(r.machine_id));
  const shown = open.slice(0, MAX_CARDS);
  const total = fleet.rows.length;
  const types = typeCounts(fleet.rows);
  const assetHref = (id: number) => {
    const p = new URLSearchParams(carried);
    p.set("machine", String(id));
    return `/asset-details?${p.toString()}`;
  };
  return (
    <div className="flex max-w-[1120px] flex-col gap-7" data-testid="overview">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-3xl leading-tight font-bold" data-testid="overview-headline">
          {headline(alerts.length)}
        </h2>
        <p className="m-0 text-base text-ink-2">
          {total - alerts.length} {total - alerts.length === 1 ? "asset is" : "assets are"} below the alert cut-off ({fleet.cutoff_percent}%).
          {open.length > 0 && " Add a job to the work plan to get it scheduled."}
          {alerts.length > open.length && ` ${alerts.length - open.length} dismissed.`}
        </p>
      </div>

      {open.length > 0 && (
        <section aria-labelledby="needs-attention" className="flex flex-col gap-3">
          <h2 id="needs-attention" className={h2}>
            Needs attention
          </h2>
          {shown.map((r) => {
            const added = jobs.includes(r.machine_id);
            return (
              <article key={r.machine_id} className={cn(card, "flex flex-wrap items-center justify-between gap-5")} data-testid="alert-card">
                <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1 rounded-sm border border-alert-edge bg-alert-bg px-2 text-[13px] leading-6 font-bold text-alert-text">
                      <span aria-hidden="true">▲</span> Alert<span className="sr-only">, predicted</span>
                    </span>
                    <h3 className="m-0 text-lg font-semibold">{machineName(r.machine_id)}</h3>
                    <span className="text-sm text-ink-2">{r.age} years old</span>
                  </div>
                  <p className="m-0 text-[15px]">{percent(r.score)} chance of failure within 24 h.</p>
                  <p className="m-0 text-sm text-ink-2">{whyText(r.latest_error)}</p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <Link href={assetHref(r.machine_id)} className={cn(buttonVariants(), "no-underline")}>
                    View asset<span className="sr-only">: {machineName(r.machine_id)}</span>
                  </Link>
                  {added ? (
                    <Link href={`/maintenance-planner${carried}`} className={cn(buttonVariants(), "no-underline")}>
                      <span aria-hidden="true">✓</span> In work plan<span className="sr-only">: {machineName(r.machine_id)}</span>
                    </Link>
                  ) : (
                    <Button variant="primary" onClick={() => add(r.machine_id)}>
                      Add to work plan<span className="sr-only">: {machineName(r.machine_id)}</span>
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
          {open.length > shown.length && (
            <p className="m-0 text-sm text-ink-2">
              {open.length - shown.length} more in{" "}
              <Link href={`/assets${carried}`} className="inline-flex min-h-11 items-center">
                Assets
              </Link>
              .
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="by-type" className="flex flex-col gap-3">
        <h2 id="by-type" className={h2}>
          Plant status by equipment type
        </h2>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 p-0">
          {types.map((t) => (
            <li key={t.type}>
              <Link
                href={`/assets${carried}`}
                className={cn(
                  "flex h-full flex-col gap-1 rounded-lg bg-card p-4 text-ink no-underline",
                  t.alerts > 0 ? "border-2 border-alert-edge" : "border border-input-edge",
                )}
              >
                <span className="text-base font-semibold">{t.type}s</span>
                <span className={cn("text-sm", t.alerts > 0 ? "font-semibold text-alert-text" : "text-ink-2")}>
                  {t.alerts > 0 ? `▲ ${t.alerts} of ${t.total} in alert` : `All ${t.total} below cut-off`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[13px] text-ink-2">Equipment types are illustrative names, not stated by the data source.</p>
        <Link href="/about-data" className="flex min-h-11 w-fit items-center text-sm font-semibold">
          See About this demo
        </Link>
      </section>

      <section className="flex flex-wrap gap-4">
        <TrustCard />
        <div className={cn(card, "flex flex-[1_1_320px] flex-col gap-2")}>
          <h2 className="m-0 text-base font-semibold">Work plan</h2>
          <p className="m-0 text-sm leading-6 text-ink-2" data-testid="workplan-summary">
            {jobs.length === 0
              ? `No jobs added yet. ${open.length} ${open.length === 1 ? "job is" : "jobs are"} recommended.`
              : `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} added. ${Math.max(0, open.length - jobs.length)} more recommended.`}
          </p>
          <Link href={`/maintenance-planner${carried}`} className="flex min-h-11 items-center text-[15px] font-semibold">
            Open work plan
          </Link>
        </div>
      </section>
    </div>
  );
}

/** "Can I trust these alerts?": counts read from the saved evaluation, never typed in. */
function TrustCard() {
  const { client, meta, search } = useData();
  const version = meta.status === "ready" ? meta.meta.model_version : "";
  const q = useApiQuery(
    async (signal) => {
      const [m, t] = await Promise.all([client.modelMetrics({ signal }), client.thresholdAnalysis({ signal })]);
      return parseResults(m, t);
    },
    [client, version],
  );
  const results = q.status === "ready" ? q.data : null;
  const cutoff = results?.models.main.summary.default_cutoff_percent ?? null;
  const row = results && cutoff !== null ? rowAt(results, "main", cutoff) : null;
  const days = results ? Math.round(results.testWindow.hours / 24) : 0;
  return (
    <div className={cn(card, "flex flex-[1_1_320px] flex-col gap-2")}>
      <h2 className="m-0 text-base font-semibold">Can I trust these alerts?</h2>
      <p className="m-0 text-sm leading-6 text-ink-2" data-testid="trust-summary">
        {row
          ? `In a ${days}-day test on simulated data, the model caught ${row.events_caught} of ${row.events_full_lookback} failures, and ${row.false_alerts} of its ${row.alerts} alerts were false. Real equipment would score lower.`
          : q.status === "loading"
            ? "Loading the test result."
            : "The test result isn't available in this deployment. See Alert accuracy."}
      </p>
      <Link href={`/model-performance${carriedSearch(search)}`} className="flex min-h-11 items-center text-[15px] font-semibold">
        See alert accuracy
      </Link>
    </div>
  );
}
