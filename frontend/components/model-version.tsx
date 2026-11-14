"use client";

import { useEffect, useState } from "react";

import { describeModelVersion, fetchModelVersion, type ModelVersionState } from "@/lib/metadata";

export function ModelVersion() {
  const [state, setState] = useState<ModelVersionState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchModelVersion(controller.signal).then((s) => {
      if (!controller.signal.aborted) setState(s);
    });
    return () => controller.abort();
  }, []);

  return (
    <span data-testid="model-version" aria-live="polite">
      {describeModelVersion(state)}
    </span>
  );
}
