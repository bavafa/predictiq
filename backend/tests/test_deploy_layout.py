"""Checks on the Vercel layout (frontend/ is the Vercel Root Directory; see docs/DEPLOY.md)."""

import importlib.util
import json
import os
import subprocess
import tomllib
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend"


def test_adapter_exposes_the_fastapi_app() -> None:
    spec = importlib.util.spec_from_file_location("vercel_adapter", FRONTEND / "api" / "index.py")
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    r = TestClient(module.app).get("/api/v1/health")
    assert r.status_code == 200
    assert r.headers["cache-control"] == "no-store"


def test_rewrite_routes_api_v1_to_the_python_function() -> None:
    cfg = json.loads((FRONTEND / "vercel.json").read_text(encoding="utf-8"))
    assert {"source": "/api/v1/:path*", "destination": "/api/index"} in cfg["rewrites"]
    assert (FRONTEND / "api" / "index.py").is_file()


def _skips_build(branch: str | None) -> bool:
    cfg = json.loads((FRONTEND / "vercel.json").read_text(encoding="utf-8"))
    env = {k: v for k, v in os.environ.items() if k != "VERCEL_GIT_COMMIT_REF"}
    if branch is not None:
        env["VERCEL_GIT_COMMIT_REF"] = branch
    # Vercel: exit code 0 = skip (ignore) the build, 1 = build.
    r = subprocess.run(["/bin/sh", "-c", cfg["ignoreCommand"]], env=env, check=False)  # noqa: S603
    assert r.returncode in (0, 1)
    return r.returncode == 0


def test_ignore_command_skips_main_only() -> None:
    assert _skips_build("main") is True
    assert _skips_build("skeleton") is False
    assert _skips_build("feature/main") is False
    assert _skips_build(None) is False  # CLI deploys without a branch still build


def test_requirements_txt_pins_match_pyproject() -> None:
    project = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]
    lines = {
        line.strip()
        for line in (FRONTEND / "requirements.txt").read_text(encoding="utf-8").splitlines()
        if line and not line.startswith(("#", " "))
    }
    for dep in project["dependencies"]:
        assert dep in lines
    assert (FRONTEND / ".python-version").read_text(encoding="utf-8").strip() == "3.12"
