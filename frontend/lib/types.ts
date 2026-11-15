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
  /** Present only when the bundle has component scores (decisions 77 and 79). */
  component_planner?: ComponentPlannerInfo | null;
};

export type PartId = "comp1" | "comp2" | "comp3" | "comp4";

export type ComponentPlannerInfo = {
  component_model_version: string;
  names: Record<PartId, string>;
  names_note: string;
  horizons_days: number[];
  default_horizon_days: number;
  shutdown_windows: Record<string, { weekday: number; start_hour: number; hours: number }>;
  windows_note: string;
  default_failure_cost: Record<PartId, number>;
  default_planned_cost: Record<PartId, number>;
  warning_cutoff_percent: Record<PartId, number>;
  honesty: string;
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

/** Body of POST /plan. Whole numbers only; every cost is an illustrative assumption. */
export type PlanRequest = {
  at: string;
  /** 0 to 100; omitted = the model's default cut-off. */
  cutoff_percent?: number;
  /** One cost for every machine, 0 to 10,000,000. */
  failure_cost: number;
  /** Optional costs per machine model (same range); models left out use `failure_cost`. */
  failure_cost_by_model?: Partial<Record<MachineModel, number>>;
  /** Shared planned cost per shortlisted machine, 0 to 10,000,000. */
  planned_cost: number;
  /** Optional planned costs per machine model (same range, decision 55); models left out use `planned_cost`. */
  planned_cost_by_model?: Partial<Record<MachineModel, number>>;
  /** 0 to 100. */
  crew_slots: number;
  /** null / omitted = off; otherwise 0 to 90 in steps of 5. */
  risk_reduction_percent?: number | null;
  include_below_cutoff?: boolean;
};

export type PlanListing = "shortlisted" | "over_capacity" | "below_cutoff";

export type PlanRow = {
  rank: number;
  machine_id: number;
  model: MachineModel;
  age: number;
  score: number;
  status: Status;
  failure_cost: number;
  planned_cost: number;
  expected_exposure: number;
  listing: PlanListing;
  /** 1..crew slots for shortlisted machines, otherwise null. */
  slot: number | null;
  /** Places moved up (+) or down (-) versus the order by chance alone; null unless per-model costs differ. */
  moved: number | null;
  /** Estimate; shortlisted rows only, and only when a risk reduction is assumed. */
  net_benefit: number | null;
};

export type PlanResponse = {
  model_version: string;
  at: string;
  label: "illustrative";
  unit: string;
  assumptions: {
    cutoff_percent: number;
    failure_cost: number;
    failure_cost_by_model: Partial<Record<MachineModel, number>>;
    planned_cost: number;
    planned_cost_by_model?: Partial<Record<MachineModel, number>>;
    crew_slots: number;
    risk_reduction_percent: number | null;
    include_below_cutoff: boolean;
  };
  /** null unless per-model costs differ. */
  order_changed: boolean | null;
  order_note: string | null;
  summary: {
    machines_at_or_above_cutoff: number;
    machines_listed: number;
    crew_slots: number;
    slots_used: number;
    spare_slots: number;
    shortlist_exposure: number;
    planned_spend: number;
    net_benefit: number | null;
    net_benefit_label: string | null;
  };
  rows: PlanRow[];
  /** Plain-words formulas for "How this is calculated". */
  formulas: Record<string, string>;
};

/** Body of POST /plan with level "component". There is no alert cut-off for the wear view (decision 79). */
export type ComponentPlanRequest = {
  level: "component";
  at: string;
  /** 7 or 14. */
  horizon_days: number;
  failure_cost: number;
  failure_cost_by_part?: Partial<Record<PartId, number>>;
  planned_cost: number;
  planned_cost_by_part?: Partial<Record<PartId, number>>;
  /** Slots per shutdown window, 0 to 100. */
  crew_slots: number;
  risk_reduction_percent?: number | null;
};

export type ComponentListing = "shortlisted" | "over_capacity" | "no_exposure";
export type ComponentAction = "act_before_window" | "replace_in_window" | "over_capacity" | "watch";

export type ComponentPlanRow = {
  rank: number;
  machine_id: number;
  model: MachineModel;
  age: number;
  part: PartId;
  part_name: string;
  wear_chance: number;
  warning_chance_48h: number;
  warning_active: boolean;
  signal: "warning" | "wear";
  days_since_replacement: number;
  window_start: string;
  days_to_window: number;
  chance_before_window: number;
  failure_cost: number;
  planned_cost: number;
  expected_exposure: number;
  listing: ComponentListing;
  slot: number | null;
  action: ComponentAction;
  net_benefit: number | null;
};

export type ComponentPlanResponse = {
  level: "component";
  model_version: string;
  component_model_version: string;
  at: string;
  label: "illustrative";
  unit: string;
  horizon_days: number;
  honesty: string;
  assumptions: {
    horizon_days: number;
    failure_cost: number;
    failure_cost_by_part: Partial<Record<PartId, number>>;
    planned_cost: number;
    planned_cost_by_part: Partial<Record<PartId, number>>;
    crew_slots_per_window: number;
    risk_reduction_percent: number | null;
  };
  summary: {
    parts_ranked: number;
    rows_returned: number;
    warning_parts: number;
    crew_slots_per_window: number;
    slots_used: number;
    shortlist_exposure: number;
    planned_spend: number;
    net_benefit: number | null;
    net_benefit_label: string | null;
    windows: { models: string[]; start: string; shortlisted: number }[];
  };
  rows: ComponentPlanRow[];
  names: Record<PartId, string>;
  names_note: string;
  windows_note: string;
  notes: string[];
  formulas: Record<string, string>;
};

export type ComponentPart = {
  part: PartId;
  part_name: string;
  wear_chance: number;
  chance_before_window: number;
  warning_chance_48h: number;
  warning_active: boolean;
  warning_cutoff_percent: number;
  days_since_replacement: number;
};

export type MachineComponents = {
  model_version: string;
  component_model_version: string;
  machine_id: number;
  model: MachineModel;
  age: number;
  at: string;
  horizon_days: number;
  window_start: string;
  days_to_window: number;
  honesty: string;
  names_note: string;
  windows_note: string;
  parts: ComponentPart[];
};
