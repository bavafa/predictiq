"""Build the serving bundle for a model version: artifacts/<version>/bundle/, bundle.zip, bundle.sha256.

Needs the raw data (`make data`) and the `ml` dependency group. Usage:
    uv run --group ml python -m scripts.build_bundle [--version piq-...]
The zip hash is also recorded in artifacts/<version>/manifest.json (key "bundle"); that is what
scripts/fetch_bundle.py checks. The bundle folder and zip are gitignored; the hash files are committed.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys

from ml import bundle as mb
from ml.artifacts import MANIFEST, resolve
from ml.validate import validate


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--version")
    p.add_argument("--components", help="component model folder under artifacts/ (comp-...)")
    args = p.parse_args()
    vdir = resolve(args.version)
    tables, problems = validate()
    if tables is None or problems:
        print("data checks failed; run `make validate`", file=sys.stderr)
        return 1
    out = vdir / mb.BUNDLE_DIR
    if out.exists():
        shutil.rmtree(out)
    comp_dir = resolve(args.components) if args.components else None
    meta = mb.build_real(vdir, tables, out, comp_dir)
    zip_path = vdir / mb.ZIP_NAME
    info = mb.pack(out, zip_path)
    (vdir / mb.SHA_NAME).write_text(f"{info['sha256']}  {mb.ZIP_NAME}\n")
    manifest_path = vdir / MANIFEST
    manifest = json.loads(manifest_path.read_text())
    manifest["bundle"] = info
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    print(f"model version:      {meta['model_version']}")
    for name in mb.bundle_files(out):
        print(f"  {name:28s}{(out / name).stat().st_size:>12,d} bytes")
    print(f"uncompressed total: {info['uncompressed_bytes']:,d} bytes")
    print(f"bundle.zip:         {info['zip_bytes']:,d} bytes")
    print(f"sha256:             {info['sha256']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
