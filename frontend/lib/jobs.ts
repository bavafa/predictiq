import { useSyncExternalStore } from "react";

// The browser-saved work plan (redesign decision 82): machines added as jobs and alerts dismissed.
// Stage 4: a job is Added, then Scheduled into a crew slot, then Done; Reset demo clears everything.
const KEYS = { jobs: "piq-jobs", dismissed: "piq-dismissed", status: "piq-status" } as const;
type Which = "jobs" | "dismissed"; // the lists; status has its own map below
const EVENT = "piq-jobs-changed";
const memory: Record<Which, number[]> = { jobs: [], dismissed: [] }; // used only when storage is blocked

function read(which: Which): string {
  try {
    return localStorage.getItem(KEYS[which]) ?? "[]";
  } catch {
    return JSON.stringify(memory[which]);
  }
}

export function parseJobs(text: string): number[] {
  try {
    const v: unknown = JSON.parse(text);
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function save(which: Which, list: number[]) {
  memory[which] = list;
  try {
    localStorage.setItem(KEYS[which], JSON.stringify(list));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export type JobStatus = "scheduled" | "done";

/** A job is keyed by its machine ("8", also the v1 key) or by a part of a machine ("8:comp2"). */
const JOB_KEY = /^\d+(:comp[1-4])?$/;

/** Saved status per job: anything that is not "scheduled" or "done", or has an odd key, is ignored. */
export function parseStatus(text: string): Record<string, JobStatus> {
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const out: Record<string, JobStatus> = {};
    for (const [k, val] of Object.entries(v)) if ((val === "scheduled" || val === "done") && JOB_KEY.test(k)) out[k] = val;
    return out;
  } catch {
    return {};
  }
}

const memoryStatus: { value: Record<string, JobStatus> } = { value: {} };

export function useJobs() {
  const jobs = parseJobs(useSyncExternalStore(subscribe, () => read("jobs"), () => "[]"));
  const dismissed = parseJobs(useSyncExternalStore(subscribe, () => read("dismissed"), () => "[]"));
  const statusText = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(KEYS.status) ?? "{}";
      } catch {
        return JSON.stringify(memoryStatus.value);
      }
    },
    () => "{}",
  );
  const status = parseStatus(statusText);
  const saveStatus = (next: Record<string, JobStatus>) => {
    memoryStatus.value = next;
    try {
      localStorage.setItem(KEYS.status, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return {
    jobs,
    dismissed,
    status,
    add: (m: number) => {
      if (!jobs.includes(m)) save("jobs", [...jobs, m]);
    },
    dismiss: (m: number) => {
      if (!dismissed.includes(m)) save("dismissed", [...dismissed, m]);
    },
    setStatus: (m: number | string, s: JobStatus | null) => {
      const next = { ...status };
      if (s === null) delete next[m];
      else next[m] = s;
      saveStatus(next);
    },
    remove: (m: number) => {
      save("jobs", jobs.filter((j) => j !== m));
      const next = { ...status };
      delete next[String(m)];
      saveStatus(next);
    },
    /** "Reset demo": every job, status and dismissed alert goes. */
    reset: () => {
      save("jobs", []);
      save("dismissed", []);
      saveStatus({});
    },
  };
}

/** Slots in use: the number of scheduled jobs. A job can be scheduled only while this is below the crew slots. */
export function slotsUsed(status: Record<string, JobStatus>): number {
  return Object.values(status).filter((s) => s === "scheduled").length;
}

/** The label a job carries: Added until it is scheduled, then Scheduled, then Done. */
export function jobLabel(s: JobStatus | undefined, added = false): "Recommended" | "Added" | "Scheduled" | "Done" {
  return s === "scheduled" ? "Scheduled" : s === "done" ? "Done" : added ? "Added" : "Recommended";
}
