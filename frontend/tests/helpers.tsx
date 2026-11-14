import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";

import { DataProvider } from "@/components/data-provider";
import { createApiClient, type FetchLike } from "@/lib/api";
import type { Metadata } from "@/lib/types";

export const MV = "piq-test-1";

/** A model-ready /metadata answer: a 49-hour window that starts a day-and-a-bit before the replay start. */
export function readyMetadata(overrides: Partial<Metadata> = {}): Metadata {
  return {
    app_name: "PredictIQ",
    version: "0.1.0",
    model_version: MV,
    model_available: true,
    replay_window: { start: "2015-11-01T00:00:00", end: "2015-11-03T00:00:00", status: "ready" },
    replay_start: "2015-11-01T06:00:00",
    replay_start_branch: "first_hour_with_alert",
    default_cutoff_percent: 51,
    planner_defaults: { label: "illustrative", unit: "units", failure_cost: {}, planned_repair_cost: {}, crew_slots: 5 },
    machines: Array.from({ length: 100 }, (_, i) => ({ machine_id: i + 1, model: "model1", age: 1, unseen: false })),
    ...overrides,
  };
}

/** The answer of a deployment with no model data installed. */
export function noModelMetadata(): Metadata {
  return {
    app_name: "PredictIQ",
    version: "0.1.0",
    model_version: null,
    model_available: false,
    replay_window: { start: "2015-11-01T00:00:00", end: "2015-12-30T06:00:00", status: "planned" },
    planner_defaults: { label: "illustrative", unit: "units", failure_cost: {}, planned_repair_cost: {}, crew_slots: 5 },
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

export function problem(status: number, title: string): Response {
  return json({ type: "about:blank", title, status }, status);
}

/** A fetch stand-in that answers /metadata and nothing else unless `handler` does. */
export function fakeFetch(metadata: Metadata | (() => Response | Promise<Response>), handler?: FetchLike) {
  return vi.fn<FetchLike>(async (input, init) => {
    if (input.startsWith("/api/v1/metadata")) {
      return typeof metadata === "function" ? metadata() : json(metadata);
    }
    if (handler) return handler(input, init);
    return problem(404, "Not found");
  });
}

export function renderWithData(ui: ReactElement, fetchImpl: FetchLike) {
  const client = createApiClient(fetchImpl);
  return render(<DataProvider client={client}>{ui}</DataProvider>);
}

/** Point the address at `search` (for example "?at=2015-11-02T00:00") before rendering. */
export function setAddress(search: string, path = "/") {
  window.history.replaceState(null, "", `${path}${search}`);
}
