"""Fixtures for the HTTP boundary tests.

The clock is the important one. Production code has no settable clock -- shipping one
invites it to be used -- so the test double lives here and arrives through FastAPI's
dependency override mechanism. With it in place every response is reproducible: forecast
origins, demo timestamps, code and session expiry, and the golden fixture all become
functions of a fixed instant.

The application is never configured from the environment here. Every app is built with
:func:`make_test_settings`: an explicit, fixed test auth secret that is not used anywhere
else, and a fresh in-memory SQLite database whose schema is created directly from the models.
The mailer is replaced by :class:`RecordingMailer`, so a test can read the code a real user
would have received by email.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_clock, get_mailer
from app.config import Settings
from app.main import create_app
from app.services.clock import Clock

FROZEN_NOW = datetime(2026, 6, 12, 9, 0, tzinfo=UTC)
"""The instant every test pretends it is. Arbitrary, but fixed."""

TEST_AUTH_SECRET = "healthtrend-test-auth-secret-0123456789-not-for-production"
"""The deterministic auth secret every test app uses. Never valid anywhere else."""

TEST_DATABASE_URL = "sqlite+pysqlite:///:memory:"
"""A private in-memory database per application."""


def make_test_settings(**overrides: Any) -> Settings:
    """Return valid settings for a test app, with any field overridden."""
    base = Settings(
        database_url=TEST_DATABASE_URL,
        auth_secret=TEST_AUTH_SECRET,
        cookie_secure=False,
        mailer="console",
        smtp_host=None,
        smtp_port=587,
        smtp_user=None,
        smtp_password=None,
        smtp_from=None,
        beta_allowed_emails=frozenset(),
    )
    return replace(base, **overrides)


@dataclass(frozen=True, slots=True)
class FixedClock:
    """A clock that always reports the same instant."""

    instant: datetime

    def now(self) -> datetime:
        """Return the fixed instant."""
        return self.instant


@dataclass(frozen=True, slots=True)
class SentCode:
    """One sign-in email the recording mailer would have sent."""

    email: str
    code: str


@dataclass(slots=True)
class RecordingMailer:
    """A mailer that records sign-in codes instead of sending them."""

    sent: list[SentCode] = field(default_factory=list)

    def send_login_code(self, email: str, code: str) -> None:
        """Record the code."""
        self.sent.append(SentCode(email=email, code=code))

    @property
    def last_code(self) -> str:
        """The most recently sent code."""
        return self.sent[-1].code


@dataclass(slots=True)
class MutableClock:
    """A clock a test can move forward, for expiry and sliding-session tests."""

    instant: datetime

    def now(self) -> datetime:
        """Return the current test instant."""
        return self.instant


def build_app(
    now: datetime = FROZEN_NOW,
    *,
    settings: Settings | None = None,
    mailer: RecordingMailer | None = None,
    clock: Clock | None = None,
) -> FastAPI:
    """Return an application with a fresh empty database, its clock frozen at ``now``.

    Pass ``clock`` instead (a :class:`MutableClock`) for a test that needs time to move.
    """
    app = create_app(settings or make_test_settings())
    app.state.database.create_schema()
    fixed_clock: Clock = clock if clock is not None else FixedClock(now)
    recording = mailer if mailer is not None else RecordingMailer()
    app.dependency_overrides[get_clock] = lambda: fixed_clock
    app.dependency_overrides[get_mailer] = lambda: recording
    return app


@pytest.fixture
def mailer() -> RecordingMailer:
    """The mailer the :func:`app` fixture's application sends codes through."""
    return RecordingMailer()


@pytest.fixture
def app(mailer: RecordingMailer) -> FastAPI:
    """An application with the clock frozen at :data:`FROZEN_NOW`."""
    return build_app(mailer=mailer)


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


DEFAULT_TEST_EMAIL = "user@example.com"
"""The address :func:`sign_in_as` and :func:`signed_in_user` use by default."""


def sign_in_as(
    client: TestClient, mailer: RecordingMailer, email: str = DEFAULT_TEST_EMAIL
) -> dict[str, Any]:
    """Sign ``client`` in as ``email`` through the recording mailer's code.

    Returns the ``MeOut`` body from the verify response; the session cookie is left set on
    ``client`` for subsequent requests.
    """
    requested = client.post("/api/auth/code/request", json={"email": email})
    assert requested.status_code == 202, requested.text
    verified = client.post("/api/auth/code/verify", json={"email": email, "code": mailer.last_code})
    assert verified.status_code == 200, verified.text
    body: dict[str, Any] = verified.json()
    return body


@pytest.fixture
def signed_in_user(client: TestClient, mailer: RecordingMailer) -> dict[str, Any]:
    """``client`` signed in as one default test account; returns its ``MeOut`` body."""
    return sign_in_as(client, mailer)
