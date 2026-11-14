"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { api, ApiError, isReady, type ApiClient } from "@/lib/api";
import {
  DEFAULT_STEP,
  announceThisStep,
  atEnd,
  atStart,
  playTick,
  stepped,
  PLAY_INTERVAL_MS,
  type StepSize,
} from "@/lib/replay";
import { formatHour, parseHour, readableHour } from "@/lib/time";
import type { Metadata, ReadyMetadata } from "@/lib/types";
import { applyChanges, parseUrlState, windowHours, type UrlChanges, type UrlState } from "@/lib/url-state";

/** After this long without an answer from /metadata the "waking up" message is shown (ux-spec, States). */
export const WAKING_AFTER_MS = 3000;
export const END_MESSAGE = "End of the replay window. There is no later data.";

export type MetaState =
  | { status: "loading"; slow: boolean }
  | { status: "no-model"; meta: Metadata }
  | { status: "error"; error: ApiError }
  | { status: "ready"; meta: ReadyMetadata };

export type Replay = {
  first: number;
  last: number;
  start: number;
  hour: number;
  step: StepSize;
  setStep: (s: StepSize) => void;
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stepBack: () => void;
  stepForward: () => void;
  /** Jump to the first hour of the whole replay window (not the replay start). */
  toStart: () => void;
  /** Go to an hour (hours since the Unix epoch); clamped to the window. Pauses playback. */
  goTo: (hour: number) => void;
  /** Text for the polite live region: the replay time every sixth step, and the end of data, once. */
  announcement: string;
};

export type DataContextValue = {
  client: ApiClient;
  meta: MetaState;
  retryMeta: () => void;
  /** Search string of the address as read now (with the leading "?", or empty). */
  search: string;
  view: UrlState | null;
  update: (changes: UrlChanges) => void;
  replay: Replay | null;
};

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error("useData must be used inside <DataProvider>");
  return value;
}

// --- the web address as an external store -------------------------------------------------------------------

const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("popstate", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("popstate", callback);
  };
}
const readSearch = () => window.location.search;
const readServerSearch = () => "";

export function DataProvider({ children, client = api }: { children: ReactNode; client?: ApiClient }) {
  const pathname = usePathname(); // a page change re-reads the address below
  void pathname;
  const search = useSyncExternalStore(subscribe, readSearch, readServerSearch);

  // --- metadata -------------------------------------------------------------------------------------------
  const [meta, setMeta] = useState<MetaState>({ status: "loading", slow: false });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      if (live) setMeta((m) => (m.status === "loading" ? { status: "loading", slow: true } : m));
    }, WAKING_AFTER_MS);
    client
      .metadata()
      .then((m) => {
        if (!live) return;
        if (isReady(m)) setMeta({ status: "ready", meta: m });
        else setMeta({ status: "no-model", meta: m });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setMeta({ status: "error", error: error instanceof ApiError ? error : new ApiError("server", "Something went wrong.") });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [client, attempt]);
  const retryMeta = useCallback(() => {
    setMeta({ status: "loading", slow: false });
    setAttempt((n) => n + 1);
  }, []);

  const ready = meta.status === "ready" ? meta.meta : null;
  const view = useMemo(() => (ready ? parseUrlState(search, ready) : null), [ready, search]);

  const update = useCallback(
    (changes: UrlChanges) => {
      if (!ready) return;
      const next = applyChanges(window.location.search, changes, ready);
      window.history.replaceState(null, "", `${window.location.pathname}${next}${window.location.hash}`);
      listeners.forEach((l) => l());
    },
    [ready],
  );

  // --- replay ---------------------------------------------------------------------------------------------
  const [step, setStep] = useState<StepSize>(DEFAULT_STEP);
  const [playing, setPlaying] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const bounds = useMemo(() => {
    if (!ready) return null;
    const { first, last, start } = windowHours(ready);
    return { first, last, start };
  }, [ready]);
  const hour = view ? (parseHour(view.at) ?? bounds?.start ?? 0) : 0;

  // The interval reads the latest values through refs, so it is not torn down on every tick.
  const live = useRef({ hour, step, bounds, update });
  useEffect(() => {
    live.current = { hour, step, bounds, update };
  });
  const playedSteps = useRef(0);

  const pause = useCallback(() => setPlaying(false), []);
  const goTo = useCallback((target: number) => {
    const b = live.current.bounds;
    if (!b) return;
    setPlaying(false);
    live.current.update({ at: formatHour(Math.min(Math.max(target, b.first), b.last)) });
  }, []);

  const play = useCallback(() => {
    const { hour: h, bounds: b } = live.current;
    if (!b || atEnd(h, b)) return;
    playedSteps.current = 0;
    setAnnouncement("");
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const { hour: h, step: size, bounds: b, update: write } = live.current;
      if (!b) return;
      const tick = playTick(h, size, b);
      write({ at: formatHour(tick.hour) });
      live.current.hour = tick.hour; // the next tick must not wait for a re-render to know where we are
      playedSteps.current += 1;
      if (tick.ended) {
        setPlaying(false);
        setAnnouncement(END_MESSAGE);
      } else if (announceThisStep(playedSteps.current)) {
        setAnnouncement(`Replay time ${readableHour(tick.hour)}`);
      }
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing]);

  const replay: Replay | null = useMemo(() => {
    if (!bounds) return null;
    const b = bounds;
    return {
      ...b,
      hour,
      step,
      setStep,
      playing,
      atStart: atStart(hour, b),
      atEnd: atEnd(hour, b),
      play,
      pause,
      toggle: () => (playing ? pause() : play()),
      stepBack: () => goTo(stepped(hour, -1, step, b)),
      stepForward: () => goTo(stepped(hour, 1, step, b)),
      toStart: () => goTo(b.first),
      goTo,
      announcement,
    };
  }, [bounds, hour, step, playing, play, pause, goTo, announcement]);

  const value = useMemo<DataContextValue>(
    () => ({ client, meta, retryMeta, search, view, update, replay }),
    [client, meta, retryMeta, search, view, update, replay],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
