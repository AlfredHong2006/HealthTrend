"""The application factory.

Run it with::

    uv run uvicorn app.main:app

**CORS** exists narrowly. A real-data page submits measurements straight from the browser to
``POST /api/analyse``, and a browser signs in by calling the auth routes directly. The allow-list
comes from :func:`app.config.allowed_origins`, is empty (nothing permitted) unless configured,
and is never a wildcard -- a ``*`` entry is refused outright, because credentials are now
allowed and a wildcard with credentials would let any site act as a signed-in user. ADR-0006
rejected configuring CORS before there was a browser client; that objection does not apply to
a deploy-time environment variable with a fail-closed default, and the demo path (server
component to server) is unaffected -- CORS only governs what a browser is allowed to read,
never what this API accepts.

**Accounts** exist beside the stateless routes, not inside them. ``POST /api/analyse``,
``POST /api/ingest/csv`` and the demo routes still keep nothing: an analysis happens inside the
request and nothing about it is retained. The auth routes store what signing in requires -- the
user's email, an HMAC of each issued sign-in code, and the hash of each session token -- in the
database named by ``HEALTHTREND_DATABASE_URL``. The session travels in an HttpOnly cookie
(:mod:`app.api.session_cookie`).

**Startup fails closed.** :class:`app.config.Settings` is read when the server starts, and a
missing database URL, auth secret or mailer configuration stops it from starting. Reading the
settings at startup rather than at import is what keeps ``import app.main`` -- and with it the
OpenAPI regeneration script -- free of any credential. Tests pass explicit settings to
:func:`create_app` instead of using the environment.

Still deliberately absent:

* **Any storage on the stateless routes**, and any cache (``docs/privacy.md``).
* **Schema creation at startup.** The database schema is created and migrated by Alembic
  (``uv run alembic upgrade head``), never implicitly by the application.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import APP_VERSION
from app.api.errors import register_exception_handlers
from app.api.logging import register_request_logging
from app.api.routes import router
from app.api.routes_account import router as account_router
from app.api.routes_auth import router as auth_router
from app.auth.mailer import ConsoleMailer, Mailer, SmtpMailer
from app.config import ALLOWED_ORIGINS_ENV_VAR, Settings, allowed_origins, load_settings
from app.errors import ConfigurationError
from app.persistence import Database

DESCRIPTION = """
Estimates the underlying weight trajectory behind noisy scale readings, quantifies how
uncertain that estimate is, and forecasts where it is heading.

Intervals describe the latent weight rather than a future scale reading, and the trajectory
is the online (filtered) estimate, so no point on it changes retroactively.

Not a medical device: this estimates and forecasts a measurement trend. It does not
diagnose, treat or prescribe.
""".strip()


def build_mailer(settings: Settings) -> Mailer:
    """Return the mailer the settings describe."""
    if settings.mailer == "console":
        return ConsoleMailer()
    # Settings validation already guarantees both for the SMTP mailer; the explicit check
    # narrows the types without an assert, which `python -O` would strip.
    if settings.smtp_host is None or settings.smtp_from is None:
        raise ConfigurationError("the SMTP mailer requires a host and a sender address")
    return SmtpMailer(
        host=settings.smtp_host,
        port=settings.smtp_port,
        sender=settings.smtp_from,
        username=settings.smtp_user,
        password=settings.smtp_password,
    )


def attach_resources(app: FastAPI, settings: Settings) -> Database:
    """Build the database handle and mailer for ``settings`` and keep them on ``app.state``."""
    database = Database(settings.database_url)
    app.state.settings = settings
    app.state.database = database
    app.state.mailer = build_mailer(settings)
    return database


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application.

    Args:
        settings: explicit settings, as tests supply. When omitted, settings are read from the
            environment when the server starts, and a missing or invalid one stops startup.

    Raises:
        ConfigurationError: if the CORS allow-list contains a wildcard.
    """
    origins = allowed_origins()
    if "*" in origins:
        raise ConfigurationError(f"{ALLOWED_ORIGINS_ENV_VAR} must name origins, not '*'")

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if settings is not None:
            yield
            return
        database = attach_resources(app, load_settings())
        try:
            yield
        finally:
            database.dispose()

    app = FastAPI(
        title="HealthTrend",
        version=APP_VERSION,
        description=DESCRIPTION,
        summary="Probabilistic weight-trend estimation and forecasting.",
        lifespan=lifespan,
    )
    if settings is not None:
        attach_resources(app, settings)
    register_request_logging(app)
    register_exception_handlers(app)
    # Added after the logging middleware so it wraps that middleware (Starlette makes the
    # most-recently-added middleware outermost): CORS headers must reach the browser on
    # every response this API can produce, including the fixed 500 that the logging
    # middleware itself returns for an unhandled exception -- a response that never passes
    # back through anything added before this point.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(account_router)
    return app


app = create_app()
"""The module-level application, for ``uvicorn app.main:app``."""
