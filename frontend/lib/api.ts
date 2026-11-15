// Typed client for the data service (docs/architecture.md, "Data service contract").
//
// Caching rule: the app reads `model_version` from /metadata and adds `mv=<model_version>` to every other
// GET. If the service answers 404 to such a request, the deployment may have moved to a new model version:
// /metadata is read once more and, when the version really changed, the request is retried once with the new
// `mv`. An old version's data is never shown.
import type {
  Asset,
  Explanation,
  Fleet,
  FleetQuery,
  FleetTrend,
  ComponentPlanRequest,
  ComponentPlanResponse,
  MachineComponents,
  Metadata,
  PlanRequest,
  PlanResponse,
  ReadyMetadata,
  Range,
  Telemetry,
} from "@/lib/types";

export type ApiErrorKind =
  | "no-model-data" // 503 "Model data unavailable": the model data isn't installed in this deployment
  | "network" // the request never got an answer
  | "server" // 5xx (other than the above) or an answer we can't read
  | "not-found" // 404 that is not about the model version (for example a machine that doesn't exist)
  | "invalid"; // 400 / 422: the service refused the request

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    /** The service's own explanation of a refusal (for example the allowed range); never the submitted value. */
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type RequestOptions = { signal?: AbortSignal };

type Query = Record<string, string | number | undefined>;

function queryString(params: Query): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function problemBody(res: Response): Promise<{ title: string | null; detail: string | undefined }> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const { title, detail } = body as { title?: unknown; detail?: unknown };
      return {
        title: typeof title === "string" ? title : null,
        detail: typeof detail === "string" ? detail : undefined,
      };
    }
  } catch {
    // not JSON: fall through
  }
  return { title: null, detail: undefined };
}

function isMetadata(value: unknown): value is Metadata {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.app_name === "string" &&
    typeof v.version === "string" &&
    (v.model_version === null || typeof v.model_version === "string") &&
    typeof v.model_available === "boolean" &&
    typeof v.replay_window === "object" &&
    v.replay_window !== null
  );
}

export function isReady(meta: Metadata): meta is ReadyMetadata {
  return (
    meta.model_available &&
    typeof meta.model_version === "string" &&
    typeof meta.default_cutoff_percent === "number" &&
    typeof meta.replay_start === "string"
  );
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient(fetchImpl: FetchLike = (input, init) => fetch(input, init), base = "/api/v1") {
  let metadataPromise: Promise<Metadata> | null = null;

  async function send(path: string, params: Query, options: RequestOptions, init?: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(`${base}${path}${queryString(params)}`, { ...init, signal: options.signal });
    } catch (error) {
      if (options.signal?.aborted) throw error; // the caller gave up on purpose; not an error state
      throw new ApiError("network", "The data service could not be reached.");
    }
  }

  async function fail(res: Response): Promise<never> {
    const { title, detail } = await problemBody(res);
    if (res.status === 503 && title === "Model data unavailable") {
      throw new ApiError("no-model-data", "The model data isn't installed in this deployment.", 503);
    }
    if (res.status === 404) throw new ApiError("not-found", title ?? "Not found", 404);
    if (res.status >= 400 && res.status < 500) {
      throw new ApiError("invalid", title ?? "Request refused", res.status, detail);
    }
    throw new ApiError("server", title ?? "The data service had a problem.", res.status);
  }

  async function readJson<T>(res: Response): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new ApiError("server", "The data service sent an answer that couldn't be read.", res.status);
    }
  }

  /**
   * GET /metadata. Held for the life of the page; `refresh` reads it again from the service. It is shared by
   * every caller, so it takes no abort signal: one caller leaving must not fail the others.
   */
  const metadataListeners = new Set<(m: Metadata) => void>();
  /** Called with the new /metadata whenever a refresh (after a stale model version) read it again. */
  function onMetadataRefreshed(listener: (m: Metadata) => void): () => void {
    metadataListeners.add(listener);
    return () => void metadataListeners.delete(listener);
  }

  function metadata(options: { refresh?: boolean } = {}): Promise<Metadata> {
    if (metadataPromise && !options.refresh) return metadataPromise;
    const request = (async () => {
      const res = await send("/metadata", {}, {}, options.refresh ? { cache: "no-cache" } : undefined);
      if (!res.ok) return fail(res);
      const body = await readJson<unknown>(res);
      if (!isMetadata(body)) throw new ApiError("server", "The data service sent unexpected metadata.", res.status);
      return body;
    })();
    metadataPromise = request;
    if (options.refresh) {
      void request.then((m) => metadataListeners.forEach((l) => l(m))).catch(() => undefined);
    }
    // A failed read must not be remembered: the next call tries again.
    request.catch(() => {
      if (metadataPromise === request) metadataPromise = null;
    });
    return request;
  }

  /** The model version to ask for, from /metadata. No model data installed is its own error kind. */
  async function modelVersion(options: { refresh?: boolean } = {}): Promise<string> {
    const meta = await metadata(options);
    if (!meta.model_available || meta.model_version === null) {
      throw new ApiError("no-model-data", "The model data isn't installed in this deployment.", 503);
    }
    return meta.model_version;
  }

  /** GET with `mv` added. On a 404, /metadata is re-read once and the request retried if the version changed. */
  async function get<T>(path: string, params: Query, options: RequestOptions, init?: RequestInit): Promise<T> {
    let mv = await modelVersion();
    for (let attempt = 0; ; attempt += 1) {
      const res = await send(path, { ...params, mv }, options, init);
      if (res.ok) return readJson<T>(res);
      if (res.status === 404 && attempt === 0) {
        const fresh = await modelVersion({ refresh: true });
        if (fresh !== mv) {
          mv = fresh;
          continue;
        }
      }
      return fail(res);
    }
  }

  /**
   * POST /plan. The request body is JSON; `mv` goes in the query like on every other call, with the same
   * retry (the planner stores nothing, so sending it again is safe). A refused input (422) is an "invalid"
   * error whose message is the service's own allowed-range text (`ApiError.detail`).
   */
  const plan = (body: PlanRequest, o: RequestOptions = {}) =>
    get<PlanResponse>("/plan", {}, o, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  /** POST /plan with level "component": same retry and error rules as the machine plan. */
  const componentPlan = (body: ComponentPlanRequest, o: RequestOptions = {}) =>
    get<ComponentPlanResponse>("/plan", {}, o, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  return {
    metadata,
    plan,
    componentPlan,
    onMetadataRefreshed,
    modelVersion,
    fleet: (q: FleetQuery, o: RequestOptions = {}) => get<Fleet>("/fleet", q, o),
    fleetTrend: (q: FleetQuery & { range?: Range }, o: RequestOptions = {}) => get<FleetTrend>("/fleet/trend", q, o),
    asset: (machine: number, q: { at: string; cutoff?: number }, o: RequestOptions = {}) =>
      get<Asset>(`/assets/${machine}`, q, o),
    telemetry: (machine: number, q: { at: string; range?: Range }, o: RequestOptions = {}) =>
      get<Telemetry>(`/assets/${machine}/telemetry`, q, o),
    components: (machine: number, q: { at: string; horizon_days?: number }, o: RequestOptions = {}) =>
      get<MachineComponents>(`/assets/${machine}/components`, q, o),
    explanation: (machine: number, q: { at: string }, o: RequestOptions = {}) =>
      get<Explanation>(`/assets/${machine}/explanation`, q, o),
    modelMetrics: (o: RequestOptions = {}) => get<Record<string, unknown>>("/model/metrics", {}, o),
    thresholdAnalysis: (o: RequestOptions = {}) => get<Record<string, unknown>>("/model/threshold-analysis", {}, o),
  };
}

/** The client the app uses. */
export const api: ApiClient = createApiClient();
