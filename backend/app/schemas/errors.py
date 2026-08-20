"""The error envelope.

Every failure this API reports uses one shape, so a client has exactly one error path to
implement:

.. code-block:: json

    {"error": {"code": "observation_in_the_future",
               "message": "...",
               "details": [{"location": "body.observations.3.weight",
                            "code": "greater_than",
                            "message": "..."}]}}

``code`` is a stable machine-readable identifier chosen by us. ``message`` is a fixed
human-readable string chosen by us. Neither is ever derived from an exception's own text or
from a Pydantic validator message, and no field anywhere in this envelope carries a
submitted value -- a weight is health data, and an error body is exactly the kind of thing
that gets forwarded into a log aggregator.

``details`` is populated only for request-validation failures, where knowing *which* field
was wrong is genuinely useful. Locations name positions and field names only, mirroring the
convention the numerical core already follows in
:class:`app.core.types.UnsortedObservationsError`.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """One field-level validation problem."""

    location: str = Field(
        description="Dotted path to the offending field, using positions for list indices."
    )
    code: str = Field(description="Stable identifier for the kind of validation failure.")
    message: str = Field(description="Fixed explanation. Never contains a submitted value.")


class ErrorBody(BaseModel):
    """The contents of an error response."""

    code: str = Field(description="Stable machine-readable error identifier.")
    message: str = Field(description="Fixed human-readable explanation.")
    details: list[ErrorDetail] = Field(
        default_factory=list,
        description="Field-level problems, present only for request-validation failures.",
    )


class ErrorResponse(BaseModel):
    """The envelope returned for every non-2xx response."""

    error: ErrorBody
