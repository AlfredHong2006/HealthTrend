"""HealthTrend numerical core: latent weight estimation and probabilistic forecasting.

This package is pure. It depends on NumPy and the standard library, and on nothing else
-- no web framework, no validation library, no filesystem, no network, no clock, no
randomness. ``tests/core/test_architecture_purity.py`` enforces that rather than trusting
it, because the moment the core reaches for the current time or a request object it stops
being deterministically testable.

The usual entry point is :func:`app.core.analyse.run_analysis`::

    from app.core import Observation, run_analysis

    result = run_analysis(observations)
    result.current.w_kg               # latent weight now, kg
    result.current.w_ci95             # 95% interval for it
    result.current.weekly_rate_kg     # trend velocity, kg/week
    result.forecast.terminal.w_kg     # 30-day forecast
    result.forecast.terminal.w_lower95, result.forecast.terminal.w_upper95

Reading order for the mathematics: :mod:`app.core.model` defines the model,
:mod:`app.core.kalman` the two primitives, :mod:`app.core.filter` the pass over a series,
:mod:`app.core.forecast` the propagation forward. ``docs/mathematics.md`` maps every
equation to the symbol that implements it.
"""

from app.core.analyse import run_analysis
from app.core.filter import run_filter
from app.core.forecast import (
    DEFAULT_HORIZON_DAYS,
    DEFAULT_STEP_DAYS,
    forecast_at,
    forecast_path,
    propagate,
)
from app.core.kalman import KalmanUpdate, predict, update
from app.core.model import (
    H,
    initial_state,
    process_noise,
    symmetrize,
    transition_matrix,
    validate_covariance,
)
from app.core.time_axis import DEFAULT_EPOCH, DEFAULT_TIME_AXIS, TimeAxis, require_utc_aware
from app.core.types import (
    STATE_DIM,
    Z_95,
    AnalysisResult,
    CoreError,
    FilterResult,
    FilterStep,
    ForecastPoint,
    ForecastResult,
    InsufficientDataError,
    InvalidCovarianceError,
    ModelParams,
    Observation,
    StateEstimate,
    TrajectoryPoint,
    UnsortedObservationsError,
)
from app.core.units import (
    DAYS_PER_WEEK,
    KG_PER_LB,
    kg_to_lb,
    lb_to_kg,
    per_day_to_per_week,
    per_week_to_per_day,
    sigma_accel_from_weekly_rate_drift,
    weekly_rate_drift_from_sigma_accel,
)

__all__ = [
    "DAYS_PER_WEEK",
    "DEFAULT_EPOCH",
    "DEFAULT_HORIZON_DAYS",
    "DEFAULT_STEP_DAYS",
    "DEFAULT_TIME_AXIS",
    "KG_PER_LB",
    "STATE_DIM",
    "Z_95",
    "AnalysisResult",
    "CoreError",
    "FilterResult",
    "FilterStep",
    "ForecastPoint",
    "ForecastResult",
    "H",
    "InsufficientDataError",
    "InvalidCovarianceError",
    "KalmanUpdate",
    "ModelParams",
    "Observation",
    "StateEstimate",
    "TimeAxis",
    "TrajectoryPoint",
    "UnsortedObservationsError",
    "forecast_at",
    "forecast_path",
    "initial_state",
    "kg_to_lb",
    "lb_to_kg",
    "per_day_to_per_week",
    "per_week_to_per_day",
    "predict",
    "process_noise",
    "propagate",
    "require_utc_aware",
    "run_analysis",
    "run_filter",
    "sigma_accel_from_weekly_rate_drift",
    "symmetrize",
    "transition_matrix",
    "update",
    "validate_covariance",
    "weekly_rate_drift_from_sigma_accel",
]
