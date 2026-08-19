"""Immutable value objects and error types shared by the whole numerical core.

Everything here is a frozen dataclass. Covariance matrices are stored as read-only
NumPy arrays so that a value object handed to a caller cannot be mutated behind the
estimator's back -- a precondition for the determinism the golden test relies on.

This module depends only on :mod:`app.core.units` and :mod:`app.core.time_axis`.
Nothing here knows about filtering, forecasting, HTTP or storage.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Final

import numpy as np
from numpy.typing import NDArray

from app.core.time_axis import require_utc_aware
from app.core.units import (
    per_day_to_per_week,
    per_week_to_per_day,
    sigma_accel_from_weekly_rate_drift,
    weekly_rate_drift_from_sigma_accel,
)

STATE_DIM: Final = 2
"""The hidden state is two-dimensional: latent weight and its rate of change."""

Z_95: Final = 1.959963984540054
"""Two-sided 95% standard-normal quantile.

Master plan section 16 writes this as ``1.96``; this is that value unrounded. Interval
code references this constant rather than a literal so the choice is stated once.
"""

# ---------------------------------------------------------------------------
# Defaults for the documented priors (see docs/mathematics.md and ADR-0003).
# These are priors, not values fitted to data. No accuracy claim attaches to them.
# ---------------------------------------------------------------------------

DEFAULT_SIGMA_OBS_KG: Final = 0.5
"""Assumed standard deviation of a single weigh-in around the latent weight, kg."""

DEFAULT_WEEKLY_RATE_DRIFT_KG_PER_WEEK: Final = 0.15
"""Assumed drift of the weekly rate over one week, kg/week per week."""

DEFAULT_INITIAL_WEEKLY_RATE_SPREAD_KG_PER_WEEK: Final = 1.0
"""Weakly-informative prior spread of the initial weekly rate, kg/week."""


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class CoreError(ValueError):
    """Base class for every error raised by the numerical core.

    Derives from :class:`ValueError` because every one of these represents invalid
    input rather than a defect, and because it lets callers catch core failures and
    ordinary value errors with a single ``except``.

    Error messages never contain weight values or timestamps: an error string can end
    up in a log, and logs must not carry health data (master plan section 42).
    """


class InsufficientDataError(CoreError):
    """Raised when there are too few observations to produce the requested output."""


class UnsortedObservationsError(CoreError):
    """Raised when observations are not in non-decreasing time order.

    Sorting is deliberately not done here. It belongs to the ingestion layer, which
    knows the provenance of the data; silently reordering in the estimator would hide
    upstream bugs.
    """


class InvalidCovarianceError(CoreError):
    """Raised when a covariance matrix is not a valid symmetric PSD 2x2 matrix."""


# ---------------------------------------------------------------------------
# Model parameters
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class ModelParams:
    """The three scalars that define the state-space model.

    Attributes:
        sigma_obs_kg: measurement noise standard deviation, kg. Larger values make the
            estimator trust the scale less and smooth harder.
        sigma_accel: process-noise intensity, ``kg * day**-1.5``. Larger values let the
            trend change direction faster. Prefer
            :meth:`from_interpretable_priors` over setting this by hand.
        sigma_v0: prior standard deviation of the initial velocity, kg/day. Governs how
            confidently a trend is inferred from the first few measurements.
    """

    sigma_obs_kg: float
    sigma_accel: float
    sigma_v0: float

    def __post_init__(self) -> None:
        """Coerce to float and reject non-positive or non-finite values."""
        for name in ("sigma_obs_kg", "sigma_accel", "sigma_v0"):
            value = float(getattr(self, name))
            if not math.isfinite(value) or value <= 0.0:
                raise CoreError(f"{name} must be a finite positive standard deviation")
            object.__setattr__(self, name, value)

    @classmethod
    def from_interpretable_priors(
        cls,
        *,
        sigma_obs_kg: float = DEFAULT_SIGMA_OBS_KG,
        weekly_rate_drift_kg_per_week: float = DEFAULT_WEEKLY_RATE_DRIFT_KG_PER_WEEK,
        initial_weekly_rate_spread_kg_per_week: float = (
            DEFAULT_INITIAL_WEEKLY_RATE_SPREAD_KG_PER_WEEK
        ),
    ) -> ModelParams:
        """Build parameters from priors stated in product units.

        Args:
            sigma_obs_kg: how far a single weigh-in typically sits from the latent
                weight, in kg.
            weekly_rate_drift_kg_per_week: how far the weekly rate can wander over the
                course of one week. See
                :func:`app.core.units.sigma_accel_from_weekly_rate_drift`.
            initial_weekly_rate_spread_kg_per_week: plausible spread of the weekly rate
                before any trend information exists.
        """
        return cls(
            sigma_obs_kg=sigma_obs_kg,
            sigma_accel=sigma_accel_from_weekly_rate_drift(weekly_rate_drift_kg_per_week),
            sigma_v0=per_week_to_per_day(initial_weekly_rate_spread_kg_per_week),
        )

    @classmethod
    def default(cls) -> ModelParams:
        """Return the documented default priors."""
        return cls.from_interpretable_priors()

    @property
    def obs_variance(self) -> float:
        """Measurement variance ``R = sigma_obs**2``, in kg^2."""
        return self.sigma_obs_kg * self.sigma_obs_kg

    @property
    def weekly_rate_drift_kg_per_week(self) -> float:
        """:attr:`sigma_accel` expressed as weekly-rate drift per week."""
        return weekly_rate_drift_from_sigma_accel(self.sigma_accel)

    @property
    def initial_weekly_rate_spread_kg_per_week(self) -> float:
        """:attr:`sigma_v0` expressed as a weekly rate."""
        return per_day_to_per_week(self.sigma_v0)

    def to_dict(self) -> dict[str, float]:
        """Return a JSON-serialisable view, including the interpretable forms."""
        return {
            "sigma_obs_kg": self.sigma_obs_kg,
            "sigma_accel": self.sigma_accel,
            "sigma_v0": self.sigma_v0,
            "weekly_rate_drift_kg_per_week": self.weekly_rate_drift_kg_per_week,
            "initial_weekly_rate_spread_kg_per_week": (self.initial_weekly_rate_spread_kg_per_week),
        }


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Observation:
    """A single timestamped weight measurement, already normalised to kg and UTC.

    Attributes:
        timestamp: the instant of the weigh-in. Must be timezone-aware; stored as UTC.
        weight_kg: the measured value in kilograms.
        obs_variance: optional per-observation measurement variance in kg^2, overriding
            ``sigma_obs**2``. Reserved for the robust and adaptive observation models of
            master plan section 21 and unused in Milestone 1, where it is always
            ``None``.
    """

    timestamp: datetime
    weight_kg: float
    obs_variance: float | None = None

    def __post_init__(self) -> None:
        """Normalise the timestamp and validate the measurement."""
        object.__setattr__(self, "timestamp", require_utc_aware(self.timestamp))
        weight = float(self.weight_kg)
        if not math.isfinite(weight) or weight <= 0.0:
            raise CoreError("weight_kg must be a finite positive number of kilograms")
        object.__setattr__(self, "weight_kg", weight)
        if self.obs_variance is not None:
            variance = float(self.obs_variance)
            if not math.isfinite(variance) or variance <= 0.0:
                raise CoreError("obs_variance must be a finite positive variance in kg^2")
            object.__setattr__(self, "obs_variance", variance)

    def variance(self, params: ModelParams) -> float:
        """Return the measurement variance ``R_t`` to use for this observation."""
        return params.obs_variance if self.obs_variance is None else self.obs_variance

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable view."""
        return {"timestamp": self.timestamp.isoformat(), "weight_kg": self.weight_kg}


# ---------------------------------------------------------------------------
# Estimates
# ---------------------------------------------------------------------------


def _read_only_covariance(value: NDArray[np.float64] | list[list[float]]) -> NDArray[np.float64]:
    """Copy ``value`` into a read-only 2x2 float64 array."""
    matrix = np.array(value, dtype=np.float64)
    if matrix.shape != (STATE_DIM, STATE_DIM):
        raise InvalidCovarianceError(
            f"covariance must have shape ({STATE_DIM}, {STATE_DIM}), got {matrix.shape}"
        )
    matrix.flags.writeable = False
    return matrix


@dataclass(frozen=True, slots=True, eq=False)
class StateEstimate:
    """The posterior (or prior) distribution of the hidden state at one instant.

    The state is ``x = [w, v]``: latent weight in kg and its rate of change in kg/day.
    ``P`` is the 2x2 covariance of that state.

    Equality is disabled because comparing NumPy arrays with ``==`` does not produce a
    single boolean; compare the fields you care about, or :meth:`to_dict`.
    """

    timestamp: datetime
    w_kg: float
    v_kg_per_day: float
    P: NDArray[np.float64]

    def __post_init__(self) -> None:
        """Normalise the timestamp, coerce scalars and freeze the covariance."""
        object.__setattr__(self, "timestamp", require_utc_aware(self.timestamp))
        object.__setattr__(self, "w_kg", float(self.w_kg))
        object.__setattr__(self, "v_kg_per_day", float(self.v_kg_per_day))
        object.__setattr__(self, "P", _read_only_covariance(self.P))

    @property
    def mean(self) -> NDArray[np.float64]:
        """The state mean ``x = [w, v]`` as a fresh writable array."""
        return np.array([self.w_kg, self.v_kg_per_day], dtype=np.float64)

    @property
    def w_var(self) -> float:
        """Variance of the latent weight, ``P[0, 0]``, in kg^2."""
        return float(self.P[0, 0])

    @property
    def v_var(self) -> float:
        """Variance of the velocity, ``P[1, 1]``, in (kg/day)^2."""
        return float(self.P[1, 1])

    @property
    def wv_cov(self) -> float:
        """Covariance between latent weight and velocity, ``P[0, 1]``."""
        return float(self.P[0, 1])

    @property
    def w_sd(self) -> float:
        """Standard deviation of the latent weight, kg."""
        return math.sqrt(self.w_var)

    @property
    def v_sd(self) -> float:
        """Standard deviation of the velocity, kg/day."""
        return math.sqrt(self.v_var)

    @property
    def weekly_rate_kg(self) -> float:
        """Velocity expressed as kg/week, the form shown to users."""
        return per_day_to_per_week(self.v_kg_per_day)

    @property
    def weekly_rate_sd_kg(self) -> float:
        """Standard deviation of the weekly rate, kg/week."""
        return per_day_to_per_week(self.v_sd)

    def w_interval(self, z: float = Z_95) -> tuple[float, float]:
        """Return a symmetric interval for the latent weight at ``z`` standard errors."""
        half_width = z * self.w_sd
        return self.w_kg - half_width, self.w_kg + half_width

    @property
    def w_ci95(self) -> tuple[float, float]:
        """The 95% interval for the latent weight (master plan section 16)."""
        return self.w_interval()

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable view."""
        lower, upper = self.w_ci95
        return {
            "timestamp": self.timestamp.isoformat(),
            "w_kg": self.w_kg,
            "w_sd": self.w_sd,
            "w_lower95": lower,
            "w_upper95": upper,
            "v_kg_per_day": self.v_kg_per_day,
            "v_sd": self.v_sd,
            "weekly_rate_kg": self.weekly_rate_kg,
            "weekly_rate_sd_kg": self.weekly_rate_sd_kg,
            "P": [[float(self.P[i, j]) for j in range(STATE_DIM)] for i in range(STATE_DIM)],
        }


@dataclass(frozen=True, slots=True, eq=False)
class FilterStep:
    """Everything that happened when one observation was absorbed.

    Recorded for every observation so that later milestones can build the "why did the
    estimate move?" inspector (master plan section 51), calibration diagnostics and an
    RTS smoother without re-running or re-designing the filter. Milestone 1 records
    these but surfaces none of them.

    Attributes:
        dt_days: elapsed time since the previous observation.
        prior: the state predicted forward to this instant, before the update.
        posterior: the state after absorbing the observation.
        innovation_kg: ``nu = y - H x_prior``, how far the measurement fell from the
            prediction.
        innovation_var: ``S = H P_prior H' + R``.
        normalized_innovation: ``nu / sqrt(S)``; should behave like a standard normal
            draw if the model is well specified.
        gain: the Kalman gain ``K`` as a length-2 vector.
        loglik_contrib: this observation's contribution to the Gaussian log-likelihood.
    """

    timestamp: datetime
    dt_days: float
    y_kg: float
    prior: StateEstimate
    posterior: StateEstimate
    innovation_kg: float
    innovation_var: float
    normalized_innovation: float
    gain: NDArray[np.float64]
    loglik_contrib: float

    def __post_init__(self) -> None:
        """Freeze the gain vector."""
        gain = np.array(self.gain, dtype=np.float64).reshape(STATE_DIM)
        gain.flags.writeable = False
        object.__setattr__(self, "gain", gain)


@dataclass(frozen=True, slots=True, eq=False)
class FilterResult:
    """The outcome of running the filter over one series of observations.

    Attributes:
        initial: the state after initialisation, which consumes the first observation.
        steps: one entry per subsequent observation, so ``len(steps) == n_obs - 1``.
        loglik: the Gaussian log-likelihood of observations 2..n conditional on the
            first. The first observation carries no predictive density because it
            initialises a diffuse prior, so it contributes nothing. Not a product
            output; recorded so parameters can be fitted by maximum likelihood later.
    """

    params: ModelParams
    initial: StateEstimate
    steps: tuple[FilterStep, ...]
    loglik: float
    n_obs: int

    @property
    def final(self) -> StateEstimate:
        """The most recent posterior state."""
        return self.steps[-1].posterior if self.steps else self.initial

    @property
    def posteriors(self) -> tuple[StateEstimate, ...]:
        """One posterior per observation, oldest first. Length equals :attr:`n_obs`."""
        return (self.initial, *(step.posterior for step in self.steps))


# ---------------------------------------------------------------------------
# Product-facing series
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class TrajectoryPoint:
    """One point on the estimated latent-weight path, ready to plot."""

    timestamp: datetime
    w_kg: float
    w_sd: float
    w_lower95: float
    w_upper95: float

    @classmethod
    def from_state(cls, state: StateEstimate) -> TrajectoryPoint:
        """Project a :class:`StateEstimate` onto the latent-weight dimension."""
        lower, upper = state.w_ci95
        return cls(
            timestamp=state.timestamp,
            w_kg=state.w_kg,
            w_sd=state.w_sd,
            w_lower95=lower,
            w_upper95=upper,
        )

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable view."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "w_kg": self.w_kg,
            "w_sd": self.w_sd,
            "w_lower95": self.w_lower95,
            "w_upper95": self.w_upper95,
        }


@dataclass(frozen=True, slots=True)
class ForecastPoint:
    """The predictive distribution of latent weight at one future horizon.

    Attributes:
        horizon_days: days ahead of the forecast origin, so ``0.0`` is the origin
            itself.
    """

    timestamp: datetime
    horizon_days: float
    w_kg: float
    w_sd: float
    w_lower95: float
    w_upper95: float

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable view."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "horizon_days": self.horizon_days,
            "w_kg": self.w_kg,
            "w_sd": self.w_sd,
            "w_lower95": self.w_lower95,
            "w_upper95": self.w_upper95,
        }


@dataclass(frozen=True, slots=True)
class ForecastResult:
    """A forecast path from an origin out to a horizon.

    Attributes:
        origin_timestamp: the instant the horizons are measured from. Defaults to the
            last observation; a caller wanting "30 days from now" passes the current
            instant (see ADR-0005).
        horizon_days: the furthest horizon in the path.
        points: the path, oldest first, always ending exactly at :attr:`horizon_days`.
        includes_observation_noise: ``False`` when the intervals describe the latent
            weight (the product's meaning), ``True`` when they describe a future scale
            reading and therefore also carry measurement noise.
    """

    origin_timestamp: datetime
    horizon_days: float
    points: tuple[ForecastPoint, ...]
    includes_observation_noise: bool = False

    def __post_init__(self) -> None:
        """Normalise the origin timestamp."""
        object.__setattr__(
            self,
            "origin_timestamp",
            require_utc_aware(self.origin_timestamp, field_name="origin_timestamp"),
        )

    @property
    def terminal(self) -> ForecastPoint:
        """The point at the furthest horizon."""
        return self.points[-1]

    def point_at(self, horizon_days: float, *, tolerance: float = 1e-9) -> ForecastPoint:
        """Return the path point at ``horizon_days``.

        Raises:
            CoreError: if the path contains no point at that horizon.
        """
        for point in self.points:
            if abs(point.horizon_days - horizon_days) <= tolerance:
                return point
        raise CoreError("the forecast path contains no point at the requested horizon")

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable view."""
        return {
            "origin_timestamp": self.origin_timestamp.isoformat(),
            "horizon_days": self.horizon_days,
            "includes_observation_noise": self.includes_observation_noise,
            "points": [point.to_dict() for point in self.points],
        }


@dataclass(frozen=True, slots=True, eq=False)
class AnalysisResult:
    """Everything Milestone 1 produces from a series of weight measurements.

    This is the object every later layer consumes: the HTTP schema will mirror it, and
    the contextual-ML experiment of master plan section 31 measures its forecast
    residuals.

    Attributes:
        trajectory: the filtered (online) latent-weight path, one point per
            observation. Not smoothed -- see ADR-0005 and master plan section 23.
        current: the latent weight, uncertainty and velocity as of the last
            observation.
        forecast: the probabilistic forecast path.
        filter_result: the full filter run, including per-observation diagnostics and
            the log-likelihood.
        span_days: elapsed days from the first observation to the last.
    """

    params: ModelParams
    observations: tuple[Observation, ...]
    trajectory: tuple[TrajectoryPoint, ...]
    current: StateEstimate
    forecast: ForecastResult
    filter_result: FilterResult
    n_obs: int
    span_days: float

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serialisable view of the product-facing surface.

        Per-observation filter diagnostics are deliberately excluded: they are an
        internal record, and including them would make the golden fixture unreviewable.
        """
        return {
            "params": self.params.to_dict(),
            "n_obs": self.n_obs,
            "span_days": self.span_days,
            "loglik": self.filter_result.loglik,
            "observations": [obs.to_dict() for obs in self.observations],
            "trajectory": [point.to_dict() for point in self.trajectory],
            "current": self.current.to_dict(),
            "forecast": self.forecast.to_dict(),
        }
