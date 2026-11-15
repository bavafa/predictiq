"""Read-only access to the serving bundle (docs/architecture.md, "Bundle format").

A bundle is one folder per model version: dense machine x hour NumPy arrays plus small JSON files, built
offline by `scripts/build_bundle.py`. This module uses numpy only (no model libraries, decision 32) and
memory-maps the big arrays. If no bundle is present, `get_bundle` returns None and the data endpoints
answer 503; nothing is ever made up.

Layout (schema 1):
  meta.json            model version, grid, replay window, cut-offs, splits, credit, machines, features
  evaluation.json      both models' test results without the threshold tables
  threshold_analysis.json
  scores_main.npy, scores_baseline.npy       float32 (machines, test hours); the score at hour t only
                                             uses records stamped before t
  contrib_codes.npy    uint8   (machines, test hours, 8)  feature index, largest push first
  contrib_values.npy   float32 (machines, test hours, 8)  push in log-odds
  contrib_other.npy    float32 (machines, test hours)     sum of all other pushes
  telemetry.npy        float32 (machines, telemetry hours, 4)  NaN where a reading is missing
  records.json         errors, repairs and failure events from the telemetry start on
Optional component files (spec step 3; absent in older bundles, then `components` is None):
  components.json, component_wear_scores.npy (2 horizons, machines, days, 4 parts),
  component_days_since.npy (machines, days, 4), component_warning_scores.npy (machines, test hours, 4)
Machine m (1-based) is row m - 1.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import numpy.typing as npt

SCHEMA = 1
ENV_DIR = "PREDICTIQ_BUNDLE_DIR"
HOUR = timedelta(hours=1)
SENSORS = ("volt", "rotate", "pressure", "vibration")
TOP_K = 8

F32 = npt.NDArray[np.float32]
U8 = npt.NDArray[np.uint8]


class BundleError(Exception):
    """The folder looks like a bundle but is unusable (wrong schema, missing file, wrong shape)."""


def find_bundle_dir() -> Path | None:
    """PREDICTIQ_BUNDLE_DIR (exclusive when set), else `bundle/` beside the `app` package (the Vercel copy),
    else the newest `artifacts/piq-*/bundle` of a git checkout."""
    env = os.environ.get(ENV_DIR)
    if env is not None:
        p = Path(env)
        return p if (p / "meta.json").is_file() else None
    backend_root = Path(__file__).resolve().parents[1]
    beside = backend_root / "bundle"
    if (beside / "meta.json").is_file():
        return beside
    repo = backend_root.parent
    if (repo / "pyproject.toml").is_file():
        found = sorted((repo / "artifacts").glob("piq-*/bundle/meta.json"))
        if found:
            return found[-1].parent
    return None


@dataclass(frozen=True)
class Components:
    """Component wear and warning scores (decisions 77 and 79). Parts are in `parts` order."""

    meta: dict[str, Any]
    wear: F32  # (horizon, machine, day, part): chance of failure within 7 or 14 days, scored daily at 06:00
    since: F32  # (machine, day, part): days since the part was replaced or failed
    warning: F32  # (machine, test hour, part): chance of failure within 48 hours
    first_day: datetime
    n_days: int

    @property
    def parts(self) -> list[str]:
        return [str(c) for c in self.meta["components"]]

    @property
    def horizons(self) -> list[int]:
        return [int(h) for h in self.meta["horizons_days"]]

    @property
    def version(self) -> str:
        return str(self.meta["component_model_version"])

    def day_index(self, t: datetime) -> int:
        """Index of the latest 06:00 scoring day at or before `t`."""
        return int((t - self.first_day) / timedelta(days=1))


@dataclass(frozen=True)
class Bundle:
    root: Path
    meta: dict[str, Any]
    evaluation: dict[str, Any]
    threshold: dict[str, Any]
    scores: dict[str, F32]
    codes: U8
    values: F32
    other: F32
    telemetry: F32
    errors: dict[int, list[tuple[int, str]]]  # machine -> (hours since telemetry start, error type)
    repairs: dict[int, list[tuple[int, str]]]
    failures: dict[int, list[tuple[int, list[str]]]]
    test_start: datetime
    replay_start: datetime
    replay_end: datetime
    tel_start: datetime
    n_hours: int
    n_machines: int
    components: Components | None = None

    @property
    def model_version(self) -> str:
        return str(self.meta["model_version"])

    @property
    def synthetic(self) -> bool:
        return bool(self.meta.get("synthetic", False))

    @property
    def default_cutoff(self) -> int:
        return int(self.meta["models"]["main"]["default_cutoff_percent"])

    def hour_index(self, t: datetime) -> int:
        """Index of hour `t` on the test grid (can be negative or past the end)."""
        return int((t - self.test_start) / HOUR)

    def tel_index(self, t: datetime) -> int:
        return int((t - self.tel_start) / HOUR)

    def hour_at(self, i: int) -> datetime:
        return self.test_start + i * HOUR

    def tel_hour_at(self, i: int) -> datetime:
        return self.tel_start + i * HOUR

    @property
    def first_index(self) -> int:
        """The replay window starts at the first held-out test hour; `replay_start` (where playback begins,
        decision 30) can be later, but earlier hours stay reachable with Start / the timeline."""
        return self.hour_index(self.test_start)

    @property
    def last_index(self) -> int:
        return self.hour_index(self.replay_end)


def _load_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError) as exc:
        raise BundleError(f"cannot read {path.name}") from exc


def _npy(root: Path, name: str, dtype: type, shape: tuple[int, ...]) -> Any:
    try:
        arr = np.load(root / name, mmap_mode="r")
    except (OSError, ValueError) as exc:
        raise BundleError(f"cannot read {name}") from exc
    if arr.dtype != dtype or arr.shape != shape:
        raise BundleError(f"{name}: expected {np.dtype(dtype)} {shape}, found {arr.dtype} {arr.shape}")
    return arr


def _load_components(root: Path, n_m: int, n_h: int) -> Components | None:
    if not (root / "components.json").is_file():
        return None
    meta = _load_json(root / "components.json")
    if meta.get("schema") != SCHEMA:
        raise BundleError("unsupported component schema")
    n_d, n_c, n_hz = int(meta["wear_days"]), len(meta["components"]), len(meta["horizons_days"])
    return Components(
        meta=meta,
        wear=_npy(root, "component_wear_scores.npy", np.float32, (n_hz, n_m, n_d, n_c)),
        since=_npy(root, "component_days_since.npy", np.float32, (n_m, n_d, n_c)),
        warning=_npy(root, "component_warning_scores.npy", np.float32, (n_m, n_h, n_c)),
        first_day=datetime.fromisoformat(meta["wear_first_day"]),
        n_days=n_d,
    )


def _by_machine(rows: list[list[Any]], conv: Any) -> dict[int, list[Any]]:
    out: dict[int, list[Any]] = {}
    for m, h, v in rows:
        out.setdefault(int(m), []).append((int(h), conv(v)))
    return out


def load_bundle(root: Path) -> Bundle:
    try:
        return _load(root)
    except (KeyError, TypeError, ValueError) as exc:
        raise BundleError(f"malformed bundle: {type(exc).__name__}") from exc


def _load(root: Path) -> Bundle:
    meta = _load_json(root / "meta.json")
    if meta.get("schema") != SCHEMA:
        raise BundleError("unsupported bundle schema")
    grid = meta["grid"]
    n_m, n_h, n_t = int(grid["machines"]), int(grid["hours"]), int(grid["telemetry_hours"])
    records = _load_json(root / "records.json")
    return Bundle(
        root=root,
        meta=meta,
        evaluation=_load_json(root / "evaluation.json"),
        threshold=_load_json(root / "threshold_analysis.json"),
        scores={
            name: _npy(root, f"scores_{name}.npy", np.float32, (n_m, n_h)) for name in ("main", "baseline")
        },
        codes=_npy(root, "contrib_codes.npy", np.uint8, (n_m, n_h, TOP_K)),
        values=_npy(root, "contrib_values.npy", np.float32, (n_m, n_h, TOP_K)),
        other=_npy(root, "contrib_other.npy", np.float32, (n_m, n_h)),
        telemetry=_npy(root, "telemetry.npy", np.float32, (n_m, n_t, len(SENSORS))),
        errors=_by_machine(records["errors"], str),
        repairs=_by_machine(records["repairs"], str),
        failures=_by_machine(records["failures"], list),
        test_start=datetime.fromisoformat(grid["test_start"]),
        replay_start=datetime.fromisoformat(meta["replay"]["start"]),
        replay_end=datetime.fromisoformat(meta["replay"]["end"]),
        tel_start=datetime.fromisoformat(grid["telemetry_start"]),
        n_hours=n_h,
        n_machines=n_m,
        components=_load_components(root, n_m, n_h),
    )


_cache: dict[Path, Bundle] = {}


def get_bundle() -> Bundle | None:
    """The bundle in use, loaded once per path (None if there is none). A broken bundle raises
    BundleError, which the service reports as 503."""
    root = find_bundle_dir()
    if root is None:
        return None
    if root not in _cache:
        _cache[root] = load_bundle(root)
    return _cache[root]


def clear_cache() -> None:
    _cache.clear()
