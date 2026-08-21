"""Turning exceptions into responses, without leaking health data.

Every error this API returns is built from a value in a table in this module. Nothing is
ever derived from ``str(exc)``, from an exception's class name, or from a Pydantic validator
message. That is not stylistic fussiness -- it is the only way to be sure a body weight
cannot appear in an error body, and from there in whatever aggregates the caller's logs
(master plan section 42, ``docs/privacy.md``).

Three concrete hazards this closes:

1. **Pydantic echoes the input by default.** A ``RequestValidationError`` detail normally
   carries ``input`` (the offending value) and ``ctx``. For this product that means a weight
   in an error response. Stripping those two keys is necessary but not sufficient, because
   the ``msg`` field is also generated text; so the message is replaced outright, looked up
   by the machine-readable ``type``, and an unrecognised type falls back to a generic
   string.
2. **Field locations are partly caller-controlled.** With ``extra="forbid"``, an unknown
   field name appears in the location path -- and a caller could put anything in a field
   name. Locations are therefore filtered to plain identifiers and list indices.
3. **Exception messages and raw request paths are not ours to trust.** A third-party
   exception message can quote a value (Pydantic's own errors embed the offending input),
   and the raw path of a parameterised route is a caller-supplied string. So handlers log
   only fixed metadata -- the public error code, a field-problem count, an exception class
   name -- never ``str(exc)``, never a traceback, never ``request.scope["path"]``. The
   per-request context (method, matched route template, status) is already logged by
   :mod:`app.api.logging`, which is also where unexpected exceptions are converted into
   the fixed 500; the handlers here are the backstop behind it.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Final

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.types import (
    CoreError,
    InsufficientDataError,
    InvalidCovarianceError,
    UnsortedObservationsError,
)
from app.errors import (
    CsvAmbiguousTimestampColumnsError,
    CsvAmbiguousWeightColumnsError,
    CsvDuplicateHeaderColumnError,
    CsvEmptyFileError,
    CsvInvalidTimezoneError,
    CsvMalformedStructureError,
    CsvMissingTimestampColumnError,
    CsvMissingWeightColumnError,
    CsvTooLargeError,
    CsvTooManyRowsError,
    CsvUndecodableTextError,
    CsvUnsupportedMediaTypeError,
    FutureObservationError,
    HealthTrendError,
    UnknownScenarioError,
)
from app.schemas.analysis import MAX_OBSERVATIONS
from app.schemas.errors import ErrorBody, ErrorDetail, ErrorResponse
from app.schemas.ingestion import MAX_CSV_BYTES

logger = logging.getLogger("healthtrend.api")

_SAFE_LOCATION_PART: Final = re.compile(r"^[A-Za-z0-9_]{1,64}$")
_REDACTED_LOCATION_PART: Final = "<field>"


@dataclass(frozen=True, slots=True)
class ErrorSpec:
    """The public face of one kind of failure.

    Attributes:
        status_code: HTTP status to return.
        code: stable machine-readable identifier for clients to branch on.
        message: fixed human-readable text. Chosen here, never generated.
    """

    status_code: int
    code: str
    message: str


VALIDATION_ERROR: Final = ErrorSpec(
    status_code=422,
    code="invalid_request",
    message="The request could not be validated. See details for the fields involved.",
)

INTERNAL_ERROR: Final = ErrorSpec(
    status_code=500,
    code="internal_error",
    message="An unexpected error occurred while processing the request.",
)

# Most specific first: the lookup walks this in order and takes the first isinstance match.
_DOMAIN_ERRORS: Final[tuple[tuple[type[Exception], ErrorSpec], ...]] = (
    (
        FutureObservationError,
        ErrorSpec(
            status_code=422,
            code="observation_in_the_future",
            message=(
                "The most recent observation is dated after the current time. Check the "
                "timestamps, or forecast from the last observation instead."
            ),
        ),
    ),
    (
        UnknownScenarioError,
        ErrorSpec(
            status_code=404,
            code="unknown_scenario",
            message="No demo scenario is available under that name.",
        ),
    ),
    (
        InsufficientDataError,
        ErrorSpec(
            status_code=422,
            code="insufficient_data",
            message="At least one observation is required to estimate a weight trend.",
        ),
    ),
    # Both of the following mean this service has a bug, not that the caller does.
    # Ingestion sorts, so the core's ordering guard should be unreachable through HTTP;
    # a broken covariance is a numerical failure. Neither is the caller's problem.
    (UnsortedObservationsError, INTERNAL_ERROR),
    (InvalidCovarianceError, INTERNAL_ERROR),
    (
        CoreError,
        ErrorSpec(
            status_code=422,
            code="invalid_observations",
            message="The observations could not be analysed. Check the values submitted.",
        ),
    ),
    (
        CsvUnsupportedMediaTypeError,
        ErrorSpec(415, "unsupported_media_type", "The request Content-Type must be text/csv."),
    ),
    (
        CsvTooLargeError,
        ErrorSpec(413, "csv_too_large", f"The file exceeds the {MAX_CSV_BYTES} byte limit."),
    ),
    (
        CsvTooManyRowsError,
        ErrorSpec(
            422,
            "csv_too_many_rows",
            f"The file has more than {MAX_OBSERVATIONS} data rows.",
        ),
    ),
    (
        CsvEmptyFileError,
        ErrorSpec(422, "csv_empty", "The file has no data rows to import."),
    ),
    (
        CsvUndecodableTextError,
        ErrorSpec(422, "csv_undecodable", "The file must be UTF-8 encoded text."),
    ),
    (
        CsvMissingTimestampColumnError,
        ErrorSpec(
            422,
            "csv_missing_timestamp_column",
            "No recognised timestamp column was found. Expected one of: timestamp, date, datetime.",
        ),
    ),
    (
        CsvMissingWeightColumnError,
        ErrorSpec(
            422,
            "csv_missing_weight_column",
            "No recognised weight column was found. Expected a column such as weight, "
            "weight_kg or weight_lb.",
        ),
    ),
    (
        CsvAmbiguousTimestampColumnsError,
        ErrorSpec(
            422,
            "csv_ambiguous_timestamp_columns",
            "More than one recognised timestamp column was found.",
        ),
    ),
    (
        CsvAmbiguousWeightColumnsError,
        ErrorSpec(
            422,
            "csv_ambiguous_weight_columns",
            "More than one recognised weight column was found.",
        ),
    ),
    (
        CsvDuplicateHeaderColumnError,
        ErrorSpec(422, "csv_duplicate_header_column", "A column name appears more than once."),
    ),
    (
        CsvMalformedStructureError,
        ErrorSpec(422, "csv_malformed_structure", "The file could not be parsed as CSV."),
    ),
    (
        CsvInvalidTimezoneError,
        ErrorSpec(422, "invalid_timezone", "assumed_timezone is not a recognised IANA timezone."),
    ),
)

_STATUS_ERRORS: Final[dict[int, ErrorSpec]] = {
    404: ErrorSpec(404, "not_found", "No such endpoint."),
    405: ErrorSpec(405, "method_not_allowed", "That method is not allowed on this endpoint."),
}

_VALIDATION_MESSAGES: Final[dict[str, str]] = {
    "missing": "This field is required.",
    "extra_forbidden": "This field is not recognised.",
    "json_invalid": "The request body is not valid JSON.",
    "too_short": "At least one observation is required.",
    "too_long": f"Too many observations; at most {MAX_OBSERVATIONS} are accepted per request.",
    "greater_than": "Value must be greater than zero.",
    "less_than_equal": "Value is later or larger than the maximum this API accepts.",
    "finite_number": "Value must be a finite number.",
    "float_parsing": "Value must be a number.",
    "float_type": "Value must be a number.",
    "int_parsing": "Value must be a whole number.",
    "int_type": "Value must be a whole number.",
    "string_type": "Value must be a string.",
    "bool_type": "Value must be true or false.",
    "list_type": "Value must be a list.",
    "model_attributes_type": "Value must be an object.",
    "dict_type": "Value must be an object.",
    "literal_error": "Value is not one of the permitted options.",
    "enum": "Value is not one of the permitted options.",
    "timezone_aware": "Timestamp must include a timezone offset.",
    "datetime_parsing": "Timestamp must be an ISO-8601 datetime with a timezone offset.",
    "datetime_type": "Timestamp must be an ISO-8601 datetime with a timezone offset.",
    "datetime_from_date_parsing": "Timestamp must include a time and a timezone offset.",
}

_GENERIC_VALIDATION_MESSAGE: Final = "The value provided is not valid."


def spec_for_exception(exc: Exception) -> ErrorSpec:
    """Return the published error for ``exc``, or the generic 500.

    Lookup is by explicit table and ``isinstance``, so adding a new exception type without
    deciding what the public API should say about it produces a 500 rather than an
    accidental disclosure.
    """
    for exception_type, spec in _DOMAIN_ERRORS:
        if isinstance(exc, exception_type):
            return spec
    return INTERNAL_ERROR


def error_response(spec: ErrorSpec, details: list[ErrorDetail] | None = None) -> JSONResponse:
    """Build the standard error envelope for ``spec``."""
    payload = ErrorResponse(
        error=ErrorBody(code=spec.code, message=spec.message, details=details or [])
    )
    return JSONResponse(status_code=spec.status_code, content=payload.model_dump(mode="json"))


def _safe_location(location: tuple[Any, ...]) -> str:
    """Render a Pydantic error location, dropping anything caller-controlled.

    Integer indices are positions and are kept: naming the third observation is useful and
    discloses nothing. String components are kept only if they look like an identifier,
    because with ``extra="forbid"`` an unknown *field name* comes from the request body.
    """
    parts: list[str] = []
    for component in location:
        if isinstance(component, int):
            parts.append(str(component))
        elif isinstance(component, str) and _SAFE_LOCATION_PART.match(component):
            parts.append(component)
        else:
            parts.append(_REDACTED_LOCATION_PART)
    return ".".join(parts)


def _sanitised_details(errors: list[dict[str, Any]]) -> list[ErrorDetail]:
    """Convert Pydantic errors into details carrying no submitted values."""
    details: list[ErrorDetail] = []
    for error in errors:
        code = str(error.get("type", "invalid"))
        details.append(
            ErrorDetail(
                location=_safe_location(tuple(error.get("loc", ()))),
                code=code,
                message=_VALIDATION_MESSAGES.get(code, _GENERIC_VALIDATION_MESSAGE),
            )
        )
    return details


def unexpected_error_response(exc: Exception) -> JSONResponse:
    """Log an unexpected exception safely and return the fixed 500 body.

    The log line carries the exception **class name** and nothing else. The class name is
    code-controlled; the message is not -- it can quote a value, which is exactly what must
    never reach a log (``docs/privacy.md``). No traceback is written for the same reason.
    The cost is real and accepted: diagnosing an unexpected failure means reproducing it,
    not reading its message out of a log.
    """
    logger.error("unhandled %s converted to a 500 response", type(exc).__name__)
    return error_response(INTERNAL_ERROR)


async def handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    """Return a sanitised 422 for a request that failed validation.

    Registered for :class:`RequestValidationError` only; the ``isinstance`` narrowing is
    explicit rather than an ``assert`` so the behaviour survives ``python -O``, and a
    mis-registration degrades to the generic 500 instead of a second exception inside an
    exception handler.
    """
    if not isinstance(exc, RequestValidationError):
        return unexpected_error_response(exc)
    details = _sanitised_details(list(exc.errors()))
    logger.info("request validation failed (%d field problems)", len(details))
    return error_response(VALIDATION_ERROR, details)


async def handle_domain_error(request: Request, exc: Exception) -> JSONResponse:
    """Return the published response for a known domain or core error."""
    spec = spec_for_exception(exc)
    logger.info("request rejected (%s)", spec.code)
    return error_response(spec)


async def handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    """Re-shape Starlette's own HTTP errors into the standard envelope."""
    if not isinstance(exc, StarletteHTTPException):
        return unexpected_error_response(exc)
    spec = _STATUS_ERRORS.get(
        exc.status_code,
        ErrorSpec(exc.status_code, "request_failed", "The request could not be completed."),
    )
    return error_response(spec)


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Backstop for exceptions that escape the request middleware.

    In normal operation this never fires: :func:`app.api.logging.log_request` converts any
    exception from the layers below it into the 500 response directly, precisely so that
    nothing propagates further out. An exception can only arrive here if the middleware
    itself failed -- a bug in a dozen lines of our own logging code.

    If it does fire, Starlette's outermost error middleware **re-raises after this handler
    returns** (by design, so servers can see the failure), and the ASGI server then writes
    the full traceback to its own logger (``uvicorn.error``). That residual channel cannot
    be closed from inside the application; it is documented in ``docs/privacy.md``.
    """
    return unexpected_error_response(exc)


def register_exception_handlers(app: FastAPI) -> None:
    """Install every handler on ``app``."""
    app.add_exception_handler(RequestValidationError, handle_validation_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(HealthTrendError, handle_domain_error)
    app.add_exception_handler(CoreError, handle_domain_error)
    app.add_exception_handler(Exception, handle_unexpected_error)
