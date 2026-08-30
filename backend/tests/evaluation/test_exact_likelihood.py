"""The independent likelihood oracle and the forecast moments. Test IDs EV1-EV2.

E1's whole value is that the oracle and the filter share nothing but the model definition.
These tests guard that: they check the oracle against arithmetic done by hand on paper for
two and three observations, check all three implementations against each other, and -- for
the ill-conditioned corner where the float64 oracle and the filter genuinely disagree --
check both against exact decimal arithmetic, which is limited by neither.
"""

from __future__ import annotations

import math
from datetime import timedelta
from decimal import Decimal

import numpy as np
import pytest

from app.core.filter import run_filter
from app.core.forecast import forecast_at
from app.core.types import ModelParams, Observation
from evaluation.exact_likelihood import (
    _PI_50,
    DECIMAL_PRECISION,
    decimal_loglik,
    direct_latent_forecast,
    direct_loglik,
    joint_moments,
    marginal_weight_moments,
)
from evaluation.experiments.e1_exact_likelihood import (
    GAP_PATTERNS,
    build_case,
    compare_case,
    parameter_grid,
)
from evaluation.mle import innovations_loglik, prepare_series
from testing.synthetic import DEFAULT_START

LOG_2PI = math.log(2.0 * math.pi)


def observations_at(offsets_days, weights_kg):
    """Build observations at the given day offsets from the fixed synthetic start."""
    return tuple(
        Observation(timestamp=DEFAULT_START + timedelta(days=offset), weight_kg=weight)
        for offset, weight in zip(offsets_days, weights_kg, strict=True)
    )


# --- EV1: the oracle against arithmetic done by hand ------------------------------


def test_ev1_two_observation_likelihood_matches_the_hand_derivation(params):
    """With two observations the density is a single univariate normal.

    Conditional on ``y_0`` the latent weight has variance ``R_0``, the velocity has
    variance ``sigma_v0**2`` about a mean of zero, and both are propagated over ``tau``
    before the second reading adds its own ``R``:

        y_1 | y_0 ~ N(y_0, R_0 + tau**2 sigma_v0**2 + sigma_accel**2 tau**3 / 3 + R)
    """
    tau = 6.0
    observations = observations_at((0.0, tau), (80.0, 79.2))

    variance = (
        params.obs_variance
        + tau**2 * params.sigma_v0**2
        + params.sigma_accel**2 * tau**3 / 3.0
        + params.obs_variance
    )
    residual = 79.2 - 80.0
    expected = -0.5 * (LOG_2PI + math.log(variance) + residual**2 / variance)

    assert direct_loglik(observations, params) == pytest.approx(expected, rel=1e-14)
    assert run_filter(observations, params).loglik == pytest.approx(expected, rel=1e-14)


def test_ev1_three_observation_likelihood_matches_the_hand_derivation(params):
    """With three observations it is a bivariate normal, inverted by hand.

    The off-diagonal is what a step-index model would get wrong, so it is written out
    explicitly rather than taken from the implementation being tested.
    """
    tau1, tau2 = 4.0, 11.0
    observations = observations_at((0.0, tau1, tau2), (80.0, 79.4, 79.1))

    r0 = params.obs_variance
    s2 = params.sigma_v0**2
    q = params.sigma_accel**2
    a1 = r0 + tau1**2 * s2 + q * tau1**3 / 3.0
    a2 = r0 + tau2**2 * s2 + q * tau2**3 / 3.0
    b1 = tau1 * s2 + q * tau1**2 / 2.0

    s11 = a1 + params.obs_variance
    s22 = a2 + params.obs_variance
    s12 = a1 + (tau2 - tau1) * b1

    determinant = s11 * s22 - s12 * s12
    r1, r2 = 79.4 - 80.0, 79.1 - 80.0
    quadratic = (s22 * r1 * r1 - 2.0 * s12 * r1 * r2 + s11 * r2 * r2) / determinant
    expected = -0.5 * (2.0 * LOG_2PI + math.log(determinant) + quadratic)

    assert direct_loglik(observations, params) == pytest.approx(expected, rel=1e-13)
    assert run_filter(observations, params).loglik == pytest.approx(expected, rel=1e-13)


def test_ev1_the_marginal_moments_are_the_propagated_covariance(params):
    """``A`` and ``B`` must equal ``F P_0 F' + Q`` entrywise, computed the long way."""
    from app.core.model import process_noise, transition_matrix

    tau = np.array([0.5, 3.0, 20.0], dtype=np.float64)
    weight_variance, cross_covariance = marginal_weight_moments(tau, params, params.obs_variance)

    p0 = np.diag([params.obs_variance, params.sigma_v0**2])
    for index, value in enumerate(tau):
        transition = transition_matrix(float(value))
        expected = transition @ p0 @ transition.T + process_noise(float(value), params)
        assert weight_variance[index] == pytest.approx(expected[0, 0], rel=1e-14)
        assert cross_covariance[index] == pytest.approx(expected[0, 1], rel=1e-14)


def test_ev1_a_single_observation_has_no_conditional_density(params):
    observations = observations_at((0.0,), (80.0,))
    assert direct_loglik(observations, params) == 0.0
    assert run_filter(observations, params).loglik == 0.0
    assert decimal_loglik(observations, params) == Decimal(0)


def test_ev1_a_zero_gap_pair_is_two_readings_of_one_latent_weight(params):
    """Simultaneous readings must give ``Var(y_1) = R_0 + R``, with no drift in between.

    ``Q(0)`` is exactly zero and ``F(0)`` is the identity, so nothing propagates. This is
    the case ``model_consistent_series`` refuses to generate -- ``Q(0)`` has no Cholesky
    factor -- and is therefore constructed directly here.
    """
    observations = observations_at((0.0, 0.0), (80.0, 80.3))
    _, covariance = joint_moments(observations, params)
    assert covariance.shape == (1, 1)
    assert float(covariance[0, 0]) == pytest.approx(2.0 * params.obs_variance, rel=1e-15)

    expected = -0.5 * (
        LOG_2PI + math.log(2.0 * params.obs_variance) + 0.3**2 / (2.0 * params.obs_variance)
    )
    assert direct_loglik(observations, params) == pytest.approx(expected, rel=1e-13)
    assert run_filter(observations, params).loglik == pytest.approx(expected, rel=1e-13)


def test_ev1_the_covariance_is_exactly_symmetric(params):
    observations = build_case("irregular", 25, 1_000_000)
    _, covariance = joint_moments(observations, params)
    np.testing.assert_array_equal(covariance, covariance.T)


@pytest.mark.parametrize("pattern", sorted(GAP_PATTERNS))
@pytest.mark.parametrize("n_obs", [2, 3, 7, 40])
def test_ev1_all_three_implementations_agree(pattern, n_obs, params):
    """The oracle, the shipped filter and the lean fitting objective on one battery case.

    Measured maximum over the full 810-case battery: ``2.1e-14`` between the two
    recursions, and below ``1e-8`` against the oracle wherever the oracle is well
    conditioned.
    """
    observations = build_case(pattern, n_obs, 1_000_000)
    oracle = direct_loglik(observations, params)
    filtered = run_filter(observations, params).loglik
    lean = innovations_loglik(
        prepare_series(observations),
        params.sigma_obs_kg,
        params.sigma_accel,
        params.sigma_v0,
    )
    scale = max(1.0, abs(oracle))
    assert abs(filtered - oracle) / scale < 1e-10
    assert abs(lean - oracle) / scale < 1e-10
    assert abs(lean - filtered) / scale < 1e-12


def test_ev1_the_battery_comparison_reports_every_discrepancy(params):
    """``compare_case`` must produce every key the runner aggregates, or a maximum silently
    stays at zero and the battery passes by omission.
    """
    observations = build_case("daily", 12, 1_000_000)
    comparison = compare_case(observations, params)
    assert set(comparison) == {
        "loglik",
        "filter_abs_diff",
        "filter_rel_diff",
        "lean_abs_diff",
        "lean_rel_diff",
        "recursion_abs_diff",
        "recursion_rel_diff",
        "condition_number",
        "forecast_mean_abs_diff",
        "forecast_variance_rel_diff",
        "forecast_observation_noise_abs_diff",
    }


def test_ev1_the_parameter_grid_is_the_full_cross_product():
    grid = parameter_grid((0.25, 1.0, 4.0))
    assert len(grid) == 27
    assert len({label for label, _ in grid}) == 27


# --- EV1: exact arithmetic settles the ill-conditioned corner ----------------------


def test_ev1_pi_is_pi():
    """The one transcribed constant in the package, checked against the standard library."""
    assert float(_PI_50) == pytest.approx(math.pi, rel=1e-15)
    assert DECIMAL_PRECISION >= 50


def test_ev1_decimal_and_float_oracles_agree_when_well_conditioned(params):
    observations = build_case("daily", 30, 1_000_000)
    exact = decimal_loglik(observations, params)
    assert direct_loglik(observations, params) == pytest.approx(float(exact), rel=1e-12)


def test_ev1_where_the_oracle_and_the_filter_disagree_the_filter_is_right():
    """The finding that reshaped E1's pass criterion, pinned as a test.

    Small measurement noise and a wide velocity prior over a long span make the oracle's
    covariance ill conditioned -- here ``3.9e8`` -- and its double-precision Cholesky loses
    most of its digits. The filter's Joseph recursion does not. Exact arithmetic at 60
    significant digits adjudicates: measured errors are ``1.7e-12`` for the filter against
    ``5.7e-07`` for the float64 oracle, a factor of 336,000.

    This is why E1 classifies ill-conditioned cases instead of failing them. If this test
    ever inverts -- the oracle closer to exact than the filter -- that classification is
    unjustified and the estimator is the thing to suspect.
    """
    default = ModelParams.default()
    params = ModelParams(
        sigma_obs_kg=default.sigma_obs_kg * 0.1,
        sigma_accel=default.sigma_accel,
        sigma_v0=default.sigma_v0 * 4.0,
    )
    observations = build_case("weekly", 60, 1_000_017)

    _, covariance = joint_moments(observations, params)
    assert float(np.linalg.cond(covariance)) > 1e8

    exact = decimal_loglik(observations, params)
    filter_error = abs(Decimal(repr(run_filter(observations, params).loglik)) - exact)
    oracle_error = abs(Decimal(repr(direct_loglik(observations, params))) - exact)

    assert filter_error < Decimal("1e-10")
    assert oracle_error > filter_error * 1000


# --- EV2: forecast moments ---------------------------------------------------------


@pytest.mark.parametrize("horizon", [0.0, 7.0, 30.0, 90.0])
def test_ev2_forecast_moments_match_the_direct_conditional(horizon, params):
    """Propagating the filter posterior must equal conditioning the joint Gaussian.

    Two routes to the distribution of a latent weight the scale has not measured: the
    filter carries its final posterior forward through ``F`` and ``Q``, while the oracle
    writes down the joint distribution of the observations and that future weight and
    conditions on what was seen.
    """
    observations = build_case("irregular", 25, 1_000_000)
    result = run_filter(observations, params)

    expected_mean, expected_variance = direct_latent_forecast(observations, params, horizon)
    point = forecast_at(result.final, params, horizon)

    assert point.w_kg == pytest.approx(expected_mean, rel=1e-11)
    assert point.w_sd**2 == pytest.approx(expected_variance, rel=1e-11)


def test_ev2_a_zero_horizon_reproduces_the_final_posterior(params):
    observations = build_case("daily", 20, 1_000_000)
    result = run_filter(observations, params)
    mean, variance = direct_latent_forecast(observations, params, 0.0)
    assert mean == pytest.approx(result.final.w_kg, rel=1e-11)
    assert variance == pytest.approx(result.final.w_var, rel=1e-11)


def test_ev2_the_predictive_variance_adds_exactly_the_observation_variance(params):
    """Latent weight and a future scale reading differ by ``R`` and by nothing else."""
    observations = build_case("daily", 20, 1_000_000)
    result = run_filter(observations, params)
    latent = forecast_at(result.final, params, 30.0)
    reading = forecast_at(result.final, params, 30.0, include_observation_noise=True)
    assert reading.w_kg == pytest.approx(latent.w_kg, rel=1e-15)
    assert reading.w_sd**2 == pytest.approx(latent.w_sd**2 + params.obs_variance, rel=1e-14)


def test_ev2_the_forecast_widens_with_the_horizon(params):
    observations = build_case("daily", 20, 1_000_000)
    variances = [direct_latent_forecast(observations, params, h)[1] for h in (0.0, 7.0, 30.0, 90.0)]
    assert variances == sorted(variances)
