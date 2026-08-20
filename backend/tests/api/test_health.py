"""The liveness endpoint, and the one piece of metadata it publishes."""

from __future__ import annotations

import tomllib
from pathlib import Path

from fastapi.testclient import TestClient

from app.api import APP_VERSION

PYPROJECT = Path(__file__).parents[2] / "pyproject.toml"


def test_health_reports_ok(strict_client: TestClient):
    response = strict_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": APP_VERSION}


def test_the_published_version_matches_pyproject():
    """The project is not installed as a distribution, so it cannot read its own metadata.

    That makes the version a hand-maintained constant, which is exactly the kind of thing
    that drifts. This is the guard.
    """
    metadata = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    assert metadata["project"]["version"] == APP_VERSION


def test_health_needs_no_clock(strict_client: TestClient):
    """Liveness must not depend on anything that could fail for an interesting reason."""
    payload = strict_client.get("/health").json()
    assert set(payload) == {"status", "version"}
