import { useSyncExternalStore } from "react";

// A per-viewer on/off flag kept in localStorage (the "data labels" switch and the open "Time controls" panel).
// Storage can be blocked, so reads and writes are guarded and the value falls back to this page view's memory.
const memory = new Map<string, boolean>();
const EVENT = "piq-flag";

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === "on";
  } catch {
    return memory.get(key) ?? false;
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

export function useStoredFlag(key: string): [boolean, (next: boolean) => void] {
  const on = useSyncExternalStore(subscribe, () => read(key), () => false);
  const set = (next: boolean) => {
    memory.set(key, next);
    try {
      localStorage.setItem(key, next ? "on" : "off");
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };
  return [on, set];
}
