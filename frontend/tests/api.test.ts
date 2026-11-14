import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient } from "@/lib/api";
import { MV, fakeFetch, json, noModelMetadata, problem, readyMetadata } from "./helpers";

const AT = "2015-11-01T06:00";

describe("api client", () => {
  it("reads model_version from /metadata and adds mv to every other GET", async () => {
    const f = fakeFetch(readyMetadata(), async () => json({ rows: [] }));
    const api = createApiClient(f);
    await api.fleet({ at: AT, cutoff: 40 });
    await api.asset(7, { at: AT });
    await api.modelMetrics();
    const urls = f.mock.calls.map((c) => c[0]);
    expect(urls[0]).toBe("/api/v1/metadata");
    for (const u of urls.slice(1)) expect(u).toContain(`mv=${MV}`);
    expect(urls[1]).toBe(`/api/v1/fleet?at=${encodeURIComponent(AT)}&cutoff=40&mv=${MV}`);
    expect(urls.filter((u) => u.startsWith("/api/v1/metadata"))).toHaveLength(1); // read once, then held
  });

  it("on 404 re-reads /metadata once and retries with the new version", async () => {
    let current = MV;
    const f = vi.fn(async (input: string) => {
      if (input.startsWith("/api/v1/metadata")) return json(readyMetadata({ model_version: current }));
      if (!input.includes(`mv=${current}`)) return problem(404, "Not found");
      return json({ model_version: current, rows: [] });
    });
    const api = createApiClient(f);
    await api.metadata(); // the page loaded under the old version
    current = "piq-test-2"; // a release happened
    const body = await api.fleet({ at: AT });
    expect(body.model_version).toBe("piq-test-2");
    const urls = f.mock.calls.map((c) => c[0]);
    expect(urls.filter((u) => u.startsWith("/api/v1/metadata"))).toHaveLength(2);
    expect(urls.at(-1)).toContain("mv=piq-test-2");
    expect(urls.filter((u) => u.startsWith("/api/v1/fleet"))).toHaveLength(2);
  });

  it("does not retry forever: a 404 with an unchanged version is a not-found error", async () => {
    const f = fakeFetch(readyMetadata(), async () => problem(404, "Not found"));
    const api = createApiClient(f);
    await expect(api.asset(101, { at: AT })).rejects.toMatchObject({ kind: "not-found", status: 404 });
    expect(f.mock.calls.filter((c) => c[0].startsWith("/api/v1/assets"))).toHaveLength(1);
  });

  it("treats 'model data unavailable' (503) as its own no-model-data error", async () => {
    const f = fakeFetch(readyMetadata(), async () => problem(503, "Model data unavailable"));
    await expect(createApiClient(f).fleet({ at: AT })).rejects.toMatchObject({ kind: "no-model-data", status: 503 });
  });

  it("treats metadata with no model as no-model-data without asking for data", async () => {
    const f = fakeFetch(noModelMetadata());
    await expect(createApiClient(f).fleet({ at: AT })).rejects.toMatchObject({ kind: "no-model-data" });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("maps network failures, other 5xx and refusals to distinct kinds", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("offline");
    });
    await expect(createApiClient(down).metadata()).rejects.toMatchObject({ kind: "network" });

    const boom = fakeFetch(readyMetadata(), async () => problem(500, "Internal error"));
    await expect(createApiClient(boom).fleet({ at: AT })).rejects.toMatchObject({ kind: "server", status: 500 });
    const other503 = fakeFetch(readyMetadata(), async () => problem(503, "Something else"));
    await expect(createApiClient(other503).fleet({ at: AT })).rejects.toMatchObject({ kind: "server" });

    const refused = fakeFetch(readyMetadata(), async () => problem(422, "Outside the replay window"));
    await expect(createApiClient(refused).fleet({ at: AT })).rejects.toMatchObject({ kind: "invalid", status: 422 });
  });

  it("does not remember a failed /metadata read", async () => {
    let up = false;
    const f = fakeFetch(() => (up ? json(readyMetadata()) : problem(500, "Internal error")));
    const api = createApiClient(f);
    await expect(api.metadata()).rejects.toBeInstanceOf(ApiError);
    up = true;
    await expect(api.metadata()).resolves.toMatchObject({ model_version: MV });
  });

  it("rejects an unreadable body as a server error", async () => {
    const f = fakeFetch(readyMetadata(), async () => new Response("<html>", { status: 200 }));
    await expect(createApiClient(f).fleet({ at: AT })).rejects.toMatchObject({ kind: "server" });
  });
});
