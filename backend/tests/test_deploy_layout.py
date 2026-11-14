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


def test_vercel_function_includes_the_app_and_the_bundle() -> None:
    cfg = json.loads((FRONTEND / "vercel.json").read_text(encoding="utf-8"))
    fn = cfg["functions"]["api/index.py"]
    assert "_backend/app/**" in fn["includeFiles"] and "_backend/bundle/**" in fn["includeFiles"]
    assert fn["excludeFiles"].startswith("{app/**")  # the Next.js app/ folder stays out


def _sync(tmp: Path, bundle_meta: dict[str, object] | None) -> tuple[int, str, Path]:
    artifacts = tmp / "artifacts"
    artifacts.mkdir(parents=True)
    if bundle_meta is not None:
        bundle = artifacts / "piq-20260101-abcd1234" / "bundle"
        bundle.mkdir(parents=True)
        (bundle / "meta.json").write_text(json.dumps(bundle_meta))
        (bundle / "scores_main.npy").write_bytes(b"x")
    out = tmp / "out"
    script = str(FRONTEND / "scripts" / "sync-backend.mjs")
    r = subprocess.run(  # noqa: S603
        ["node", script, "--artifacts", str(artifacts), "--out", str(out)],  # noqa: S607
        capture_output=True,
        text=True,
        check=False,
    )
    return r.returncode, r.stdout + r.stderr, out


def test_prebuild_refuses_a_synthetic_bundle(tmp_path: Path) -> None:
    code, text, out = _sync(tmp_path / "a", {"synthetic": True, "model_version": "piq-20260101-abcd1234"})
    assert code == 1 and "REFUSING" in text
    assert not (out / "bundle").exists()
    code, _, _ = _sync(tmp_path / "b", {"model_version": "piq-20260101-abcd1234"})  # no flag: not real
    assert code == 1


def test_prebuild_copies_a_real_bundle_and_works_without_one(tmp_path: Path) -> None:
    code, text, out = _sync(tmp_path / "a", {"synthetic": False, "model_version": "piq-20260101-abcd1234"})
    assert code == 0, text
    assert (out / "bundle" / "meta.json").is_file() and (out / "app" / "main.py").is_file()
    code, text, out = _sync(tmp_path / "b", None)
    assert code == 0 and not (out / "bundle").exists() and (out / "app" / "main.py").is_file()
    code, _, _ = _sync(tmp_path / "c", {"synthetic": False, "model_version": "piq-19990101-00000000"})
    assert code == 1  # folder name and meta.json disagree


def test_node_and_python_bundle_fetchers_allow_the_same_files() -> None:
    """fetch-bundle.mjs (production build) and scripts/fetch_bundle.py allow the same ten names."""
    import re

    from scripts.fetch_bundle import ALLOWED

    js = (FRONTEND / "scripts" / "fetch-bundle.mjs").read_text(encoding="utf-8")
    block = re.search(r"export const ALLOWED = \[(.*?)\];", js, re.S)
    assert block is not None
    assert set(re.findall(r'"([^"]+)"', block.group(1))) == set(ALLOWED)


def test_prebuild_downloads_only_when_asked_and_production_fails_without_a_bundle(tmp_path: Path) -> None:
    """No env (local, preview): passes without a bundle. VERCEL_ENV=production without one: fails."""
    artifacts = tmp_path / "artifacts"
    (artifacts / "piq-20260101-abcd1234").mkdir(parents=True)
    (artifacts / "piq-20260101-abcd1234" / "manifest.json").write_text(
        json.dumps({"bundle": {"file": "bundle.zip", "sha256": "0" * 64, "zip_bytes": 10}})
    )
    script = str(FRONTEND / "scripts" / "sync-backend.mjs")
    base = {k: v for k, v in os.environ.items() if k not in {"VERCEL_ENV", "BUNDLE_FETCH", "BUNDLE_URL"}}

    def run(extra: dict[str, str]) -> subprocess.CompletedProcess[str]:
        return subprocess.run(  # noqa: S603
            ["node", script, "--artifacts", str(artifacts), "--out", str(tmp_path / "out")],  # noqa: S607
            env={**base, **extra},
            capture_output=True,
            text=True,
            check=False,
        )

    assert run({}).returncode == 0
    assert run({"VERCEL_ENV": "preview"}).returncode == 0
    prod = run({"VERCEL_ENV": "production", "BUNDLE_URL": "http://127.0.0.1:9/bundle.zip"})
    assert prod.returncode == 1 and "download failed" in prod.stderr
