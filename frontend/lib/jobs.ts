import { useSyncExternalStore } from "react";

// The browser-saved work plan (redesign decision 82): the machines the visitor has added as jobs.
// Stage 2 stores only "added"; stage 4 extends this with slots, status, dismiss and Reset demo.
const KEY = "piq-jobs";
const EVENT = "piq-jobs-changed";
let memory: number[] = []; // used only when storage is blocked

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return JSON.stringify(memory);
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

export function useJobs(): { jobs: number[]; add: (machine: number) => void } {
  const text = useSyncExternalStore(subscribe, read, () => "[]");
  const jobs = parseJobs(text);
  const add = (machine: number) => {
    if (jobs.includes(machine)) return;
    memory = [...jobs, machine];
    try {
      localStorage.setItem(KEY, JSON.stringify(memory));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return { jobs, add };
}
