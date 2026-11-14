"""`python -m ml.features`: validate, build every feature for the scored hours, report timing."""

import sys
import time

from ml.data import FIRST_SCORED, HOUR, LAST_SCORED
from ml.features import FEATURE_COLUMNS, build_features, feature_fingerprint
from ml.labels import scored_hours
from ml.validate import validate


def main() -> int:
    tables, problems = validate()
    if tables is None or problems:
        print("data checks failed; run python -m ml.validate", file=sys.stderr)
        return 1
    start = time.perf_counter()
    feats = build_features(tables, scored_hours())
    seconds = time.perf_counter() - start
    n_machines = tables.machines["machineID"].nunique()
    telemetry_start = tables.telemetry["datetime"].min()
    warmup_hours = int((FIRST_SCORED - telemetry_start) // HOUR)
    tail_hours = int((tables.telemetry["datetime"].max() - LAST_SCORED) // HOUR)
    print(f"features: {len(feats):,} machine-hours x {len(FEATURE_COLUMNS)} features in {seconds:.1f} s")
    missing = int(feats[FEATURE_COLUMNS].isna().sum().sum())
    print(f"fingerprint {feature_fingerprint()}; missing values: {missing}")
    warm = warmup_hours * n_machines
    tail = tail_hours * n_machines
    print(f"warm-up dropped: {warmup_hours} h x {n_machines} machines = {warm:,} machine-hours")
    print(f"end of coverage dropped: {tail_hours} h x {n_machines} machines = {tail:,} machine-hours")
    return 0


if __name__ == "__main__":
    sys.exit(main())
