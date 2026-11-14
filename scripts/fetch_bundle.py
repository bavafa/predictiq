"""Download the serving bundle of a model version from its GitHub release, check it, unpack it.

    uv run python -m scripts.fetch_bundle [--version piq-...] [--tag bundle-piq-...] [--zip PATH]

Steps: `gh release download <tag> --repo bavafa/predictiq --pattern bundle.zip` into an empty temporary
folder, compare the SHA-256 with the committed `artifacts/<version>/manifest.json` ("bundle" entry), refuse
anything else, unpack the listed files only into `artifacts/<version>/bundle/`. With `--zip` a local file is
used instead of a download (same checks). The script never creates a release and needs no secret.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess  # noqa: S404
import sys
import tempfile
import zipfile
from pathlib import Path

REPO = "bavafa/predictiq"
ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ZIP_NAME = "bundle.zip"
# Files a bundle may contain (docs/architecture.md; backend/app/bundle.py). Anything else is refused.
ALLOWED = {
    "meta.json",
    "evaluation.json",
    "threshold_analysis.json",
    "records.json",
    "scores_main.npy",
    "scores_baseline.npy",
    "contrib_codes.npy",
    "contrib_values.npy",
    "contrib_other.npy",
    "telemetry.npy",
}
MAX_UNPACKED = 200 * 1024 * 1024  # refuse a zip that would unpack to more than this


class FetchError(Exception):
    pass


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def latest_version(root: Path = ARTIFACTS) -> str:
    found = sorted(p.name for p in root.glob("piq-*") if (p / "manifest.json").is_file())
    if not found:
        raise FetchError(f"no model version with a manifest under {root}")
    return found[-1]


def expected_hash(version_dir: Path) -> str:
    manifest = json.loads((version_dir / "manifest.json").read_text())
    entry = manifest.get("bundle")
    if not isinstance(entry, dict) or not isinstance(entry.get("sha256"), str):
        raise FetchError("manifest.json has no bundle hash; run scripts/build_bundle.py first")
    return str(entry["sha256"])


def download(tag: str, dest: Path) -> Path:
    cmd = ["gh", "release", "download", tag, "--repo", REPO, "--pattern", ZIP_NAME, "--dir", str(dest)]
    try:
        subprocess.run(cmd, check=True, timeout=600)  # noqa: S603
    except FileNotFoundError:
        raise FetchError("the GitHub command-line tool `gh` is not installed") from None
    except subprocess.CalledProcessError:
        raise FetchError(f"`gh release download {tag}` failed (does the release exist?)") from None
    return dest / ZIP_NAME


def unpack(zip_path: Path, target: Path) -> None:
    """Unpack only known file names, flat, with a size cap; replace `target` as a whole."""
    with zipfile.ZipFile(zip_path) as z:
        infos = z.infolist()
        names = [i.filename for i in infos]
        if sorted(names) != sorted(set(names)) or not set(names) <= ALLOWED or "meta.json" not in names:
            raise FetchError("the zip does not contain exactly the expected bundle files")
        if sum(i.file_size for i in infos) > MAX_UNPACKED:
            raise FetchError("the zip would unpack to more than the size limit")
        staging = Path(tempfile.mkdtemp(dir=target.parent, prefix=".bundle-"))
        try:
            for i in infos:
                (staging / i.filename).write_bytes(z.read(i))
            if target.exists():
                shutil.rmtree(target)
            staging.rename(target)
        except BaseException:
            shutil.rmtree(staging, ignore_errors=True)
            raise


def fetch(version: str, tag: str | None, local_zip: Path | None, root: Path = ARTIFACTS) -> Path:
    version_dir = root / version
    want = expected_hash(version_dir)
    with tempfile.TemporaryDirectory(prefix="predictiq-bundle-") as tmp:
        zip_path = local_zip if local_zip is not None else download(tag or f"bundle-{version}", Path(tmp))
        got = sha256(zip_path)
        if got != want:
            raise FetchError(
                f"SHA-256 mismatch: manifest says {want}, the download is {got}. Nothing unpacked."
            )
        target = version_dir / "bundle"
        unpack(zip_path, target)
    meta = json.loads((target / "meta.json").read_text())
    if meta.get("model_version") != version or meta.get("synthetic") is not False:
        shutil.rmtree(target)
        raise FetchError("the bundle is not the real bundle of this model version")
    return target


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--version", help="model version folder under artifacts/ (default: the latest)")
    p.add_argument("--tag", help="release tag (default: bundle-<version>)")
    p.add_argument("--zip", type=Path, help="use this local bundle.zip instead of downloading")
    args = p.parse_args()
    try:
        version = args.version or latest_version()
        target = fetch(version, args.tag, args.zip)
    except (FetchError, OSError, zipfile.BadZipFile) as exc:
        print(f"fetch_bundle: {exc}", file=sys.stderr)
        return 1
    print(f"bundle for {version} verified and unpacked to {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
