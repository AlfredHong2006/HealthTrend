"""The application factory.

Run it with::

    uv run uvicorn app.main:app

**CORS** now exists, narrowly. A real-data page submits measurements straight from the
browser to ``POST /api/analyse`` (the manual-entry milestone), which is the first time this
API is called from anywhere but a server. The allow-list comes from
:func:`app.config.allowed_origins`, is empty (nothing permitted) unless configured, and is
never a wildcard. ADR-0006 rejected configuring CORS earlier because there was no browser
client and any origin written into code then would have been a guess; that objection does not
apply to a deploy-time environment variable with a fail-closed default, and the demo path
(server component to server) is entirely unaffected -- CORS only governs what a browser is
allowed to read, never what this API accepts.

Still deliberately absent:

* **Storage of any kind.** No database, no session, no cache. An analysis happens inside the
  request and nothing about it is retained (``docs/privacy.md``).
* **Authentication.** No accounts in V1.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import APP_VERSION
from app.api.errors import register_exception_handlers
from app.api.logging import register_request_logging
from app.api.routes import router
from app.config import allowed_origins

DESCRIPTION = """
Estimates the underlying weight trajectory behind noisy scale readings, quantifies how
uncertain that estimate is, and forecasts where it is heading.

Intervals describe the latent weight rather than a future scale reading, and the trajectory
is the online (filtered) estimate, so no point on it changes retroactively.

Not a medical device: this estimates and forecasts a measurement trend. It does not
diagnose, treat or prescribe.
""".strip()


def create_app() -> FastAPI:
    """Build the application."""
    app = FastAPI(
        title="HealthTrend",
        version=APP_VERSION,
        description=DESCRIPTION,
        summary="Probabilistic weight-trend estimation and forecasting.",
    )
    register_request_logging(app)
    register_exception_handlers(app)
    # Added after the logging middleware so it wraps that middleware (Starlette makes the
    # most-recently-added middleware outermost): CORS headers must reach the browser on
    # every response this API can produce, including the fixed 500 that the logging
    # middleware itself returns for an unhandled exception -- a response that never passes
    # back through anything added before this point.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_credentials=False,
        allow_methods=["POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(router)
    return app


app = create_app()
"""The module-level application, for ``uvicorn app.main:app``."""
