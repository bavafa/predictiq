"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { CutoffControl } from "@/components/cutoff-control";
import { useData } from "@/components/data-provider";
import { ChartSkeleton, DistributionChart, TrendChart } from "@/components/fleet-charts";
import { FleetTable } from "@/components/fleet-table";
import { NoModelData, ServiceError, Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ValueLabel } from "@/components/value-label";
import { ApiError } from "@/lib/api";
import { sameAnswer } from "@/lib/asset";
import { DEFAULT_SORT, describeFilters, percent, type Sort } from "@/lib/fleet";
import { readableHour, parseHour } from "@/lib/time";
import type { Fleet, FleetTrend, MachineModel, Range, Status } from "@/lib/types";
import { MACHINE_MODELS, STATUSES, machineCount } from "@/lib/url-state";
import { useApiQuery, useSettledSet } from "@/lib/use-api-query";

const GUIDE_KEY = "predictiq-hide-guide";

const guideListeners = new Set<() => void>();
const subscribeGuide = (cb: () => void) => {
  guideListeners.add(cb);
  return () => void guideListeners.delete(cb);
};
const readGuideHidden = () => {
  try {
    return window.sessionStorage.getItem(GUIDE_KEY) === "1";
  } catch {
    return false; // storage not available: the guide simply shows
  }
};

function Guide() {
  const hidden = useSyncExternalStore(subscribeGuide, readGuideHidden, () => false);
  if (hidden) return null;
  return (
    <section aria-labelledby="guide-title" data-testid="guide" className="rounded-lg border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="guide-title" className="m-0 text-lg leading-7 font-semibold">
          New here? Three steps, about 90 seconds
        </h2>
        <Button
          onClick={() => {
            try {
              window.sessionStorage.setItem(GUIDE_KEY, "1");
            } catch {
              /* ignore */
            }
            guideListeners.forEach((l) => l());
          }}
        >
          Hide guide
        </Button>
      </div>
      <ol className="mt-2 mb-0 list-decimal pl-5 text-sm leading-6">
        <li>
          Press <strong>Play</strong> to replay the simulated machine history hour by hour.
        </li>
        <li>Open the top machine in the table to see its sensors and what pushed its estimate up.</li>
        <li>
          Open the <strong>Maintenance Planner</strong>, open &ldquo;Set cost per machine model&rdquo; and give one machine model a higher
          illustrative failure cost. Machines of that model move up the list, with &ldquo;moved up&rdquo; marks.
        </li>
      </ol>
    </section>
  );
}

function Card({ label, children, note }: { label: string; children: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-card p-4 sm:p-5">
      <div className="text-sm font-semibold">{label}</div>
      <div className="tabular mt-1 text-[28px] leading-9 font-bold">{children}</div>
      <div className="mt-1 text-sm leading-5 text-ink-2">{note}</div>
    </div>
  );
}

type Filters = { machine_model: MachineModel | null; status: Status | null; machine_number: number | null };

export function FleetScreen() {
  const { client, meta, view } = useData();
  if (meta.status !== "ready" || !view) return null;
  return <FleetBody client={client} total={machineCount(meta.meta)} modelVersion={meta.meta.model_version} />;
}

type Shown = { fleet: Fleet; trend: FleetTrend | null; trendError: ApiError | null };

function FleetBody({ client, total, modelVersion }: { client: ReturnType<typeof useData>["client"]; total: number; modelVersion: string }) {
  const { view, update } = useData();
  const v = view!;
  const { at, cutoff, filters } = v;
  const [range, setRange] = useState<Range>("24h");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  // A new view (other cut-off or filters) goes back to the first page.
  const viewKey = `${cutoff}|${filters.machine_model}|${filters.status}|${filters.machine_number}`;
  const [pageState, setPageState] = useState({ key: viewKey, page: 1 });
  const page = pageState.key === viewKey ? pageState.page : 1;
  const setPage = (p: number) => setPageState({ key: viewKey, page: p });
  const [announcement, setAnnouncement] = useState("");
  const [cutoffNote, setCutoffNote] = useState<number | null>(null);
  const pending = useRef<"cutoff" | "filters" | null>(null);
  const sawLoading = useRef(false);

  const query = {
    at,
    cutoff,
    machine_model: filters.machine_model ?? undefined,
    status: filters.status ?? undefined,
    machine: filters.machine_number ?? undefined,
  };
  const deps = [client, modelVersion, at, cutoff, filters.machine_model, filters.status, filters.machine_number] as const;
  const fleet = useApiQuery<Fleet>((signal) => client.fleet(query, { signal }), deps);
  const trend = useApiQuery((signal) => client.fleetTrend({ ...query, range }, { signal }), [...deps, range]);

  // Announce once after a cut-off or filter change, when the new numbers are in.
  useEffect(() => {
    if (pending.current === null) return;
    // The first render after a change still holds the old answer; wait until the new request has run.
    if (fleet.status === "loading") sawLoading.current = true;
    if (fleet.status !== "ready" || !sawLoading.current) return;
    sawLoading.current = false;
    const c = fleet.data.cards;
    setAnnouncement(
      pending.current === "cutoff"
        ? `Cut-off ${cutoff} percent. ${c.machines_in_alert} ${c.machines_in_alert === 1 ? "machine is" : "machines are"} in Alert.`
        : `${c.machines_shown} ${c.machines_shown === 1 ? "machine matches" : "machines match"}. ${c.machines_in_alert} in Alert.`,
    );
    pending.current = null;
  }, [fleet, cutoff]);

  // Everything on screen comes from one settled set: the cards, charts and table of one fleet answer and the
  // trend for the same hour, cut-off and model version. While the next set loads, the last one stays,
  // dimmed, with its own labels.
  const fleetData = fleet.status === "ready" ? fleet.data : null;
  const trendData = trend.status === "ready" ? trend.data : null;
  const trendError = trend.status === "error" ? trend.error : null;
  const candidate = useMemo<Shown | null>(() => {
    if (!fleetData || !sameAnswer(fleetData, { at, cutoff, modelVersion })) return null;
    if (trendData && sameAnswer(trendData, { at, cutoff, modelVersion }) && trendData.range === range) {
      return { fleet: fleetData, trend: trendData, trendError: null };
    }
    if (trendError) return { fleet: fleetData, trend: null, trendError };
    return null;
  }, [fleetData, trendData, trendError, at, cutoff, modelVersion, range]);
  const { shown, current } = useSettledSet(candidate);
  const data = shown?.fleet ?? null;
  const busy = !current;
  const filterWords = describeFilters(filters);
  const hourLabel = (() => {
    const text = data?.at ?? at;
    const h = parseHour(text.slice(0, 16));
    return h === null ? text : readableHour(h);
  })();

  return (
    <div className="flex flex-col gap-4">
      <Guide />

      <section aria-label="Alert cut-off and filters" className="rounded-lg border border-line bg-card p-4 sm:p-5">
        <CutoffControl
          onChanged={(c) => {
            pending.current = "cutoff";
            setCutoffNote(c);
          }}
        />
        <FilterBar
          filters={filters}
          total={total}
          onChange={(changes) => {
            pending.current = "filters";
            update(changes);
          }}
        />
      </section>

      {cutoffNote !== null && (
        <p role="note" data-testid="cutoff-note" className="m-0 rounded-lg border border-l-4 border-input-edge bg-card px-4 py-3 text-sm">
          {current && data
            ? `Cut-off changed to ${data.cutoff_percent}%. Cards, tags, chart line and table updated together. ${data.cards.machines_in_alert} machines in Alert.`
            : `Cut-off changed to ${cutoff}%. Updating the cards, tags, chart line and table.`}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite" data-testid="fleet-announcer">
        {announcement}
      </p>

      {fleet.status === "error" ? (
        fleet.error.kind === "no-model-data" ? (
          <NoModelData />
        ) : (
          <ServiceError what={`the fleet at ${hourLabel}`} error={fleet.error as ApiError} onRetry={fleet.retry} />
        )
      ) : data === null ? (
        <FleetSkeleton />
      ) : (
        <div className={busy ? "flex flex-col gap-4 opacity-60" : "flex flex-col gap-4"} aria-busy={busy} data-testid="fleet-ready">
          <Cards fleet={data} total={total} hourLabel={hourLabel} />
          <div className="grid gap-4 lg:grid-cols-2">
            <DistributionChart fleet={data} shownOf={total} />
            {shown?.trendError ? (
              <ServiceError what="the Alert trend" error={shown.trendError} onRetry={trend.retry} />
            ) : shown?.trend ? (
              <TrendChart trend={shown.trend} range={shown.trend.range} onRange={setRange} shownOf={total} />
            ) : (
              <ChartSkeleton label="Loading the Alert trend" />
            )}
          </div>
          <section aria-labelledby="table-title" className="rounded-lg border border-line bg-card p-4 sm:p-5">
            <h2 id="table-title" className="m-0 text-lg leading-7 font-semibold">
              Machines ranked by predicted 24-hour risk
            </h2>
            {data.rows.length === 0 ? (
              <EmptyResult
                hourLabel={hourLabel}
                words={filterWords}
                total={total}
                onClear={() => {
                  pending.current = "filters";
                  update({ machine_model: null, status: null, machine_number: null });
                }}
              />
            ) : (
              <FleetTable rows={data.rows} total={data.rows.length} sort={sort} onSort={setSort} page={page} onPage={setPage} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Cards({ fleet, total, hourLabel }: { fleet: Fleet; total: number; hourLabel: string }) {
  const c = fleet.cards;
  const none = c.machines_shown === 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="cards">
      <Card
        label="Machines shown"
        note={
          <>
            <ValueLabel kind="Historical" /> {none ? `0 of ${total} match filters` : `of ${total}`}
          </>
        }
      >
        <span data-testid="card-shown">{c.machines_shown}</span>
      </Card>
      <Card
        label="Machines in Alert"
        note={
          <>
            <ValueLabel kind="Predicted" />{" "}
            {none ? "of the 0 machines shown" : `chance ≥ ${fleet.cutoff_percent}% cut-off, next 24 h, among machines shown`}
          </>
        }
      >
        <span data-testid="card-alert">{c.machines_in_alert}</span>
      </Card>
      <Card
        label="Highest predicted chance"
        note={
          <>
            <ValueLabel kind="Predicted" /> {none ? "no machines shown, so no highest value" : "of a recorded failure in 24 h, among machines shown"}
          </>
        }
      >
        <span data-testid="card-highest">{c.highest_score === null ? "None" : percent(c.highest_score)}</span>
      </Card>
      <Card label="Scored hour" note={<>Follows the replay time{none ? "; not affected by filters" : ""}. Simulated sample data.</>}>
        <span className="text-xl" data-testid="card-hour">
          {hourLabel}
        </span>
      </Card>
    </div>
  );
}

function EmptyResult({ hourLabel, words, total, onClear }: { hourLabel: string; words: string[]; total: number; onClear: () => void }) {
  return (
    <div data-testid="empty-result" className="mt-3 rounded-lg border border-dashed border-input-edge p-6 text-center">
      <p className="m-0 text-sm font-semibold">No machines match these filters at {hourLabel}.</p>
      <p className="mx-0 mt-1 mb-4 text-sm text-ink-2">
        Filters: {words.join(" and ")}. All cards and charts above count these 0 machines (0 of {total} match).
      </p>
      <Button variant="primary" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

function FleetSkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="fleet-loading">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" label="Loading the fleet summary" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartSkeleton label="Loading the risk chart" />
        <ChartSkeleton label="Loading the Alert trend" />
      </div>
      <Skeleton className="h-96 w-full" label="Loading the machine table" />
    </div>
  );
}

const selectClass = "min-h-11 rounded-md border border-input-edge bg-card px-2 text-sm font-normal";

function FilterBar({
  filters,
  total,
  onChange,
}: {
  filters: Filters;
  total: number;
  onChange: (c: { machine_model?: MachineModel | null; status?: Status | null; machine_number?: number | null }) => void;
}) {
  const id = useId();
  const [text, setText] = useState(filters.machine_number === null ? "" : String(filters.machine_number));
  const [bad, setBad] = useState(false);
  const typed = useRef(false);
  // The address changed from elsewhere (Clear filters, a link): follow it.
  useEffect(() => {
    if (typed.current) {
      typed.current = false;
      return;
    }
    setText(filters.machine_number === null ? "" : String(filters.machine_number));
    setBad(false);
  }, [filters.machine_number]);

  const any = filters.machine_model !== null || filters.status !== null || filters.machine_number !== null || text !== "";
  return (
    <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
      <label className="flex items-center gap-2 text-sm">
        Machine model
        <select
          className={selectClass}
          value={filters.machine_model ?? ""}
          onChange={(e) => onChange({ machine_model: MACHINE_MODELS.find((m) => m === e.target.value) ?? null })}
        >
          <option value="">All</option>
          {MACHINE_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        Status
        <select
          className={selectClass}
          value={filters.status ?? ""}
          onChange={(e) => onChange({ status: STATUSES.find((s) => s === e.target.value) ?? null })}
        >
          <option value="">All</option>
          <option value="alert">Alert</option>
          <option value="below_cutoff">Below cut-off</option>
        </select>
      </label>
      <div className="flex flex-col">
        <label className="flex items-center gap-2 text-sm">
          Machine number
          <input
            inputMode="numeric"
            placeholder={`1 to ${total}`}
            value={text}
            aria-invalid={bad}
            aria-describedby={bad ? `${id}-err` : undefined}
            className="min-h-11 w-28 rounded-md border border-input-edge bg-card px-2 text-sm"
            onChange={(e) => {
              const value = e.target.value.trim();
              setText(e.target.value);
              typed.current = true;
              if (value === "") {
                setBad(false);
                onChange({ machine_number: null });
              } else if (/^[0-9]{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= total) {
                setBad(false);
                onChange({ machine_number: Number(value) });
              } else {
                setBad(true);
                typed.current = false;
              }
            }}
          />
        </label>
        {bad && (
          <span id={`${id}-err`} role="alert" className="text-xs text-alert-text">
            Enter a machine number from 1 to {total}.
          </span>
        )}
      </div>
      <Button
        disabled={!any}
        onClick={() => {
          setText("");
          setBad(false);
          onChange({ machine_model: null, status: null, machine_number: null });
        }}
      >
        Clear filters
      </Button>
    </div>
  );
}
