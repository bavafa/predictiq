"use client";

import { ChevronDown, FastForward, Pause, Play, SkipBack, StepBack, StepForward } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { useData, type Replay } from "@/components/data-provider";
import { Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { REPLAY_PAGES } from "@/lib/nav";
import { START_LINE, START_LINE_FALLBACK, STEP_SIZES, isStepSize } from "@/lib/replay";
import { useStoredFlag } from "@/lib/stored-flag";
import { readableHour, shortHour } from "@/lib/time";
import { cn } from "@/lib/utils";

const unavailable = "aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** Run `act` unless the button is marked unavailable. Unavailable buttons stay focusable so focus is never lost. */
const unlessUnavailable = (can: boolean, act: () => void) => () => {
  if (can) act();
};

function Timeline({ replay, describedBy }: { replay: Replay; describedBy?: string }) {
  const id = useId();
  const { first, last, hour, goTo } = replay;
  const [draft, setDraft] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const dragging = useRef(false);

  // The address changed from elsewhere (Play, a step button, a link): the drag value no longer applies.
  useEffect(() => {
    if (!dragging.current) {
      draftRef.current = null;
      setDraft(null);
    }
  }, [hour]);

  function commit() {
    if (draftRef.current !== null) goTo(first + draftRef.current);
    draftRef.current = null;
    setDraft(null);
  }

  const index = draft ?? hour - first;
  const shown = readableHour(first + index);
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
      <label htmlFor={id} className="text-sm font-semibold">
        Simulated plant time
      </label>
      <span className="text-xs text-ink-2">First hour {shortHour(first)}</span>
      <input
        id={id}
        type="range"
        min={0}
        max={last - first}
        step={1}
        value={index}
        aria-valuetext={shown}
        aria-describedby={describedBy}
        className="h-11 min-w-40 flex-1 cursor-pointer accent-brand"
        onChange={(e) => {
          const next = Number(e.target.value);
          // Keys apply at once; dragging applies on release.
          if (dragging.current) {
            draftRef.current = next;
            setDraft(next);
          } else {
            goTo(first + next);
          }
        }}
        onPointerDown={() => {
          dragging.current = true;
          const release = () => {
            document.removeEventListener("pointerup", release);
            document.removeEventListener("pointercancel", release);
            dragging.current = false;
            commit();
          };
          document.addEventListener("pointerup", release);
          document.addEventListener("pointercancel", release);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          // Page Up / Page Down move ten hours (one step is one hour); the browser's own range does the rest.
          if (e.key === "PageUp" || e.key === "PageDown") {
            e.preventDefault();
            goTo(hour + (e.key === "PageUp" ? 10 : -10));
          }
        }}
      />
      <span className="text-xs text-ink-2">Last hour {shortHour(last)}</span>
    </div>
  );
}

function Controls({ replay }: { replay: Replay }) {
  const { atStart, atEnd, playing } = replay;
  return (
    <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-disabled={atStart}
          aria-describedby={atStart ? "start-note" : undefined}
          className={unavailable}
          onClick={unlessUnavailable(!atStart, replay.toStart)}
        >
          <SkipBack aria-hidden="true" size={16} /> Start
        </Button>
        <Button
          aria-disabled={atStart}
          aria-describedby={atStart ? "start-note" : undefined}
          className={unavailable}
          onClick={unlessUnavailable(!atStart, replay.stepBack)}
        >
          <StepBack aria-hidden="true" size={16} /> Step back
        </Button>
        <Button
          variant="primary"
          aria-disabled={atEnd && !playing}
          aria-describedby={atEnd ? "end-note" : undefined}
          className={unavailable}
          onClick={unlessUnavailable(!atEnd || playing, replay.toggle)}
        >
          {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          aria-disabled={atEnd}
          aria-describedby={atEnd ? "end-note" : undefined}
          className={unavailable}
          onClick={unlessUnavailable(!atEnd, replay.stepForward)}
        >
          <StepForward aria-hidden="true" size={16} /> Step forward
        </Button>
        <label className="flex items-center gap-2 text-sm font-semibold">
          Step size
          <select
            value={replay.step}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (isStepSize(next)) replay.setStep(next);
            }}
            className="min-h-11 rounded-md border border-input-edge bg-card px-2 text-sm font-normal"
          >
            {STEP_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} {s === 1 ? "hour" : "hours"}
              </option>
            ))}
          </select>
        </label>
    </div>
  );
}

export function ReplayBar() {
  const { meta, view, replay } = useData();
  const [panelOpen, setPanelOpen] = useStoredFlag("piq-time-panel");
  const pathname = usePathname();
  const interactive = REPLAY_PAGES.includes(pathname);

  const time =
    meta.status === "ready" && replay ? (
      <time dateTime={view?.at} data-testid="replay-time" className="tabular text-base font-bold">
        {readableHour(replay.hour)}
      </time>
    ) : meta.status === "loading" ? (
      <Skeleton className="h-6 w-56" label="Loading the simulated plant time" />
    ) : (
      <span data-testid="replay-time" className="text-base font-bold">
        —
      </span>
    );

  const ready = meta.status === "ready" && replay !== null;
  const startLine =
    meta.status === "ready" && meta.meta.replay_start_branch === "no_alert_first_test_hour" ? START_LINE_FALLBACK : START_LINE;

  return (
    <section aria-label="Simulated plant time" className="border-b border-line bg-card px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-ink-2">Simulated plant time</span>
          {time}
        </div>
        {ready && interactive && (
          <>
            <Button
              variant="primary"
              aria-disabled={replay.atEnd}
              aria-describedby={replay.atEnd ? "end-note" : undefined}
              className={unavailable}
              onClick={unlessUnavailable(!replay.atEnd, () => replay.goTo(replay.hour + 1))}
            >
              <FastForward aria-hidden="true" size={16} /> Advance 1 h
            </Button>
            <Button
              variant="outline"
              aria-expanded={panelOpen}
              aria-controls="time-controls"
              onClick={() => setPanelOpen(!panelOpen)}
            >
              Time controls <ChevronDown aria-hidden="true" size={16} className={cn(panelOpen && "rotate-180")} />
            </Button>
          </>
        )}
        {!ready && meta.status === "no-model" && (
          <span className="text-sm text-ink-2">
            There are no time controls because the model data isn&rsquo;t installed in this preview.
          </span>
        )}
      </div>

      {ready && interactive && panelOpen && (
        <div id="time-controls" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <Controls replay={replay} />
          <Timeline replay={replay} describedBy={replay.atStart ? "start-note" : replay.atEnd ? "end-note" : undefined} />
        </div>
      )}
      {ready && interactive && panelOpen && replay.atStart && (
        <p id="start-note" className="m-0 mt-2 text-sm text-ink-2">
          Start of the simulated data.
        </p>
      )}
      {ready && interactive && replay.atEnd && (
        <div
          id="end-note"
          data-testid="end-state"
          className={cn("mt-2 flex flex-wrap items-center gap-3 rounded-md border border-l-4 border-input-edge bg-subtle px-3 py-2 text-sm")}
        >
          <span>
            <strong>End of the simulated data.</strong> There is no later data.
          </span>
          <Button onClick={replay.toStart}>Jump to start</Button>
        </div>
      )}
      {ready && interactive && panelOpen && <p className="m-0 mt-2 text-xs leading-4 text-ink-2">{startLine}</p>}
      {ready &&
        view?.issues.map((issue) => (
          <p key={issue} role="note" className="m-0 mt-2 text-xs leading-4 text-alert-text">
            {issue}
          </p>
        ))}

      <p className="sr-only" role="status" aria-live="polite" data-testid="replay-announcer">
        {ready ? replay.announcement : ""}
      </p>
    </section>
  );
}
