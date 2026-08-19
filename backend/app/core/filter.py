"""Run the Kalman filter over a series of irregularly-timed weight measurements.

This is the online pass: at every observation the estimate reflects only what was known
at that instant. That is deliberately the quantity the product shows, because it is the
answer to "what should I have believed at the time" rather than a retrospectively
rewritten history. The retrospective view needs an RTS smoother, which is a later
milestone (master plan section 23); the per-step priors and posteriors recorded here are
exactly its input.

Intervals between observations are real elapsed times, never step indices. Nothing in
this module assumes daily weigh-ins, regular spacing, or a minimum number of
measurements.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.core.kalman import predict, update
from app.core.model import initial_state
from app.core.time_axis import DEFAULT_TIME_AXIS, TimeAxis
from app.core.types import (
    FilterResult,
    FilterStep,
    InsufficientDataError,
    ModelParams,
    Observation,
    StateEstimate,
    UnsortedObservationsError,
)


def _elapsed_days(observations: Sequence[Observation], time_axis: TimeAxis) -> list[float]:
    """Return the gap in days before each observation after the first.

    Raises:
        UnsortedObservationsError: if time ever runs backwards. The message names
            positions only -- never a timestamp or a weight -- because it may be logged.
    """
    gaps: list[float] = []
    for index in range(1, len(observations)):
        gap = time_axis.elapsed_days(
            observations[index - 1].timestamp, observations[index].timestamp
        )
        if gap < 0.0:
            raise UnsortedObservationsError(
                f"observations must be in non-decreasing time order, but the observation "
                f"at position {index} precedes the one at position {index - 1}; "
                f"sort them during ingestion"
            )
        gaps.append(gap)
    return gaps


def run_filter(
    observations: Sequence[Observation],
    params: ModelParams | None = None,
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> FilterResult:
    """Filter a series of observations into a latent-weight trajectory.

    The first observation initialises the state (see
    :func:`app.core.model.initial_state`); each subsequent one triggers a predict over
    the real elapsed interval followed by an update. Simultaneous observations give a
    zero-length interval, which the model handles exactly.

    Args:
        observations: weight measurements in non-decreasing time order. Sorting,
            de-duplication and unit conversion belong to ingestion, not here.
        params: model parameters; defaults to the documented priors.
        time_axis: the time coordinate system. Results are independent of its epoch.

    Returns:
        A :class:`FilterResult` with one posterior per observation plus per-step
        diagnostics.

    Raises:
        InsufficientDataError: if ``observations`` is empty.
        UnsortedObservationsError: if the observations are not in time order.
    """
    if len(observations) == 0:
        raise InsufficientDataError(
            "at least one observation is required to estimate a latent weight"
        )

    resolved_params = ModelParams.default() if params is None else params
    series = tuple(observations)
    gaps = _elapsed_days(series, time_axis)

    first = series[0]
    x, P = initial_state(
        first.weight_kg,
        resolved_params,
        obs_variance=first.variance(resolved_params),
    )
    initial = StateEstimate(timestamp=first.timestamp, w_kg=x[0], v_kg_per_day=x[1], P=P)

    steps: list[FilterStep] = []
    loglik = 0.0
    for index in range(1, len(series)):
        observation = series[index]
        dt_days = gaps[index - 1]

        x_prior, P_prior = predict(x, P, dt_days, resolved_params)
        prior = StateEstimate(
            timestamp=observation.timestamp,
            w_kg=x_prior[0],
            v_kg_per_day=x_prior[1],
            P=P_prior,
        )

        outcome = update(
            x_prior,
            P_prior,
            observation.weight_kg,
            observation.variance(resolved_params),
        )
        x, P = outcome.x, outcome.P
        posterior = StateEstimate(
            timestamp=observation.timestamp,
            w_kg=x[0],
            v_kg_per_day=x[1],
            P=P,
        )

        loglik += outcome.loglik_contrib
        steps.append(
            FilterStep(
                timestamp=observation.timestamp,
                dt_days=dt_days,
                y_kg=observation.weight_kg,
                prior=prior,
                posterior=posterior,
                innovation_kg=outcome.innovation,
                innovation_var=outcome.innovation_var,
                normalized_innovation=outcome.normalized_innovation,
                gain=outcome.gain,
                loglik_contrib=outcome.loglik_contrib,
            )
        )

    return FilterResult(
        params=resolved_params,
        initial=initial,
        steps=tuple(steps),
        loglik=loglik,
        n_obs=len(series),
    )
