// Shapes of the data service answers (backend/app/schemas/). Only fields the app reads are listed.

export type Status = "alert" | "below_cutoff";
export type MachineModel = "model1" | "model2" | "model3" | "model4";
export type Range = "24h" | "7d";

export type Metadata = {
  app_name: string;
  version: string;
  model_version: string | null;
  model_available: boolean;
  replay_window: { start: string; end: string; status: "planned" | "ready" };
  planner_defaults: {
    label: "illustrative";
    unit: string;
    failure_cost: Record<string, number>;
    planned_repair_cost: Record<string, number>;
    crew_slots: number;
  };
  synthetic?: boolean;
  model_created?: string | null;
  default_cutoff_percent?: number | null;
  replay_start?: string | null;
  replay_start_branch?: string | null;
  data_credit?: string | null;
  splits?: Record<string, string[]> | null;
  machines?: { machine_id: number; model: MachineModel; age: number; unseen: boolean }[];
};

/** Metadata of a deployment that has model data: everything the replay needs is present. */
export type ReadyMetadata = Metadata & {
  model_version: string;
  model_available: true;
  default_cutoff_percent: number;
  replay_start: string;
};

export type FleetRow = {
  rank: number;
  machine_id: number;
  model: MachineModel;
  age: number;
  score: number;
  status: Status;
  /** Newest error stamped strictly before the replay hour, from all records; null when none yet. */
  latest_error: { error: string; time: string } | null;
};

export type Fleet = {
  model_version: string;
  at: string;
  cutoff_percent: number;
  cards: { machines_shown: number; machines_in_alert: number; highest_score: number | null; scored_hour: string };
  distribution: { low: number; high: number; count: number }[];
  rows: FleetRow[];
};

export type FleetTrend = {
  model_version: string;
  at: string;
  cutoff_percent: number;
  range: Range;
  machines_in_population: number;
  points: { hour: string; machines_in_alert: number }[];
};

export type Asset = {
  model_version: string;
  machine_id: number;
  model: MachineModel;
  age: number;
  at: string;
  cutoff_percent: number;
  score: number;
  status: Status;
  past_estimates: { hour: string; score: number }[];
  errors: { time: string; error: string }[];
  repairs: { time: string; component: string }[];
  failures: { time: string; components: string[] }[];
};

export type Telemetry = {
  model_version: string;
  machine_id: number;
  at: string;
  range: Range;
  rows: { hour: string; volt: number | null; rotate: number | null; pressure: number | null; vibration: number | null }[];
};

export type Explanation = {
  model_version: string;
  machine_id: number;
  at: string;
  score: number;
  unit: string;
  base_value: number;
  contributions: { feature: string; contribution: number }[];
  all_others: number;
  caveat: string;
};

/** Filters the fleet answers accept. */
export type FleetQuery = {
  at: string;
  cutoff?: number;
  machine_model?: MachineModel;
  status?: Status;
  machine?: number;
};
