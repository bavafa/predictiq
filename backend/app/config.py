"""Static, non-secret service constants. Nothing here is read from the environment."""

API_PREFIX = "/api/v1"
APP_NAME = "PredictIQ"
APP_VERSION = "0.1.0"

DATASET_NAME = "Predictive Maintenance Modelling Guide sample dataset (simulated)"
DATASET_PUBLISHER = "Microsoft"
DATASET_REPOSITORY = "https://github.com/microsoft/sqlworkshops"
# Keep in sync with docs/DATA_PROVENANCE.md (a test checks this).
DATASET_PINNED_COMMIT = "e836f4e866028db7fd7d1a66b88f79664a1f4eac"

# Replay window from decisions 36 and 49. Planned only: no model or scores exist yet.
REPLAY_WINDOW_START = "2015-11-01T00:00:00"
REPLAY_WINDOW_END = "2015-12-30T06:00:00"

# Cache-Control values (docs/architecture.md, "Data service contract").
CACHE_NO_STORE = "no-store"
CACHE_METADATA = "public, max-age=0, s-maxage=60, stale-while-revalidate=300"
# Data endpoints (with the current `mv`): safe to cache, one deployment serves one model version.
CACHE_DATA = "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400"

# Size limits (docs/architecture.md, "Validation"): at most 168 time points, 100 machines per response.
MAX_POINTS = 168
N_MACHINES = 100
MACHINE_MODELS = ("model1", "model2", "model3", "model4")
STATUSES = ("alert", "below_cutoff")

# EXAMPLE planner costs. ILLUSTRATIVE, NOT REAL: the dataset has no money figures. Proposed, owner to
# confirm (DECISIONS.md, decision 55). Shown with the word "illustrative" wherever they appear.
# POST /plan takes its costs from the request; these are only the starting values the Planner screen shows.
PLANNER_DEFAULTS: dict[str, str | int | dict[str, int]] = {
    "label": "illustrative",
    "unit": "illustrative currency units",
    "failure_cost": {"model1": 10_000, "model2": 8_000, "model3": 12_000, "model4": 9_000},
    "planned_repair_cost": {"model1": 2_500, "model2": 2_000, "model3": 3_000, "model4": 2_250},
    "crew_slots": 5,
}

# ---- Component planner (spec docs/specs/component-planner.md; decisions 77 and 79) -------------------------
COMPONENTS = ("comp1", "comp2", "comp3", "comp4")
COMPONENT_NAMES = {"comp1": "Motor winding", "comp2": "Bearing", "comp3": "Seal / valve", "comp4": "Coupling"}
COMPONENT_NAMES_NOTE = (
    "Illustrative names, assumed, not stated by the source. The data only has comp1 to comp4."
)
COMPONENT_HORIZONS = (7, 14)
COMPONENT_DEFAULT_HORIZON = 14
COMPONENT_ROWS_MAX = 100  # rows returned by the component plan; the summary counts every ranked part
# One ASSUMED weekly shutdown window per machine model (the data has no shutdown or maintenance windows).
# weekday: 0 = Monday .. 6 = Sunday; start_hour and hours are on the data's own clock (no time zone).
SHUTDOWN_WINDOWS: dict[str, dict[str, int]] = {
    "model1": {"weekday": 6, "start_hour": 6, "hours": 12},
    "model2": {"weekday": 0, "start_hour": 6, "hours": 12},
    "model3": {"weekday": 1, "start_hour": 6, "hours": 12},
    "model4": {"weekday": 2, "start_hour": 6, "hours": 12},
}
SHUTDOWN_WINDOWS_NOTE = (
    "Assumed, not from the data: one weekly window per machine model, set in the service config."
)
# EXAMPLE per-part costs. ILLUSTRATIVE, NOT REAL (the dataset has no money figures); the request sets
# the real values.
COMPONENT_PLANNER_DEFAULTS: dict[str, dict[str, int]] = {
    "failure_cost": {"comp1": 9_000, "comp2": 6_000, "comp3": 4_000, "comp4": 5_000},
    "planned_cost": {"comp1": 2_500, "comp2": 1_500, "comp3": 1_000, "comp4": 1_200},
}
COMPONENT_HONESTY = (
    "In this simulated data, warning signs appear about 2 days before a failure. The 7 to 14 day view is a "
    "wear estimate from part age and history, not an early warning."
)
