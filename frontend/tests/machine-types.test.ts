import { describe, expect, it } from "vitest";
import { MACHINE_TYPES, machineName, machineType } from "@/lib/machine-types";

describe("machine types (illustrative)", () => {
  it("names a machine by its type and number", () => {
    expect(machineName(13)).toBe("Centrifugal pump 13"); // model1
    expect(machineName(11)).toBe("Reciprocating compressor 11"); // model2
    expect(machineName(1)).toBe("Exhaust fan 1"); // model3, age 18
    expect(machineName(100)).toBe("CNC spindle 100"); // model4, age 5
  });
  it("falls back to Machine outside 1..100 and covers six types", () => {
    expect(machineType(0)).toBe("Machine");
    expect(machineType(101)).toBe("Machine");
    expect(new Set(Array.from({ length: 100 }, (_, i) => machineType(i + 1)))).toEqual(new Set(MACHINE_TYPES));
  });
});
