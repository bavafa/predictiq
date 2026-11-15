"use client";

import Link from "next/link";

import { useData } from "@/components/data-provider";
import { ValueLabel } from "@/components/value-label";
import { Button } from "@/components/ui/button";
import {
  PAGE_SIZE,
  SORT_OPTIONS,
  pageCount,
  pageOf,
  percent,
  sortRows,
  sortValue,
  statusLabel,
  type Sort,
  type SortKey,
} from "@/lib/fleet";
import { machineName } from "@/lib/machine-types";
import { parseHour, shortHour } from "@/lib/time";
import { carriedSearch } from "@/lib/url-state";
import type { FleetRow, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Word and icon, never colour alone. Amber is a model alert; red is reserved for recorded failures. */
export function StatusTag({ status }: { status: Status }) {
  const alert = status === "alert";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-2 text-xs leading-6 font-semibold whitespace-nowrap",
        alert ? "border-alert-edge bg-alert-bg text-alert-text" : "border-input-edge bg-card text-ink",
      )}
    >
      <span aria-hidden="true">{alert ? "▲" : "○"}</span> {statusLabel(status)}
      <span className="sr-only">, predicted</span>
    </span>
  );
}

function useMachineHref() {
  const { search } = useData();
  return (id: number) => {
    const params = new URLSearchParams(carriedSearch(search));
    params.set("machine", String(id));
    return `/asset-details?${params.toString()}`;
  };
}

/** "error3 · 12 Nov 2015, 14:00", or "None yet" when the machine has no error record before the replay hour. */
export function latestErrorText(e: FleetRow["latest_error"]): string {
  if (!e) return "None yet";
  const h = parseHour(e.time.slice(0, 16));
  return h === null ? e.error : `${e.error} · ${shortHour(h)}`;
}

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "rank", label: "Rank", align: "right" },
  { key: "machine", label: "Machine" },
  { key: "model", label: "Machine model" },
  { key: "age", label: "Age (years)", align: "right" },
  { key: "score", label: "Predicted chance, 24 h", align: "right" },
  { key: "status", label: "Status" },
];

function SortHeader({ col, sort, onSort }: { col: (typeof COLUMNS)[number]; sort: Sort; onSort: (key: SortKey) => void }) {
  const active = sort.key === col.key;
  const dir = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const arrow = !active ? "" : sort.dir === "asc" ? "▲" : "▼";
  return (
    <th scope="col" aria-sort={dir} className={cn("border-b border-line bg-subtle p-0 text-xs font-semibold text-ink-2", col.align === "right" ? "text-right" : "text-left")}>
      <button type="button" onClick={() => onSort(col.key)} className="min-h-11 w-full cursor-pointer px-3 font-semibold" style={{ textAlign: col.align ?? "left" }}>
        {col.label} {arrow && <span aria-hidden="true">{arrow}</span>}
      </button>
    </th>
  );
}

export function FleetTable({
  rows,
  total,
  sort,
  onSort,
  page,
  onPage,
}: {
  rows: readonly FleetRow[];
  total: number;
  sort: Sort;
  onSort: (s: Sort) => void;
  page: number;
  onPage: (p: number) => void;
}) {
  const href = useMachineHref();
  const sorted = sortRows(rows, sort);
  const pages = pageCount(sorted.length);
  const current = Math.min(page, pages);
  const visible = pageOf(sorted, current);
  const from = sorted.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = (current - 1) * PAGE_SIZE + visible.length;

  const toggle = (key: SortKey) => {
    if (sort.key === key) onSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
    else onSort({ key, dir: key === "age" || key === "score" ? "desc" : "asc" });
  };

  return (
    <>
      <p className="m-0 text-sm text-ink-2" data-testid="table-count">
        Showing {from}–{to} of {total}
      </p>

      <div className="mt-3 hidden md:block">
        <table className="w-full border-collapse" data-testid="fleet-table">
          <caption className="sr-only">
            Machines ranked by predicted chance of failure in the next 24 hours, riskiest first. Predicted chance and status are predicted;
            machine model and age are historical.
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <SortHeader key={c.key} col={c} sort={sort} onSort={toggle} />
              ))}
              <th scope="col" className="border-b border-line bg-subtle px-3 text-left text-xs font-semibold text-ink-2">
                Latest error
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.machine_id} data-testid="fleet-row" data-status={r.status} data-machine={r.machine_id} className="border-b border-line">
                <td className="tabular px-3 py-2 text-right text-sm">{r.rank}</td>
                <td className="px-3 py-2 text-sm">
                  <Link href={href(r.machine_id)} className="inline-flex min-h-11 max-w-40 items-center text-link underline">
                    {machineName(r.machine_id)}
                  </Link>
                </td>
                <td className="px-3 py-2 text-sm">{r.model}</td>
                <td className="tabular px-3 py-2 text-right text-sm">{r.age}</td>
                <td className="tabular px-3 py-2 text-right text-sm">{percent(r.score)}</td>
                <td className="px-3 py-2">
                  <StatusTag status={r.status} />
                </td>
                <td className="px-3 py-2 text-sm" data-testid="latest-error">
                  {latestErrorText(r.latest_error)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 mb-0 text-xs text-ink-2">
          <ValueLabel kind="Predicted" /> Predicted chance and status. <ValueLabel kind="Historical" /> Machine model, age and latest error (the newest error record before the replay time).
        </p>
      </div>

      <div className="mt-3 md:hidden">
        <ul className="m-0 list-none p-0" aria-label="Machines ranked by predicted chance of failure in the next 24 hours">
          {visible.map((r) => (
            <li key={r.machine_id} data-testid="fleet-card-row" data-status={r.status} className="border-b border-line">
              <Link href={href(r.machine_id)} className="flex min-h-11 items-center justify-between gap-3 py-3 text-ink no-underline">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-link underline">
                    {r.rank} · {machineName(r.machine_id)}
                  </span>
                  <span className="block text-xs text-ink-2">
                    {r.model} · {r.age} years · latest error {latestErrorText(r.latest_error)} (historical)
                  </span>
                </span>
                <span className="flex flex-none items-center gap-2">
                  <span className="tabular text-sm">{percent(r.score)}</span>
                  <StatusTag status={r.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
          Sort
          <select
            value={sortValue(sort)}
            onChange={(e) => {
              const o = SORT_OPTIONS.find((x) => x.value === e.target.value);
              if (o) onSort(o.sort);
            }}
            className="min-h-11 rounded-md border border-input-edge bg-card px-2 text-sm font-normal"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-ink-2">Rows per page: {PAGE_SIZE}</span>
        <nav aria-label="Table pages" className="flex items-center gap-3">
          <Button aria-disabled={current <= 1} className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50" onClick={() => current > 1 && onPage(current - 1)}>
            ‹ Previous
          </Button>
          <span className="tabular text-sm">
            Page {current} of {pages}
          </span>
          <Button aria-disabled={current >= pages} className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50" onClick={() => current < pages && onPage(current + 1)}>
            Next ›
          </Button>
        </nav>
      </div>
    </>
  );
}
