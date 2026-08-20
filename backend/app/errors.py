"""Domain errors raised above the numerical core.

These live at the top of the ``app`` package, not inside a layer, because both
:mod:`app.services` and :mod:`app.demo` raise them and :mod:`app.api` maps them to HTTP
responses. Putting them in any one of those packages would force a dependency in the wrong
direction.

Like :class:`app.core.types.CoreError`, none of these carries a measurement value in its
message. An exception string is exactly the kind of thing that ends up in a log
aggregator, and the API layer never derives a public message from one anyway -- it looks
the exception up in an explicit table (see :mod:`app.api.errors`).
"""

from __future__ import annotations


class HealthTrendError(Exception):
    """Base class for domain errors raised outside the numerical core."""


class FutureObservationError(HealthTrendError):
    """The latest observation is dated after the current instant.

    Only meaningful when forecasting from "now". A measurement in the future would give a
    negative forecast lead time, which :func:`app.core.forecast.forecast_at` rejects as a
    smoothing problem rather than a forecasting one (ADR-0005). Catching it here turns an
    opaque core failure into a stable, explainable response.
    """


class UnknownScenarioError(HealthTrendError):
    """No demo scenario is registered under the requested identifier."""
