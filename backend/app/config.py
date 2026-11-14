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
