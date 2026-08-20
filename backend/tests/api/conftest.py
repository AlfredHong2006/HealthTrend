"""Fixtures for the HTTP boundary tests.

The clock is the important one. Production code has no settable clock -- shipping one
invites it to be used -- so the test double lives here and arrives through FastAPI's
dependency override mechanism. With it in place every response is reproducible: forecast
origins, demo timestamps and the golden fixture all become functions of a fixed instant.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_clock
from app.main import create_app

FROZEN_NOW = datetime(2026, 6, 12, 9, 0, tzinfo=UTC)
"""The instant every test pretends it is. Arbitrary, but fixed."""


@dataclass(frozen=True, slots=True)
class FixedClock:
    """A clock that always reports the same instant."""

    instant: datetime

    def now(self) -> datetime:
        """Return the fixed instant."""
        return self.instant


def build_app(now: datetime = FROZEN_NOW) -> FastAPI:
    """Return an application whose clock is frozen at ``now``."""
    app = create_app()
    app.dependency_overrides[get_clock] = lambda: FixedClock(now)
    return app


@pytest.fixture
def app() -> FastAPI:
    """An application with the clock frozen at :data:`FROZEN_NOW`."""
    return build_app()


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """A client that returns the 500 envelope instead of re-raising server errors.

    Re-raising is the friendlier default when a test fails for an unexpected reason, but it
    makes the catch-all handler untestable, and that handler is a privacy control.
    """
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def strict_client(app: FastAPI) -> TestClient:
    """A client that re-raises server errors, so an unexpected 500 surfaces as a traceback."""
    return TestClient(app)
