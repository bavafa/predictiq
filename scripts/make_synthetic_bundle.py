"""Write a SYNTHETIC serving bundle (fake numbers, real shapes, `synthetic: true`) for end-to-end tests.

    uv run --group ml python -m scripts.make_synthetic_bundle frontend/.e2e/bundle

The replay starts 24 hours after the first window hour, so tests can step back to the window's first hour. The
Vercel prebuild refuses a synthetic bundle, so this can never be deployed."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

from ml.bundle import synthetic_bundle

REPLAY_START_OFFSET_HOURS = 24


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python -m scripts.make_synthetic_bundle <output folder>", file=sys.stderr)
        return 2
    out = Path(argv[1])
    if out.exists():
        shutil.rmtree(out)
    meta = synthetic_bundle(out, replay_start_offset=REPLAY_START_OFFSET_HOURS, with_components=True)
    start = meta["replay"]["start"]
    print(f"synthetic bundle {meta['model_version']} written to {out} (replay starts {start})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
