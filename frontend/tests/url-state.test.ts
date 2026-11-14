import { describe, expect, it } from "vitest";

import { formatHour, parseHour, readableHour } from "@/lib/time";
import type { ReadyMetadata } from "@/lib/types";
import { applyChanges, carriedSearch, parseUrlState } from "@/lib/url-state";
import { readyMetadata } from "./helpers";

const meta = readyMetadata() as ReadyMetadata; // window 2015-11-01 00:00 to 2015-11-03 00:00, start 06:00, cut-off 51

describe("time helpers", () => {
  it("accepts only whole valid hours", () => {
    expect(parseHour("2015-11-01T06:00")).not.toBeNull();
    expect(parseHour("2015-11-01T06:00:00")).not.toBeNull();
    for (const bad of ["2015-11-01T06:30", "2015-02-30T00:00", "2015-11-01T24:00", "2015-11-01", "x", "", "2015-11-01T06:00\n"]) {
      expect(parseHour(bad), bad).toBeNull();
    }
  });
  it("round-trips and reads aloud in full", () => {
    const h = parseHour("2015-11-14T06:00") as number;
    expect(formatHour(h)).toBe("2015-11-14T06:00");
    expect(readableHour(h)).toBe("14 November 2015, 06:00");
  });
});

describe("parseUrlState", () => {
  it("uses the replay start and default cut-off for an empty address", () => {
    const s = parseUrlState("", meta);
    expect(s.at).toBe("2015-11-01T06:00");
    expect(s.cutoff).toBe(51);
    expect(s.machine).toEqual({ kind: "none" });
    expect(s.filters).toEqual({ machine_model: null, status: null, machine_number: null });
    expect(s.issues).toEqual([]);
  });

  it("keeps a shared link's own replay time, cut-off, machine and filters", () => {
    const s = parseUrlState("?at=2015-11-02T12:00&cutoff=35&machine=7&machine_model=model2&status=alert&machine_number=12", meta);
    expect(s.at).toBe("2015-11-02T12:00");
    expect(s.cutoff).toBe(35);
    expect(s.machine).toEqual({ kind: "ok", id: 7 });
    expect(s.filters).toEqual({ machine_model: "model2", status: "alert", machine_number: 12 });
    expect(s.issues).toEqual([]);
  });

  it("accepts both ends of the window and cut-offs 0 and 100", () => {
    expect(parseUrlState("?at=2015-11-01T00:00&cutoff=0", meta)).toMatchObject({ at: "2015-11-01T00:00", cutoff: 0 });
    expect(parseUrlState("?at=2015-11-03T00:00:00&cutoff=100", meta)).toMatchObject({ at: "2015-11-03T00:00", cutoff: 100 });
  });

  it.each(["2015-10-31T23:00", "2015-11-03T01:00", "2015-11-01T06:30", "yesterday", "2015-02-30T00:00", ""])(
    "ignores a replay time that isn't an hour in the window (%j)",
    (at) => {
      const s = parseUrlState(new URLSearchParams({ at }), meta);
      expect(s.at).toBe("2015-11-01T06:00");
      expect(s.issues).toHaveLength(1);
    },
  );

  it.each(["101", "-1", "50.5", "abc", "", "1e1", "٥"])("ignores a cut-off that isn't a whole percent 0-100 (%j)", (cutoff) => {
    const s = parseUrlState(new URLSearchParams({ cutoff }), meta);
    expect(s.cutoff).toBe(51);
    expect(s.issues).toHaveLength(1);
  });

  it("flags machine numbers outside 1-100 for the 'isn't in the sample data' state", () => {
    expect(parseUrlState("?machine=101", meta).machine).toEqual({ kind: "out-of-range", text: "101" });
    expect(parseUrlState("?machine=0", meta).machine).toEqual({ kind: "out-of-range", text: "0" });
    expect(parseUrlState("?machine=abc", meta).machine).toEqual({ kind: "out-of-range", text: "" });
    expect(parseUrlState("?machine=100", meta).machine).toEqual({ kind: "ok", id: 100 });
  });

  it("ignores bad filters and says so", () => {
    const s = parseUrlState("?machine_model=model9&status=watch&machine_number=500", meta);
    expect(s.filters).toEqual({ machine_model: null, status: null, machine_number: null });
    expect(s.issues).toHaveLength(3);
  });
});

describe("applyChanges and carriedSearch", () => {
  it("leaves out values equal to their defaults and keeps unknown keys", () => {
    expect(applyChanges("", { at: "2015-11-01T06:00", cutoff: 51 }, meta)).toBe("");
    expect(applyChanges("?x=1", { at: "2015-11-02T00:00", cutoff: 30 }, meta)).toBe("?x=1&at=2015-11-02T00%3A00&cutoff=30");
  });
  it("removes a key with null", () => {
    expect(applyChanges("?status=alert&cutoff=30", { status: null }, meta)).toBe("?cutoff=30");
  });
  it("carries only the shared keys to another page", () => {
    expect(carriedSearch("?at=2015-11-02T00%3A00&cutoff=30&machine=4&status=alert&machine_model=model2")).toBe(
      "?at=2015-11-02T00%3A00&cutoff=30&machine=4",
    );
    expect(carriedSearch("?status=alert")).toBe("");
  });
});
