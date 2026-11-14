"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";

/**
 * The shared alert cut-off (decision 13): a native range input, 0% to 100% in 1-point steps, with a visible
 * label, both ends written, the value as text, "(default)" or "(custom)" and Reset to default. Keys apply at
 * once; a drag applies on release. The value lives in the web address.
 */
export function CutoffControl({ onChanged }: { onChanged?: (cutoff: number) => void }) {
  const { meta, view, update } = useData();
  const id = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const draftRef = useRef<number | null>(null);
  const dragging = useRef(false);

  const cutoff = view?.cutoff ?? 0;
  useEffect(() => {
    if (!dragging.current) {
      draftRef.current = null;
      setDraft(null);
    }
  }, [cutoff]);

  if (meta.status !== "ready" || !view) return null;
  const def = meta.meta.default_cutoff_percent;

  const apply = (value: number) => {
    const next = Math.min(100, Math.max(0, value));
    update({ cutoff: next });
    onChanged?.(next);
  };
  const commit = () => {
    if (draftRef.current !== null) apply(draftRef.current);
    draftRef.current = null;
    setDraft(null);
  };

  const shown = draft ?? cutoff;
  const custom = shown !== def;
  const valueText = `${shown} percent, ${custom ? "custom" : "default"}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label htmlFor={id} className="text-sm font-semibold">
        Alert cut-off
      </label>
      <span className="text-xs text-ink-2">0%</span>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={shown}
        aria-valuetext={valueText}
        className="h-11 min-w-40 max-w-xs flex-1 cursor-pointer accent-brand"
        onChange={(e) => {
          const next = Number(e.target.value);
          if (dragging.current) {
            draftRef.current = next;
            setDraft(next);
          } else {
            apply(next);
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
          if (e.key === "PageUp" || e.key === "PageDown") {
            e.preventDefault();
            apply(cutoff + (e.key === "PageUp" ? 10 : -10));
          }
        }}
      />
      <span className="text-xs text-ink-2">100%</span>
      <span data-testid="cutoff-value" className="tabular text-sm font-bold">
        {shown}% ({custom ? "custom" : "default"})
      </span>
      {custom && (
        <span className="rounded-sm border border-ink-2 bg-card px-1.5 text-xs leading-5 font-semibold">changed</span>
      )}
      <Button
        aria-disabled={!custom}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (custom) apply(def);
        }}
      >
        Reset to default
      </Button>
      <span className="text-xs text-ink-2">Default set on validation data. Shared with the Planner and Model Performance.</span>
    </div>
  );
}
