"""Model version, data hashes, manifest and folder lookup."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

from ml.data import RAW_DIR, ROOT

ARTIFACTS_DIR = ROOT / "artifacts"
RAW_FILES = ("PdM_telemetry.csv", "PdM_errors.csv", "PdM_maint.csv", "PdM_failures.csv", "PdM_machines.csv")
MANIFEST = "manifest.json"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def data_hashes(raw_dir: Path = RAW_DIR) -> dict[str, str]:
    return {name: sha256_file(raw_dir / name) for name in RAW_FILES}


def git_state(root: Path = ROOT) -> dict[str, Any]:
    def run(*args: str) -> str:
        return subprocess.run(  # noqa: S603
            ["git", *args],  # noqa: S607
            cwd=root,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()

    try:
        return {"commit": run("rev-parse", "HEAD"), "dirty": bool(run("status", "--porcelain"))}
    except (OSError, subprocess.CalledProcessError):
        return {"commit": "unknown", "dirty": False}


def model_version(date: str, hashes: dict[str, str], config: dict[str, Any], commit: str) -> str:
    """piq-<YYYYMMDD>-<first 8 hex chars of SHA-256 over data hashes + config + git commit>."""
    payload = json.dumps({"data": hashes, "config": config, "commit": commit}, sort_keys=True)
    return f"piq-{date}-{hashlib.sha256(payload.encode()).hexdigest()[:8]}"


def write_manifest(version_dir: Path) -> dict[str, str]:
    """SHA-256 of every file in the version folder except the manifest and the throw-away score cache."""
    files = {
        p.name: sha256_file(p)
        for p in sorted(version_dir.iterdir())
        if p.is_file() and p.name not in (MANIFEST, "test_scores.npz")
    }
    (version_dir / MANIFEST).write_text(json.dumps({"sha256": files}, indent=2, sort_keys=True) + "\n")
    return files


def check_manifest(version_dir: Path) -> list[str]:
    path = version_dir / MANIFEST
    if not path.exists():
        return ["manifest.json is missing"]
    listed: dict[str, str] = json.loads(path.read_text())["sha256"]
    problems = []
    for name, digest in listed.items():
        f = version_dir / name
        if not f.exists():
            problems.append(f"manifest lists {name}, which is missing")
        elif sha256_file(f) != digest:
            problems.append(f"{name} does not match its manifest hash")
    return problems


def latest_version(root: Path = ARTIFACTS_DIR) -> Path:
    found = sorted(p for p in root.glob("piq-*") if p.is_dir())
    if not found:
        raise FileNotFoundError(f"no model version under {root}; run `make train`")
    return found[-1]


def resolve(version: str | None, root: Path = ARTIFACTS_DIR) -> Path:
    return root / version if version else latest_version(root)
