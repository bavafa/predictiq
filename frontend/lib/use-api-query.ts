"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";

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
  const [state, setState] = useState<QueryState<T>>({ status: "loading", previous: null });
  const [attempt, setAttempt] = useState(0);
  const last = useRef<T | null>(null);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", previous: last.current });
    runRef
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        last.current = data;
        setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        last.current = null;
        setState({
          status: "error",
          error: error instanceof ApiError ? error : new ApiError("server", "Something went wrong."),
        });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists exactly what the request depends on
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
