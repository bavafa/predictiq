import { cn } from "@/lib/utils";

// The three value types (ux-spec, Labeling rules). The word is always visible; the edge style differs too
// (solid, dashed, dotted), so colour is never the only signal.
const KINDS = {
  Historical: "border-solid border-ink-2",
  Predicted: "border-dashed border-ink-2",
  Illustrative: "border-dotted border-ink-2",
} as const;

export function ValueLabel({ kind, className }: { kind: keyof typeof KINDS; className?: string }) {
  return (
    <span
      data-value-label={kind}
      className={cn("inline-block rounded-sm border bg-card px-1.5 text-xs leading-5 font-semibold text-ink", KINDS[kind], className)}
    >
      {kind}
      <span className="sr-only">, simulated data</span>
    </span>
  );
}
