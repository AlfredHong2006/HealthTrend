"""An independent likelihood for the local-linear-trend model, computed a different way.

The filter accumulates its log-likelihood one observation at a time, from the innovations
of a recursion: predict, subtract, divide by the innovation variance, move on. That is the
right way to compute it and the wrong way to check it, because a mistake in the recursion
would be reproduced identically by any second implementation of the same recursion.

So this module does not filter. It writes down the joint distribution of the whole
observation vector in closed form and evaluates a single multivariate normal density.
Conditional on the first observation -- matching the filter, which consumes it to
initialise rather than to update -- the remaining observations are jointly Gaussian, and
their mean and covariance follow from the model's marginal moments:

    x_0 | y_0 ~ N([y_0, 0], P_0),   P_0 = diag(R_0, sigma_v0**2)
    x_i = F(tau_i) x_0 + w_i,       w_i ~ N(0, Q(tau_i)),  tau_i = t_i - t_0

whence, writing ``V_i = F(tau_i) P_0 F(tau_i)' + Q(tau_i)``,

    E[y_i]        = H F(tau_i) [y_0, 0]' = y_0
    Cov(x_i, x_j) = V_i F(t_j - t_i)'                    for i <= j
    Sigma_ij      = H Cov(x_i, x_j) H' + R_i [i == j]

Projecting onto the weight component gives two scalars per observation and nothing worse::

    A_i = R_0 + tau_i**2 sigma_v0**2 + sigma_accel**2 tau_i**3 / 3     (= V_i[0, 0])
    B_i = tau_i sigma_v0**2         + sigma_accel**2 tau_i**2 / 2      (= V_i[0, 1])

    Sigma_ij = A_i + (tau_j - tau_i) B_i + R_i [i == j],   i <= j

and the log-likelihood is one Cholesky factorisation::

    l = -0.5 [ (n - 1) log(2 pi) + 2 sum_k log L_kk + || L^-1 (y - mu) ||**2 ]

Nothing here is recursive, nothing is incremental, and the covariance is built from the
continuous-time moments rather than by stepping. The two computations share only the
model's definition, which is exactly what makes their agreement informative.

**This is an oracle, never an objective.** It costs ``O(n**3)`` and allocates an
``n``-by-``n`` matrix, so fitting through it would be slow for no benefit. The fitting
objective is :func:`evaluation.mle.innovations_loglik`, a lean ``O(n)`` recursion that E1
checks against this module alongside :func:`app.core.filter.run_filter` itself.

**The oracle is the numerically weaker of the two, and E1 measured how much.** The
covariance it factorises has condition number growing with the square of the calendar
span; over 300 weekly readings with a wide velocity prior and small measurement noise it
reaches ``1.6e10``, and there the double-precision Cholesky loses most of its digits. On
the worst such case, checked against :func:`decimal_loglik` at 60 significant digits:

===========================  ==================
computation                  error vs exact
===========================  ==================
``run_filter`` (Joseph)      ``7.4e-13``
``innovations_loglik``       ``7.4e-13``
``direct_loglik`` (float64)  ``3.7e-05``
===========================  ==================

Seven orders of magnitude, in the oracle's disfavour. So a disagreement at high condition
number is evidence about *this module*, not about the estimator, and E1 classifies such
cases rather than counting them as failures -- see
:data:`evaluation.experiments.e1_exact_likelihood.ORACLE_CONDITION_LIMIT`. That is not a
widened tolerance to make a test pass: the filter is independently confirmed correct to
``1e-12`` by exact arithmetic, which is a stronger statement than the one the float64
oracle was able to make.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from decimal import Decimal, localcontext
from typing import Final

import numpy as np
from numpy.typing import NDArray

from app.core.time_axis import DEFAULT_TIME_AXIS, TimeAxis
from app.core.types import CoreError, ModelParams, Observation

_LOG_2PI: Final = math.log(2.0 * math.pi)

_PI_50 = Decimal("3.14159265358979323846264338327950288419716939937510")
"""Pi to 50 significant digits, for :func:`decimal_loglik`.

Checked against :data:`math.pi` to double precision by test ``EV1``, which is all the
verification a universally tabulated mathematical constant needs -- and more than a
transcribed statistical quantile could get.
"""

DECIMAL_PRECISION: Final = 60
"""Significant digits used by :func:`decimal_loglik`.

Sixty is far beyond what the comparison needs; the point is that the reference is limited
by nothing the float64 path is limited by.
"""


def elapsed_since_first(
    observations: Sequence[Observation],
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> NDArray[np.float64]:
    """Return ``tau_i = t_i - t_0`` in days, one per observation, starting at zero.

    Raises:
        CoreError: if the observations are not in non-decreasing time order. The filter
            rejects the same thing; the oracle must not quietly accept what the filter
            refuses, or a disagreement would be attributed to the mathematics.
    """
    first = observations[0].timestamp
    tau = np.array(
        [time_axis.elapsed_days(first, observation.timestamp) for observation in observations],
        dtype=np.float64,
    )
    if bool(np.any(np.diff(tau) < 0.0)):
        raise CoreError("observations must be in non-decreasing time order")
    return tau


def marginal_weight_moments(
    tau: NDArray[np.float64],
    params: ModelParams,
    initial_variance: float,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Return ``(A, B)``: the weight variance and weight-velocity covariance at each ``tau``.

    ``A_i`` is ``V_i[0, 0]`` and ``B_i`` is ``V_i[0, 1]`` for the marginal state covariance
    ``V_i = F(tau_i) P_0 F(tau_i)' + Q(tau_i)``, expanded by hand so that no matrix
    multiplication -- and in particular no reuse of :func:`app.core.model.transition_matrix`
    or :func:`app.core.model.process_noise` -- enters the oracle.
    """
    velocity_variance = params.sigma_v0 * params.sigma_v0
    intensity = params.sigma_accel * params.sigma_accel
    tau2 = tau * tau
    tau3 = tau2 * tau
    weight_variance = initial_variance + tau2 * velocity_variance + intensity * tau3 / 3.0
    cross_covariance = tau * velocity_variance + intensity * tau2 / 2.0
    return weight_variance, cross_covariance


def joint_moments(
    observations: Sequence[Observation],
    params: ModelParams,
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Return the mean and covariance of ``y_1..y_{n-1}`` given ``y_0``.

    Raises:
        CoreError: if fewer than two observations are supplied, in which case there is no
            conditional density to evaluate -- the same case in which the filter's
            log-likelihood is zero.
    """
    if len(observations) < 2:
        raise CoreError("the conditional likelihood needs at least two observations")

    tau_all = elapsed_since_first(observations, time_axis=time_axis)
    tau = tau_all[1:]
    initial_variance = observations[0].variance(params)
    weight_variance, cross_covariance = marginal_weight_moments(tau, params, initial_variance)

    # Sigma_ij = A_i + (tau_j - tau_i) B_i for i <= j; symmetrised from the upper triangle
    # so the two halves cannot disagree in the last bit.
    upper = weight_variance[:, None] + (tau[None, :] - tau[:, None]) * cross_covariance[:, None]
    covariance = np.triu(upper) + np.triu(upper, 1).T

    observation_variance = np.array(
        [observation.variance(params) for observation in observations[1:]],
        dtype=np.float64,
    )
    covariance[np.diag_indices_from(covariance)] += observation_variance

    mean = np.full(len(tau), float(observations[0].weight_kg), dtype=np.float64)
    return mean, covariance


def _forward_substitute(
    factor: NDArray[np.float64],
    vector: NDArray[np.float64],
) -> NDArray[np.float64]:
    """Solve ``L z = vector`` for lower-triangular ``L`` by forward substitution.

    NumPy has no triangular solver of its own -- ``scipy.linalg.solve_triangular`` is the
    usual answer and this package adds no dependency -- and a general ``np.linalg.solve``
    would discard the triangular structure the Cholesky factorisation just produced, and
    with it the numerical advantage of having factorised at all.
    """
    size = vector.shape[0]
    solution = np.empty(size, dtype=np.float64)
    for index in range(size):
        total = vector[index] - factor[index, :index] @ solution[:index]
        solution[index] = total / factor[index, index]
    return solution


def direct_loglik(
    observations: Sequence[Observation],
    params: ModelParams,
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> float:
    """Return the exact log-likelihood of ``y_1..y_{n-1}`` given ``y_0``.

    A single observation carries no conditional density and returns ``0.0``, matching
    :attr:`app.core.types.FilterResult.loglik` in the same case.
    """
    if len(observations) < 2:
        return 0.0

    mean, covariance = joint_moments(observations, params, time_axis=time_axis)
    values = np.array([observation.weight_kg for observation in observations[1:]], dtype=np.float64)
    residual = values - mean

    factor: NDArray[np.float64] = np.asarray(np.linalg.cholesky(covariance), dtype=np.float64)
    solved = _forward_substitute(factor, residual)
    log_determinant = 2.0 * float(np.sum(np.log(np.diag(factor))))
    quadratic = float(solved @ solved)
    return -0.5 * (len(residual) * _LOG_2PI + log_determinant + quadratic)


def decimal_loglik(
    observations: Sequence[Observation],
    params: ModelParams,
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> Decimal:
    """Return the same log-likelihood as :func:`direct_loglik`, in exact arithmetic.

    The identical mathematics evaluated at :data:`DECIMAL_PRECISION` significant digits
    instead of double precision, so that where the float64 oracle and the filter disagree,
    a third computation limited by neither can say which is right. On the worst case E1
    found, it said the filter -- by seven orders of magnitude.

    Costs ``O(n**3)`` Python-level Decimal operations, which is slow enough that it is used
    to adjudicate specific cases rather than to run a battery: about a second at ``n = 60``
    and the better part of a minute at ``n = 300``.
    """
    if len(observations) < 2:
        return Decimal(0)

    with localcontext() as context:
        context.prec = DECIMAL_PRECISION
        tau_all = elapsed_since_first(observations, time_axis=time_axis)
        tau = [Decimal(repr(float(value))) for value in tau_all[1:]]
        size = len(tau)

        initial_variance = Decimal(repr(observations[0].variance(params)))
        velocity_variance = Decimal(repr(params.sigma_v0)) ** 2
        intensity = Decimal(repr(params.sigma_accel)) ** 2
        two = Decimal(2)
        three = Decimal(3)

        weight_variance = [
            initial_variance + t * t * velocity_variance + intensity * t**3 / three for t in tau
        ]
        cross_covariance = [t * velocity_variance + intensity * t * t / two for t in tau]

        covariance = [[Decimal(0)] * size for _ in range(size)]
        for i in range(size):
            for j in range(i, size):
                entry = weight_variance[i] + (tau[j] - tau[i]) * cross_covariance[i]
                covariance[i][j] = entry
                covariance[j][i] = entry
            covariance[i][i] += Decimal(repr(observations[i + 1].variance(params)))

        first_weight = Decimal(repr(observations[0].weight_kg))
        residual = [Decimal(repr(o.weight_kg)) - first_weight for o in observations[1:]]

        factor = [[Decimal(0)] * size for _ in range(size)]
        for i in range(size):
            for j in range(i + 1):
                total = covariance[i][j] - sum(
                    (factor[i][k] * factor[j][k] for k in range(j)), Decimal(0)
                )
                factor[i][j] = total.sqrt() if i == j else total / factor[j][j]

        solved = [Decimal(0)] * size
        for i in range(size):
            total = residual[i] - sum((factor[i][k] * solved[k] for k in range(i)), Decimal(0))
            solved[i] = total / factor[i][i]

        log_determinant = two * sum((factor[i][i].ln() for i in range(size)), Decimal(0))
        quadratic = sum((z * z for z in solved), Decimal(0))
        return -(Decimal(size) * (two * _PI_50).ln() + log_determinant + quadratic) / two


def direct_latent_forecast(
    observations: Sequence[Observation],
    params: ModelParams,
    horizon_days: float,
    *,
    time_axis: TimeAxis = DEFAULT_TIME_AXIS,
) -> tuple[float, float]:
    """Return the mean and variance of the latent weight ``horizon_days`` past the last one.

    Conditions the joint Gaussian of ``(y_1..y_{n-1}, w*)`` on the observations, where
    ``w*`` is the latent weight at ``t_{n-1} + horizon_days``. The filter reaches the same
    quantity by propagating its final posterior, which is a completely different route to
    the same number -- which is the point.
    """
    if len(observations) < 2:
        raise CoreError("the conditional forecast needs at least two observations")

    tau_all = elapsed_since_first(observations, time_axis=time_axis)
    tau = tau_all[1:]
    initial_variance = observations[0].variance(params)
    tau_target = float(tau_all[-1]) + float(horizon_days)

    target_variance, _ = marginal_weight_moments(
        np.array([tau_target], dtype=np.float64), params, initial_variance
    )
    weight_variance, cross_covariance = marginal_weight_moments(tau, params, initial_variance)

    # Cov(w*, y_i) = A_i + (tau* - tau_i) B_i, because tau* is at or after every tau_i.
    coupling = weight_variance + (tau_target - tau) * cross_covariance

    _, covariance = joint_moments(observations, params, time_axis=time_axis)
    values = np.array([observation.weight_kg for observation in observations[1:]], dtype=np.float64)
    residual = values - float(observations[0].weight_kg)

    factor: NDArray[np.float64] = np.asarray(np.linalg.cholesky(covariance), dtype=np.float64)
    solved_residual = _forward_substitute(factor, residual)
    solved_coupling = _forward_substitute(factor, coupling)

    mean = float(observations[0].weight_kg) + float(solved_coupling @ solved_residual)
    variance = float(target_variance[0]) - float(solved_coupling @ solved_coupling)
    return mean, variance
