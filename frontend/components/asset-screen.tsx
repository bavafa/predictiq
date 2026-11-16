"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { PastEstimatesChart, SensorCharts } from "@/components/asset-charts";
import { ComponentPanel } from "@/components/component-panel";
import { useData } from "@/components/data-provider";
import { StatusTag } from "@/components/fleet-table";
import { NoModelData, PanelError, Skeleton } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Definition } from "@/components/definition";
import { ValueLabel } from "@/components/value-label";
import { CAVEAT_LINE, effectWord, inputName, recentFirst, rowHour, sameAnswer, signed } from "@/lib/asset";
import { percent } from "@/lib/fleet";
import { machineName } from "@/lib/machine-types";
import { parseHour, readableHour } from "@/lib/time";
import type { ApiError } from "@/lib/api";
import type { Asset, Explanation, Fleet, MachineModel, Range, Telemetry } from "@/lib/types";
import { carriedSearch, machineCount } from "@/lib/url-state";
import { useApiQuery, useSettledSet } from "@/lib/use-api-query";
import { useJobs } from "@/lib/jobs";
import { useStoredFlag } from "@/lib/stored-flag";
import { rankByCost } from "@/components/alerts-screen";
import { check, defaultFields } from "@/lib/planner";
import { windowText } from "@/lib/component-planner";
import type { ComponentPart, MachineComponents, PlanResponse, ReadyMetadata } from "@/lib/types";
import { latestErrorText } from "@/components/fleet-table";
import { machineType } from "@/lib/machine-types";

const card = "rounded-lg border border-line bg-card p-4 sm:p-5";
const h2 = "m-0 text-lg leading-7 font-semibold";

const hourText = (t: string) => {
  const h = parseHour(t.slice(0, 16));
  return h === null ? t : readableHour(h);
};

export function AssetScreen() {
  const { meta, view } = useData();
  if (meta.status !== "ready" || !view) return null;
  const total = machineCount(meta.meta);
  if (view.machine.kind === "none") return <NoMachine total={total} />;
  if (view.machine.kind === "out-of-range") return <NotFound text={view.machine.text} total={total} />;
  return <AssetBody key={view.machine.id} id={view.machine.id} total={total} modelVersion={meta.meta.model_version} />;
}

// --- machine picker and the two "no machine" states -----------------------------------------------------------

function useFleetHref() {
  const { search } = useData();
  const params = new URLSearchParams(carriedSearch(search));
  params.delete("machine");
  const text = params.toString();
  return text ? `/assets?${text}` : "/assets";
}

function MachineSelect({ selected, total }: { selected: number | null; total: number }) {
  const { meta, update } = useData();
  const id = useId();
  const machines = meta.status === "ready" ? (meta.meta.machines ?? []) : [];
  const options = machines.length > 0 ? machines : Array.from({ length: total }, (_, i) => ({ machine_id: i + 1, model: "" as MachineModel | "" }));
  return (
    <label htmlFor={id} className="flex min-w-0 items-center gap-2 text-sm font-semibold">
      Machine
      <select
        id={id}
        value={selected === null ? "" : String(selected)}
        onChange={(e) => update({ machine: e.target.value === "" ? null : Number(e.target.value) })}
        className="min-h-11 max-w-56 min-w-0 rounded-md border border-input-edge bg-card px-2 text-sm font-normal"
      >
        {selected === null && <option value="">Choose a machine</option>}
        {options.map((m) => (
          <option key={m.machine_id} value={m.machine_id}>
            {machineName(m.machine_id)}
            {m.model ? ` · ${m.model}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function BackToFleet() {
  const href = useFleetHref();
  return (
    <Link href={href} className="inline-flex min-h-11 items-center text-sm text-link underline">
      ‹ Back to assets
    </Link>
  );
}

function NoMachine({ total }: { total: number }) {
  return (
    <section data-testid="no-machine" className={`${card} flex flex-col gap-3`} aria-labelledby="no-machine-title">
      <h2 id="no-machine-title" className={h2}>
        Choose a machine to see its history and risk
      </h2>
      <p className="m-0 text-sm text-ink-2">
        Pick one of the {total} machines in the sample, or open one from the ranked table on Assets.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <MachineSelect selected={null} total={total} />
        <BackToFleet />
      </div>
    </section>
  );
}

function NotFound({ text, total }: { text: string; total: number }) {
  return (
    <section data-testid="machine-not-found" className={`${card} flex flex-col gap-3 border-l-4 border-l-alert-edge`} aria-labelledby="nf-title">
      <h2 id="nf-title" className={h2}>
        {text === "" ? "That machine isn't in the sample data." : `Machine ${text} isn't in the sample data.`}
      </h2>
      <p className="m-0 text-sm text-ink-2">The sample has machines numbered 1 to {total}.</p>
      <div className="flex flex-wrap items-center gap-4">
        <MachineSelect selected={null} total={total} />
        <BackToFleet />
      </div>
    </section>
  );
}

// --- the machine screen ---------------------------------------------------------------------------------------

type Panel<T> = { data: T | null; error: ApiError | null };
type Shown = { asset: Panel<Asset>; telemetry: Panel<Telemetry>; explanation: Panel<Explanation> };

function AssetBody({ id, total, modelVersion }: { id: number; total: number; modelVersion: string }) {
  const { client, view } = useData();
  const v = view!;
  const { at, cutoff } = v;
  const [range, setRange] = useState<Range>("24h");
  const fleetHref = useFleetHref();

  const asset = useApiQuery<Asset>((signal) => client.asset(id, { at, cutoff }, { signal }), [client, modelVersion, id, at, cutoff]);
  const telemetry = useApiQuery((signal) => client.telemetry(id, { at, range }, { signal }), [client, modelVersion, id, at, range]);
  const explanation = useApiQuery<Explanation>((signal) => client.explanation(id, { at }, { signal }), [client, modelVersion, id, at]);

  // Score, factors, charts and records are shown from one settled set: the same hour, cut-off, range and
  // model version. While the next set loads, the last one stays, dimmed, with its own hour label.
  const assetD = asset.status === "ready" ? asset.data : null;
  const telD = telemetry.status === "ready" ? telemetry.data : null;
  const expD = explanation.status === "ready" ? explanation.data : null;
  const assetE = asset.status === "error" ? asset.error : null;
  const telE = telemetry.status === "error" ? telemetry.error : null;
  const expE = explanation.status === "error" ? explanation.error : null;
  const candidate = useMemo<Shown | null>(() => {
    const a: Panel<Asset> | null = assetD
      ? sameAnswer(assetD, { at, cutoff, modelVersion }) && assetD.machine_id === id ? { data: assetD, error: null } : null
      : assetE ? { data: null, error: assetE } : null;
    const t: Panel<Telemetry> | null = telD
      ? sameAnswer(telD, { at, modelVersion }) && telD.range === range && telD.machine_id === id ? { data: telD, error: null } : null
      : telE ? { data: null, error: telE } : null;
    const e: Panel<Explanation> | null = expD
      ? sameAnswer(expD, { at, modelVersion }) && expD.machine_id === id ? { data: expD, error: null } : null
      : expE ? { data: null, error: expE } : null;
    return a && t && e ? { asset: a, telemetry: t, explanation: e } : null;
  }, [assetD, telD, expD, assetE, telE, expE, at, cutoff, range, modelVersion, id]);
  const { shown, current } = useSettledSet(candidate);
  const assetData = shown?.asset.data ?? null;
  const busy = !current;
  // Whole-page outcomes: model data missing, or the machine isn't there.
  const first = [asset, telemetry, explanation].find((q) => q.status === "error");
  if (first && first.status === "error" && first.error.kind === "no-model-data") return <NoModelData />;
  if (asset.status === "error" && asset.error.kind === "not-found") return <NotFound text={String(id)} total={total} />;

  const assetQ = { error: shown?.asset.error ?? null, retry: asset.retry };
  const hourLabel = hourText(assetData?.at ?? at);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Machine and range" className={`${card} flex flex-wrap items-center gap-x-5 gap-y-3`}>
        <BackToFleet />
        <MachineSelect selected={id} total={total} />
        <div className="flex flex-wrap items-center gap-2">
          <span id="range-label" className="text-sm font-semibold">
            Range
          </span>
          <div role="radiogroup" aria-labelledby="range-label" className="flex gap-2">
            {(["24h", "7d"] as const).map((r) => (
              <Button key={r} role="radio" aria-checked={range === r} variant={range === r ? "primary" : "outline"} onClick={() => setRange(r)}>
                {r === "24h" ? "24 h" : "7 days"}
              </Button>
            ))}
          </div>
        </div>
        <span className="text-sm text-ink-2" data-testid="cutoff-readout">
          Alert cut-off: {cutoff}% (shared; change it on{" "}
          <Link href={fleetHref} className="inline-flex min-h-11 min-w-11 items-center justify-center text-link underline">
            Assets
          </Link>
          )
        </span>
      </section>

      <FactsPanel query={assetQ} data={assetData} id={id} />
      <div className="grid gap-4 md:grid-cols-2">
        <ScorePanel query={assetQ} data={assetData} hourLabel={hourLabel} busy={busy} />
        <WhyFlagged asset={assetData} explanation={shown?.explanation.data ?? null} />
      </div>

      <WhatToCheck id={id} at={at} modelVersion={modelVersion} />

      <ComponentPanel id={id} at={at} modelVersion={modelVersion} />

      <section aria-labelledby="sensors-title" className={card}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="sensors-title" className={h2}>
            Sensor history, up to the simulated plant time
          </h2>
          <ValueLabel kind="Historical" />
        </div>
        <p className="mt-1 mb-3 text-sm text-ink-2">One reading per hour, from before the simulated plant time. The source gives no units, so the axes just say reading. Markers: ◆ recorded failure · ■ repair · ▲ error.</p>
        {shown?.telemetry.error ? (
          <PanelError testId="sensor-error" message="Couldn't load the sensor history for this machine." onRetry={telemetry.retry} />
        ) : !shown?.telemetry.data ? (
          <Skeleton className="h-72 w-full" label="Loading the sensor history" />
        ) : (
          <div className={busy ? "opacity-60" : undefined} aria-busy={busy}>
            <SensorCharts telemetry={shown.telemetry.data} asset={assetData} range={shown.telemetry.data.range} />
          </div>
        )}
      </section>

      <section aria-label="Past estimates" className="flex flex-col gap-4">
        {shown?.asset.error ? (
          <PanelError testId="asset-error-chart" message="Couldn't load the past estimates for this machine." onRetry={asset.retry} />
        ) : assetData === null ? (
          <Skeleton className="h-72 w-full" label="Loading the past estimates" />
        ) : (
          <div className={busy ? "opacity-60" : undefined}>
            <PastEstimatesChart asset={assetData} range={shown?.telemetry.data?.range ?? range} />
          </div>
        )}
      </section>

      <HistoryList query={assetQ} data={assetData} busy={busy} />

      <ModelDetails>
        <ExplanationPanel error={shown?.explanation.error ?? null} retry={explanation.retry} data={shown?.explanation.data ?? null} dim={busy} />
      </ModelDetails>
    </div>
  );
}

type Q = { error: ApiError | null; retry: () => void };

function usePriority(id: number, enabled: boolean): { n: number; of: number } | null {
  const { client, meta, view } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const { dismissed } = useJobs();
  const fleet = useApiQuery<Fleet>(
    (signal) => (enabled && view ? client.fleet({ at: view.at, cutoff: view.cutoff }, { signal }) : Promise.reject(new Error("off"))),
    [client, ready?.model_version, enabled, view?.at, view?.cutoff],
  );
  const inputs = ready ? (() => { const c = check(defaultFields(ready as ReadyMetadata)); return c.ok ? c.inputs : null; })() : null;
  const inputsKey = JSON.stringify(inputs);
  const plan = useApiQuery<PlanResponse | null>(
    (signal) => (enabled && view && inputs ? client.plan({ at: view.at, cutoff_percent: view.cutoff, ...inputs }, { signal }) : Promise.resolve(null)),
    [client, ready?.model_version, enabled, view?.at, view?.cutoff, inputsKey],
  );
  if (fleet.status !== "ready" || plan.status === "loading" || !Array.isArray(fleet.data?.rows)) return null; // a failed side lookup never breaks the page
  const open = fleet.data.rows.filter((r) => r.status === "alert" && !dismissed.includes(r.machine_id));
  const ranked = rankByCost(open, plan.status === "ready" && Array.isArray(plan.data?.rows) ? plan.data : null).rows;
  const i = ranked.findIndex((r) => r.machine_id === id);
  return i < 0 ? null : { n: i + 1, of: ranked.length };
}

function FactsPanel({ query, data, id }: { query: Q; data: Asset | null; id: number }) {
  const { jobs, dismissed, add, dismiss } = useJobs();
  const { search, meta } = useData();
  const priority = usePriority(id, data?.status === "alert");
  const alertsHref = `/alerts${carriedSearch(search)}`;
  const plan = `/maintenance-planner${carriedSearch(search)}`;
  const added = jobs.includes(id);
  const gone = dismissed.includes(id);
  const alert = data?.status === "alert";
  const recentRepairs = data ? recentFirst(data.repairs, data.at).length : 0;
  return (
    <section className={card} aria-labelledby="facts-title" data-testid="facts">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={alertsHref} className="inline-flex min-h-11 items-center text-sm font-semibold">
            <span aria-hidden="true">←&nbsp;</span>All alerts
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="facts-title" className={h2}>
              {machineName(id)}
            </h2>
            {priority && (
              <span className="text-sm font-semibold text-ink-2" data-testid="priority">
                Priority {priority.n} of {priority.of}
              </span>
            )}
            <span className="text-xs text-ink-2">
              Machine {id} of {meta.status === "ready" ? machineCount(meta.meta) : "—"}
            </span>
          </div>
          {query.error ? (
            <PanelError testId="asset-error-facts" message="Couldn't load this machine's details." onRetry={query.retry} />
          ) : data === null ? (
            <Skeleton className="mt-2 h-10 w-72" label="Loading the machine details" />
          ) : (
            <>
              <p className="mt-2 mb-1 text-sm">
                {machineType(id)} · Machine model <strong data-testid="fact-model">{data.model}</strong> · Age{" "}
                <strong data-testid="fact-age">{data.age}</strong> {data.age === 1 ? "year" : "years"} · {recentRepairs === 0 ? "no repairs" : `${recentRepairs} ${recentRepairs === 1 ? "repair" : "repairs"}`} in the past 7 days
              </p>
              <p className="m-0 text-sm text-ink-2">
                <ValueLabel kind="Historical" /> from the simulated sample data
              </p>
            </>
          )}
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-2.5">
            {alert && (gone ? <span className="text-sm text-ink-2" data-testid="dismissed-note">Alert dismissed (kept in this browser only).</span> : <Button onClick={() => dismiss(id)}>Dismiss alert</Button>)}
            {added ? (
              <Link href={plan} className={cn(buttonVariants(), "no-underline")}>
                <span aria-hidden="true">✓</span> In work plan
              </Link>
            ) : (
              <Button variant="primary" onClick={() => add(id)}>
                Add to work plan
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** "Why it is flagged": the biggest upward pushes and the latest error, in sentences. Patterns, not causes. */
function WhyFlagged({ asset, explanation }: { asset: Asset | null; explanation: Explanation | null }) {
  const alert = asset?.status === "alert";
  const ups = (explanation?.contributions ?? []).filter((c) => c.contribution > 0).sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  const last = asset ? recentFirst(asset.errors, asset.at)[0] : undefined;
  return (
    <section className={card} aria-labelledby="flag-title" data-testid="why-flagged">
      <h2 id="flag-title" className={h2}>
        {alert ? "Why it is flagged" : "What the model sees"}
      </h2>
      {asset === null || explanation === null ? (
        <Skeleton className="mt-2 h-20 w-full" label="Loading why this machine is flagged" />
      ) : ups.length === 0 && !last ? (
        <p className="mt-2 mb-0 text-sm">No input is pushing this machine&rsquo;s estimate up at this hour.</p>
      ) : (
        <ul className="mt-2 mb-0 list-disc pl-5 text-sm leading-6">
          {ups.map((c) => (
            <li key={c.feature}>{inputName(c.feature).name} pushed the estimate up.</li>
          ))}
          {last && <li>Latest error record: {latestErrorText(last)}.</li>}
        </ul>
      )}
      <p className="mt-2 mb-0 text-xs text-ink-2" data-testid="why-caveat">
        {CAVEAT_LINE}
      </p>
    </section>
  );
}

function ScorePanel({ query, data, hourLabel, busy }: { query: Q; data: Asset | null; hourLabel: string; busy: boolean }) {
  return (
    <section className={`${card}${busy ? " opacity-60" : ""}`} aria-labelledby="score-title" data-testid="score-panel" aria-busy={busy}>
      <h2 id="score-title" className={h2}>
        Predicted chance of a recorded failure in the next 24 hours
      </h2>
      {query.error ? (
        <PanelError testId="asset-error-score" message="Couldn't load this machine's predicted chance." onRetry={query.retry} />
      ) : data === null ? (
        <Skeleton className="mt-2 h-16 w-full" label="Loading the predicted chance" />
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="tabular text-[32px] leading-10 font-bold" data-testid="asset-score">
              {percent(data.score)}
            </span>
            <span data-testid="asset-status" data-status={data.status}>
              <StatusTag status={data.status} />
            </span>
            <ValueLabel kind="Predicted" />
          </div>
          <p className="mt-2 mb-0 text-sm text-ink-2">
            Scored at the simulated plant time, {hourLabel}. Uses only records from before this hour. Act today starts at {data.cutoff_percent}%. Model version {data.model_version}.
          </p>
        </>
      )}
    </section>
  );
}

// --- what pushed the estimate ---------------------------------------------------------------------------------

function ExplanationPanel({ error, retry, data, dim }: { error: ApiError | null; retry: () => void; data: Explanation | null; dim: boolean }) {
  return (
    <section className={card} aria-labelledby="why-title" data-testid="explanation">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="why-title" className={`${h2} flex items-center gap-1`}>
          What pushed this estimate up or down
          <Definition
            name="the pushes"
            text="Each input pushed this machine's estimate up or down for this hour. A longer bar means a bigger push. The exact numbers are in log-odds, the scale the model works in (0 means no push); show them with the button under the heading."
          />
        </h2>
        <ValueLabel kind="Predicted" />
      </div>
      <p className="mt-1 mb-3 text-sm" data-testid="caveat">
        {CAVEAT_LINE}
      </p>
      {error ? (
        <PanelError testId="explanation-error" message="Couldn't load what pushed this estimate." onRetry={retry} />
      ) : data === null ? (
        <Skeleton className="h-64 w-full" label="Loading what pushed this estimate" />
      ) : (
        <ExplanationTable e={data} dim={dim} />
      )}
    </section>
  );
}

function ExplanationTable({ e, dim }: { e: Explanation; dim: boolean }) {
  const [exact, setExact] = useState(false);
  const rows = [
    ...e.contributions.map((c) => ({ key: c.feature, ...inputName(c.feature), push: c.contribution })),
    { key: "others", name: "All other inputs combined", meaning: "The sum of the pushes of every input not listed above.", push: e.all_others },
  ];
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.push)));
  const th = "border-b border-line bg-subtle px-3 py-2 text-left text-xs font-semibold text-ink-2";
  return (
    <div className={dim ? "opacity-60" : undefined} aria-busy={dim}>
      <div className="mb-2">
        <Button aria-pressed={exact} onClick={() => setExact((v) => !v)}>
          {exact ? "Hide exact numbers" : "Show exact numbers"}
        </Button>
      </div>
      <table className="w-full border-collapse text-sm" data-testid="explanation-table">
        <caption className="sr-only">
          The eight inputs that pushed this machine&rsquo;s estimate the most, and all others combined. Each row says whether the input raises or
          lowers the chance of a failure. Patterns, not causes.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={th}>Input</th>
            <th scope="col" className={th}>Effect on the chance (longer bar = bigger push)</th>
            {exact && <th scope="col" className={`${th} text-right`}>Exact push (log-odds)</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} data-testid="explanation-row" className="border-b border-line">
              <th scope="row" className="px-3 py-1 text-left font-normal">
                {r.name}
                <Definition name={r.name} text={r.meaning} />
              </th>
              <td className="px-3 py-1">
                <span className="whitespace-nowrap">
                  <span aria-hidden="true">{r.push > 0 ? "▲" : r.push < 0 ? "▼" : "–"}</span> {effectWord(r.push)}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 hidden h-2 bg-ink-2 sm:block"
                  style={{ width: `${Math.max(2, (Math.abs(r.push) / max) * 100)}%` }}
                />
              </td>
              {exact && <td className="tabular px-3 py-1 text-right">{signed(r.push)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- recent records -------------------------------------------------------------------------------------------

type HistoryItem = { time: string; kind: "error" | "repair" | "failure"; text: string };

/** One list of everything recorded for the machine in the 7 days before the simulated plant time, newest first. */
function HistoryList({ query, data, busy }: { query: Q; data: Asset | null; busy: boolean }) {
  const at = data?.at ?? "";
  const items: HistoryItem[] =
    data === null
      ? []
      : [
          ...recentFirst(data.errors, at).map((e) => ({ time: e.time, kind: "error" as const, text: `Error record: ${e.error}` })),
          ...recentFirst(data.repairs, at).map((r) => ({ time: r.time, kind: "repair" as const, text: `Component ${r.component.replace(/^comp/, "")} replaced (${r.component})` })),
          ...recentFirst(data.failures, at).map((f) => ({ time: f.time, kind: "failure" as const, text: `Recorded failure: ${f.components.join(", ")}` })),
        ].sort((a, b) => b.time.localeCompare(a.time));
  return (
    <section className={`${card}${busy ? " opacity-60" : ""}`} aria-labelledby="history-title" data-testid="history-list" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="history-title" className={h2}>
          History, 7 days up to the simulated plant time
        </h2>
        <ValueLabel kind="Historical" />
      </div>
      {query.error ? (
        <PanelError testId="history-error" message="Couldn't load the history for this machine." onRetry={query.retry} />
      ) : data === null ? (
        <Skeleton className="mt-2 h-24 w-full" label="Loading the history" />
      ) : items.length === 0 ? (
        <p className="mt-2 mb-0 text-sm">No errors, repairs or recorded failures in the 7 days up to this time.</p>
      ) : (
        <ul className="mt-2 mb-0 list-none pl-0 text-sm leading-6">
          {items.map((i, n) => (
            <li key={`${i.time}-${i.kind}-${n}`} data-record-time={i.time} data-kind={i.kind}>
              {i.kind === "failure" && (
                <>
                  <span aria-hidden="true" className="text-[#b91c1c]">◆ </span>
                  <span className="inline-block rounded-sm bg-[#fee2e2] px-1.5 font-semibold text-[#991b1b]">Recorded failure</span>{" "}
                </>
              )}
              <time dateTime={rowHour(i.time)}>{hourText(i.time)}</time> · {i.kind === "failure" ? i.text.replace("Recorded failure: ", "") : i.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 mb-0 text-xs text-ink-2">
        Lists only records from before the simulated plant time, the same rule the model follows. Simulated sample data. Recorded failures are shown so you can
        see whether the estimate rose before one.
      </p>
    </section>
  );
}

/** "Model details": the full table of what pushed the estimate, closed until asked for. */
function ModelDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useStoredFlag("piq-model-details"); // remembered for the visitor, like the Time controls panel
  return (
    <section className="flex flex-col gap-3">
      <Button aria-expanded={open} aria-controls="model-details" className="h-auto max-w-full self-start py-2 text-left whitespace-normal" onClick={() => setOpen(!open)}>
        Model details: what pushed the estimate up or down
      </Button>
      <div id="model-details" hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}

/** "What to check first": only while a part has an active 48-hour warning (decision 85). Nothing otherwise. */
function WhatToCheck({ id, at, modelVersion }: { id: number; at: string; modelVersion: string }) {
  const { client, meta } = useData();
  const info = meta.status === "ready" ? (meta.meta.component_planner ?? null) : null;
  const q = useApiQuery<MachineComponents | null>(
    (signal) => (info ? client.components(id, { at }, { signal }) : Promise.resolve(null)),
    [client, modelVersion, id, at, !!info],
  );
  if (q.status !== "ready" || !q.data) return null;
  const warned = q.data.parts.filter((p: ComponentPart) => p.warning_active).sort((a, b) => b.warning_chance_48h - a.warning_chance_48h)[0];
  if (!warned) return null;
  return (
    <section className={card} aria-labelledby="check-title" data-testid="what-to-check">
      <h2 id="check-title" className={h2}>
        What to check first
      </h2>
      <p className="mt-2 mb-1 text-sm leading-6">
        Inspect the <strong>{warned.part_name.toLowerCase()}</strong>. Its 48-hour warning is active: {percent(warned.warning_chance_48h)} chance within 48 hours,
        {" "}
        next shutdown window {windowText(q.data.window_start)} (assumed).
      </p>
      <p className="m-0 text-xs text-ink-2">Based on patterns in past data, not a diagnosis. Part names are assumed.</p>
    </section>
  );
}
