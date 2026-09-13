"""Milestone 7A definitions, checked against arithmetic rather than against themselves.

Test IDs:

- ``EV12`` the on-plan probability and the trend-established gate
- ``EV13`` the experimental gated filter, against the shipped filter it must reduce to
- ``EV14`` the distributions, the rates and the innovation rules, including their exact
  false-alarm rate under the null they were designed for
- ``EV15`` the phase protocol: leakage, the regimes and the baselines

Every check that a rule is honest is made here on constructed inputs, so a failure points
at a definition. What the rules then do on the regimes is the study's business, not a test's.
"""

from __future__ import annotations

import math
from datetime import timedelta
from itertools import pairwise

import numpy as np
import pytest

from app.core.filter import run_filter
from app.core.kalman import predict, update
from app.core.types import Z_95, ModelParams, Observation
from evaluation.constants import (
    CHI2_1_95,
    Z_90,
    chi2_cdf,
    chi2_ppf,
    clipped_normal_second_moment,
    normal_cdf,
    normal_pdf,
    normal_ppf,
    student_t_cdf,
)
from evaluation.metrics import clustered_rate, wilson_interval
from evaluation.plan_alignment import (
    ALPHA_CHECK,
    CLIP_C,
    GATE_Z,
    PLAN_TOLERANCE_KG_PER_WEEK,
    PRIOR_WEIGHT_GATE,
    PlanBand,
    RateEstimate,
    band_probability,
    gated_trace,
    innov_chi2_claim,
    innov_mean_claim,
    innov_robust_claim,
    innov_robust_statistic,
    max_attainable_probability,
    ols_window_estimate,
    prior_weight_on_velocity,
    shipped_trace,
    trend_established,
    weekly_means_estimate,
)
from evaluation.plan_scenarios import (
    BAD_READING_DAY,
    CHECKIN_DAYS,
    MISSING_SILENCE_DAYS,
    band_exit_day,
    draw,
    evaluate_series,
    missing_data_gaps,
    random_target,
    with_bad_reading,
)
from testing.synthetic import DEFAULT_START, gradual_loss_series

PARAMS = ModelParams.default()


def _observations(days, weights):
    return tuple(
        Observation(timestamp=DEFAULT_START + timedelta(days=d), weight_kg=w)
        for d, w in zip(days, weights, strict=True)
    )


# --- EV12: the on-plan probability ------------------------------------------------


def test_ev12_the_band_probability_is_the_mass_between_the_edges():
    estimate = RateEstimate(-0.4, 0.25)
    band = PlanBand(-0.5, 0.2)
    below = normal_cdf((band.lo + 0.4) / 0.25)
    above = 1.0 - normal_cdf((band.hi + 0.4) / 0.25)
    assert band_probability(estimate, band) == pytest.approx(1.0 - below - above, abs=1e-15)


def test_ev12_a_centred_posterior_attains_exactly_the_ceiling():
    for sd in (0.05, 0.185, 1.0):
        estimate = RateEstimate(-0.5, sd)
        assert band_probability(estimate, PlanBand(-0.5, 0.2)) == pytest.approx(
            max_attainable_probability(sd, 0.2), abs=1e-15
        )
        # Any other location gives less.
        assert band_probability(RateEstimate(-0.45, sd), PlanBand(-0.5, 0.2)) < (
            max_attainable_probability(sd, 0.2)
        )


def test_ev12_the_student_t_estimate_tends_to_the_gaussian():
    band = PlanBand(0.0, 0.2)
    gaussian = band_probability(RateEstimate(0.1, 0.15), band)
    heavy = band_probability(RateEstimate(0.1, 0.15, df=3), band)
    light = band_probability(RateEstimate(0.1, 0.15, df=100_000), band)
    assert light == pytest.approx(gaussian, abs=1e-5)
    assert heavy != pytest.approx(gaussian, abs=1e-3)
    assert student_t_cdf(0.0, 7) == pytest.approx(0.5)


def test_ev12_a_band_needs_a_positive_tolerance():
    with pytest.raises(ValueError, match="positive"):
        PlanBand(-0.5, 0.0)


def _manual_velocity(observations, v0_mean):
    """Filter with the velocity prior mean moved off zero; everything else as shipped."""
    first = observations[0]
    x = np.array([first.weight_kg, v0_mean], dtype=np.float64)
    P = np.array([[PARAMS.obs_variance, 0.0], [0.0, PARAMS.sigma_v0**2]])
    velocities = [v0_mean]
    for previous, current in pairwise(observations):
        dt = (current.timestamp - previous.timestamp).total_seconds() / 86_400.0
        x_prior, P_prior = predict(x, P, dt, PARAMS)
        outcome = update(x_prior, P_prior, current.weight_kg, PARAMS.obs_variance)
        x, P = outcome.x, outcome.P
        velocities.append(float(x[1]))
    return velocities


@pytest.mark.parametrize(
    "days",
    [
        list(range(30)),
        [0.0, 0.5, 3.5, 4.0, 18.0, 18.25, 25.0, 46.0, 48.0, 48.75],
    ],
    ids=["daily", "irregular"],
)
def test_ev12_the_prior_weight_is_exactly_the_coefficient_on_the_prior_mean(days):
    """Move the prior velocity mean and the posterior moves by exactly weight times that.

    This is the claim the gate rests on, checked by an independent filter that does not use
    the gains the weight was computed from.
    """
    rng = np.random.default_rng(3)
    weights = [
        80.0 - 0.07 * d + float(e) for d, e in zip(days, rng.normal(0, 0.5, len(days)), strict=True)
    ]
    observations = _observations(days, weights)
    result = run_filter(observations, PARAMS)
    weight = prior_weight_on_velocity(result)
    base = _manual_velocity(observations, 0.0)
    moved = _manual_velocity(observations, 0.1)
    for index in range(len(days)):
        # Independent filter at prior mean zero reproduces the shipped filter.
        assert base[index] == pytest.approx(result.posteriors[index].v_kg_per_day, abs=1e-12)
        assert abs(moved[index] - base[index]) == pytest.approx(0.1 * weight[index], abs=1e-12)


def test_ev12_without_elapsed_time_the_prior_is_the_whole_rate():
    observations = _observations([0.0, 0.0, 0.0], [80.0, 80.4, 79.8])
    weight = prior_weight_on_velocity(run_filter(observations, PARAMS))
    assert weight == (1.0, 1.0, 1.0)
    assert not trend_established(weight[-1])


def test_ev12_the_gate_opens_as_data_replaces_the_prior():
    days = list(range(60))
    trace = shipped_trace(_observations(days, [80.0] * 60), PARAMS)
    assert trace.prior_weight[0] == 1.0
    assert not trend_established(trace.prior_weight[1])
    assert trend_established(trace.prior_weight[-1])
    assert trend_established(PRIOR_WEIGHT_GATE)


# --- EV13: the experimental gated filter ---------------------------------------------


def test_ev13_with_nothing_beyond_the_gate_it_is_the_shipped_filter():
    series = gradual_loss_series(n_obs=60, noise_sd_kg=0.3, seed=5)
    shipped = shipped_trace(series.observations, PARAMS)
    gated = gated_trace(series.observations, PARAMS)
    assert gated.held == ()
    assert gated.absorbed_index == shipped.absorbed_index
    np.testing.assert_allclose(gated.v_mean_kg_per_week, shipped.v_mean_kg_per_week, atol=1e-12)
    np.testing.assert_allclose(gated.v_sd_kg_per_week, shipped.v_sd_kg_per_week, atol=1e-12)
    np.testing.assert_allclose(gated.prior_weight, shipped.prior_weight, atol=1e-12)


def test_ev13_an_isolated_bad_reading_is_held_then_discarded_exactly():
    """After discarding, the gated filter is the shipped filter on the series without it."""
    clean = gradual_loss_series(n_obs=50, noise_sd_kg=0.0, seed=1)
    bad_index = 30
    series = clean.with_outlier(bad_index, 6.0)
    gated = gated_trace(series.observations, PARAMS)
    assert gated.held == (bad_index,)
    assert gated.discarded == (bad_index,)
    # While held, the state does not move.
    assert gated.absorbed_index[bad_index] == bad_index - 1
    assert gated.v_mean_kg_per_week[bad_index] == gated.v_mean_kg_per_week[bad_index - 1]

    without = tuple(o for i, o in enumerate(series.observations) if i != bad_index)
    reference = shipped_trace(without, PARAMS)
    np.testing.assert_allclose(
        gated.v_mean_kg_per_week[bad_index + 1 :],
        reference.v_mean_kg_per_week[bad_index:],
        atol=1e-12,
    )
    np.testing.assert_allclose(
        gated.prior_weight[bad_index + 1 :], reference.prior_weight[bad_index:], atol=1e-12
    )


def test_ev13_a_confirmed_step_is_absorbed_one_reading_late():
    """Two same-sign exceedances in a row are both absorbed; the state then equals shipped."""
    base = gradual_loss_series(n_obs=50, noise_sd_kg=0.0, seed=1)
    observations = list(base.observations)
    for i in range(30, 50):
        observations[i] = Observation(
            timestamp=observations[i].timestamp, weight_kg=observations[i].weight_kg + 6.0
        )
    gated = gated_trace(observations, PARAMS)
    shipped = shipped_trace(observations, PARAMS)
    assert 30 in gated.held
    assert 30 not in gated.discarded
    assert gated.absorbed_index[31] == 31
    np.testing.assert_allclose(
        gated.v_mean_kg_per_week[31], shipped.v_mean_kg_per_week[31], atol=1e-12
    )


def test_ev13_the_gate_constant_is_the_preregistered_one():
    assert GATE_Z == 3.0


# --- EV14: distributions, rates, innovation rules -----------------------------------


def test_ev14_the_normal_quantiles_are_the_existing_constants():
    assert normal_ppf(0.975) == pytest.approx(Z_95, abs=1e-12)
    assert normal_ppf(0.95) == pytest.approx(Z_90, abs=1e-12)
    assert normal_cdf(normal_ppf(0.123)) == pytest.approx(0.123, abs=1e-13)


def test_ev14_the_chi_square_cdf_matches_its_closed_forms():
    for x in (0.1, 1.0, 5.0, 20.0):
        assert chi2_cdf(x, 2) == pytest.approx(1.0 - math.exp(-x / 2.0), abs=1e-13)
        assert chi2_cdf(x, 1) == pytest.approx(2.0 * normal_cdf(math.sqrt(x)) - 1.0, abs=1e-13)
    assert chi2_ppf(0.95, 1) == pytest.approx(CHI2_1_95, abs=1e-10)
    for df in (3, 14, 40):
        assert chi2_cdf(chi2_ppf(1.0 - ALPHA_CHECK, df), df) == pytest.approx(
            1.0 - ALPHA_CHECK, abs=1e-12
        )


def test_ev14_the_clipped_second_moment_matches_numerical_integration():
    grid = np.linspace(-12.0, 12.0, 400_001)
    density = np.exp(-0.5 * grid**2) / math.sqrt(2.0 * math.pi)
    for c in (0.5, CLIP_C, 3.0):
        integrand = np.clip(grid, -c, c) ** 2 * density
        numeric = float(np.sum((integrand[1:] + integrand[:-1]) * 0.5 * np.diff(grid)))
        assert clipped_normal_second_moment(c) == pytest.approx(numeric, abs=1e-9)
    assert normal_pdf(0.0) == pytest.approx(1.0 / math.sqrt(2.0 * math.pi))


def test_ev14_wilson_interval_is_the_textbook_one():
    summary = wilson_interval(5, 100)
    assert summary.rate == 0.05
    assert summary.ci_lo == pytest.approx(0.021543, abs=1e-5)
    assert summary.ci_hi == pytest.approx(0.111753, abs=1e-5)
    zero = wilson_interval(0, 1000)
    assert zero.ci_lo == 0.0
    assert 0.003 < zero.ci_hi < 0.004
    with pytest.raises(ValueError):
        wilson_interval(0, 0)


def test_ev14_clustered_rate_pools_and_falls_back_to_the_rule_of_three():
    summary = clustered_rate([1, 0, 2, 1], [4, 4, 4, 4])
    assert summary.rate == pytest.approx(4 / 16)
    assert summary.method == "cluster_ratio"
    assert summary.ci_lo < 0.25 < summary.ci_hi
    empty = clustered_rate([0, 0, 0], [5, 0, 5])
    assert empty.method == "rule_of_three"
    assert empty.n_clusters == 2
    assert empty.ci_hi == pytest.approx(1.0)
    with pytest.raises(ValueError):
        clustered_rate([0], [0])


def test_ev14_innovation_rules_decline_windows_too_small_to_assess():
    assert innov_chi2_claim([0.1]) is None
    assert innov_mean_claim([0.1]) is None
    assert innov_robust_claim([0.1, 0.2]) is None
    assert innov_chi2_claim([0.1, 0.2]) is False


def test_ev14_one_extreme_innovation_triggers_chi2_and_never_the_robust_rule():
    """The chi-square rule has no protection from a single value; the robust one does."""
    window = [0.3, -0.2, 0.1, 0.4, -0.5, 0.2, 0.0, -0.1, 0.3, 0.1, -0.2, 0.2, 0.1]
    spiked = [*window, 1.0e6]
    assert innov_chi2_claim(spiked) is True
    assert innov_mean_claim(spiked) is True
    assert innov_robust_claim(spiked) is False
    # Leave-one-out: dropping the spike is one of the omissions, so the statistic can be no
    # larger than the clean window's clipped sum rescaled to the same count.
    assert innov_robust_statistic(spiked) <= innov_robust_statistic(
        [*window, 0.0]
    ) + 2.0 / math.sqrt(13 * clipped_normal_second_moment(CLIP_C))


def test_ev14_on_iid_standard_normal_windows_the_rules_hold_their_level():
    """The null the thresholds were derived for: exact for I1 and I2, conservative for I3."""
    rng = np.random.default_rng(20260913)
    n_windows = 40_000
    k = 14
    draws = rng.standard_normal((n_windows, k))
    chi2 = sum(bool(innov_chi2_claim(list(row))) for row in draws) / n_windows
    mean = sum(bool(innov_mean_claim(list(row))) for row in draws) / n_windows
    robust = sum(bool(innov_robust_claim(list(row))) for row in draws) / n_windows
    se = math.sqrt(ALPHA_CHECK * (1 - ALPHA_CHECK) / n_windows)
    assert abs(chi2 - ALPHA_CHECK) < 4 * se
    assert abs(mean - ALPHA_CHECK) < 4 * se
    assert robust < ALPHA_CHECK + 4 * se


# --- EV15: protocol, leakage, regimes, baselines ------------------------------------


@pytest.mark.parametrize(
    ("regime", "schedule"),
    [
        ("steady", "daily"),
        ("steady_missing", "missing"),
        ("plateau", "3.5d"),
        ("model_consistent", "irregular"),
    ],
)
def test_ev15_a_checkin_sees_nothing_after_its_day(regime, schedule):
    """Every method at day ``c`` equals the same method run on the series truncated at ``c``."""
    series = draw(regime, schedule, 4_000_123, PARAMS)
    full = evaluate_series(series, PARAMS)
    for day in (28.0, 56.0):
        keep = [i for i, d in enumerate(series.elapsed_days) if d <= day + 1e-9]
        truncated = type(series)(
            label=series.label,
            observations=series.observations[: keep[-1] + 1],
            true_weight_kg=series.true_weight_kg[: keep[-1] + 1],
            true_velocity_kg_per_day=series.true_velocity_kg_per_day[: keep[-1] + 1],
            elapsed_days=series.elapsed_days[: keep[-1] + 1],
        )
        short = evaluate_series(truncated, PARAMS)
        a, b = full.at(day), short.at(day)
        assert a.kalman == b.kalman
        assert a.kalman_prior_weight == b.kalman_prior_weight
        assert a.gated == b.gated
        assert a.ols28 == b.ols28
        assert a.weekly_means == b.weekly_means
        assert a.innovations == b.innovations


def test_ev15_every_regime_is_labelled_synthetic_and_covers_the_phase():
    for regime, schedule in [
        ("model_consistent", "daily"),
        ("model_consistent", "weekly"),
        ("steady", "3.5d"),
        ("steady_irregular", "irregular"),
        ("steady_missing", "missing"),
        ("level_shift", "daily"),
        ("plateau", "weekly"),
        ("gradual_rate_change", "daily"),
        ("curved", "daily"),
    ]:
        series = draw(regime, schedule, 4_000_001, PARAMS)
        assert "synthetic" in series.label
        assert series.elapsed_days[0] == 0.0
        assert series.elapsed_days[-1] >= CHECKIN_DAYS[-1] - 1e-9


def test_ev15_the_missing_schedule_keeps_day_zero_and_its_silence():
    gaps = missing_data_gaps(4_000_050)
    days = np.concatenate([[0.0], np.cumsum(gaps)])
    lo, hi = MISSING_SILENCE_DAYS
    assert not any(lo <= d <= hi for d in days)
    assert days[-1] <= 84.0
    assert missing_data_gaps(4_000_050) == gaps


def test_ev15_a_bad_reading_moves_one_reading_and_no_truth():
    series = draw("steady", "daily", 4_000_002, PARAMS)
    moved = with_bad_reading(series, 3.0)
    changed = [
        i
        for i, (a, b) in enumerate(zip(series.observations, moved.observations, strict=True))
        if a.weight_kg != b.weight_kg
    ]
    assert changed == [int(BAD_READING_DAY)]
    assert moved.true_weight_kg == series.true_weight_kg
    with pytest.raises(ValueError, match="day 56"):
        with_bad_reading(draw("steady_irregular", "irregular", 1, PARAMS), 3.0)


def test_ev15_band_exit_is_the_first_reading_outside_the_band():
    plateau = evaluate_series(draw("plateau", "daily", 4_000_003, PARAMS), PARAMS)
    assert band_exit_day(plateau, -0.5, PLAN_TOLERANCE_KG_PER_WEEK) == pytest.approx(42.0)
    gradual = evaluate_series(draw("gradual_rate_change", "daily", 4_000_004, PARAMS), PARAMS)
    assert band_exit_day(gradual, -0.5, PLAN_TOLERANCE_KG_PER_WEEK) == pytest.approx(54.0)
    steady = evaluate_series(draw("steady", "daily", 4_000_005, PARAMS), PARAMS)
    assert band_exit_day(steady, -0.5, PLAN_TOLERANCE_KG_PER_WEEK) is None


def test_ev15_targets_are_reproducible_and_independent_where_required():
    assert random_target(9, "model_consistent", 5.0) == random_target(9, "model_consistent", -5.0)
    assert -1.0 <= random_target(9, "model_consistent", 0.0) <= 1.0
    assert random_target(9, "steady", -0.5) == pytest.approx(random_target(9, "steady", 0.0) - 0.5)


def test_ev15_the_ols_baseline_is_ordinary_least_squares_on_its_window():
    rng = np.random.default_rng(2)
    days = list(range(40))
    weights = [
        80.0 - 0.06 * d + float(e) for d, e in zip(days, rng.normal(0, 0.4, 40), strict=True)
    ]
    estimate = ols_window_estimate(days, weights, 35.0)
    assert estimate is not None
    window = [(d, w) for d, w in zip(days, weights, strict=True) if 7.0 < d <= 35.0]
    t = np.array([d for d, _ in window], dtype=float)
    y = np.array([w for _, w in window])
    slope, intercept = np.polyfit(t, y, 1)
    residual = y - (slope * t + intercept)
    se = math.sqrt(float(residual @ residual) / (len(t) - 2) / float(((t - t.mean()) ** 2).sum()))
    assert estimate.mean_kg_per_week == pytest.approx(7.0 * slope, abs=1e-10)
    assert estimate.sd_kg_per_week == pytest.approx(7.0 * se, abs=1e-10)
    assert estimate.df == len(t) - 2
    assert ols_window_estimate([0.0, 1.0, 2.0], [80.0, 79.9, 80.1], 2.0) is None


def test_ev15_the_weekly_means_baseline_is_its_hand_arithmetic():
    days = [8.0, 10.0, 12.0, 15.0, 17.0, 21.0]
    weights = [80.0, 80.4, 79.8, 79.6, 79.9, 79.4]
    estimate = weekly_means_estimate(days, weights, 21.0)
    assert estimate is not None
    m1, m2 = np.mean(weights[:3]), np.mean(weights[3:])
    gap = np.mean(days[3:]) - np.mean(days[:3])
    pooled = (
        np.sum((np.array(weights[:3]) - m1) ** 2) + np.sum((np.array(weights[3:]) - m2) ** 2)
    ) / 4
    assert estimate.mean_kg_per_week == pytest.approx(7.0 * (m2 - m1) / gap)
    assert estimate.sd_kg_per_week == pytest.approx(7.0 * math.sqrt(pooled * (2 / 3)) / gap)
    assert estimate.df == 4
    assert weekly_means_estimate(days[:4], weights[:4], 21.0) is None
