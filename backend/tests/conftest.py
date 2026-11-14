from collections.abc import Iterator
from pathlib import Path

import pytest
from app import bundle as reader
from fastapi.testclient import TestClient

from ml.bundle import synthetic_bundle


@pytest.fixture(scope="session")
def synthetic_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A fake bundle of the real shapes (marked synthetic), built once per test run."""
    out = tmp_path_factory.mktemp("synthetic") / "bundle"
    synthetic_bundle(out)
    return out


@pytest.fixture(autouse=True)
def no_bundle_by_default(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Iterator[None]:
    """Tests never pick up a real bundle from artifacts/: the default is 'no bundle'."""
    monkeypatch.setenv(reader.ENV_DIR, str(tmp_path / "no-bundle-here"))
    reader.clear_cache()
    yield
    reader.clear_cache()


@pytest.fixture()
def with_bundle(monkeypatch: pytest.MonkeyPatch, synthetic_dir: Path) -> reader.Bundle:
    monkeypatch.setenv(reader.ENV_DIR, str(synthetic_dir))
    reader.clear_cache()
    b = reader.get_bundle()
    assert b is not None
    return b


@pytest.fixture()
def client() -> TestClient:
    from app.main import app

    return TestClient(app, raise_server_exceptions=False)
