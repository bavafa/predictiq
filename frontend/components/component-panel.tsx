"use client";

import { useState } from "react";

import { useData } from "@/components/data-provider";
import { PanelError, Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ValueLabel } from "@/components/value-label";
import { HONESTY, HORIZONS, WEAR_LABEL, untilText, windowText } from "@/lib/component-planner";
import { percent } from "@/lib/fleet";
import type { ComponentPlannerInfo, MachineComponents } from "@/lib/types";
import { useApiQuery } from "@/lib/use-api-query";

const card = "rounded-lg border border-line bg-card p-4 sm:p-5";

/** The four parts of one machine at the replay hour (spec step 4). Names and windows are assumed; the 7 to 14 day
 *  chance is a weak wear estimate, and only the 48-hour warning has a cut-off. Hidden when the deployment has no
 *  component scores. */
export function ComponentPanel({ id, at, modelVersion }: { id: number; at: string; modelVersion: string }) {
  const { meta } = useData();
  const info = meta.status === "ready" ? (meta.meta.component_planner ?? null) : null;
  if (!info) return null; // no request is made without component scores
  return <PanelBody id={id} at={at} modelVersion={modelVersion} info={info} />;
}

function PanelBody({ id, at, modelVersion, info }: { id: number; at: string; modelVersion: string; info: ComponentPlannerInfo }) {
  const { client } = useData();
  const [horizon, setHorizon] = useState<number>(info.default_horizon_days);
  const q = useApiQuery<MachineComponents>(
    (signal) => client.components(id, { at, horizon_days: horizon }, { signal }),
    [client, modelVersion, id, at, horizon],
  );
  const data = q.status === "ready" && q.data.machine_id === id && q.data.horizon_days === horizon && q.data.at.slice(0, 16) === at.slice(0, 16) ? q.data : null;
  return (
    <section className={card} aria-labelledby="parts-panel-title" data-testid="component-panel">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="parts-panel-title" className="m-0 text-lg leading-7 font-semibold">
          Parts of this machine
        </h2>
        <ValueLabel kind="Predicted" /> <ValueLabel kind="Assumed" />
      </div>
      <p className="mt-1 mb-2 text-sm text-ink-2" data-testid="component-honesty">
        {info.honesty || HONESTY}
      </p>
      <div role="group" aria-label="Look-ahead for the wear estimate" className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold">Look-ahead</span>
        {HORIZONS.map((h) => (
          <Button key={h} aria-pressed={horizon === h} variant={horizon === h ? "primary" : undefined} data-testid={`panel-horizon-${h}`} onClick={() => setHorizon(h)}>
            {h} days
          </Button>
        ))}
      </div>
      {q.status === "error" ? (
        <PanelError testId="component-panel-error" message="Couldn't load the parts of this machine." onRetry={q.retry} />
      ) : data === null ? (
        <Skeleton className="h-40 w-full" label="Loading the parts of this machine" />
      ) : (
        <>
          <p className="mt-0 mb-2 text-sm" data-testid="component-window">
            Next shutdown window for {data.model}: <strong>{windowText(data.window_start)}</strong> ({untilText(data.days_to_window)}) <ValueLabel kind="Assumed" />
          </p>
          <ul className="m-0 list-none p-0 xl:hidden" aria-label="The four parts of this machine" data-testid="component-cards">
            {data.parts.map((p) => (
              <li key={p.part} data-testid="component-card" data-part={p.part} className="border-b border-line py-3">
                <p className="m-0 text-sm font-semibold">
                  <span title={p.part}>{p.part_name}</span> <span className="text-xs font-normal text-ink-2">({p.part}, assumed name)</span>
                </p>
                <p className="m-0 text-xs leading-5 text-ink-2">
                  {Math.round(p.days_since_replacement)} days since replaced · wear estimate {percent(p.wear_chance)} over {data.horizon_days} days (
                  {WEAR_LABEL}) · chance before window {percent(p.chance_before_window)}
                </p>
                <p className="m-0 text-sm">
                  <strong>{p.warning_active ? `⚠ Warning: ${p.part_name} signature` : "No warning"}</strong>{" "}
                  <span className="text-xs text-ink-2">
                    48 h chance {percent(p.warning_chance_48h)} · warns at {p.warning_cutoff_percent}%
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto xl:block" tabIndex={0} role="region" aria-label="Parts table (scrolls sideways if it is too wide)">
            <table className="w-full border-collapse text-left" data-testid="component-table">
              <caption className="sr-only">
                The four parts of this machine: days since replaced, wear estimate over {data.horizon_days} days, chance before the next window and the 48-hour warning.
              </caption>
              <thead>
                <tr>
                  {["Part", "Days since replaced", `Wear estimate, ${data.horizon_days} days`, "Chance before window", "48-hour warning"].map((h) => (
                    <th key={h} scope="col" className="border-b border-line bg-subtle px-1.5 py-2 align-top text-left text-xs font-semibold text-ink-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.parts.map((p) => (
                  <tr key={p.part} data-testid="component-row" data-part={p.part} data-warning={p.warning_active} className="border-b border-line">
                    <td className="px-1.5 py-2 text-sm">
                      <span title={p.part}>{p.part_name}</span>
                      <span className="block text-xs text-ink-2">{p.part}</span>
                    </td>
                    <td className="tabular px-1.5 py-2 text-sm">{Math.round(p.days_since_replacement)}</td>
                    <td className="px-1.5 py-2 text-sm">
                      <span className="tabular">{percent(p.wear_chance)}</span>
                      <span className="block text-xs text-ink-2">{WEAR_LABEL}</span>
                    </td>
                    <td className="tabular px-1.5 py-2 text-sm">{percent(p.chance_before_window)}</td>
                    <td className="px-1.5 py-2 text-sm">
                      <strong>{p.warning_active ? `⚠ Warning: ${p.part_name} signature` : "No warning"}</strong>
                      <span className="block text-xs text-ink-2">
                        48 h chance {percent(p.warning_chance_48h)} · warns at {p.warning_cutoff_percent}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 mb-0 text-xs text-ink-2">
            {data.names_note} {data.windows_note}
          </p>
        </>
      )}
    </section>
  );
}
