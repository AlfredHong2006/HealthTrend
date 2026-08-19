"""The state-space model: transition, process noise, observation, covariance hygiene.

The hidden state is

    x_t = [w_t, v_t]

where ``w_t`` is latent weight in kg and ``v_t`` is its rate of change in kg/day. The
model is local-linear-trend in continuous time, sampled at whatever instants the user
happened to step on the scale.

**Transition.** Over an interval of ``dt`` days, weight moves by ``v * dt`` and velocity
is unchanged in expectation::

    F(dt) = [[1, dt],
             [0,  1]]

**Process noise.** Velocity is a Wiener process with intensity ``sigma_accel`` and
weight is its integral (continuous white-noise acceleration)::

    Q(dt) = sigma_accel**2 * [[dt**3 / 3, dt**2 / 2],
                             [dt**2 / 2,       dt]]

That form is not a convenience. It is the only one that satisfies

    F(b) Q(a) F(b)' + Q(b) == Q(a + b)

so splitting an interval into sub-intervals changes nothing. A 30-day gap gives exactly
the same answer as thirty 1-day steps, which is what makes irregular weigh-in times
principled rather than approximated. See :func:`process_noise` and test ``M4``.

**Observation.** The scale reads the weight component only::

    y_t = H x_t + e_t,   H = [[1, 0]],   e_t ~ N(0, R_t)
"""

from __future__ import annotations

from typing import Final

import numpy as np
from numpy.typing import NDArray

from app.core.types import STATE_DIM, CoreError, InvalidCovarianceError, ModelParams

H: Final[NDArray[np.float64]] = np.array([[1.0, 0.0]], dtype=np.float64)
"""Observation matrix, shape ``(1, 2)``: the scale measures weight, not velocity."""

H.flags.writeable = False

IDENTITY: Final[NDArray[np.float64]] = np.eye(STATE_DIM, dtype=np.float64)
IDENTITY.flags.writeable = False


def _require_non_negative_dt(dt_days: float) -> float:
    """Validate an elapsed time, which may be zero but never negative."""
    value = float(dt_days)
    if not np.isfinite(value) or value < 0.0:
        raise CoreError(
            "dt_days must be a finite non-negative number of days; "
            "observations must be sorted before they reach the model"
        )
    return value


def transition_matrix(dt_days: float) -> NDArray[np.float64]:
    """Return ``F(dt)`` for an interval of ``dt_days`` days.

    ``dt_days == 0`` yields the identity, which is what makes two weigh-ins recorded at
    the same instant reduce to two consecutive Kalman updates -- exactly, not
    approximately.
    """
    dt = _require_non_negative_dt(dt_days)
    return np.array([[1.0, dt], [0.0, 1.0]], dtype=np.float64)


def process_noise(dt_days: float, params: ModelParams) -> NDArray[np.float64]:
    """Return ``Q(dt)`` for an interval of ``dt_days`` days.

    The integrated-Wiener form documented at module level. ``Q(0)`` is exactly zero, so
    no uncertainty is manufactured for a zero-length interval.
    """
    dt = _require_non_negative_dt(dt_days)
    intensity = params.sigma_accel * params.sigma_accel
    dt2 = dt * dt
    dt3 = dt2 * dt
    return intensity * np.array(
        [[dt3 / 3.0, dt2 / 2.0], [dt2 / 2.0, dt]],
        dtype=np.float64,
    )


def symmetrize(matrix: NDArray[np.float64]) -> NDArray[np.float64]:
    """Return ``(P + P') / 2``.

    Applied after every predict and update. The algebra guarantees symmetry; floating
    point does not, and asymmetry compounds over thousands of steps.
    """
    return (matrix + matrix.T) / 2.0


def validate_covariance(
    matrix: NDArray[np.float64],
    *,
    name: str = "P",
    symmetry_tolerance: float = 1e-10,
) -> None:
    """Raise if ``matrix`` is not a usable 2x2 covariance.

    Checks shape, finiteness, symmetry, positive variances and a non-negative
    determinant. Used by the test suite on every recorded step rather than on the hot
    path, so the estimator stays allocation-light.

    Raises:
        InvalidCovarianceError: if any check fails.
    """
    if matrix.shape != (STATE_DIM, STATE_DIM):
        raise InvalidCovarianceError(
            f"{name} must have shape ({STATE_DIM}, {STATE_DIM}), got {matrix.shape}"
        )
    if not bool(np.all(np.isfinite(matrix))):
        raise InvalidCovarianceError(f"{name} contains non-finite entries")
    asymmetry = float(np.max(np.abs(matrix - matrix.T)))
    if asymmetry > symmetry_tolerance:
        raise InvalidCovarianceError(f"{name} is not symmetric (max asymmetry {asymmetry:.3e})")
    diagonal = np.diag(matrix)
    if bool(np.any(diagonal <= 0.0)):
        raise InvalidCovarianceError(f"{name} has a non-positive variance on its diagonal")
    determinant = float(matrix[0, 0] * matrix[1, 1] - matrix[0, 1] * matrix[1, 0])
    if determinant < -symmetry_tolerance:
        raise InvalidCovarianceError(
            f"{name} is not positive semi-definite (determinant {determinant:.3e})"
        )


def initial_state(
    first_weight_kg: float, params: ModelParams, *, obs_variance: float | None = None
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Return the initial mean and covariance, having consumed the first observation.

    Under a flat prior on latent weight, a single Gaussian measurement gives exactly
    ``w | y_0 ~ N(y_0, R_0)``, so the first observation is absorbed by initialisation
    rather than by an update -- no double counting, and no arbitrary starting variance::

        x_0 = [y_0, 0]
        P_0 = [[R_0,   0],
               [  0, sigma_v0**2]]

    A single measurement carries no information about velocity, so the velocity prior
    stands untouched, with a mean of zero. That zero is what keeps the estimator honest
    with one data point: it reports the weight and declines to invent a trend. It is
    also why a user's chosen goal can never bias the estimate -- the core has no way to
    learn what that goal is.

    Args:
        first_weight_kg: the first measurement, kg.
        params: model parameters.
        obs_variance: measurement variance for the first observation, defaulting to
            ``params.obs_variance``.
    """
    variance = params.obs_variance if obs_variance is None else obs_variance
    mean = np.array([float(first_weight_kg), 0.0], dtype=np.float64)
    covariance = np.array(
        [[variance, 0.0], [0.0, params.sigma_v0 * params.sigma_v0]],
        dtype=np.float64,
    )
    return mean, covariance
