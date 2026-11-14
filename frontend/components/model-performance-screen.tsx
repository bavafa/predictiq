"use client";

import { useMemo } from "react";

import { CutoffControl } from "@/components/cutoff-control";
import { useData } from "@/components/data-provider";
import { Definition } from "@/components/definition";
import {
  AlertsPerDayByCutoff,
  CalibrationChart,
  PrecisionRecallByCutoff,
  PrecisionRecallCurves,
} from "@/components/model-charts";
import { NoModelData, ResultsNotAvailable, ServiceError, Skeleton } from "@/components/states";
import { td, th } from "@/components/chart-card";
import { ValueLabel } from "@/components/value-label";
import { ApiError } from "@/lib/api";
import {
  DASH,
  MODEL_KEYS,
  MODEL_NAME,
  accuracyFigures,
  comparisonRows,
  count,
  parseResults,
  type MeasureRow,
  type Results,
} from "@/lib/model-performance";
import { parseHour, shortHour } from "@/lib/time";
import { useApiQuery } from "@/lib/use-api-query";

const card = "rounded-lg border border-line bg-card p-4 sm:p-5";
const h2 = "m-0 text-lg leading-7 font-semibold";

export const TARGET_WORDS = "Whether a machine has a recorded failure within the next 24 hours.";

/** "2015-11-01 00:00" or "2015-11-01T00:00:00" -> "1 Nov 2015, 00:00". Anything unreadable shows as it is. */
function hourText(text: string): string {
  const h = parseHour(text.replace(" ", "T").slice(0, 16));
  return h === null ? text : shortHour(h);
}

/** "14 November 2026" from "20261114" or "2026-11-14". */
function dateText(text: string): string {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
  if (!m) return text;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

type Loaded = { kind: "ready"; results: Results } | { kind: "not-available" };

export function ModelPerformanceScreen() {
  const { meta } = useData();
  if (meta.status !== "ready") return null;
  return <Body />;
}

function Body() {
  const { client, meta, view } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const modelVersion = ready!.model_version;
  const cutoff = view?.cutoff ?? ready!.default_cutoff_percent;

  const query = useApiQuery<Loaded>(
    async (signal) => {
      try {
        const [metrics, threshold] = await Promise.all([client.modelMetrics({ signal }), client.thresholdAnalysis({ signal })]);
        const results = parseResults(metrics, threshold);
        return results ? { kind: "ready", results } : { kind: "not-available" };
      } catch (error) {
        if (error instanceof ApiError && error.kind === "not-found") return { kind: "not-available" };
        throw error;
      }
    },
    [client, modelVersion],
  );

  if (query.status === "error" && query.error.kind === "no-model-data") return <NoModelData />;

  const loaded = query.status === "ready" ? query.data : null;
  const results = loaded?.kind === "ready" ? loaded.results : null;
  const failed = query.status === "error";
  const notAvailable = loaded?.kind === "not-available";
  const loading = query.status === "loading";
  const showControl = loading || results !== null;

  const start = results?.testWindow.start ?? ready!.replay_window.start;
  const end = results?.testWindow.end ?? ready!.replay_window.end;
  const period = `${hourText(start)} to ${hourText(end)}`;

  return (
    <div className="flex flex-col gap-4" data-testid="model-performance">
      <section aria-labelledby="mp-facts" className={card} data-testid="mp-facts">
        <h2 id="mp-facts" className={h2}>
          About these results
        </h2>
        <dl className="mt-2 mb-0 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <Fact k="Model version" v={ready!.model_version} testId="fact-version" />
          <Fact k="Evaluation date" v={ready!.model_created ? dateText(ready!.model_created) : DASH} testId="fact-date" />
          <Fact k="Held-out test period" v={`${period}, hours the models never saw while training`} testId="fact-period" />
          <Fact k="What is predicted" v={TARGET_WORDS} testId="fact-target" />
        </dl>
        <p className="mt-2 mb-0 text-sm text-ink-2">
          Every number on this page comes from the saved evaluation of this model version, run once on simulated sample
          data. Nothing here describes real machines. The replay time above is shown for reference only; nothing on this
          page changes with it.
        </p>
      </section>

      {showControl && (
        <section aria-label="Alert cut-off" className={card}>
          <CutoffControl />
        </section>
      )}

      <p data-testid="period-line" className="m-0 text-sm leading-5">
        <strong>Test period:</strong> {period}
        {results && (
          <>
            {" "}
            ({count(results.testWindow.hours)} hours, {count(results.models.main.summary.n_machines)} machines).
          </>
        )}
        {showControl && (
          <>
            {" "}
            <strong>Alert cut-off in use:</strong>{" "}
            <span data-testid="period-cutoff">{cutoff}%</span> (the same for both models).
          </>
        )}
      </p>

      {loading && <LoadingBlocks />}
      {failed && query.status === "error" && query.error.kind !== "no-model-data" && (
        <ServiceError what="the saved evaluation results" error={query.error} onRetry={query.retry} />
      )}
      {notAvailable && <ResultsNotAvailable />}
      {results && <ResultsBody results={results} cutoff={cutoff} />}

      <Limitations />
    </div>
  );
}

function Fact({ k, v, testId }: { k: string; v: string; testId: string }) {
  return (
    <div className="contents">
      <dt className="font-semibold">{k}</dt>
      <dd data-testid={testId} className="m-0 text-ink-2">
        {v}
      </dd>
    </div>
  );
}

function LoadingBlocks() {
  return (
    <div className="flex flex-col gap-4" data-testid="mp-loading">
      <Skeleton className="h-96 w-full" label="Loading the comparison table" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" label="Loading precision and recall by cut-off" />
        <Skeleton className="h-72 w-full" label="Loading alerts per day by cut-off" />
        <Skeleton className="h-72 w-full" label="Loading the precision–recall curves" />
        <Skeleton className="h-72 w-full" label="Loading the calibration chart" />
      </div>
      <Skeleton className="h-40 w-full" label="Loading the accuracy explanation" />
    </div>
  );
}

// --- the comparison table and everything under it --------------------------------------------------------------

function ResultsBody({ results, cutoff }: { results: Results; cutoff: number }) {
  const rows = useMemo(() => comparisonRows(results, cutoff), [results, cutoff]);
  return (
    <>
      <ComparisonTable rows={rows} results={results} cutoff={cutoff} />
      <div className="grid gap-4 lg:grid-cols-2" data-testid="mp-charts">
        <PrecisionRecallByCutoff results={results} cutoff={cutoff} />
        <AlertsPerDayByCutoff results={results} cutoff={cutoff} />
        <PrecisionRecallCurves results={results} />
        <div id="calibration-chart" className="min-w-0 scroll-mt-4">
          <CalibrationChart results={results} />
        </div>
      </div>
      <AccuracySection results={results} cutoff={cutoff} />
    </>
  );
}

function ComparisonTable({ rows, results, cutoff }: { rows: MeasureRow[]; results: Results; cutoff: number }) {
  const higher = rows.filter((r) => r.better === "higher").map((r) => r.label);
  const lower = rows.filter((r) => r.better === "lower").map((r) => r.label);
  const own = MODEL_KEYS.map((m) => ({ m, d: results.models[m].summary.default_cutoff_percent })).filter(
    (x): x is { m: (typeof MODEL_KEYS)[number]; d: number } => x.d !== null,
  );
  return (
    <section aria-labelledby="mp-table-title" className={card} data-testid="comparison">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mp-table-title" className={h2}>
          Main model vs simple baseline
        </h2>
        <span className="flex gap-2">
          <ValueLabel kind="Predicted" />
          <ValueLabel kind="Historical" />
        </span>
      </div>
      <p className="mt-1 mb-3 text-sm leading-5 text-ink-2" data-testid="comparison-line">
        Model alerts (predicted) checked against recorded failures (historical). Held-out test period{" "}
        {hourText(results.testWindow.start)} to {hourText(results.testWindow.end)}, alert cut-off {cutoff}% for both
        models. Model version {results.modelVersion}.
      </p>
      {own.length > 0 && (
        <p className="mt-0 mb-3 text-sm leading-5 text-ink-2" data-testid="own-cutoffs">
          Each model&rsquo;s own best cut-off, chosen on validation data before the test period was looked at:{" "}
          {own.map((x) => `${MODEL_NAME[x.m].toLowerCase()} ${x.d}%`).join(", ")}. The table below uses the one shared
          cut-off for both, so the comparison is like for like.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" data-testid="comparison-table">
          <caption className="sr-only">
            Main model vs simple baseline at the {cutoff}% alert cut-off on the held-out test period, model version{" "}
            {results.modelVersion}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                Measure
              </th>
              <th scope="col" className={`${th} text-right`}>
                Main model
              </th>
              <th scope="col" className={`${th} text-right`}>
                Simple baseline
              </th>
              <th scope="col" className={`${th} hidden md:table-cell`}>
                Better is
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} data-testid="measure-row" data-key={r.key}>
                <th scope="row" className={`${td} text-left font-normal`}>
                  <span className="inline-flex flex-wrap items-center gap-x-1">
                    <span className="font-semibold">{r.label}</span>
                    <Definition name={r.label} text={r.definition} />
                  </span>
                  {r.note && (
                    <span className="block text-xs text-ink-2" data-testid="row-note">
                      ({r.note})
                    </span>
                  )}
                  {r.key === "calibration" && (
                    <a href="#calibration-chart" className="flex min-h-11 items-center text-xs text-link underline">
                      See the calibration chart below
                    </a>
                  )}
                </th>
                {MODEL_KEYS.map((m) => (
                  <td key={m} data-testid={`cell-${m}`} className={`${td} text-right align-top`}>
                    {r.cells[m].text}
                    {r.cells[m].detail && <span className="block text-xs text-ink-2">{r.cells[m].detail}</span>}
                    {r.cells[m].reason && <span className="block text-xs text-ink-2">({r.cells[m].reason})</span>}
                  </td>
                ))}
                <td className={`${td} hidden align-top md:table-cell`} data-testid="better">
                  {r.better === "higher" ? "Higher" : "Lower"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 mb-0 text-xs leading-5 text-ink-2 md:hidden" data-testid="better-rule">
        Better is higher for: {higher.join("; ")}. Better is lower for: {lower.join("; ")}.
      </p>
    </section>
  );
}

function AccuracySection({ results, cutoff }: { results: Results; cutoff: number }) {
  const a = accuracyFigures(results, cutoff);
  return (
    <section aria-labelledby="mp-accuracy" className={card} data-testid="accuracy">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mp-accuracy" className={h2}>
          Why accuracy misleads when failures are rare
        </h2>
        <ValueLabel kind="Predicted" />
      </div>
      {a ? (
        <>
          <p className="mt-2 mb-3 text-sm leading-5">
            Accuracy is the share of machine-hours called right. Here only {a.failureShare} of the {a.total} machine-hours in
            the test period ({a.failureHours}) were followed by a recorded failure within 24 hours. So a rule that always
            says &ldquo;no failure&rdquo; is right on almost every hour and catches none of the failures. A high accuracy
            alone says little; precision and recall show what it hides.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" data-testid="accuracy-table">
              <caption className="sr-only">
                Accuracy and failure hours caught by each rule on the held-out test period, at the {cutoff}% cut-off
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={th}>Rule</th>
                  <th scope="col" className={`${th} text-right`}>Right on (accuracy)</th>
                  <th scope="col" className={`${th} text-right`}>Failure hours caught</th>
                </tr>
              </thead>
              <tbody>
                {a.rows.map((r) => (
                  <tr key={r.key} data-testid="accuracy-row" data-key={r.key}>
                    <th scope="row" className={`${td} text-left font-normal`}>{r.rule}</th>
                    <td className={`${td} text-right`}>{r.right}</td>
                    <td className={`${td} text-right`}>{r.failuresCaught}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 mb-0 text-xs text-ink-2">
            From the saved counts of the evaluation: right = (caught + quiet and correct) ÷ all machine-hours.
          </p>
        </>
      ) : (
        <p className="mt-2 mb-0 text-sm">{DASH} The saved evaluation has no machine-hour counts to explain this with.</p>
      )}
    </section>
  );
}

function Limitations() {
  return (
    <section aria-labelledby="mp-limits" className={card} data-testid="limitations">
      <h2 id="mp-limits" className={h2}>
        Limitations
      </h2>
      <ul className="mt-2 mb-0 list-disc pl-5 text-sm leading-6">
        <li>
          <strong>Simulated data.</strong> The sensor readings and failures were generated by a simulator, and failures leave
          a clear mark in them. The very high scores are not a forecast for real equipment, where signs are weaker and
          noisier. Read the comparison between the two models as meaningful and the absolute levels as a feature of this data.
        </li>
        <li>One year of data from a small set of machines, so every figure has a wide margin. No margins are shown because none were calculated.</li>
        <li>
          Hour-level precision and recall count overlapping hours, because one failure makes many earlier hours count as
          followed by a failure. The failure-event share and false alerts per 100 machine-days are the event-level measures.
        </li>
        <li>The cut-off is a default, not a rule. A different cost of a miss or a false alarm needs a different cut-off.</li>
        <li>
          Calibration was fitted on the same validation hours used to choose it. The correction is small, but the risk of
          fooling ourselves is not zero.
        </li>
        <li>The test period was looked at once, after every setting was fixed. A later change gets a new model version and its own saved results.</li>
        <li>This page describes the saved evaluation only. It makes no claim about performance on real machines.</li>
      </ul>
    </section>
  );
}
