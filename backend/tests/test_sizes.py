"""Largest allowed request per endpoint: status 200 and body under 256 KB (architecture, "Validation").

The service is imported through the Vercel adapter from a copy laid out like the deployed function. The bundle
is the real one when artifacts/<version>/bundle exists (a git checkout after `build_bundle.py` or
`fetch_bundle.py`), otherwise a synthetic one of the same shapes. Sizes are printed (run with -s or see the
summary below)."""

import json
import shutil
import subprocess  # noqa: S404
import sys
from pathlib import Path

import pytest

from ml.bundle import uncompressed_bytes

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 256 * 1024
EXPECTED_CACHE = "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400"


def real_bundle() -> Path | None:
    for meta in sorted(ROOT.glob("artifacts/piq-*/bundle/meta.json"), reverse=True):
        if json.loads(meta.read_text()).get("synthetic") is False:
            return meta.parent
    return None


def lay_out(tmp: Path, bundle: Path) -> Path:
    frontend = tmp / "frontend"
    (frontend / "api").mkdir(parents=True)
    shutil.copy(ROOT / "frontend" / "api" / "index.py", frontend / "api" / "index.py")
    shutil.copytree(
        ROOT / "backend" / "app", frontend / "_backend" / "app", ignore=shutil.ignore_patterns("__pycache__")
    )
    shutil.copytree(bundle, frontend / "_backend" / "bundle")
    return frontend


def probe(frontend: Path) -> dict[str, dict[str, object]]:
    env = {"PATH": "/usr/bin:/bin"}  # no PREDICTIQ_BUNDLE_DIR: the bundle must be found beside the app
    res = subprocess.run(  # noqa: S603
        [sys.executable, "-I", str(ROOT / "backend" / "tests" / "adapter_probe.py"), str(frontend)],
        capture_output=True,
        text=True,
        env=env,
        cwd=frontend.parent,
        check=True,
        timeout=300,
    )
    out: dict[str, dict[str, object]] = json.loads(res.stdout.strip().splitlines()[-1])
    return out


def check(sizes: dict[str, dict[str, object]], capsys: pytest.CaptureFixture[str], label: str) -> None:
    with capsys.disabled():
        print(f"\nLargest allowed request per endpoint ({label}):")
        for name, v in sizes.items():
            print(f"  {name:42s} {v['status']}  {v['bytes']:>9,} bytes")
    for name, v in sizes.items():
        assert v["status"] == 200, name
        assert isinstance(v["bytes"], int) and v["bytes"] < LIMIT, name
        if name.startswith("POST plan"):
            assert v["cache"] == "no-store", name
            assert v["rows"] == 100, name  # the largest allowed answer: every machine listed
        elif name not in ("metadata", "health"):
            assert v["cache"] == EXPECTED_CACHE, name


def test_largest_requests_through_the_adapter_with_a_synthetic_bundle(
    tmp_path: Path, synthetic_dir: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    frontend = lay_out(tmp_path, synthetic_dir)
    check(probe(frontend), capsys, "synthetic bundle")


def test_largest_requests_through_the_adapter_with_the_real_bundle(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    bundle = real_bundle()
    if bundle is None:
        pytest.skip("no real bundle in artifacts/ (run scripts/build_bundle.py or scripts/fetch_bundle.py)")
    frontend = lay_out(tmp_path, bundle)
    with capsys.disabled():
        print(f"\nreal bundle {bundle.parent.name}: {uncompressed_bytes(bundle):,} bytes uncompressed")
    check(probe(frontend), capsys, f"real bundle {bundle.parent.name}")
