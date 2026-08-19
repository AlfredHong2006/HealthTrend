"""The one entry point Milestone 1 exists to provide.

    timestamped weight measurements
        -> latent weight trajectory
        -> uncertainty
        -> trend velocity
        -> 30-day probabilistic forecast

This module only orchestrates. Every equation lives in :mod:`app.core.model`,
:mod:`app.core.kalman`, :mod:`app.core.filter` and :mod:`app.core.forecast`. It performs
no I/O, consults no clock and holds no state, so the same input always produces the same
output -- which is what the golden regression test depends on.

Deliberately absent, because they are later milestones: trend classification, plateau
probability, change detection, goal projection and any interpretation copy. This function
returns numbers and their uncertainty; deciding what to call a trend is somebody else's
job.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from app.core.filter import run_filter
from app.core.forecast import DEFAULT_HORIZON_DAYS, DEFAULT_STEP_DAYS, forecast_path
from app.core.time_axis import DEFAULT_TIME_AXIS, TimeAxis
from app.core.types import (
    AnalysisResult,
    ModelParams,
    Observation,
    TrajectoryPoint,
)


def run_analysis(
    observations: Sequence[Observation],
    params: ModelParams | None = None,
    *,
    horizon_days: float = DEFAULT_HORIZON_DAYS,
    forecast_step_days: float = DEFAULT_STEP_DAYS,
    origin: datetime | None = None,
    include_observation_noise: bool = False,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> AnalysisResult:
    """Estimate the latent weight trajectory and forecast it forward.

    Args:
        observations: weight measurements in non-decreasing time order, already in kg and
            carrying timezone-aware timestamps.
        params: model parameters; defaults to the documented priors.
        horizon_days: the furthest forecast horizon. Defaults to 30, the primary
            consumer forecast.
        forecast_step_days: granularity of the forecast path.
        origin: the instant forecast horizons are measured from, defaulting to the last
            observation.
        include_observation_noise: report forecast intervals for a future scale reading
            rather than for the latent weight.
        time_axis: the time coordinate system. Results are independent of its epoch.

    Returns:
        An :class:`AnalysisResult`. With a single observation it reports that weight,
        a velocity of exactly zero, and a forecast whose interval is wide enough to say
        nothing -- which is the honest answer, not a failure (master plan section 12).

    Raises:
        InsufficientDataError: if ``observations`` is empty.
        UnsortedObservationsError: if the observations are not in time order.
    """
    series = tuple(observations)
    filter_result = run_filter(series, params, time_axis=time_axis)
    current = filter_result.final

    forecast = forecast_path(
        current,
        filter_result.params,
        horizon_days,
        step_days=forecast_step_days,
        origin=origin,
        include_observation_noise=include_observation_noise,
        time_axis=time_axis,
    )

    return AnalysisResult(
        params=filter_result.params,
        observations=series,
        trajectory=tuple(TrajectoryPoint.from_state(s) for s in filter_result.posteriors),
        current=current,
        forecast=forecast,
        filter_result=filter_result,
        n_obs=filter_result.n_obs,
        span_days=time_axis.elapsed_days(series[0].timestamp, series[-1].timestamp),
    )
