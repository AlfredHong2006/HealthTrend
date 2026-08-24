"""The wire schema mirrors the core result deliberately, and this pins how.

Every field the core produces is either published or on an explicit exclusion list with a
reason. Without this test the two drift silently in either direction: a new core field goes
unnoticed and unpublished, or an internal diagnostic starts appearing in responses because
somebody widened an adapter.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Final

import pytest
from fastapi.testclient import TestClient

from app.core.analyse import run_analysis
from app.core.filter import run_filter
from app.core.forecast import forecast_at
from app.core.types import AnalysisResult, ModelParams, Observation
from app.schemas.analysis import (
    AnalysisResponse,
    CurrentEstimateOut,
    ForecastOut,
    ForecastPointOut,
    ModelParamsOut,
    ObservationOut,
    TrajectoryPointOut,
)
from app.schemas.demo import DemoAnalysisResponse
from tests.api.conftest import FROZEN_NOW

TOP_LEVEL_EXCLUSIONS: Final = {
    # Recorded so that parameters can be fitted by maximum likelihood later. Not a product
    # output, and publishing it would invite it to be read as a quality score.
    "loglik",
}

CURRENT_EXCLUSIONS: Final = {
    "v_kg_per_day",  # users think in kg/week (ADR-0001)
    "v_sd",  # ditto; weekly_rate_sd_kg is published instead
    "P",  # the state covariance belongs to a later model-inspector view
}

FORECAST_EXCLUSIONS: Final = {
    "horizon_days",  # the single max horizon, superseded by the `horizons` list
}

FORECAST_RENAMES: Final = {"points": "path"}

FORECAST_ADDITIONS: Final = {"last_observation_timestamp", "lead_days", "horizons"}


def core_result() -> AnalysisResult:
    start = datetime(2026, 5, 1, 7, 30, tzinfo=UTC)
    observations = [
        Observation(timestamp=start + timedelta(days=index), weight_kg=80.0 - 0.05 * index)
        for index in range(20)
    ]
    return run_analysis(observations, horizon_days=90.0)


def test_every_core_top_level_field_is_published_or_excluded():
    core = set(core_result().to_dict())
    published = set(AnalysisResponse.model_fields)
    assert core - TOP_LEVEL_EXCLUSIONS <= published
    assert core & TOP_LEVEL_EXCLUSIONS & published == set()


def test_the_response_adds_only_metadata_of_its_own():
    core = set(core_result().to_dict())
    added = set(AnalysisResponse.model_fields) - core
    assert added == {"meta"}


def test_every_current_estimate_field_is_published_or_excluded():
    core = set(core_result().current.to_dict())
    published = set(CurrentEstimateOut.model_fields)
    assert core - CURRENT_EXCLUSIONS == published


def test_every_forecast_field_is_published_renamed_or_excluded():
    core = set(core_result().forecast.to_dict())
    expected = {FORECAST_RENAMES.get(name, name) for name in core - FORECAST_EXCLUSIONS}
    assert set(ForecastOut.model_fields) == expected | FORECAST_ADDITIONS


def test_every_forecast_point_field_is_published():
    core = set(core_result().forecast.points[0].to_dict())
    assert core == set(ForecastPointOut.model_fields)


def test_every_trajectory_point_field_is_published():
    core = set(core_result().trajectory[0].to_dict())
    assert core == set(TrajectoryPointOut.model_fields)


def test_every_observation_field_is_published():
    core = set(core_result().observations[0].to_dict())
    assert core == set(ObservationOut.model_fields)


def test_every_model_parameter_field_is_published():
    """A new core parameter must surface in the response, not vanish silently.

    Pydantic ignores unexpected keyword arguments to a model with no matching field, so
    without this parity check a parameter added to `ModelParams.to_dict()` would be
    dropped from the wire without any test noticing.
    """
    assert set(ModelParamsOut.model_fields) == set(ModelParams.default().to_dict())


def test_the_published_values_are_the_cores_own_values():
    """The adapter must not round, rescale or recompute anything."""
    result = core_result()
    response = AnalysisResponse.from_result(result, source="submitted")

    assert response.n_obs == result.n_obs
    assert response.span_days == result.span_days
    assert response.current.w_kg == result.current.w_kg
    assert response.current.w_sd == result.current.w_sd
    assert response.current.weekly_rate_kg == result.current.weekly_rate_kg
    assert response.current.w_lower95 == result.current.w_ci95[0]
    assert response.current.w_upper95 == result.current.w_ci95[1]
    assert len(response.trajectory) == len(result.trajectory)
    assert len(response.forecast.path) == len(result.forecast.points)
    assert response.forecast.horizons[1].w_kg == result.forecast.point_at(30.0).w_kg


def test_the_demo_response_is_the_analysis_response_plus_provenance():
    added = set(DemoAnalysisResponse.model_fields) - set(AnalysisResponse.model_fields)
    assert added == {"scenario"}


def test_published_horizons_equal_standalone_core_forecasts(strict_client):
    """Each 7/30/90 point must equal `forecast_at` called directly on the core.

    The service reads the three horizons off one 90-day `forecast_path`; this compares
    them against three independent single-horizon propagations, so the equivalence is
    checked against the core itself rather than between two branches of our own code.
    """
    start = FROZEN_NOW - timedelta(days=19)
    stamps = [start + timedelta(days=index) for index in range(20)]
    weights = [80.0 - 0.05 * index for index in range(20)]

    response = strict_client.post(
        "/api/analyse",
        json={
            "observations": [
                {"timestamp": stamp.isoformat(), "weight": weight, "unit": "kg"}
                for stamp, weight in zip(stamps, weights, strict=True)
            ],
            "forecast_from": "now",
        },
    )
    assert response.status_code == 200
    horizons = response.json()["forecast"]["horizons"]

    state = run_filter(
        [
            Observation(timestamp=stamp, weight_kg=weight)
            for stamp, weight in zip(stamps, weights, strict=True)
        ]
    ).final
    params = ModelParams.default()

    assert [point["horizon_days"] for point in horizons] == [7.0, 30.0, 90.0]
    for point in horizons:
        expected = forecast_at(state, params, point["horizon_days"], origin=FROZEN_NOW)
        assert point["w_kg"] == pytest.approx(expected.w_kg, rel=1e-15)
        assert point["w_sd"] == pytest.approx(expected.w_sd, rel=1e-15)
        assert point["w_lower95"] == pytest.approx(expected.w_lower95, rel=1e-15)
        assert point["w_upper95"] == pytest.approx(expected.w_upper95, rel=1e-15)
        assert point["timestamp"] == expected.timestamp.isoformat().replace("+00:00", "Z")


def test_the_openapi_schema_builds(strict_client: TestClient):
    response = strict_client.get("/openapi.json")
    assert response.status_code == 200
    schema = response.json()
    assert set(schema["paths"]) == {
        "/health",
        "/api/analyse",
        "/api/demo",
        "/api/demo/{scenario}",
        "/api/ingest/csv",
    }


def test_the_openapi_schema_documents_the_error_envelope(strict_client: TestClient):
    """The frontend milestone generates its types from this, so the error path must be in it."""
    schema = strict_client.get("/openapi.json").json()
    assert "ErrorResponse" in schema["components"]["schemas"]
    assert "422" in schema["paths"]["/api/analyse"]["post"]["responses"]
    assert "404" in schema["paths"]["/api/demo/{scenario}"]["get"]["responses"]


def test_the_openapi_schema_describes_the_published_response_models(strict_client: TestClient):
    schema = strict_client.get("/openapi.json").json()
    components: dict[str, Any] = schema["components"]["schemas"]
    assert "AnalysisResponse" in components
    assert "DemoAnalysisResponse" in components
    assert set(components["AnalysisResponse"]["required"]) >= {
        "n_obs",
        "current",
        "forecast",
        "trajectory",
    }


def test_the_request_schema_publishes_no_goal_or_parameter_field(strict_client: TestClient):
    """Goal projection is a later milestone, and the priors are not caller-tunable.

    The estimator is goal-neutral by construction. Keeping the goal
    out of the request keeps that guarantee structural rather than a promise.
    """
    schema = strict_client.get("/openapi.json").json()
    request_schema = schema["components"]["schemas"]["AnalysisRequest"]
    assert set(request_schema["properties"]) == {"observations", "forecast_from"}


@pytest.mark.parametrize("field", ["loglik", "sigma_obs_kg"])
def test_response_and_request_surfaces_stay_disjoint_where_they_must(field: str):
    """``sigma_obs_kg`` is published but not accepted; ``loglik`` is neither."""
    from app.schemas.analysis import AnalysisRequest

    assert field not in AnalysisRequest.model_fields
