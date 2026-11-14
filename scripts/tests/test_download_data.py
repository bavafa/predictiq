"""No-network tests for scripts/download_data.py."""

import hashlib
import re
from pathlib import Path

import pytest

from scripts import download_data as dd

ROOT = Path(__file__).resolve().parents[2]


def _provenance_rows() -> dict[str, tuple[int, str]]:
    text = (ROOT / "docs" / "DATA_PROVENANCE.md").read_text(encoding="utf-8")
    rows: dict[str, tuple[int, str]] = {}
    pattern = re.compile(r"^\|\s*(PdM_\w+\.csv)\s*\|\s*([\d,]+)\s*\|\s*[\d,]+\s*\|\s*`([0-9a-f]{64})`")
    for line in text.splitlines():
        m = pattern.match(line)
        if m:
            rows[m.group(1)] = (int(m.group(2).replace(",", "")), m.group(3))
    return rows


def test_hash_table_matches_provenance_document() -> None:
    rows = _provenance_rows()
    assert len(rows) == 5
    assert rows == dd.FILES


def test_pinned_commit_and_base_url_match_provenance_document() -> None:
    text = (ROOT / "docs" / "DATA_PROVENANCE.md").read_text(encoding="utf-8")
    assert dd.PINNED_COMMIT in text
    assert dd.BASE_URL in text


def _patch_files(monkeypatch: pytest.MonkeyPatch, contents: dict[str, bytes]) -> None:
    table = {n: (len(b), hashlib.sha256(b).hexdigest()) for n, b in contents.items()}
    monkeypatch.setattr(dd, "FILES", table)


def test_good_files_are_saved_and_verified(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    src = tmp_path / "src"
    src.mkdir()
    contents = {"a.csv": b"1,2\n", "b.csv": b"3,4\n"}
    for n, b in contents.items():
        (src / n).write_bytes(b)
    _patch_files(monkeypatch, contents)
    dest = tmp_path / "raw"
    assert dd.main(["--dest", str(dest), "--base-url", src.as_uri()]) == 0
    assert (dest / "a.csv").read_bytes() == b"1,2\n"
    # Second run: nothing to fetch, still verified.
    assert dd.main(["--dest", str(dest), "--verify-only"]) == 0


def test_hash_mismatch_exits_non_zero_and_saves_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    src = tmp_path / "src"
    src.mkdir()
    (src / "a.csv").write_bytes(b"tampered\n")
    _patch_files(monkeypatch, {"a.csv": b"original\n"})
    dest = tmp_path / "raw"
    assert dd.main(["--dest", str(dest), "--base-url", src.as_uri()]) == 1
    assert not (dest / "a.csv").exists()


def test_verify_only_fails_on_missing_or_corrupt(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_files(monkeypatch, {"a.csv": b"x\n"})
    dest = tmp_path / "raw"
    assert dd.main(["--dest", str(dest), "--verify-only"]) == 1
    dest.mkdir(exist_ok=True)
    (dest / "a.csv").write_bytes(b"y\n")
    assert dd.main(["--dest", str(dest), "--verify-only"]) == 1


def test_refuses_plain_http() -> None:
    with pytest.raises(ValueError, match="non-https"):
        dd.download("http://example.com/x.csv", Path("/dev/null"))
