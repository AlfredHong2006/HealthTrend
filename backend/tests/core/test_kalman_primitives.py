"""The predict and update primitives. Test IDs K1-K4."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.kalman import predict, update
from app.core.model import IDENTITY, H, process_noise, transition_matrix, validate_covariance
from app.core.types import CoreError, ModelParams

# --- K1: prediction inflates covariance -----------------------------------


@pytest.mark.parametrize("dt", (0.5, 1.0, 7.0, 30.0, 90.0))
def test_k1_prediction_increases_both_variances(dt, params: ModelParams):
    P = np.array([[0.25, 0.0], [0.0, params.sigma_v0**2]])
    _, P_prior = predict(np.array([72.0, -0.03]), P, dt, params)
    assert P_prior[0, 0] > P[0, 0]
    assert P_prior[1, 1] > P[1, 1]
    validate_covariance(P_prior)


def test_k1_prediction_matches_the_closed_form(params: ModelParams):
    P = np.array([[0.20, 0.01], [0.01, 0.004]])
    h = 30.0
    _, P_prior = predict(np.array([72.0, -0.03]), P, h, params)
    expected_ww = P[0, 0] + 2.0 * h * P[0, 1] + h * h * P[1, 1] + params.sigma_accel**2 * h**3 / 3.0
    assert float(P_prior[0, 0]) == pytest.approx(expected_ww, rel=1e-14)


def test_k1_prediction_moves_the_mean_along_the_trend(params: ModelParams):
    x_prior, _ = predict(np.array([72.0, -0.05]), np.eye(2) * 0.1, 30.0, params)
    np.testing.assert_allclose(x_prior, [72.0 - 1.5, -0.05], rtol=1e-14)


def test_k1_zero_interval_is_a_no_op(params: ModelParams):
    x = np.array([72.0, -0.05])
    P = np.array([[0.25, 0.01], [0.01, 0.02]])
    x_prior, P_prior = predict(x, P, 0.0, params)
    np.testing.assert_array_equal(x_prior, x)
    np.testing.assert_array_equal(P_prior, P)


def test_k1_prediction_variance_is_monotone_in_the_horizon(params: ModelParams):
    P = np.array([[0.25, 0.0], [0.0, params.sigma_v0**2]])
    widths = [
        float(predict(np.array([72.0, 0.0]), P, h, params)[1][0, 0])
        for h in (0.0, 1.0, 7.0, 30.0, 90.0, 365.0)
    ]
    assert widths == sorted(widths)
    assert len(set(widths)) == len(widths)


# --- K2: an informative update deflates covariance ------------------------


def test_k2_update_reduces_weight_variance_and_trace(params: ModelParams):
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(np.array([72.0, -0.03]), P_prior, 71.8, params.obs_variance)
    assert outcome.P[0, 0] < P_prior[0, 0]
    assert np.trace(outcome.P) < np.trace(P_prior)
    validate_covariance(outcome.P)


def test_k2_update_records_the_innovation_and_its_variance(params: ModelParams):
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(np.array([72.0, -0.03]), P_prior, 72.7, params.obs_variance)
    assert outcome.innovation == pytest.approx(0.7, rel=1e-15)
    assert outcome.innovation_var == pytest.approx(0.40 + params.obs_variance, rel=1e-15)
    assert outcome.normalized_innovation == pytest.approx(
        0.7 / np.sqrt(0.40 + params.obs_variance), rel=1e-14
    )


def test_k2_the_posterior_mean_is_the_prior_plus_gain_times_innovation(params: ModelParams):
    x_prior = np.array([72.0, -0.03])
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(x_prior, P_prior, 72.7, params.obs_variance)
    np.testing.assert_allclose(outcome.x, x_prior + outcome.gain * outcome.innovation, rtol=1e-15)


def test_k2_gain_matches_the_closed_form(params: ModelParams):
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(np.array([72.0, -0.03]), P_prior, 71.8, params.obs_variance)
    S = 0.40 + params.obs_variance
    np.testing.assert_allclose(outcome.gain, [0.40 / S, 0.02 / S], rtol=1e-14)


def test_k2_loglikelihood_contribution_matches_the_gaussian_density(params: ModelParams):
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(np.array([72.0, -0.03]), P_prior, 72.7, params.obs_variance)
    S = outcome.innovation_var
    expected = -0.5 * (np.log(2.0 * np.pi) + np.log(S) + outcome.innovation**2 / S)
    assert outcome.loglik_contrib == pytest.approx(float(expected), rel=1e-14)


# --- K3: Joseph form ------------------------------------------------------


def test_k3_joseph_form_agrees_with_the_textbook_form(params: ModelParams):
    x_prior = np.array([72.0, -0.03])
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(x_prior, P_prior, 71.8, params.obs_variance)
    gain = outcome.gain.reshape(2, 1)
    textbook = (IDENTITY - gain @ H) @ P_prior
    np.testing.assert_allclose(outcome.P, textbook, rtol=1e-10, atol=1e-18)


def test_k3_joseph_form_stays_symmetric_and_psd_over_many_updates(params: ModelParams):
    """Chain 2000 predict/update cycles and require the covariance to stay healthy."""
    x = np.array([72.0, 0.0])
    P = np.array([[params.obs_variance, 0.0], [0.0, params.sigma_v0**2]])
    for step in range(2000):
        x, P = predict(x, P, 1.0, params)
        x, P, *_ = update(x, P, 72.0 - 0.001 * step, params.obs_variance)
        validate_covariance(P)
    assert float(np.max(np.abs(P - P.T))) < 1e-12
    assert np.all(np.isfinite(P))


def test_k3_joseph_form_survives_a_near_perfect_measurement(params: ModelParams):
    """A tiny R is the classic case where the short update form loses symmetry."""
    x = np.array([72.0, 0.0])
    P = np.array([[params.obs_variance, 0.0], [0.0, params.sigma_v0**2]])
    for step in range(500):
        x, P = predict(x, P, 1.0, params)
        x, P, *_ = update(x, P, 72.0 - 0.001 * step, 1e-10)
        validate_covariance(P)
    assert float(np.max(np.abs(P - P.T))) == 0.0


# --- K4: limiting behaviour of R ------------------------------------------


def test_k4_an_uninformative_measurement_leaves_the_state_alone(params: ModelParams):
    x_prior = np.array([72.0, -0.03])
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(x_prior, P_prior, 90.0, 1e12)
    np.testing.assert_allclose(outcome.x, x_prior, atol=1e-9)
    np.testing.assert_allclose(outcome.P, P_prior, atol=1e-9)


def test_k4_a_perfect_measurement_pins_the_weight(params: ModelParams):
    P_prior = np.array([[0.40, 0.02], [0.02, 0.02]])
    outcome = update(np.array([72.0, -0.03]), P_prior, 71.5, 1e-12)
    assert outcome.x[0] == pytest.approx(71.5, abs=1e-9)
    assert outcome.P[0, 0] == pytest.approx(0.0, abs=1e-11)


@pytest.mark.parametrize("bad", (0.0, -1.0, float("nan"), float("inf")))
def test_update_rejects_an_invalid_observation_variance(bad):
    with pytest.raises(CoreError):
        update(np.array([72.0, 0.0]), np.eye(2) * 0.1, 72.0, bad)


# --- Splitting invariance inside the primitives (see also F6) --------------


@pytest.mark.parametrize(("a", "b"), ((0.25, 3.0), (1.0, 29.0), (7.0, 83.0)))
def test_prediction_in_two_steps_equals_prediction_in_one(a, b, params: ModelParams):
    x = np.array([72.0, -0.04])
    P = np.array([[0.25, 0.01], [0.01, 0.004]])
    x_split, P_split = predict(*predict(x, P, a, params), b, params)
    x_single, P_single = predict(x, P, a + b, params)
    np.testing.assert_allclose(x_split, x_single, rtol=1e-14)
    np.testing.assert_allclose(P_split, P_single, rtol=1e-12, atol=1e-30)


def test_prediction_uses_the_documented_matrices(params: ModelParams):
    x = np.array([72.0, -0.04])
    P = np.array([[0.25, 0.01], [0.01, 0.004]])
    dt = 12.5
    F = transition_matrix(dt)
    Q = process_noise(dt, params)
    x_prior, P_prior = predict(x, P, dt, params)
    np.testing.assert_allclose(x_prior, F @ x, rtol=1e-15)
    np.testing.assert_allclose(P_prior, F @ P @ F.T + Q, rtol=1e-14)
