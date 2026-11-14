"use client";

import { useData } from "@/components/data-provider";

export function ModelVersion() {
  const { meta } = useData();
  const text =
    meta.status === "loading"
      ? "…"
      : meta.status === "error"
        ? "— (couldn't load)"
        : meta.status === "no-model"
          ? "none yet"
          : meta.meta.model_version;
  return (
    <span data-testid="model-version" aria-live="polite">
      {text}
    </span>
  );
}
