"""More contract rules for the data endpoints: strict input forms, clear errors, window vs replay start."""

from pathlib import Path

import pytest
from app import bundle as reader
from app.bundle import Bundle
from fastapi.testclient import TestClient

from ml.bundle import synthetic_bundle

V = "/api/v1"
START = "2015-11-01T00:00:00"
MID = "2015-12-01T12:00:00"


@pytest.mark.parametrize(
    "at", ["2015-12-01T12:00\n", "2015-12-01T12:00:00\n", "２０１５-12-01T12:00", " 2015-12-01T12:00"]
)
def test_at_rejects_trailing_newlines_and_non_ascii_digits(
    client: TestClient, with_bundle: Bundle, at: str
) -> None:
    r = client.get(f"{V}/fleet", params={"mv": with_bundle.model_version, "at": at})
    assert r.status_code == 422


@pytest.mark.parametrize("cutoff", ["5\n", "٥", "05\n"])
def test_cutoff_rejects_trailing_newlines_and_non_ascii_digits(
    client: TestClient, with_bundle: Bundle, cutoff: str
) -> None:
    r = client.get(f"{V}/fleet", params={"mv": with_bundle.model_version, "at": MID, "cutoff": cutoff})
    assert r.status_code == 422


def test_every_error_is_problem_json_without_an_echo_of_the_input(
    client: TestClient, with_bundle: Bundle
) -> None:
    mv = with_bundle.model_version
    bad = [
        f"{V}/fleet?mv={mv}&at=secret-value",
        f"{V}/fleet?mv={mv}&at={MID}&cutoff=secret-value",
        f"{V}/assets/secret-value?mv={mv}&at={MID}",
        f"{V}/fleet?mv={mv}&at={MID}&machine_model=secret-value",
        f"{V}/fleet?mv=secret-value&at={MID}",
        f"{V}/fleet?at={MID}",  # missing mv
    ]
    for u in bad:
        r = client.get(u)
        assert r.status_code in (400, 404, 422), u
        assert r.headers["content-type"].startswith("application/problem+json"), u
        assert r.headers["cache-control"] == "no-store"
        body = r.json()
        assert body["title"] and body["status"] == r.status_code
        assert "secret-value" not in r.text and "Traceback" not in r.text


def test_the_replay_window_can_start_before_the_replay_start(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Decision 30: playback begins at `replay_start`; the window (and `at`) covers the whole test period."""
    folder = tmp_path / "later-start"
    synthetic_bundle(folder, replay_start_offset=48, n_hours=200)
    monkeypatch.setenv(reader.ENV_DIR, str(folder))
    reader.clear_cache()
    meta = client.get(f"{V}/metadata").json()
    assert meta["replay_window"]["start"] == START
    assert meta["replay_start"] == "2015-11-03T00:00:00"
    b = reader.get_bundle()
    assert b is not None
    assert client.get(f"{V}/fleet?mv={b.model_version}&at={START}").status_code == 200  # before replay start
    assert client.get(f"{V}/fleet?mv={b.model_version}&at=2015-10-31T23:00:00").status_code == 422
