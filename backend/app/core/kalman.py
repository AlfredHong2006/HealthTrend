"""The two Kalman primitives: predict forward in time, update on a measurement.

These are deliberately small, stateless functions on plain arrays. Everything above them
-- filtering a series, forecasting a horizon -- is built from these two operations, which
is why forecasting needs no separate propagation code: a forecast is a prediction with no
measurement to follow it.

Prediction::

    x_prior = F(dt) x
    P_prior = F(dt) P F(dt)' + Q(dt)

Innovation and gain, with a scalar ``S`` so the "inverse" is a true division::

    nu = y - H x_prior
    S  = H P_prior H' + R
    K  = P_prior H' / S

Update, in Joseph form::

    x_post = x_prior + K nu
    P_post = (I - K H) P_prior (I - K H)' + K R K'
"""

from __future__ import annotations

import math
from typing import Final, NamedTuple

import numpy as np
from numpy.typing import NDArray

from app.core.model import IDENTITY, H, process_noise, symmetrize, transition_matrix
from app.core.types import STATE_DIM, CoreError, ModelParams

_LOG_2PI: Final = math.log(2.0 * math.pi)


class KalmanUpdate(NamedTuple):
    """The result of absorbing one measurement, including diagnostics.

    Attributes:
        x: posterior state mean.
        P: posterior covariance.
        innovation: ``nu``, how far the measurement fell from the prediction, kg.
        innovation_var: ``S``, the variance the model expected that gap to have, kg^2.
        normalized_innovation: ``nu / sqrt(S)``. Standard normal under a correctly
            specified model, which is what makes it the natural basis for the
            calibration, outlier and change-detection work of later milestones.
        gain: ``K`` as a length-2 vector.
        loglik_contrib: this measurement's Gaussian log-likelihood contribution.
    """

    x: NDArray[np.float64]
    P: NDArray[np.float64]
    innovation: float
    innovation_var: float
    normalized_innovation: float
    gain: NDArray[np.float64]
    loglik_contrib: float


def predict(
    x: NDArray[np.float64],
    P: NDArray[np.float64],
    dt_days: float,
    params: ModelParams,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Propagate the state forward by ``dt_days`` days with no measurement.

    Covariance grows here, and it grows for two distinct reasons: an uncertain velocity
    is extrapolated over a longer lever arm (the ``F P F'`` term), and the trend itself
    may have drifted in the meantime (the ``Q`` term). Both are why forecast intervals
    widen with horizon.

    Args:
        x: state mean, shape ``(2,)``.
        P: state covariance, shape ``(2, 2)``.
        dt_days: elapsed days, zero or more.
        params: model parameters.

    Returns:
        The predicted mean and covariance.
    """
    F = transition_matrix(dt_days)
    Q = process_noise(dt_days, params)
    x_prior = F @ x
    P_prior = symmetrize(F @ P @ F.T + Q)
    return x_prior, P_prior


def update(
    x_prior: NDArray[np.float64],
    P_prior: NDArray[np.float64],
    y_kg: float,
    obs_variance: float,
) -> KalmanUpdate:
    """Absorb one weight measurement.

    The Joseph form of the covariance update is used rather than the shorter
    ``(I - K H) P``. Both are algebraically identical; only this one stays symmetric and
    positive semi-definite when accumulated over thousands of steps in floating point.

    Args:
        x_prior: predicted state mean at the measurement instant.
        P_prior: predicted covariance at the measurement instant.
        y_kg: the measurement, kg.
        obs_variance: ``R``, the measurement variance in kg^2.

    Returns:
        The posterior state and the diagnostics of this update.

    Raises:
        CoreError: if ``obs_variance`` is not positive, or if the innovation variance is
            non-positive (which would mean the covariance had already gone bad).
    """
    if not math.isfinite(obs_variance) or obs_variance <= 0.0:
        raise CoreError("obs_variance must be a finite positive variance in kg^2")

    innovation = float(y_kg) - float((H @ x_prior)[0])
    innovation_var = float((H @ P_prior @ H.T)[0, 0]) + obs_variance
    if not math.isfinite(innovation_var) or innovation_var <= 0.0:
        raise CoreError("innovation variance must be finite and positive")

    gain = P_prior @ H.T / innovation_var  # shape (2, 1)
    x_post = x_prior + gain[:, 0] * innovation

    i_kh = IDENTITY - gain @ H
    P_post = symmetrize(i_kh @ P_prior @ i_kh.T + (gain @ gain.T) * obs_variance)

    normalized_innovation = innovation / math.sqrt(innovation_var)
    loglik_contrib = -0.5 * (
        _LOG_2PI + math.log(innovation_var) + normalized_innovation * normalized_innovation
    )

    return KalmanUpdate(
        x=x_post,
        P=P_post,
        innovation=innovation,
        innovation_var=innovation_var,
        normalized_innovation=normalized_innovation,
        gain=gain.reshape(STATE_DIM).copy(),
        loglik_contrib=loglik_contrib,
    )
