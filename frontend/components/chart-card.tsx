"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ValueLabel } from "@/components/value-label";

/**
 * A chart with a title, a one-line text summary, labelled axes (drawn by the caller) and "View as table".
 * The drawing itself is hidden from screen readers: the summary and the table carry the same values.
 */
export function ChartCard({
  title,
  summary,
  caption,
  actions,
  chart,
  table,
  testId,
  note,
  kind = "Predicted",
}: {
  kind?: "Historical" | "Predicted";
  note?: string;
  title: string;
  summary: string;
  caption?: string;
  actions?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  testId: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure data-testid={testId} className="m-0 min-w-0 rounded-lg border border-line bg-card p-4 sm:p-5" aria-labelledby={`${id}-t`} aria-describedby={`${id}-s`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`${id}-t`} className="m-0 text-lg leading-7 font-semibold">
          {title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Button aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            {asTable ? "View as chart" : "View as table"}
          </Button>
        </div>
      </div>
      <figcaption className="mt-1 text-sm leading-5 text-ink-2">
        <ValueLabel kind={kind} />
        {caption ? ` ${caption}` : null}
      </figcaption>
      <p id={`${id}-s`} data-testid={`${testId}-summary`} className="mt-2 mb-0 text-sm leading-5 font-semibold">
        {summary}
      </p>
      {note && (
        <p data-testid={`${testId}-note`} className="mt-1 mb-0 text-sm text-ink-2">
          {note}
        </p>
      )}
      <div className="mt-3">
        {asTable ? table : <div aria-hidden="true">{chart}</div>}
      </div>
    </figure>
  );
}

/**
 * A table that can be taller than its box. A box that scrolls must be reachable by keyboard (WCAG 2.1.1), so it is
 * focusable and named; the arrow keys then scroll it.
 */
export function ScrollRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="max-h-72 overflow-auto" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

export const th ="border-b border-line px-3 py-2 text-left text-xs font-semibold text-ink-2";
export const td = "tabular border-b border-line px-3 py-1.5 text-sm";

