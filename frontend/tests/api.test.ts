import { describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, type FetchLike } from "@/lib/api";
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

  describe("plan()", () => {
    const BODY = { at: AT, failure_cost: 10_000, planned_cost: 2_000, crew_slots: 5 };

    it("POSTs the JSON body to /plan with mv in the query", async () => {
      const f = fakeFetch(readyMetadata(), async () => json({ rows: [] }));
      await createApiClient(f).plan(BODY);
      const [url, init] = f.mock.calls[1] as [string, RequestInit | undefined];
      expect(url).toBe(`/api/v1/plan?mv=${MV}`);
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual(BODY);
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    it("on 404 re-reads /metadata once and retries the same body with the new version", async () => {
      let current = MV;
      const f = vi.fn<FetchLike>(async (input) => {
        if (input.startsWith("/api/v1/metadata")) return json(readyMetadata({ model_version: current }));
        if (!input.includes(`mv=${current}`)) return problem(404, "Not found");
        return json({ model_version: current, rows: [] });
      });
      const api = createApiClient(f);
      await api.metadata();
      current = "piq-test-2";
      const body = await api.plan(BODY);
      expect(body.model_version).toBe("piq-test-2");
      const posts = f.mock.calls.filter((c) => c[0].startsWith("/api/v1/plan"));
      expect(posts).toHaveLength(2);
      const [first, second] = posts;
      expect(second?.[0]).toBe("/api/v1/plan?mv=piq-test-2");
      expect(second?.[1]?.body).toBe(first?.[1]?.body);
    });

    it("does not retry a 404 when the version did not change", async () => {
      const f = fakeFetch(readyMetadata(), async () => problem(404, "Not found"));
      await expect(createApiClient(f).plan(BODY)).rejects.toMatchObject({ kind: "not-found" });
      expect(f.mock.calls.filter((c) => c[0].startsWith("/api/v1/plan"))).toHaveLength(1);
    });

    it("keeps the service's allowed-range message on a refusal", async () => {
      const refused = async () =>
        new Response(
          JSON.stringify({ title: "Invalid request", status: 422, detail: "Invalid field: crew_slots must be a whole number from 0 to 100" }),
          { status: 422, headers: { "content-type": "application/problem+json" } },
        );
      const f = fakeFetch(readyMetadata(), refused);
      await expect(createApiClient(f).plan({ ...BODY, crew_slots: 500 })).rejects.toMatchObject({
        kind: "invalid",
        status: 422,
        detail: "Invalid field: crew_slots must be a whole number from 0 to 100",
      });
    });

    it("reports no-model-data without posting", async () => {
      const f = fakeFetch(noModelMetadata());
      await expect(createApiClient(f).plan(BODY)).rejects.toMatchObject({ kind: "no-model-data" });
      expect(f).toHaveBeenCalledTimes(1);
    });
  });

  it("rejects an unreadable body as a server error", async () => {
    const f = fakeFetch(readyMetadata(), async () => new Response("<html>", { status: 200 }));
    await expect(createApiClient(f).fleet({ at: AT })).rejects.toMatchObject({ kind: "server" });
  });
});
