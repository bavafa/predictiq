"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { latestErrorText } from "@/components/fleet-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { percent } from "@/lib/fleet";
import { machineName, machineType } from "@/lib/machine-types";
import type { FleetRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export const MAX_CARDS = 5;
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

/** One machine that needs action: tag, name, chance, reason, View asset and Add to work plan. Shared by Home and Alerts. */
export function AlertCard({
  r,
  added,
  onAdd,
  carried,
  priority,
  extra,
}: {
  r: FleetRow;
  added: boolean;
  onAdd: () => void;
  carried: string;
  priority?: number;
  extra?: ReactNode;
}) {
  const p = new URLSearchParams(carried);
  p.set("machine", String(r.machine_id));
  const assetHref = `/asset-details?${p.toString()}`;
  return (
    <article className={cn(card, "flex flex-wrap items-center justify-between gap-5")} data-testid="alert-card">
      <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-1.5">
        {priority !== undefined && <p className="m-0 text-xs font-semibold tracking-wide text-ink-2 uppercase">Priority {priority}</p>}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1 rounded-sm border border-alert-edge bg-alert-bg px-2 text-[13px] leading-6 font-bold text-alert-text">
            <span aria-hidden="true">▲</span> Act today<span className="sr-only">, predicted</span>
          </span>
          <h3 className="m-0 text-lg font-semibold">{machineName(r.machine_id)}</h3>
          <span className="text-sm text-ink-2">
            {r.age} {r.age === 1 ? "year" : "years"} old
          </span>
        </div>
        <p className="m-0 text-[15px]">{percent(r.score)} chance of failure within 24 h.</p>
        <p className="m-0 text-sm text-ink-2">{whyText(r.latest_error)}</p>
        {extra}
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Link href={assetHref} className={cn(buttonVariants(), "no-underline")}>
          View asset<span className="sr-only">: {machineName(r.machine_id)}</span>
        </Link>
        {added ? (
          <Link href={`/maintenance-planner${carried}`} className={cn(buttonVariants(), "no-underline")}>
            <span aria-hidden="true">✓</span> In work plan<span className="sr-only">: {machineName(r.machine_id)}</span>
          </Link>
        ) : (
          <Button variant="primary" onClick={onAdd}>
            Add to work plan<span className="sr-only">: {machineName(r.machine_id)}</span>
          </Button>
        )}
      </div>
    </article>
  );
}

/** Status by equipment type; each tile opens Assets. */
export function TypeGrid({ rows, carried, title, note }: { rows: readonly FleetRow[]; carried: string; title: string; note: ReactNode }) {
  const types = typeCounts(rows);
  return (
      <section aria-labelledby="by-type" className="flex flex-col gap-3">
        <h2 id="by-type" className={h2}>
          {title}
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
                  {t.alerts > 0 ? `▲ ${t.alerts} of ${t.total} act today` : `All ${t.total} Normal`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[13px] text-ink-2">{note}</p>
      </section>
  );
}
