"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";

const sameDeps = (a: readonly unknown[] | null, b: readonly unknown[]) =>
  a !== null && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));

/**
 * Keep the last complete set of answers on screen while the next set loads. `candidate` is the new set once
 * every request in it has settled for the current view (null until then). Returns what to show and whether it
 * is the current set. Panels that read from one set can never show numbers from two different requests.
 */
export function useSettledSet<T extends object>(candidate: T | null): { shown: T | null; current: boolean } {
  const [kept, setKept] = useState<T | null>(null);
  if (candidate !== null && candidate !== kept) setKept(candidate);
  return { shown: candidate ?? kept, current: candidate !== null };
}

export type QueryState<T> =
  | { status: "loading"; previous: T | null }
  | { status: "ready"; data: T }
  | { status: "error"; error: ApiError };

/**
 * Run one data request for a screen panel. Whenever `deps` change a new request replaces the old one (the old
 * one is cancelled and its answer ignored). `previous` is the last good answer while the next one loads, so a
 * screen can keep it dimmed instead of blanking; it is never offered after an error.
 * `retry` runs the same request again ("Try again").
 */
export function useApiQuery<T>(
  run: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): QueryState<T> & { retry: () => void } {
  const [held, setState] = useState<{ state: QueryState<T>; deps: readonly unknown[] | null }>({
    state: { status: "loading", previous: null },
    deps: null,
  });
  // The render right after a change still holds the answer to the old request: report it as loading.
  const state: QueryState<T> = sameDeps(held.deps, deps)
    ? held.state
    : { status: "loading", previous: held.state.status === "ready" ? held.state.data : held.state.status === "loading" ? held.state.previous : null };
  const [attempt, setAttempt] = useState(0);
  const last = useRef<T | null>(null);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ state: { status: "loading", previous: last.current }, deps });
    runRef
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        last.current = data;
        setState({ state: { status: "ready", data }, deps });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        last.current = null;
        setState({
          state: { status: "error", error: error instanceof ApiError ? error : new ApiError("server", "Something went wrong.") },
          deps,
        });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists exactly what the request depends on
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
