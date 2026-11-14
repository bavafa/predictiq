// Shape of GET /api/v1/metadata (see backend/app/schemas.py). Only what the shell needs.
export type Metadata = {
  app_name: string;
  version: string;
  model_version: string | null;
  model_available: boolean;
};

export type ModelVersionState =
  | { status: "loading" }
  | { status: "ready"; modelVersion: string | null }
  | { status: "unavailable" };

export function isMetadata(value: unknown): value is Metadata {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.app_name === "string" &&
    typeof v.version === "string" &&
    (v.model_version === null || typeof v.model_version === "string") &&
    typeof v.model_available === "boolean"
  );
}

export async function fetchModelVersion(signal?: AbortSignal): Promise<ModelVersionState> {
  try {
    const res = await fetch("/api/v1/metadata", { signal });
    if (!res.ok) return { status: "unavailable" };
    const body: unknown = await res.json();
    if (!isMetadata(body)) return { status: "unavailable" };
    return { status: "ready", modelVersion: body.model_available ? body.model_version : null };
  } catch {
    return { status: "unavailable" };
  }
}

export function describeModelVersion(state: ModelVersionState): string {
  if (state.status === "loading") return "…";
  if (state.status === "unavailable") return "— (couldn't load)";
  return state.modelVersion ?? "none yet";
}
