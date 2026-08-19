"""Transition and process-noise matrices. Test IDs M1-M5."""

from __future__ import annotations

import numpy as np
import pytest

from app.core.model import (
    IDENTITY,
    H,
    initial_state,
    process_noise,
    symmetrize,
    transition_matrix,
    validate_covariance,
)
from app.core.types import CoreError, InvalidCovarianceError, ModelParams

INTERVALS = (1e-9, 0.01, 0.25, 1.0, 7.0, 30.0, 90.0, 365.0)

# --- M1: F(dt) -------------------------------------------------------------


@pytest.mark.parametrize("dt", INTERVALS)
def test_m1_transition_matrix_has_the_documented_form(dt):
    np.testing.assert_array_equal(transition_matrix(dt), np.array([[1.0, dt], [0.0, 1.0]]))


def test_m1_zero_interval_gives_the_identity():
    np.testing.assert_array_equal(transition_matrix(0.0), IDENTITY)


def test_m1_transition_matrix_moves_weight_by_velocity_times_time():
    x = np.array([70.0, -0.05])
    np.testing.assert_allclose(transition_matrix(30.0) @ x, [70.0 - 1.5, -0.05], rtol=1e-15)


def test_observation_matrix_reads_weight_only():
    np.testing.assert_array_equal(H, np.array([[1.0, 0.0]]))
    assert float((H @ np.array([71.8, -0.05]))[0]) == 71.8


# --- M2: F is a semigroup in time -----------------------------------------


@pytest.mark.parametrize("a", (0.0, 0.25, 1.0, 7.0, 30.0))
@pytest.mark.parametrize("b", (0.0, 0.5, 3.0, 14.0, 90.0))
def test_m2_transition_matrices_compose_by_adding_time(a, b):
    np.testing.assert_allclose(
        transition_matrix(a) @ transition_matrix(b),
        transition_matrix(a + b),
        rtol=1e-15,
        atol=0.0,
    )


# --- M3: Q(dt) -------------------------------------------------------------


@pytest.mark.parametrize("dt", INTERVALS)
def test_m3_process_noise_matches_the_closed_form(dt, params: ModelParams):
    intensity = params.sigma_accel**2
    expected = intensity * np.array(
        [[dt**3 / 3.0, dt**2 / 2.0], [dt**2 / 2.0, dt]],
    )
    np.testing.assert_allclose(process_noise(dt, params), expected, rtol=1e-14, atol=0.0)


def test_m3_zero_interval_adds_no_uncertainty(params: ModelParams):
    np.testing.assert_array_equal(process_noise(0.0, params), np.zeros((2, 2)))


@pytest.mark.parametrize("dt", INTERVALS)
def test_m3_process_noise_is_symmetric_and_psd(dt, params: ModelParams):
    Q = process_noise(dt, params)
    np.testing.assert_array_equal(Q, Q.T)
    eigenvalues = np.linalg.eigvalsh(Q)
    assert eigenvalues.min() >= -1e-18
    # Strictly positive definite for a positive interval: det = s**4 dt**4 / 12.
    determinant = float(np.linalg.det(Q))
    assert determinant > 0.0
    assert determinant == pytest.approx(params.sigma_accel**4 * dt**4 / 12.0, rel=1e-9)


# --- M4: time-splitting consistency (the central property) ----------------


@pytest.mark.parametrize("a", (1e-6, 0.25, 1.0, 7.0, 30.0, 200.0))
@pytest.mark.parametrize("b", (1e-6, 0.5, 3.0, 14.0, 90.0, 365.0))
def test_m4_process_noise_is_consistent_under_time_splitting(a, b, params: ModelParams):
    """F(b) Q(a) F(b)' + Q(b) == Q(a + b).

    This is what makes irregular weigh-in times principled rather than approximated:
    a single long gap is indistinguishable from the sum of its parts.
    """
    F_b = transition_matrix(b)
    split = F_b @ process_noise(a, params) @ F_b.T + process_noise(b, params)
    np.testing.assert_allclose(split, process_noise(a + b, params), rtol=1e-12, atol=1e-30)


def test_m4_splitting_into_many_sub_intervals_also_agrees(params: ModelParams):
    total = 30.0
    steps = 30
    dt = total / steps
    P = np.zeros((2, 2))
    F = transition_matrix(dt)
    Q = process_noise(dt, params)
    for _ in range(steps):
        P = F @ P @ F.T + Q
    np.testing.assert_allclose(P, process_noise(total, params), rtol=1e-12, atol=1e-30)


# --- M5: invalid intervals -------------------------------------------------


@pytest.mark.parametrize("dt", (-1e-9, -1.0, float("nan"), float("inf")))
def test_m5_invalid_interval_is_rejected(dt, params: ModelParams):
    with pytest.raises(CoreError):
        transition_matrix(dt)
    with pytest.raises(CoreError):
        process_noise(dt, params)


# --- Covariance helpers ----------------------------------------------------


def test_symmetrize_averages_the_off_diagonals():
    P = np.array([[1.0, 0.4], [0.2, 2.0]])
    # (0.4 + 0.2) / 2 is not exactly 0.3 in binary floating point, hence assert_allclose.
    np.testing.assert_allclose(symmetrize(P), np.array([[1.0, 0.3], [0.3, 2.0]]), rtol=1e-15)


def test_symmetrize_leaves_a_symmetric_matrix_untouched():
    P = np.array([[0.25, 0.01], [0.01, 0.02]])
    np.testing.assert_array_equal(symmetrize(P), P)


def test_validate_covariance_accepts_a_healthy_matrix():
    validate_covariance(np.array([[0.25, 0.01], [0.01, 0.02]]))


@pytest.mark.parametrize(
    "bad",
    [
        np.array([[float("nan"), 0.0], [0.0, 1.0]]),
        np.array([[1.0, 0.5], [0.0, 1.0]]),
        np.array([[-1.0, 0.0], [0.0, 1.0]]),
        np.array([[1.0, 2.0], [2.0, 1.0]]),
        np.eye(3),
    ],
)
def test_validate_covariance_rejects_bad_matrices(bad):
    with pytest.raises(InvalidCovarianceError):
        validate_covariance(bad)


# --- Initialisation --------------------------------------------------------


def test_initial_state_consumes_the_first_observation(params: ModelParams):
    x, P = initial_state(72.4, params)
    np.testing.assert_array_equal(x, np.array([72.4, 0.0]))
    np.testing.assert_allclose(
        P,
        np.array([[params.obs_variance, 0.0], [0.0, params.sigma_v0**2]]),
        rtol=1e-15,
    )
    validate_covariance(P)


def test_initial_state_honours_a_per_observation_variance(params: ModelParams):
    _, P = initial_state(72.4, params, obs_variance=0.09)
    assert float(P[0, 0]) == 0.09


def test_initial_state_assumes_no_trend(params: ModelParams):
    # The velocity mean must be zero regardless of the weight: with one measurement
    # there is no trend information, and the estimator must not invent one.
    for weight in (55.0, 72.4, 130.0):
        x, _ = initial_state(weight, params)
        assert x[1] == 0.0
