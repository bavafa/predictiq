import { describe, expect, it } from "vitest";

import { announceThisStep, canStep, playTick, stepped } from "@/lib/replay";

const b = { first: 100, last: 110 };

describe("replay rules", () => {
  it("steps by the chosen size and never leaves the window", () => {
    expect(stepped(105, 1, 1, b)).toBe(106);
    expect(stepped(105, 1, 6, b)).toBe(110);
    expect(stepped(105, -1, 24, b)).toBe(100);
    expect(stepped(110, 1, 1, b)).toBe(110); // never wraps
    expect(stepped(100, -1, 1, b)).toBe(100);
  });
  it("knows when a step can't act", () => {
    expect(canStep(100, -1, b)).toBe(false);
    expect(canStep(100, 1, b)).toBe(true);
    expect(canStep(110, 1, b)).toBe(false);
  });
  it("play stops on reaching the end, even when the step overshoots", () => {
    expect(playTick(108, 1, b)).toEqual({ hour: 109, ended: false });
    expect(playTick(109, 1, b)).toEqual({ hour: 110, ended: true });
    expect(playTick(105, 24, b)).toEqual({ hour: 110, ended: true });
  });
  it("announces every sixth step only", () => {
    const said = [1, 2, 3, 4, 5, 6, 7, 12].filter(announceThisStep);
    expect(said).toEqual([6, 12]);
  });
});
