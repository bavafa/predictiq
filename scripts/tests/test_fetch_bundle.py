"""fetch_bundle: hash check against the manifest, safe unpacking, no network (gh is replaced)."""

import json
import zipfile
from pathlib import Path

import pytest

from ml import bundle as mb
from scripts import fetch_bundle as fb


def make_real_looking(tmp: Path, version: str = "piq-20260101-abcd1234", synthetic: bool = False) -> Path:
    """An artifacts/ root with one version, a bundle zip and a manifest entry for it."""
    root = tmp / "artifacts"
    vdir = root / version
    src = tmp / "src"
    meta = mb.synthetic_bundle(src, n_machines=5, n_hours=60)
    meta["model_version"] = version
    meta["synthetic"] = synthetic
    (src / "meta.json").write_text(json.dumps(meta))
    vdir.mkdir(parents=True)
    info = mb.pack(src, tmp / "bundle.zip")
    (vdir / "manifest.json").write_text(json.dumps({"sha256": {}, "bundle": info}))
    return root


def test_good_zip_is_verified_and_unpacked(tmp_path: Path) -> None:
    root = make_real_looking(tmp_path)
    target = fb.fetch("piq-20260101-abcd1234", None, tmp_path / "bundle.zip", root)
    assert (target / "meta.json").is_file() and (target / "scores_main.npy").is_file()
    assert not list((root / "piq-20260101-abcd1234").glob(".bundle-*"))


def test_wrong_hash_is_refused_and_nothing_is_unpacked(tmp_path: Path) -> None:
    root = make_real_looking(tmp_path)
    bad = tmp_path / "other.zip"
    bad.write_bytes((tmp_path / "bundle.zip").read_bytes() + b"x")
    with pytest.raises(fb.FetchError, match="SHA-256 mismatch"):
        fb.fetch("piq-20260101-abcd1234", None, bad, root)
    assert not (root / "piq-20260101-abcd1234" / "bundle").exists()


def test_synthetic_bundle_is_refused(tmp_path: Path) -> None:
    root = make_real_looking(tmp_path, synthetic=True)
    with pytest.raises(fb.FetchError, match="not the real bundle"):
        fb.fetch("piq-20260101-abcd1234", None, tmp_path / "bundle.zip", root)
    assert not (root / "piq-20260101-abcd1234" / "bundle").exists()


def test_zip_with_unexpected_names_is_refused(tmp_path: Path) -> None:
    evil = tmp_path / "evil.zip"
    with zipfile.ZipFile(evil, "w") as z:
        z.writestr("meta.json", "{}")
        z.writestr("../escape.txt", "x")
    with pytest.raises(fb.FetchError, match="exactly the expected"):
        fb.unpack(evil, tmp_path / "out")
    assert not (tmp_path / "escape.txt").exists()


def test_manifest_without_a_bundle_hash_is_refused(tmp_path: Path) -> None:
    vdir = tmp_path / "piq-x"
    vdir.mkdir()
    (vdir / "manifest.json").write_text(json.dumps({"sha256": {}}))
    with pytest.raises(fb.FetchError, match="no bundle hash"):
        fb.expected_hash(vdir)


def test_download_uses_gh_release_download_with_the_pinned_repo(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    def fake_run(cmd: list[str], **_: object) -> None:
        calls.append(cmd)
        (tmp_path / fb.ZIP_NAME).write_bytes(b"zip")

    monkeypatch.setattr("subprocess.run", fake_run)
    path = fb.download("bundle-piq-1", tmp_path)
    assert path == tmp_path / fb.ZIP_NAME
    assert calls == [
        ["gh", "release", "download", "bundle-piq-1", "--repo", "bavafa/predictiq", "--pattern", "bundle.zip",
         "--dir", str(tmp_path)]
    ]  # fmt: skip
