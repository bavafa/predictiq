// Illustrative machine types. The source dataset (simulated) does not name machine types; these are our best guesses,
// assigned from machine model (model1 pump, model2 compressor) and, for model3 and model4, an age cut at 10 years.
// One letter per machine, machine 1 first. Derivation: .agent/machine_inference_report.md (local) and DECISIONS.md.
const CODES = "FSMMMMFFSMCMPMFPPFFCCPPPDMMSSFPDFSPSPDSCSPFSFSCSPSDFMCFPSPFSSDDFFSDMCMCSCSFCDDFMSFDMPMCDFCDPFCCCCCPS";

const TYPE: Record<string, string> = {
  P: "Centrifugal pump",
  C: "Reciprocating compressor",
  M: "Industrial mixer",
  F: "Exhaust fan",
  S: "CNC spindle",
  D: "Conveyor drive",
};

export const MACHINE_TYPES = Object.values(TYPE);

/** "Centrifugal pump" for machine 13; "Machine" for a number outside 1..100. */
export function machineType(id: number): string {
  return TYPE[CODES[id - 1] ?? ""] ?? "Machine";
}

/** The display name that replaces "Machine 13": "Centrifugal pump 13". */
export const machineName = (id: number | string) => `${machineType(Number(id))} ${id}`;
