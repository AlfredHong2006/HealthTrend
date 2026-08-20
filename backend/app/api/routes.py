"""The four endpoints.

Each route does the same four things and nothing else: take validated input, resolve the
clock, call one service function, record the observation count for the access log. Anything
resembling a decision about the model belongs below this layer.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from app.api import APP_VERSION
from app.api.deps import ClockDep
from app.api.logging import record_observation_count
from app.demo.scenarios import catalogue
from app.schemas.analysis import AnalysisRequest, AnalysisResponse
from app.schemas.demo import DemoAnalysisResponse, DemoCatalogueResponse, DemoScenarioOut
from app.schemas.errors import ErrorResponse
from app.schemas.health import HealthResponse
from app.services.analysis import analyse_demo_scenario, analyse_submitted

router = APIRouter()

_VALIDATION_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "The request was rejected."}
}
_NOT_FOUND_RESPONSES: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse, "description": "No such demo scenario."}
}


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
