import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_evaluate_needs_a_mode() -> None:
    """`python -m ml.evaluate` with neither --write nor --verify must fail, not guess."""
    r = subprocess.run(  # noqa: S603
        [sys.executable, "-m", "ml.evaluate"], cwd=ROOT, capture_output=True, text=True, check=False
    )
    assert r.returncode != 0
    assert "--write" in r.stderr and "--verify" in r.stderr
