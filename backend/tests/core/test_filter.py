"""The filter pass over a series of observations. Test IDs F1-F12."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from app.core.filter import run_filter
from app.core.model import validate_covariance
from app.core.time_axis import TimeAxis
from app.core.types import (
    Z_95,
    InsufficientDataError,
    ModelParams,
    Observation,
    UnsortedObservationsError,
)
from testing.synthetic import (
    DEFAULT_START,
    constant_series,
    gradual_loss_series,
    irregular_loss_series,
    model_consistent_ensemble,
    model_consistent_series,
    simultaneous_pair_series,
)

# --- F1: one observation ---------------------------------------------------


def test_f1_a_single_observation_reports_the_weight_and_no_trend(params: ModelParams):
    result = run_filter([Observation(timestamp=DEFAULT_START, weight_kg=72.4)], params)

    assert result.n_obs == 1
    assert result.steps == ()
    assert result.final.w_kg == 72.4
    assert result.final.v_kg_per_day == 0.0
    assert result.final.weekly_rate_kg == 0.0
    np.testing.assert_allclose(
        result.final.P,
        np.array([[params.obs_variance, 0.0], [0.0, params.sigma_v0**2]]),
        rtol=1e-15,
    )
    validate_covariance(result.final.P)
    assert result.loglik == 0.0


def test_f1_a_single_observation_gives_the_measurement_interval(params: ModelParams):
    result = run_filter([Observation(timestamp=DEFAULT_START, weight_kg=72.4)], params)
    lower, upper = result.final.w_ci95
    # Flat prior plus one Gaussian measurement: the interval is exactly +/- z * sigma_obs.
    assert result.final.w_sd == pytest.approx(params.sigma_obs_kg, rel=1e-15)
    assert upper - lower == pytest.approx(2 * Z_95 * params.sigma_obs_kg, rel=1e-14)


def test_f1_the_velocity_posterior_equals_its_prior_with_one_observation(params: ModelParams):
    result = run_filter([Observation(timestamp=DEFAULT_START, weight_kg=72.4)], params)
    assert result.final.v_sd == pytest.approx(params.sigma_v0, rel=1e-15)


# --- F2: two observations --------------------------------------------------

TWO_OBSERVATIONS = (
    Observation(timestamp=DEFAULT_START, weight_kg=72.0),
    Observation(timestamp=DEFAULT_START + timedelta(days=7), weight_kg=71.3),
)


def test_f2_two_observations_give_a_shrunk_but_correctly_signed_trend(params: ModelParams):
    result = run_filter(TWO_OBSERVATIONS, params)
    naive_slope = -0.7 / 7.0  # what a straight line through the two points would say

    assert naive_slope < result.final.v_kg_per_day < 0.0
    assert result.final.weekly_rate_kg < 0.0
    # The latent estimate does not jump all the way to the new reading either.
    assert 71.3 < result.final.w_kg < 72.0


def test_f2_two_observations_leave_substantial_velocity_uncertainty(params: ModelParams):
    result = run_filter(TWO_OBSERVATIONS, params)
    # The weekly rate is not yet distinguishable from zero: honest minimal-data behaviour.
    assert abs(result.final.weekly_rate_kg) < Z_95 * result.final.weekly_rate_sd_kg


# --- F3: constant trajectory ----------------------------------------------


def test_f3_a_constant_noise_free_series_stays_flat(params: ModelParams):
    series = constant_series(weight_kg=70.0, n_obs=60)
    result = run_filter(series.observations, params)

    assert abs(result.final.w_kg - 70.0) < 1e-6
    assert abs(result.final.v_kg_per_day) < 1e-6
    for state in result.posteriors:
        assert abs(state.w_kg - 70.0) < 1e-6
        validate_covariance(state.P)


def test_f3_repeated_identical_readings_shrink_the_weight_interval(params: ModelParams):
    series = constant_series(weight_kg=70.0, n_obs=60)
    result = run_filter(series.observations, params)
    assert result.final.w_sd < result.initial.w_sd


# --- F4: linear decline, regular sampling ---------------------------------


def test_f4_a_noise_free_linear_decline_is_recovered(params: ModelParams):
    series = gradual_loss_series(start_kg=80.0, rate_kg_per_week=-0.35, n_obs=120)
    result = run_filter(series.observations, params)

    assert abs(result.final.w_kg - series.final_true_weight_kg) < 1e-3
    assert abs(result.final.v_kg_per_day - series.final_true_velocity_kg_per_day) < 1e-3
    assert result.final.weekly_rate_kg == pytest.approx(-0.35, abs=1e-2)


# --- F5: linear decline, irregular sampling (the central irregularity test) ---


def test_f5_the_same_decline_is_recovered_from_irregular_weigh_ins(params: ModelParams):
    """Recovery must not depend on regular sampling.

    The gap pattern deliberately mixes twice-a-day weigh-ins with three-week absences.
    """
    series = irregular_loss_series(start_kg=80.0, rate_kg_per_week=-0.35, n_obs=60)
    result = run_filter(series.observations, params)

    gaps = [step.dt_days for step in result.steps]
    assert min(gaps) < 0.5 < 20.0 < max(gaps)  # the schedule really is irregular

    assert abs(result.final.w_kg - series.final_true_weight_kg) < 1e-3
    assert abs(result.final.v_kg_per_day - series.final_true_velocity_kg_per_day) < 1e-3


def test_f5_intervals_are_elapsed_times_not_step_indices(params: ModelParams):
    series = irregular_loss_series(n_obs=12)
    result = run_filter(series.observations, params)
    for index, step in enumerate(result.steps, start=1):
        expected = series.elapsed_days[index] - series.elapsed_days[index - 1]
        assert step.dt_days == pytest.approx(expected, rel=1e-12)


# --- F6: splitting and shift invariance -----------------------------------


def test_f6_results_depend_only_on_elapsed_time_not_absolute_time(params: ModelParams):
    series = irregular_loss_series(n_obs=40)
    shifted = [
        Observation(timestamp=obs.timestamp + timedelta(days=100), weight_kg=obs.weight_kg)
        for obs in series.observations
    ]
    original = run_filter(series.observations, params)
    moved = run_filter(shifted, params)

    assert moved.final.w_kg == original.final.w_kg
    assert moved.final.v_kg_per_day == original.final.v_kg_per_day
    np.testing.assert_array_equal(moved.final.P, original.final.P)
    assert moved.loglik == original.loglik


def test_f6_results_are_independent_of_the_time_axis_epoch(params: ModelParams):
    series = irregular_loss_series(n_obs=40)
    baseline = run_filter(series.observations, params)
    for epoch in (datetime(1970, 1, 1, tzinfo=UTC), datetime(2200, 1, 1, tzinfo=UTC)):
        other = run_filter(series.observations, params, time_axis=TimeAxis(epoch=epoch))
        assert other.final.w_kg == baseline.final.w_kg
        assert other.final.v_kg_per_day == baseline.final.v_kg_per_day


# --- F7: simultaneous observations ----------------------------------------


def test_f7_simultaneous_observations_commute(params: ModelParams):
    series = simultaneous_pair_series(start_kg=72.0, first_kg=72.4, second_kg=71.9)
    reversed_observations = [
        series.observations[0],
        series.observations[2],
        series.observations[1],
    ]

    forward = run_filter(series.observations, params).final
    backward = run_filter(reversed_observations, params).final

    assert forward.w_kg == pytest.approx(backward.w_kg, abs=1e-12)
    assert forward.v_kg_per_day == pytest.approx(backward.v_kg_per_day, abs=1e-12)
    np.testing.assert_allclose(forward.P, backward.P, rtol=1e-12, atol=1e-18)


def test_f7_a_second_simultaneous_reading_adds_information(params: ModelParams):
    series = simultaneous_pair_series()
    with_pair = run_filter(series.observations, params).final
    with_one = run_filter(series.observations[:2], params).final
    assert with_pair.w_var < with_one.w_var


def test_f7_a_zero_interval_step_is_recorded_as_zero(params: ModelParams):
    series = simultaneous_pair_series()
    result = run_filter(series.observations, params)
    assert result.steps[-1].dt_days == 0.0


# --- F8: unsorted input ---------------------------------------------------

UNSORTED_WEIGHTS = (72.0, 71.6, 71.9)
UNSORTED_OBSERVATIONS = (
    Observation(timestamp=DEFAULT_START, weight_kg=UNSORTED_WEIGHTS[0]),
    Observation(timestamp=DEFAULT_START + timedelta(days=3), weight_kg=UNSORTED_WEIGHTS[1]),
    Observation(timestamp=DEFAULT_START + timedelta(days=1), weight_kg=UNSORTED_WEIGHTS[2]),
)


def test_f8_unsorted_observations_are_rejected(params: ModelParams):
    with pytest.raises(UnsortedObservationsError) as caught:
        run_filter(UNSORTED_OBSERVATIONS, params)
    assert "position 2" in str(caught.value)


def test_f8_the_error_message_carries_no_health_data(params: ModelParams):
    with pytest.raises(UnsortedObservationsError) as caught:
        run_filter(UNSORTED_OBSERVATIONS, params)

    message = str(caught.value)
    for weight in UNSORTED_WEIGHTS:
        assert str(weight) not in message
        assert f"{weight:.1f}" not in message
    assert "2025" not in message  # no timestamps either


# --- F9: long-run numerical stability -------------------------------------


def test_f9_five_years_of_daily_data_stays_numerically_healthy(params: ModelParams):
    series = constant_series(weight_kg=70.0, n_obs=1825, noise_sd_kg=0.5, seed=11)
    result = run_filter(series.observations, params)

    assert result.n_obs == 1825
    for state in result.posteriors:
        P = state.P
        assert float(np.max(np.abs(P - P.T))) < 1e-12
        assert P[0, 0] > 0.0
        assert P[1, 1] > 0.0
        assert float(np.linalg.det(P)) >= 0.0
        assert np.all(np.isfinite(P))
    assert np.isfinite(result.loglik)


def test_f9_the_covariance_reaches_a_steady_state(params: ModelParams):
    series = constant_series(weight_kg=70.0, n_obs=1825, noise_sd_kg=0.5, seed=11)
    result = run_filter(series.observations, params)
    late = [state.w_var for state in result.posteriors[-50:]]
    assert max(late) - min(late) < 1e-9


# --- F10: outlier sensitivity, characterised rather than claimed -----------

OUTLIER_INDEX = 60
OUTLIER_SPIKE_KG = 10.0


def _outlier_pair(params: ModelParams):
    clean = gradual_loss_series(
        start_kg=80.0, rate_kg_per_week=-0.35, n_obs=200, noise_sd_kg=0.4, seed=7
    )
    spiked = clean.with_outlier(OUTLIER_INDEX, OUTLIER_SPIKE_KG)
    return run_filter(clean.observations, params), run_filter(spiked.observations, params)


def test_f10_an_outlier_displaces_the_estimate_by_exactly_gain_times_the_spike(
    params: ModelParams,
):
    """The Gaussian filter is linear, so the displacement is exactly K_w times the spike.

    This test asserts no robustness, because Milestone 1 has none. It pins down the exact
    sensitivity so a later robust-observation milestone has a baseline to beat.
    """
    clean, spiked = _outlier_pair(params)
    step = OUTLIER_INDEX - 1  # the first observation is consumed by initialisation

    gain_w = float(clean.steps[step].gain[0])
    displacement = spiked.steps[step].posterior.w_kg - clean.steps[step].posterior.w_kg

    assert displacement == pytest.approx(gain_w * OUTLIER_SPIKE_KG, rel=1e-9)
    # Recorded consequence: one mistyped reading moves the estimate by more than a kilo.
    assert displacement > 1.0


def test_f10_the_estimate_recovers_within_a_decaying_envelope(params: ModelParams):
    """Recovery is a damped oscillation, so the envelope decays but pointwise values do not.

    The transient has complex eigenvalues, so the displacement can tick back up between
    steps -- measured, it falls to 0.078 kg by the 21st following observation and is back
    at 0.100 kg by the 30th. Asserting pointwise monotonicity would be asserting something
    untrue about the filter, so the bounds below are envelope bounds over tail windows.
    """
    clean, spiked = _outlier_pair(params)

    def gap(lookahead: int) -> float:
        step = OUTLIER_INDEX - 1 + lookahead
        return abs(spiked.steps[step].posterior.w_kg - clean.steps[step].posterior.w_kg)

    gaps = [gap(lookahead) for lookahead in range(140)]

    # A week of normal weigh-ins is not enough: measured 0.71 kg still out.
    assert gaps[7] > 0.5
    # A fortnight brings it back inside 0.3 kg: measured 0.14 kg.
    assert gaps[14] < 0.3
    # Envelope bounds, not pointwise: the worst case in each tail window.
    assert max(gaps[30:]) < 0.15
    assert max(gaps[60:]) < 0.01
    assert max(gaps[90:]) < 0.001


def test_f10_the_reported_trend_is_corrupted_worse_than_the_weight(params: ModelParams):
    """The velocity takes the bigger hit, and that is what the product would display.

    One mistyped reading shifts the reported weekly rate by about 1.0 kg/week at once, and
    two weeks later it is still off by 0.22 kg/week -- on a true trend of about
    -0.38 kg/week, that is a rate reported 57% too steep. This is the strongest argument
    for a later robust-observation milestone.
    """
    clean, spiked = _outlier_pair(params)

    def rate_gap(lookahead: int) -> float:
        step = OUTLIER_INDEX - 1 + lookahead
        return abs(
            spiked.steps[step].posterior.weekly_rate_kg - clean.steps[step].posterior.weekly_rate_kg
        )

    assert rate_gap(0) > 0.5
    assert rate_gap(14) > 0.15
    # It does wash out eventually.
    assert rate_gap(90) < 0.01


# --- F11: calibration on model-consistent data ---------------------------


def test_f11_normalised_innovations_are_calibrated_on_model_consistent_data(
    params: ModelParams,
):
    """Mean squared normalised innovation should be about 1 when the model is true.

    The generator draws the initial velocity from the same prior the filter uses and the
    state noise from the same Q, so the filter is perfectly specified here. This is the
    reference point for the evaluation milestone.

    Averaged over 40 independent 50-observation draws rather than one 2000-observation
    draw: the model has no mean reversion, so a single multi-year trajectory wanders
    hundreds of kilograms away from its start and stops describing a human being. The
    replications also make the diagnostics genuinely independent.
    """
    ensemble = model_consistent_ensemble(params, n_series=40, n_obs=50)
    z = np.array(
        [
            step.normalized_innovation
            for series in ensemble
            for step in run_filter(series.observations, params).steps
        ]
    )

    assert len(z) == 40 * 49
    assert float(np.mean(z**2)) == pytest.approx(1.0, abs=0.15)
    assert abs(float(np.mean(z))) < 0.1


def test_f11_the_interval_covers_the_truth_about_95_percent_of_the_time(
    params: ModelParams,
):
    ensemble = model_consistent_ensemble(params, n_series=40, n_obs=50)
    inside = 0
    total = 0
    for series in ensemble:
        result = run_filter(series.observations, params)
        for state, truth in zip(result.posteriors, series.true_weight_kg, strict=True):
            total += 1
            inside += int(state.w_ci95[0] <= truth <= state.w_ci95[1])

    assert total == 40 * 50
    assert 0.90 <= inside / total <= 0.99


def test_f11_a_single_long_draw_diverges_as_the_model_says_it_should(
    params: ModelParams,
):
    """Records the model limitation that forced the ensemble above.

    Latent weight is an integrated random walk, so its spread grows like
    ``sigma_accel * sqrt(t**3 / 3)`` -- about 1.6 kg over 50 days and about 400 kg over
    2000. The 30-day product horizon is chosen with this in mind.
    """
    series = model_consistent_series(params, n_obs=50)
    drift = abs(series.final_true_weight_kg - series.true_weight_kg[0])
    predicted_sd = params.sigma_accel * np.sqrt(49.0**3 / 3.0)
    assert drift < 12.0  # plausible over seven weeks
    assert predicted_sd == pytest.approx(1.60, abs=0.05)
    # Over 2000 days the same formula gives a spread no body could have.
    assert params.sigma_accel * np.sqrt(2000.0**3 / 3.0) > 300.0


# --- F12: empty input ----------------------------------------------------


def test_f12_an_empty_series_is_rejected(params: ModelParams):
    with pytest.raises(InsufficientDataError):
        run_filter([], params)


# --- Structure of the result ---------------------------------------------


def test_the_result_exposes_one_posterior_per_observation(params: ModelParams):
    series = irregular_loss_series(n_obs=25)
    result = run_filter(series.observations, params)
    assert len(result.posteriors) == series.n_obs == 25
    assert len(result.steps) == 24
    assert result.final is result.posteriors[-1]


def test_default_parameters_are_used_when_none_are_supplied():
    series = constant_series(n_obs=5)
    assert run_filter(series.observations).params == ModelParams.default()


def test_step_diagnostics_are_recorded_for_every_observation(params: ModelParams):
    series = irregular_loss_series(n_obs=25, noise_sd_kg=0.4, seed=3)
    result = run_filter(series.observations, params)
    for step in result.steps:
        assert step.gain.shape == (2,)
        assert step.innovation_var > 0.0
        assert np.isfinite(step.normalized_innovation)
        assert np.isfinite(step.loglik_contrib)
        validate_covariance(step.prior.P)
        validate_covariance(step.posterior.P)
    assert result.loglik == pytest.approx(
        sum(step.loglik_contrib for step in result.steps), rel=1e-12
    )


def test_a_per_observation_variance_is_honoured(params: ModelParams):
    trusted = [
        Observation(timestamp=DEFAULT_START, weight_kg=72.0, obs_variance=1e-6),
        Observation(timestamp=DEFAULT_START + timedelta(days=1), weight_kg=71.9, obs_variance=1e-6),
    ]
    default = [
        Observation(timestamp=DEFAULT_START, weight_kg=72.0),
        Observation(timestamp=DEFAULT_START + timedelta(days=1), weight_kg=71.9),
    ]
    assert run_filter(trusted, params).final.w_var < run_filter(default, params).final.w_var
