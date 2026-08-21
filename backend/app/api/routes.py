"""The four endpoints.

Each route does the same four things and nothing else: take validated input, resolve the
clock, call one service function, record the observation count for the access log. Anything
resembling a decision about the model belongs below this layer.
"""

from __future__ import annotations

from typing import Any, Final, Literal

from fastapi import APIRouter, Query, Request

from app.api import APP_VERSION
from app.api.deps import ClockDep
from app.api.logging import record_observation_count
from app.demo.scenarios import catalogue
from app.errors import CsvTooLargeError, CsvUnsupportedMediaTypeError
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.schemas.demo import DemoAnalysisResponse, DemoCatalogueResponse, DemoScenarioOut
from app.schemas.errors import ErrorResponse
from app.schemas.health import HealthResponse
from app.schemas.ingestion import MAX_CSV_BYTES, CsvIngestResponse
from app.services.analysis import analyse_demo_scenario, analyse_submitted
from app.services.ingestion import ingest_csv

router = APIRouter()

_VALIDATION_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "The request was rejected."}
}
_NOT_FOUND_RESPONSES: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse, "description": "No such demo scenario."}
}
_INGEST_RESPONSES: dict[int | str, dict[str, Any]] = {
    413: {"model": ErrorResponse, "description": "The file was too large."},
    415: {"model": ErrorResponse, "description": "The request's Content-Type was not text/csv."},
    422: {"model": ErrorResponse, "description": "The request was rejected."},
}
_CSV_CONTENT_TYPE: Final = "text/csv"


@router.get("/health", response_model=HealthResponse, tags=["service"], summary="Liveness check")
def health() -> HealthResponse:
    """Report that the service is up."""
    return HealthResponse(version=APP_VERSION)


@router.post(
    "/api/analyse",
    response_model=AnalysisResponse,
    tags=["analysis"],
    summary="Estimate the latent weight trend and forecast it",
    responses=_VALIDATION_RESPONSES,
)
def analyse(payload: AnalysisRequest, clock: ClockDep, request: Request) -> AnalysisResponse:
    """Analyse a submitted series of weigh-ins.

    Returns the filtered latent-weight trajectory with 95% intervals, the current estimate
    and weekly rate, and the 7-, 30- and 90-day forecasts with the band between them.
    """
    response = analyse_submitted(payload, now=clock.now())
    record_observation_count(request, response.n_obs)
    return response


@router.get(
    "/api/demo",
    response_model=DemoCatalogueResponse,
    tags=["demo"],
    summary="List the synthetic demo scenarios",
)
def demo_catalogue() -> DemoCatalogueResponse:
    """List every available demo scenario. All of them are generated, none measured."""
    return DemoCatalogueResponse(
        scenarios=[DemoScenarioOut.from_spec(spec) for spec in catalogue()]
    )


@router.get(
    "/api/demo/{scenario}",
    response_model=DemoAnalysisResponse,
    tags=["demo"],
    summary="Analyse a synthetic demo scenario",
    responses=_NOT_FOUND_RESPONSES,
)
def demo_analysis(scenario: str, clock: ClockDep, request: Request) -> DemoAnalysisResponse:
    """Generate the named scenario, ending just before now, and analyse it.

    The response is the same shape as ``POST /api/analyse`` with the scenario's provenance
    added, so a client needs only one renderer.
    """
    response = analyse_demo_scenario(scenario, now=clock.now())
    record_observation_count(request, response.n_obs)
    return response


@router.post(
    "/api/ingest/csv",
    response_model=CsvIngestResponse,
    tags=["ingestion"],
    summary="Parse an uploaded CSV into observations ready for /api/analyse",
    responses=_INGEST_RESPONSES,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {_CSV_CONTENT_TYPE: {"schema": {"type": "string", "format": "binary"}}},
        }
    },
)
async def ingest_csv_route(
    request: Request,
    assumed_timezone: str = Query(
        ...,
        description="IANA timezone (e.g. Europe/London) used to resolve timestamps with no "
        "UTC offset. Ignored for timestamps that already carry one.",
    ),
    default_unit: Literal["kg", "lb"] = Query(
        ...,
        description="Unit assumed for a weight column with no per-row or header-implied unit.",
    ),
) -> CsvIngestResponse:
    """Parse an uploaded CSV file into validated, normalised observations.

    Does not analyse anything. Call ``POST /api/analyse`` next with the returned
    ``accepted`` list to get a trend and forecast -- the same call a manually entered
    series makes, since ``accepted`` is already shaped as ``ObservationIn`` (ADR-0010). No
    row count from this endpoint is logged; the parse report reaches the caller directly and
    nowhere else.
    """
    if not _is_csv_content_type(request.headers.get("content-type")):
        raise CsvUnsupportedMediaTypeError(f"Content-Type must be {_CSV_CONTENT_TYPE}")
    raw_bytes = await _read_capped_body(request)
    return ingest_csv(raw_bytes, assumed_timezone=assumed_timezone, default_unit=default_unit)


def _is_csv_content_type(content_type: str | None) -> bool:
    """Match the media type only, so ``text/csv; charset=utf-8`` is still accepted."""
    if content_type is None:
        return False
    media_type = content_type.split(";", 1)[0].strip().lower()
    return media_type == _CSV_CONTENT_TYPE


async def _read_capped_body(request: Request) -> bytes:
    """Read the request body, aborting the instant it exceeds ``MAX_CSV_BYTES``.

    Deliberately not ``await request.body()``, which buffers the whole body before
    returning: reading the stream directly means an oversized upload is rejected before its
    tail even arrives. This path also never touches Starlette's multipart/form parser, which
    spools any file part above 1 MiB to a real on-disk temporary file (ADR-0010) -- so this
    request body never gets written to disk by this application.
    """
    buffer = bytearray()
    async for chunk in request.stream():
        buffer.extend(chunk)
        if len(buffer) > MAX_CSV_BYTES:
            raise CsvTooLargeError(f"the file exceeds {MAX_CSV_BYTES} bytes")
    return bytes(buffer)
