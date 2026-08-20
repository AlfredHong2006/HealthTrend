"""The two service calls behind the API: analyse submitted data, analyse a demo scenario.

Both funnel into the same private helper, so the demo cannot drift into being a different
product. The only difference is where the observations come from.

This module owns one genuine decision: **what "30 days" means.** ADR-0005 established that
the forecast origin is an explicit parameter and that propagation runs over
``tau = lead + horizon``, not over the horizon alone. The consequence lands here. Defaulting
to ``forecast_from="now"`` means that a user who last weighed in five days ago gets a
forecast anchored to today, with those five days of real elapsed drift and uncertainty
propagated through -- rather than a five-day-old view of the future wearing today's label.
``forecast_from="last_observation"`` is available for a caller that genuinely wants the
series-relative view.

The clock is not read here either. It arrives as an argument, ultimately from
:class:`app.services.clock.Clock`, which keeps every response reproducible under a fixed
clock in tests.
"""

from __future__ import annotations

from datetime import datetime

from app.core.analyse import run_analysis
from app.core.types import AnalysisResult, InsufficientDataError, Observation
from app.demo.scenarios import generate
from app.errors import FutureObservationError
from app.ingestion import normalise_observations
from app.schemas.analysis import (
    FORECAST_STEP_DAYS,
    MAX_HORIZON_DAYS,
    AnalysisRequest,
    AnalysisResponse,
    ForecastFrom,
)
from app.schemas.demo import DemoAnalysisResponse

DEMO_FORECAST_FROM: ForecastFrom = "now"
"""Demo scenarios always forecast from the present.

Their observations are generated relative to the clock, so this is both the honest reading
and the one that produces a sensible forecast band.
"""


def analyse_submitted(request: AnalysisRequest, *, now: datetime) -> AnalysisResponse:
    """Analyse a submitted series of weigh-ins.

    Args:
        request: the validated request.
        now: the current instant, from the injected clock.

    Returns:
        The analysis response.

    Raises:
        FutureObservationError: if the latest weigh-in is dated after ``now`` while
            forecasting from the present.
        InsufficientDataError: if the series is empty.
    """
    observations = normalise_observations(request.observations)
    result = _analyse(observations, forecast_from=request.forecast_from, now=now)
    return AnalysisResponse.from_result(result, source="submitted")


def analyse_demo_scenario(scenario_id: str, *, now: datetime) -> DemoAnalysisResponse:
    """Generate the named demo scenario and analyse it.

    Args:
        scenario_id: one of :data:`app.demo.scenarios.SCENARIO_IDS`.
        now: the current instant, from the injected clock. The series is generated so that
            its most recent weigh-in sits just before this.

    Returns:
        The analysis response, with the scenario's provenance attached.

    Raises:
        UnknownScenarioError: if no scenario is registered under ``scenario_id``.
    """
    series = generate(scenario_id, now)
    result = _analyse(series.observations, forecast_from=DEMO_FORECAST_FROM, now=now)
    return DemoAnalysisResponse.from_result_and_series(result, series)


def _analyse(
    observations: tuple[Observation, ...],
    *,
    forecast_from: ForecastFrom,
    now: datetime,
) -> AnalysisResult:
    """Run the core analysis out to the furthest published horizon."""
    if not observations:
        raise InsufficientDataError(
            "at least one observation is required to estimate a latent weight"
        )
    return run_analysis(
        observations,
        horizon_days=MAX_HORIZON_DAYS,
        forecast_step_days=FORECAST_STEP_DAYS,
        origin=_resolve_origin(observations[-1].timestamp, forecast_from=forecast_from, now=now),
    )


def _resolve_origin(
    last_observed: datetime,
    *,
    forecast_from: ForecastFrom,
    now: datetime,
) -> datetime | None:
    """Return the instant horizons are measured from, or ``None`` for the core's default.

    A measurement dated after ``now`` is rejected rather than propagated. The core would
    reject the resulting negative lead anyway -- forecasting into the past is a smoothing
    problem, not a forecasting one -- but it would surface as a generic core failure. A
    named error gives the caller a stable code and an explanation instead.

    Raises:
        FutureObservationError: if ``last_observed`` is after ``now``.
    """
    if forecast_from == "last_observation":
        return None
    if last_observed > now:
        raise FutureObservationError(
            "the most recent observation is dated after the current instant"
        )
    return now
