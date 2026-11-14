import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MODULES = ["validate", "labels", "train", "evaluate", "replay", "features"]


@pytest.mark.parametrize("name", MODULES)
def test_stub_exits_non_zero_with_message(name: str) -> None:
    r = subprocess.run(  # noqa: S603
        [sys.executable, "-m", f"ml.{name}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert r.returncode != 0
    assert "not implemented in the skeleton story" in r.stderr
