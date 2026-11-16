import { useSyncExternalStore } from "react";

// The browser-saved work plan (redesign decision 82): machines added as jobs and alerts dismissed.
// Stage 3 stores "added" and "dismissed"; stage 4 extends this with slots, status and Reset demo.
const KEYS = { jobs: "piq-jobs", dismissed: "piq-dismissed" } as const;
type Which = keyof typeof KEYS;
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

export function useJobs(): { jobs: number[]; dismissed: number[]; add: (m: number) => void; dismiss: (m: number) => void } {
  const jobs = parseJobs(useSyncExternalStore(subscribe, () => read("jobs"), () => "[]"));
  const dismissed = parseJobs(useSyncExternalStore(subscribe, () => read("dismissed"), () => "[]"));
  return {
    jobs,
    dismissed,
    add: (m) => {
      if (!jobs.includes(m)) save("jobs", [...jobs, m]);
    },
    dismiss: (m) => {
      if (!dismissed.includes(m)) save("dismissed", [...dismissed, m]);
    },
  };
}
