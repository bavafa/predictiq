"use client";

import { AlertTriangle, ClipboardList, Database, Loader } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import type { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Grey block the size of the final content, so nothing jumps (ux-spec, States). Marked as busy for readers. */
export function Skeleton({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ?? "Loading"}
      data-testid="skeleton"
      className={cn("animate-pulse rounded-md bg-line", className)}
    />
  );
}

function Notice({
  tone,
  icon,
  title,
  children,
  testId,
  role,
}: {
  tone: "problem" | "info";
  icon: ReactNode;
  title: string;
  children: ReactNode;
  testId: string;
  role?: "alert" | "status";
}) {
  return (
    <section
      role={role}
      data-testid={testId}
      className={cn(
        "flex gap-3 rounded-lg border border-l-4 bg-card p-4 sm:p-5",
        tone === "problem" ? "border-alert-edge" : "border-input-edge",
      )}
    >
      <span aria-hidden="true" className={cn("mt-0.5 flex-none", tone === "problem" ? "text-alert-text" : "text-ink-2")}>
        {icon}
      </span>
      <div className="min-w-0 text-sm leading-5">
        <h2 className="m-0 text-base leading-6 font-semibold">{title}</h2>
        <div className="mt-1 text-ink-2">{children}</div>
      </div>
    </section>
  );
}

/**
 * The model data isn't installed in this deployment (the data service answered "Model data unavailable").
 * No numbers, no placeholders, no charts.
 */
export function NoModelData() {
  return (
    <Notice
      tone="info"
      icon={<Database size={20} />}
      title="The model data isn't installed in this preview"
      testId="no-model-data"
      role="status"
    >
      <p className="m-0">
        This preview has no saved model scores, so there is nothing to show on this page. No numbers appear here
        rather than made-up ones.
      </p>
      <p className="mt-2 mb-0">
        You can still read what the sample data is and what this demo does not do on{" "}
        <Link href="/about-data" className="inline-flex min-h-11 items-center text-link underline">
          About &amp; Data
        </Link>
        .
      </p>
    </Notice>
  );
}

/** A failed request: what failed, and Try again. Settings are kept; the rest of the page is not blanked. */
export function ServiceError({ what, error, onRetry }: { what: string; error: ApiError | null; onRetry: () => void }) {
  const reason =
    error?.kind === "network"
      ? "The data service could not be reached. Check your connection."
      : error?.kind === "server"
        ? "The data service had a problem."
        : null;
  return (
    <Notice tone="problem" icon={<AlertTriangle size={20} />} title={`Couldn't load ${what}.`} testId="service-error" role="alert">
      {reason && <p className="m-0">{reason}</p>}
      <p className="m-0 mt-1">Your settings are kept.</p>
      <Button className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </Notice>
  );
}

/** Shown when the data service takes a while to answer (it sleeps when nobody uses it). */
export function WakingUp() {
  return (
    <Notice tone="info" icon={<Loader size={20} />} title="Waking up the data service…" testId="waking-up" role="status">
      <p className="m-0">This can take up to a minute. The page fills in by itself.</p>
      <p className="mt-2 mb-0">
        <Link href="/about-data" className="inline-flex min-h-11 items-center text-link underline">
          Read about the data while you wait
        </Link>
      </p>
    </Notice>
  );
}

/** One panel failed: it says what failed and offers Try again; the rest of the page stays as it was. */
export function PanelError({ message, onRetry, testId }: { message: string; onRetry: () => void; testId: string }) {
  return (
    <Notice tone="problem" icon={<AlertTriangle size={20} />} title={message} testId={testId} role="status">
      <p className="m-0">The rest of this page is still correct.</p>
      <Button className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </Notice>
  );
}

/** The model has not been evaluated yet (or the saved evaluation is not in a usable form): no numbers at all. */
export function ResultsNotAvailable() {
  return (
    <Notice
      tone="info"
      icon={<ClipboardList size={20} />}
      title="Results appear after the model is evaluated"
      testId="results-not-available"
      role="status"
    >
      <p className="m-0">There are no saved evaluation results to show yet, so no numbers appear here rather than made-up ones.</p>
    </Notice>
  );
}
