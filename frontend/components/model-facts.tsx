"use client";

import { useData } from "@/components/data-provider";
import { parseHour, shortHour } from "@/lib/time";

const DASH = "—";

/** "20261114" or "2026-11-14" -> "14 November 2026"; anything else is shown as it is. */
function modelDate(text: string): string {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(text);
  if (!m) return text;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

function hour(text: string | null | undefined): string {
  if (!text) return DASH;
  const h = parseHour(text.slice(0, 16));
  return h === null ? DASH : shortHour(h);
}

/**
 * Basic facts read from /metadata (ux-spec, About & Data). While it loads, or if it can't be read, the values
 * show "—" and the rest of the page stays readable.
 */
export function ModelFacts() {
  const { meta } = useData();
  const ready = meta.status === "ready" ? meta.meta : null;
  const noModel = meta.status === "no-model";
  const failed = meta.status === "error";

  const facts: [string, string][] = [
    ["Model version", ready?.model_version ?? DASH],
    ["Model built", ready?.model_created ? modelDate(ready.model_created) : DASH],
    ["Default alert cut-off", ready ? `${ready.default_cutoff_percent}% (chosen on validation data only)` : DASH],
    [
      "Replay window",
      ready ? `${hour(ready.replay_window.start)} to ${hour(ready.replay_window.end)}, the period the models never saw while training` : DASH,
    ],
    ["Simulated plant time starts at", ready ? hour(ready.replay_start) : DASH],
  ];
  return (
    <div data-testid="model-facts" className="mt-3">
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-semibold">{k}</dt>
            <dd className="m-0 text-ink-2">{v}</dd>
          </div>
        ))}
      </dl>
      {failed && (
        <p role="status" className="mt-2 mb-0 text-sm text-ink-2">
          — (couldn&rsquo;t load right now; the rest of this page still applies)
        </p>
      )}
      {noModel && (
        <p role="status" className="mt-2 mb-0 text-sm text-ink-2">
          The model data isn&rsquo;t installed in this preview, so no model details are shown.
        </p>
      )}
    </div>
  );
}
