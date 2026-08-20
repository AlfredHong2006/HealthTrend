"""The application factory.

Run it with::

    uv run uvicorn app.main:app

Deliberately absent in this milestone:

* **CORS.** There is no browser client yet. A permissive origin policy added "for later" is
  exactly the kind of thing that ships to production unreviewed, so it waits until the
  frontend exists and its origins are known.
* **Storage of any kind.** No database, no session, no cache. An analysis happens inside the
  request and nothing about it is retained (master plan section 42).
* **Authentication.** No accounts in V1.
"""

from __future__ import annotations

from fastapi import FastAPI

from app.api import APP_VERSION
from app.api.errors import register_exception_handlers
from app.api.logging import register_request_logging
from app.api.routes import router

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
    app.include_router(router)
    return app


app = create_app()
"""The module-level application, for ``uvicorn app.main:app``."""
