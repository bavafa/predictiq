import { afterEach, describe, expect, it, vi } from "vitest";

import { describeModelVersion, fetchModelVersion, isMetadata } from "@/lib/metadata";

afterEach(() => vi.unstubAllGlobals());

describe("metadata helpers", () => {
  it("validates the shape", () => {
    expect(isMetadata({ app_name: "x", version: "1", model_version: null, model_available: false })).toBe(true);
    expect(isMetadata({ app_name: "x" })).toBe(false);
    expect(isMetadata(null)).toBe(false);
  });

  it("returns unavailable on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }));
    expect(await fetchModelVersion()).toEqual({ status: "unavailable" });
  });

  it("never invents a model version when none is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ app_name: "x", version: "1", model_version: "piq-fake", model_available: false }),
      }),
    );
    const state = await fetchModelVersion();
    expect(describeModelVersion(state)).toBe("none yet");
  });
});
