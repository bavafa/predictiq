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
