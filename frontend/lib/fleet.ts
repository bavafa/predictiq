// Fleet Overview helpers: number formats, sorting, paging and the plain-words filter description.
import type { FleetRow, MachineModel, Status } from "@/lib/types";

export const PAGE_SIZE = 25;

/** A score is a fraction (0.985582); the screen says "98.6%". */
export function percent(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

export function modelLabel(model: MachineModel): string {
  return model;
}

export function statusLabel(status: Status): string {
  return status === "alert" ? "Alert" : "Below cut-off";
}

export type SortKey = "rank" | "machine" | "model" | "age" | "score" | "status";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

/** The default order: riskiest first, which is the order the service sends (rank 1 first). */
export const DEFAULT_SORT: Sort = { key: "score", dir: "desc" };

export const SORT_OPTIONS: { value: string; label: string; sort: Sort }[] = [
  { value: "score-desc", label: "Predicted chance, high → low", sort: { key: "score", dir: "desc" } },
  { value: "score-asc", label: "Predicted chance, low → high", sort: { key: "score", dir: "asc" } },
  { value: "machine-asc", label: "Machine number, low → high", sort: { key: "machine", dir: "asc" } },
  { value: "age-desc", label: "Age, oldest first", sort: { key: "age", dir: "desc" } },
  { value: "model-asc", label: "Machine model, A → Z", sort: { key: "model", dir: "asc" } },
];

export function sortValue(sort: Sort): string {
  return SORT_OPTIONS.find((o) => o.sort.key === sort.key && o.sort.dir === sort.dir)?.value ?? "score-desc";
}

const STATUS_ORDER: Record<Status, number> = { alert: 0, below_cutoff: 1 };

export function sortRows(rows: readonly FleetRow[], sort: Sort): FleetRow[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  const compare = (a: FleetRow, b: FleetRow): number => {
    switch (sort.key) {
      case "rank":
        return a.rank - b.rank; // rank already orders by predicted chance, ties by machine number
      case "score":
        return b.rank - a.rank; // a higher chance has a lower rank number
      case "machine":
        return a.machine_id - b.machine_id;
      case "model":
        return a.model.localeCompare(b.model) || a.rank - b.rank;
      case "age":
        return a.age - b.age || a.rank - b.rank;
      case "status":
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.rank - b.rank;
    }
  };
  return [...rows].sort((a, b) => sign * compare(a, b));
}

export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function pageOf<T>(rows: readonly T[], page: number): T[] {
  return rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

/** "Machines of model2 with status Alert and machine number 12", for the empty state. */
export function describeFilters(f: { machine_model: MachineModel | null; status: Status | null; machine_number: number | null }): string[] {
  const parts: string[] = [];
  if (f.status) parts.push(`status "${statusLabel(f.status)}"`);
  if (f.machine_model) parts.push(`machine model "${f.machine_model}"`);
  if (f.machine_number !== null) parts.push(`machine number ${f.machine_number}`);
  return parts;
}

/** Labels of the ten equal-width bins, "0–10%" … "90–100%". */
export function binLabel(low: number, high: number): string {
  return `${Math.round(low * 100)}–${Math.round(high * 100)}%`;
}

/** Index of the bin a cut-off (whole percent) falls in; 100% falls in the last bin. */
export function binOfCutoff(cutoff: number, bins: number): number {
  return Math.min(bins - 1, Math.floor((cutoff / 100) * bins));
}
