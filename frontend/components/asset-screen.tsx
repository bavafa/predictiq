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
import type { Asset, Explanation, MachineModel, Range, Telemetry } from "@/lib/types";
import { carriedSearch, machineCount } from "@/lib/url-state";
import { useApiQuery, useSettledSet } from "@/lib/use-api-query";
import { useJobs } from "@/lib/jobs";
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

      <ExplanationPanel error={shown?.explanation.error ?? null} retry={explanation.retry} data={shown?.explanation.data ?? null} dim={busy} />

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

      <div className={busy ? "grid gap-4 opacity-60 md:grid-cols-2" : "grid gap-4 md:grid-cols-2"} aria-busy={busy}>
        <EventList kind="errors" query={assetQ} data={assetData} at={assetData?.at ?? at} />
        <EventList kind="repairs" query={assetQ} data={assetData} at={assetData?.at ?? at} />
      </div>
      {assetData && <FailureList asset={assetData} />}
    </div>
  );
}

type Q = { error: ApiError | null; retry: () => void };

function FactsPanel({ query, data, id }: { query: Q; data: Asset | null; id: number }) {
  const { jobs, dismissed, add, dismiss } = useJobs();
  const { search } = useData();
  const plan = `/maintenance-planner${carriedSearch(search)}`;
  const added = jobs.includes(id);
  const gone = dismissed.includes(id);
  const alert = data?.status === "alert";
  const recentRepairs = data ? recentFirst(data.repairs, data.at).length : 0;
  return (
    <section className={card} aria-labelledby="facts-title" data-testid="facts">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="facts-title" className={h2}>
            {machineName(id)}
          </h2>
          {query.error ? (
            <PanelError testId="asset-error-facts" message="Couldn't load this machine's details." onRetry={query.retry} />
          ) : data === null ? (
            <Skeleton className="mt-2 h-10 w-72" label="Loading the machine details" />
          ) : (
            <>
              <p className="mt-2 mb-1 text-sm">
                {machineType(id)} · Machine model <strong data-testid="fact-model">{data.model}</strong> · Age{" "}
                <strong data-testid="fact-age">{data.age}</strong> years · {recentRepairs === 0 ? "no repairs" : `${recentRepairs} ${recentRepairs === 1 ? "repair" : "repairs"}`} in the past 7 days
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
      <p className="mt-2 mb-0 text-xs text-ink-2">{CAVEAT_LINE}</p>
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
            Scored at the simulated plant time, {hourLabel}. Uses only records from before this hour. Alert means the chance is at or above the
            {" "}
            {data.cutoff_percent}% cut-off. Model version {data.model_version}.
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

function EventList({ kind, query, data, at }: { kind: "errors" | "repairs"; query: Q; data: Asset | null; at: string }) {
  const title = kind === "errors" ? "Recent errors (7 days up to simulated plant time)" : "Recent repairs (7 days up to simulated plant time)";
  const empty = kind === "errors" ? "No errors in the 7 days up to this time." : "No repairs in the 7 days up to this time.";
  const items =
    data === null
      ? []
      : kind === "errors"
        ? recentFirst(data.errors, at).map((e) => ({ time: e.time, text: e.error }))
        : recentFirst(data.repairs, at).map((r) => ({ time: r.time, text: `component ${r.component.replace(/^comp/, "")} replaced (${r.component})` }));
  const testId = `${kind}-list`;
  return (
    <section className={card} aria-labelledby={`${kind}-title`} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={`${kind}-title`} className={h2}>
          {title}
        </h2>
        <ValueLabel kind="Historical" />
      </div>
      {query.error ? (
        <PanelError testId={`${kind}-error`} message={`Couldn't load the recent ${kind} for this machine.`} onRetry={query.retry} />
      ) : data === null ? (
        <Skeleton className="mt-2 h-24 w-full" label={`Loading the recent ${kind}`} />
      ) : items.length === 0 ? (
        <p className="mt-2 mb-0 text-sm">{empty}</p>
      ) : (
        <ul className="mt-2 mb-0 list-disc pl-5 text-sm leading-6">
          {items.map((i, n) => (
            <li key={`${i.time}-${n}`} data-record-time={i.time}>
              <time dateTime={rowHour(i.time)}>{hourText(i.time)}</time> · {i.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 mb-0 text-xs text-ink-2">Lists only records from before the replay hour, the same rule the model follows.</p>
    </section>
  );
}

function FailureList({ asset }: { asset: Asset }) {
  const failures = recentFirst(asset.failures, asset.at);
  return (
    <section className={card} aria-labelledby="failures-title" data-testid="failures-list">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="failures-title" className={h2}>
          Recorded failures (7 days before simulated plant time)
        </h2>
        <ValueLabel kind="Historical" />
      </div>
      {failures.length === 0 ? (
        <p className="mt-2 mb-0 text-sm">No recorded failures in the 7 days up to this time.</p>
      ) : (
        <ul className="mt-2 mb-0 list-none pl-0 text-sm leading-6">
          {failures.map((f, n) => (
            <li key={`${f.time}-${n}`} data-record-time={f.time}>
              <span aria-hidden="true" className="text-[#b91c1c]">◆ </span>
              <span className="inline-block rounded-sm bg-[#fee2e2] px-1.5 font-semibold text-[#991b1b]">Recorded failure</span>{" "}
              <time dateTime={rowHour(f.time)}>{hourText(f.time)}</time> · {f.components.join(", ")}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 mb-0 text-xs text-ink-2">Simulated sample data. Shown beside the predicted chances above, to see whether the estimate rose before a failure.</p>
    </section>
  );
}
