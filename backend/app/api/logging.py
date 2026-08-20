"""Request logging that cannot leak a measurement.

``docs/privacy.md`` already states the rule for the numerical core: it may not log, because
anything it printed could be health data. The same rule has to hold one layer up, where the
data actually arrives. So this middleware records only what a request *was*, never what it
*contained*:

* the HTTP method
* the matched route template, not the raw path
* the status code
* how long it took
* how many observations were analysed, if the route recorded that

Two details matter more than they look.

**The middleware never reads the request body.** Not to count observations, not to check a
size. Parsing a body in a logging path is how a weight ends up in a log line by accident, and
it would also consume the stream the route needs. Instead a route that has *already* parsed
and validated its input may put the count on ``request.state``, and this middleware picks it
up afterwards if it is there.

**The route template is logged, not the URL path.** For a matched request they carry the same
information, but a path is a caller-supplied string -- an unmatched one is arbitrary, and even
a matched parameterised one (``/api/demo/{scenario}``) embeds whatever the caller typed. There
is no good reason to copy either into a log.

**Unhandled exceptions are converted here, not merely observed.** Starlette's outermost error
middleware re-raises after any registered catch-all handler runs -- deliberately, so servers
can see the failure -- which makes the ASGI server write the full traceback to its own logger.
An exception message is not ours to trust (a Pydantic error quotes the offending input), so
the only way to keep that traceback out of every log this process writes is to stop the
exception before it leaves the application: this middleware catches it, logs one line carrying
the exception **class name** only, and returns the fixed 500 body itself. The handler
registered for ``Exception`` in :mod:`app.api.errors` remains as the backstop for a failure of
this middleware's own dozen lines.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from time import perf_counter
from typing import Final

from fastapi import FastAPI, Request, Response
from starlette.routing import Route

from app.api.errors import INTERNAL_ERROR, error_response

logger = logging.getLogger("healthtrend.api.access")

_UNMATCHED_ROUTE: Final = "<unmatched>"

_OBSERVATION_COUNT_ATTRIBUTE: Final = "n_obs"
"""Attribute a route sets on ``request.state`` once it knows the validated count."""


def record_observation_count(request: Request, n_obs: int) -> None:
    """Record how many observations a route analysed, for the access log."""
    setattr(request.state, _OBSERVATION_COUNT_ATTRIBUTE, n_obs)


def _route_template(request: Request) -> str:
    """Return the matched route's path template, or a placeholder if nothing matched."""
    route = request.scope.get("route")
    if isinstance(route, Route):
        return route.path
    return _UNMATCHED_ROUTE


async def log_request(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Time a request, log its safe metadata, and absorb anything unhandled.

    The ``except`` branch is the application's real catch-all (see the module docstring):
    it logs the exception class name -- code-controlled, unlike the message -- and returns
    the fixed 500 body, so neither our loggers nor the server's ever see the traceback.
    """
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        elapsed_ms = (perf_counter() - started) * 1000.0
        logger.error(
            "%s %s -> unhandled %s in %.1f ms",
            request.method,
            _route_template(request),
            type(exc).__name__,
            elapsed_ms,
        )
        return error_response(INTERNAL_ERROR)

    elapsed_ms = (perf_counter() - started) * 1000.0
    n_obs = getattr(request.state, _OBSERVATION_COUNT_ATTRIBUTE, None)
    logger.info(
        "%s %s -> %d in %.1f ms (n_obs=%s)",
        request.method,
        _route_template(request),
        response.status_code,
        elapsed_ms,
        "-" if n_obs is None else n_obs,
    )
    return response


def register_request_logging(app: FastAPI) -> None:
    """Install the access-log middleware on ``app``."""
    app.middleware("http")(log_request)
