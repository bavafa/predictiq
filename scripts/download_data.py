#!/usr/bin/env python3
"""Download the five Microsoft sample CSV files and verify their SHA-256 fingerprints.

Source and hashes: docs/DATA_PROVENANCE.md (pinned commit). Files go to the gitignored
data/raw/. Any mismatch deletes the bad download and exits non-zero. The data is simulated
sample data published by Microsoft.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import tempfile
import urllib.request
from pathlib import Path

PINNED_COMMIT = "e836f4e866028db7fd7d1a66b88f79664a1f4eac"
BASE_URL = (
    "https://raw.githubusercontent.com/microsoft/sqlworkshops/"
    f"{PINNED_COMMIT}/SQLServerAndAzureMachineLearning/ML%20Services%20for%20SQL%20Server/data/"
)

# file name -> (bytes, sha256). Must match docs/DATA_PROVENANCE.md (a test checks this).
FILES: dict[str, tuple[int, str]] = {
    "PdM_telemetry.csv": (
        80_142_329,
        "d957f3c45bb83416b716600da8cffd72f4b6961db89867d9696ad19f7cb1bd4e",
    ),
    "PdM_errors.csv": (
        129_077,
        "9c2a2a010ad77227e2bb0c94e7971bca78810790ddd1f28a8bee4f12c2f62370",
    ),
    "PdM_maint.csv": (
        104_903,
        "481ed4e155f609e6ca6130754d2c035453093902a507cce5b3f3e235995f1db6",
    ),
    "PdM_failures.csv": (
        24_336,
        "0c6c31a4fd52ef2df95ad7c44e8b0c8c32917bcef29ba5a1ba3ba45531ded3b7",
    ),
    "PdM_machines.csv": (
        1_582,
        "5e8e1571c4999bf88abb7cae3925964c218d946fe851a9a100bb3d19330652bc",
    ),
}

DEFAULT_DEST = Path(__file__).resolve().parents[1] / "data" / "raw"
CHUNK = 1 << 20


def sha256_of(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as f:
        while chunk := f.read(CHUNK):
            digest.update(chunk)
            size += len(chunk)
    return size, digest.hexdigest()


def matches(path: Path, name: str) -> bool:
    expected_size, expected_hash = FILES[name]
    if not path.is_file():
        return False
    size, digest = sha256_of(path)
    return size == expected_size and digest == expected_hash


def download(url: str, target: Path) -> None:
    if not url.startswith(("https://", "file://")):
        raise ValueError(f"refusing non-https URL: {url}")
    with urllib.request.urlopen(url, timeout=60) as resp, target.open("wb") as out:  # noqa: S310
        while chunk := resp.read(CHUNK):
            out.write(chunk)


def fetch_all(dest: Path, base_url: str, verify_only: bool = False) -> int:
    dest.mkdir(parents=True, exist_ok=True)
    failures = 0
    for name in FILES:
        final = dest / name
        if matches(final, name):
            print(f"ok       {name} (already present, fingerprint matches)")
            continue
        if verify_only:
            print(f"MISSING or MISMATCH: {name}", file=sys.stderr)
            failures += 1
            continue
        with tempfile.TemporaryDirectory(dir=dest) as tmp:
            part = Path(tmp) / name
            try:
                download(base_url + name, part)
            except (OSError, ValueError) as exc:
                print(f"FAILED   {name}: download error: {exc}", file=sys.stderr)
                failures += 1
                continue
            if not matches(part, name):
                size, digest = sha256_of(part)
                print(
                    f"MISMATCH {name}: got {size} bytes, sha256 {digest}; "
                    f"expected {FILES[name][0]} bytes, sha256 {FILES[name][1]}. Not saved.",
                    file=sys.stderr,
                )
                failures += 1
                continue
            part.replace(final)
            print(f"ok       {name} (downloaded, fingerprint matches)")
    if failures:
        print(f"{failures} file(s) failed verification.", file=sys.stderr)
        return 1
    print(f"All {len(FILES)} files verified in {dest}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    p.add_argument("--dest", type=Path, default=DEFAULT_DEST, help="target folder (default data/raw)")
    p.add_argument("--base-url", default=BASE_URL, help="override the pinned download URL (tests)")
    p.add_argument("--verify-only", action="store_true", help="check existing files; no network")
    args = p.parse_args(argv)
    base = args.base_url if args.base_url.endswith("/") else args.base_url + "/"
    return fetch_all(args.dest, base, args.verify_only)


if __name__ == "__main__":
    sys.exit(main())
