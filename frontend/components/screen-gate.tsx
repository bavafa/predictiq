"use client";

import type { ReactNode } from "react";

import { useData } from "@/components/data-provider";
import { NoModelData, ServiceError, Skeleton, WakingUp } from "@/components/states";

/**
 * Wraps a screen body. Until the data service has told us what it has, a screen shows grey blocks; if the
 * model data isn't installed it says so plainly (no numbers); if the service can't be reached it shows what
 * failed with Try again. Only when model data exists are the children (the screen itself) rendered.
 */
export function ScreenGate({ what, children }: { what: string; children: ReactNode }) {
  const { meta, retryMeta } = useData();
  switch (meta.status) {
    case "loading":
      return (
        <div className="flex flex-col gap-4">
          {meta.slow && <WakingUp />}
          <Skeleton className="h-24 w-full" label={`Loading ${what}`} />
          <Skeleton className="h-64 w-full" label={`Loading ${what}`} />
        </div>
      );
    case "error":
      return <ServiceError what={what} error={meta.error} onRetry={retryMeta} />;
    case "no-model":
      return <NoModelData />;
    case "ready":
      return <>{children}</>;
  }
}
