"use client";

import Link from "next/link";
import { useState } from "react";

import { useData } from "@/components/data-provider";
import { StatusTag } from "@/components/fleet-table";
import { Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ValueLabel } from "@/components/value-label";
import { percent } from "@/lib/fleet";
import { jobLabel, slotsUsed, useJobs } from "@/lib/jobs";
import { machineName } from "@/lib/machine-types";
import type { Fleet } from "@/lib/types";
import { carriedSearch } from "@/lib/url-state";
import { useApiQuery } from "@/lib/use-api-query";

const card = "rounded-lg border border-line bg-card p-4 sm:p-5";
const th = "border-b border-line bg-subtle px-3 py-2 text-left text-xs font-semibold text-ink-2";

/** "My jobs": the machines added from Overview or an asset page. Saved in this browser only (decision 82). */
export function JobList() {
  const { client, meta, view, search } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const { jobs, status, setStatus, remove, reset } = useJobs();
  const [full, setFull] = useState(false);
  const fleet = useApiQuery<Fleet>(
    (signal) => client.fleet({ at: view!.at, cutoff: view!.cutoff }, { signal }),
    [client, ready?.model_version, view?.at, view?.cutoff],
  );
  if (!ready || !view) return null;
  const crew = ready.planner_defaults.crew_slots;
  const used = slotsUsed(status);
  const carried = carriedSearch(search);
  const rows = fleet.status === "ready" ? fleet.data.rows : fleet.status === "error" ? [] : null; // a failed lookup only leaves the chance blank
  const assetHref = (id: number) => {
    const p = new URLSearchParams(carried);
    p.set("machine", String(id));
    return `/asset-details?${p.toString()}`;
  };
  const schedule = (id: number) => {
    if (used >= crew) {
      setFull(true);
      return;
    }
    setFull(false);
    setStatus(id, "scheduled");
  };
  return (
    <section aria-labelledby="my-jobs" className={card} data-testid="job-list">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="my-jobs" className="m-0 text-lg leading-7 font-semibold">
          My jobs
        </h2>
        <span className="text-sm font-semibold" data-testid="slots-used">
          Slots used: {used} of {crew}
        </span>
        <Button
          onClick={() => {
            setFull(false);
            reset();
          }}
        >
          Reset demo
        </Button>
      </div>
      {jobs.length === 0 ? (
        <div data-testid="no-jobs">
          <p className="mt-2 mb-0 text-sm">No jobs yet. Add one from an alert on Overview or from an asset page.</p>
          <Link href={`/${carried}`} className="flex min-h-11 w-fit items-center text-sm font-semibold">
            Go to Overview
          </Link>
        </div>
      ) : rows === null ? (
        <Skeleton className="mt-3 h-24 w-full" label="Loading your jobs" />
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Jobs you added, with their status and actions.</caption>
            <thead>
              <tr>
                <th scope="col" className={th}>Asset</th>
                <th scope="col" className={th}>Chance of failure, next 24 h</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((id) => {
                const r = rows.find((x) => x.machine_id === id);
                const label = jobLabel(status[id]);
                return (
                  <tr key={id} className="border-b border-line" data-testid="job-row">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <Link href={assetHref(id)}>{machineName(id)}</Link>
                    </th>
                    <td className="tabular px-3 py-2">
                      {r ? (
                        <>
                          {percent(r.score)} <StatusTag status={r.status} /> <ValueLabel kind="Predicted" />
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold" data-testid="job-status">
                      {label}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {label === "Added" && <Button onClick={() => schedule(id)}>Schedule<span className="sr-only">: {machineName(id)}</span></Button>}
                        {label === "Scheduled" && (
                          <>
                            <Button variant="primary" onClick={() => setStatus(id, "done")}>
                              Mark done<span className="sr-only">: {machineName(id)}</span>
                            </Button>
                            <Button onClick={() => setStatus(id, null)}>Unschedule<span className="sr-only">: {machineName(id)}</span></Button>
                          </>
                        )}
                        {label === "Done" && <Button onClick={() => setStatus(id, "scheduled")}>Reopen<span className="sr-only">: {machineName(id)}</span></Button>}
                        <Button onClick={() => remove(id)}>Remove<span className="sr-only">: {machineName(id)}</span></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {full && (
        <p role="alert" className="mt-2 mb-0 text-sm text-alert-text" data-testid="slots-full">
          All {crew} slots in this window are taken. Mark a job done or unschedule one first.
        </p>
      )}
      <p className="mt-2 mb-0 text-xs text-ink-2">
        Jobs and their status are kept in this browser only, and do not change when the simulated plant time moves. Slots per window start at the planner&rsquo;s default ({crew}); this demo does not book real crews.
      </p>
    </section>
  );
}
