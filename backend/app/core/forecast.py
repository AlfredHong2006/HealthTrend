"""Probabilistic forecasting of latent weight.

A forecast is a prediction with no measurement after it, so this module reuses
:func:`app.core.kalman.predict` rather than reimplementing propagation. Everything here
is analytic -- the model is linear and Gaussian, so no simulation is needed.

**Horizons are measured from the origin; propagation is over total elapsed time.** The
last observation is at ``t_T``, the forecast origin is at ``t_org >= t_T``, and a horizon
``h`` means ``h`` days after the origin. The state must therefore be carried forward over

    tau = (t_org - t_T) + h

not over ``h`` alone. Writing ``lead = t_org - t_T``::

    x(h) = F(tau) x_T
    P(h) = F(tau) P_T F(tau)' + Q(tau)

which for the weight component is::

    w(h)    = w_T + v_T tau
    P_ww(h) = P_ww + 2 tau P_wv + tau**2 P_vv + sigma_accel**2 tau**3 / 3

When the origin defaults to the last observation, ``lead`` is zero and ``tau`` is just
``h``. When it does not -- the user last weighed in five days ago and wants "30 days from
now" -- those five days are real elapsed time during which the trend both moved and became
less certain, so they must be propagated through. The reported ``horizon_days`` stays ``h``,
because that is what the label means to the user; only the propagation uses ``tau``. See
:func:`_propagated_point`, ADR-0005, and tests ``P5``.

The three terms after ``P_ww`` are why the band widens with horizon: uncertainty in the
current weight, uncertainty in the current velocity extrapolated over a longer lever arm,
and the possibility that the trend itself drifts. The ``tau**3`` term is what makes distant
forecasts honestly vague rather than confidently wrong.

Intervals describe the **latent** weight, matching what the product means by "30-day
estimated trend weight" (master plan section 9). Passing
``include_observation_noise=True`` widens them to describe a future scale reading
instead, which is a different question and not what Milestone 1 reports.

The horizon is a parameter throughout. Milestone 1 exposes and validates 30 days; 7 and
90 need no additional mathematics.
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import Final

import numpy as np
from numpy.typing import NDArray

from app.core.kalman import predict
from app.core.time_axis import DEFAULT_TIME_AXIS, TimeAxis
from app.core.types import (
    Z_95,
    CoreError,
    ForecastPoint,
    ForecastResult,
    ModelParams,
    StateEstimate,
)

DEFAULT_HORIZON_DAYS: Final = 30.0
"""The primary consumer forecast horizon (master plan section 9)."""

DEFAULT_STEP_DAYS: Final = 1.0
"""Granularity of the forecast path used to draw the widening band."""

_GRID_TOLERANCE: Final = 1e-12


def propagate(
    state: StateEstimate,
    horizon_days: float,
    params: ModelParams,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Propagate a state forward by ``horizon_days`` with no intervening measurement.

    Because ``F(a) Q(b) F(a)' + Q(a) == Q(a + b)``, propagating in one jump and
    propagating in steps agree exactly. That identity is what lets the forecast path be
    drawn at any granularity without changing the endpoint.
    """
    return predict(state.mean, state.P, _validate_horizon(horizon_days), params)


def forecast_at(
    state: StateEstimate,
    params: ModelParams,
    horizon_days: float = DEFAULT_HORIZON_DAYS,
    *,
    origin: datetime | None = None,
    include_observation_noise: bool = False,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> ForecastPoint:
    """Return the predictive distribution of latent weight at one horizon.

    Args:
        state: the state to forecast from, normally the last filtered posterior.
        params: model parameters.
        horizon_days: days ahead of the origin.
        origin: the instant horizons are measured from, defaulting to ``state``'s own
            timestamp. A caller wanting "30 days from now" for a user who last weighed
            in five days ago passes the current instant, which is equivalent to
            forecasting 35 days from the last observation (see ADR-0005).
        include_observation_noise: widen the interval to describe a future scale reading
            rather than the latent weight.
        time_axis: the time coordinate system.

    Raises:
        CoreError: if the horizon is negative or the origin precedes ``state``.
    """
    lead_days = _lead_days(state, origin, time_axis)
    return _propagated_point(
        state=state,
        params=params,
        lead_days=lead_days,
        horizon_days=_validate_horizon(horizon_days),
        include_observation_noise=include_observation_noise,
        time_axis=time_axis,
    )


def forecast_path(
    state: StateEstimate,
    params: ModelParams,
    horizon_days: float = DEFAULT_HORIZON_DAYS,
    *,
    step_days: float = DEFAULT_STEP_DAYS,
    origin: datetime | None = None,
    include_observation_noise: bool = False,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> ForecastResult:
    """Return the whole forecast path from the origin out to ``horizon_days``.

    The path always starts at horizon zero and ends exactly at ``horizon_days``, even
    when the horizon is not a whole multiple of ``step_days``. Horizon zero reproduces
    the state being forecast from, so the historical trend line and the forecast join
    without a visual discontinuity (master plan section 7).

    Raises:
        CoreError: if ``step_days`` is not positive, the horizon is negative, or the
            origin precedes ``state``.
    """
    horizon = _validate_horizon(horizon_days)
    if not math.isfinite(step_days) or step_days <= 0.0:
        raise CoreError("step_days must be a finite positive number of days")

    lead_days = _lead_days(state, origin, time_axis)
    horizons = _horizon_grid(horizon, step_days)
    points = tuple(
        _propagated_point(
            state=state,
            params=params,
            lead_days=lead_days,
            horizon_days=h,
            include_observation_noise=include_observation_noise,
            time_axis=time_axis,
        )
        for h in horizons
    )
    return ForecastResult(
        origin_timestamp=time_axis.shift(state.timestamp, lead_days),
        horizon_days=horizon,
        points=points,
        includes_observation_noise=include_observation_noise,
    )


def _validate_horizon(horizon_days: float) -> float:
    """Validate a forecast horizon, which may be zero but never negative."""
    horizon = float(horizon_days)
    if not math.isfinite(horizon) or horizon < 0.0:
        raise CoreError("horizon_days must be a finite non-negative number of days")
    return horizon


def _lead_days(state: StateEstimate, origin: datetime | None, time_axis: TimeAxis) -> float:
    """Return the gap between ``state`` and the forecast origin."""
    if origin is None:
        return 0.0
    lead = time_axis.elapsed_days(state.timestamp, origin)
    if lead < 0.0:
        raise CoreError(
            "the forecast origin must not precede the state being forecast from; "
            "forecasting into the past requires a smoother, not a forecast"
        )
    return lead


def _horizon_grid(horizon_days: float, step_days: float) -> list[float]:
    """Return ``[0, step, 2*step, ...]`` always terminating exactly at the horizon."""
    whole_steps = math.floor(horizon_days / step_days + _GRID_TOLERANCE)
    grid = [index * step_days for index in range(whole_steps + 1)]
    if horizon_days - grid[-1] > _GRID_TOLERANCE:
        grid.append(horizon_days)
    return grid


def _propagated_point(
    *,
    state: StateEstimate,
    params: ModelParams,
    lead_days: float,
    horizon_days: float,
    include_observation_noise: bool,
    time_axis: TimeAxis,
) -> ForecastPoint:
    """Propagate ``state`` over the total elapsed time and package the result.

    The propagation interval is ``tau = lead_days + horizon_days``: the gap from the state
    to the forecast origin, plus the horizon beyond it. The point reports
    ``horizon_days``, measured from the origin, while the distribution comes from ``tau``.
    """
    total_days = lead_days + horizon_days
    x, P = predict(state.mean, state.P, total_days, params)

    weight = float(x[0])
    variance = float(P[0, 0])
    if include_observation_noise:
        variance += params.obs_variance
    sd = math.sqrt(variance)
    half_width = Z_95 * sd

    return ForecastPoint(
        timestamp=time_axis.shift(state.timestamp, total_days),
        horizon_days=horizon_days,
        w_kg=weight,
        w_sd=sd,
        w_lower95=weight - half_width,
        w_upper95=weight + half_width,
    )
