"""The fitting objective, the optimiser and the profile intervals. Test ID EV5.

Every estimate in E3, E4 and E5 comes out of this module, so it is checked on three axes:
that the fast objective is the same number the shipped filter computes, that the optimiser
is deterministic and finds what it should, and that the profile interval reports censoring
honestly instead of silently returning a bound as though it were a crossing.
"""

from __future__ import annotations

import math

import pytest

from app.core.filter import run_filter
from app.core.types import ModelParams, Observation
from evaluation.constants import CHI2_1_95, CHI2_MIX_95
from evaluation.experiments.e1_exact_likelihood import build_case
from evaluation.mle import (
    BOUNDARY_MARGIN,
    SEARCH_BOX,
    _Objective,
    dataset_loglik,
    fit,
    innovations_loglik,
    nelder_mead,
    objective_discrepancy,
    prepare_dataset,
    prepare_series,
    profile_ci,
    q_zero_statistic,
)
from testing.synthetic import model_consistent_ensemble, model_consistent_series

TRUTH = ModelParams.default()
TRUTH_LOG10 = (math.log10(TRUTH.sigma_obs_kg), math.log10(TRUTH.sigma_accel))

IDENTIFIED_N_SERIES = 12
IDENTIFIED_N_OBS = 200
"""A pooled ensemble large enough to identify both parameters, and no larger.

Twelve series of 200 daily readings span 199 days, over which the model's own spread is
13 kg from a start of 80 -- comfortably positive. Pushing to 300 readings, as an earlier
draft did, spans 299 days with a spread of 24 kg, and one series in forty then wanders to a
negative weight that :class:`~app.core.types.Observation` rightly refuses. That is not a
generator bug; it is the no-mean-reversion limitation in ``docs/mathematics.md`` section
8.4 arriving in person, and it is why E3 and E4 carry a redraw mechanism.
"""


@pytest.fixture(scope="module")
def identified():
    """A fit on data generous enough that both parameters are well determined.

    Module-scoped because the fit and its profile intervals cost about a second, and three
    tests ask the same question of the same optimum.
    """
    ensemble = model_consistent_ensemble(
        TRUTH,
        n_series=IDENTIFIED_N_SERIES,
        n_obs=IDENTIFIED_N_OBS,
        start_kg=80.0,
        base_seed=2_000_600,
    )
    dataset = prepare_dataset([series.observations for series in ensemble])
    return dataset, fit(dataset, sigma_v0=TRUTH.sigma_v0)


# --- EV5: the fast objective is the shipped one -----------------------------------


@pytest.mark.parametrize("pattern", ["daily", "irregular", "duplicated", "twice_daily"])
@pytest.mark.parametrize(
    "theta",
    [(0.5, 0.008, 1 / 7), (0.1, 0.05, 0.5), (2.0, 0.001, 0.02), (0.35, 0.02, 0.14)],
)
def test_ev5_the_fitting_objective_equals_the_filter(pattern, theta):
    """The reason for the lean recursion is speed; the reason to trust it is this.

    ``duplicated`` puts two readings at the same instant, which is where a recursion that
    quietly assumed a positive gap would come apart.
    """
    observations = build_case(pattern, 40, 1_000_000)
    params = ModelParams(sigma_obs_kg=theta[0], sigma_accel=theta[1], sigma_v0=theta[2])
    lean = innovations_loglik(prepare_series(observations), *theta)
    filtered = run_filter(observations, params).loglik
    assert lean == pytest.approx(filtered, rel=1e-12)


def test_ev5_the_discrepancy_helper_reports_what_the_runner_checks():
    observations = build_case("daily", 50, 1_000_000)
    assert objective_discrepancy(observations, -0.30103, -2.0915, 1 / 7) < 1e-10


def test_ev5_a_single_observation_contributes_no_likelihood():
    prepared = prepare_series(build_case("daily", 1, 1_000_000))
    assert innovations_loglik(prepared, 0.5, 0.008, 1 / 7) == 0.0


def test_ev5_pooled_likelihood_is_the_sum_of_its_parts():
    ensemble = model_consistent_ensemble(TRUTH, n_series=4, n_obs=20, base_seed=2_000_000)
    dataset = prepare_dataset([series.observations for series in ensemble])
    total = dataset_loglik(dataset, 0.5, 0.008, 1 / 7)
    parts = [innovations_loglik(series, 0.5, 0.008, 1 / 7) for series in dataset]
    assert total == pytest.approx(sum(parts), rel=1e-13)


def test_ev5_prepare_refuses_a_per_observation_variance():
    """Silently ignoring a field that had been set would be worse than not supporting it."""
    observations = list(build_case("daily", 5, 1_000_000))
    observations[2] = Observation(
        timestamp=observations[2].timestamp, weight_kg=observations[2].weight_kg, obs_variance=0.4
    )
    with pytest.raises(ValueError, match="per-observation override"):
        prepare_series(observations)


def test_ev5_prepared_series_rejects_inconsistent_inputs():
    from evaluation.mle import PreparedSeries

    with pytest.raises(ValueError, match="one fewer entry"):
        PreparedSeries(dt_days=(1.0, 1.0), y_kg=(80.0, 79.0, 78.0, 77.0))
    with pytest.raises(ValueError, match="non-decreasing"):
        PreparedSeries(dt_days=(1.0, -1.0), y_kg=(80.0, 79.0, 78.0))


# --- EV5: the optimiser -------------------------------------------------------------


def test_ev5_the_optimiser_is_deterministic():
    """Two runs must agree bit for bit; a study whose estimates moved could claim nothing."""
    series = model_consistent_series(TRUTH, n_obs=120, seed=2_000_500)
    dataset = [prepare_series(series.observations)]
    first = fit(dataset, sigma_v0=TRUTH.sigma_v0)
    second = fit(dataset, sigma_v0=TRUTH.sigma_v0)
    assert first == second


def test_ev5_the_optimiser_minimises_a_quadratic_bowl():
    """A shape with a known optimum, so a broken simplex cannot pass by luck."""

    class Bowl(_Objective):
        def __init__(self):
            self.n_evaluations = 0

        def __call__(self, x, y):
            self.n_evaluations += 1
            return (x - 0.3) ** 2 + 3.0 * (y + 1.25) ** 2

    point, value = nelder_mead(Bowl(), (-1.0, -3.0))
    assert point[0] == pytest.approx(0.3, abs=1e-5)
    assert point[1] == pytest.approx(-1.25, abs=1e-5)
    assert value == pytest.approx(0.0, abs=1e-9)


def test_ev5_the_optimum_is_never_outside_the_search_box():
    """A likelihood that keeps rising must stop at the bound, not walk out of it."""
    series = model_consistent_series(TRUTH, n_obs=15, seed=2_000_501)
    fitted = fit([prepare_series(series.observations)], sigma_v0=TRUTH.sigma_v0)
    assert SEARCH_BOX[0][0] <= fitted.log10_sigma_obs <= SEARCH_BOX[0][1]
    assert SEARCH_BOX[1][0] <= fitted.log10_sigma_accel <= SEARCH_BOX[1][1]


def test_ev5_the_fit_recovers_the_truth_when_there_is_enough_data(identified):
    """Pooling many long series makes both parameters identified, which pins the fitter.

    Deliberately generous conditions -- twelve series of 200 daily readings, far more than
    any single user supplies. The point is that the estimator is consistent, not that it
    works on realistic data; E3 is where the realistic answer is measured, and it is much
    worse. Measured errors here are ``-0.008`` and ``-0.025`` in ``log10``.
    """
    _, fitted = identified
    assert fitted.log10_sigma_obs == pytest.approx(TRUTH_LOG10[0], abs=0.05)
    assert fitted.log10_sigma_accel == pytest.approx(TRUTH_LOG10[1], abs=0.10)
    assert not any(fitted.at_lower_bound)
    assert not any(fitted.at_upper_bound)


def test_ev5_the_maximised_likelihood_beats_the_truth_on_its_own_sample():
    """A maximum must be at least as high as any particular point, including the true one."""
    series = model_consistent_series(TRUTH, n_obs=200, seed=2_000_700)
    dataset = [prepare_series(series.observations)]
    fitted = fit(dataset, sigma_v0=TRUTH.sigma_v0)
    at_truth = dataset_loglik(dataset, TRUTH.sigma_obs_kg, TRUTH.sigma_accel, TRUTH.sigma_v0)
    assert fitted.loglik >= at_truth - 1e-9


def test_ev5_a_boundary_flag_means_within_the_stated_margin():
    series = model_consistent_series(TRUTH, n_obs=200, seed=2_000_700)
    fitted = fit([prepare_series(series.observations)], sigma_v0=TRUTH.sigma_v0)
    assert fitted.at_lower_bound[1] == (
        fitted.log10_sigma_accel - SEARCH_BOX[1][0] <= BOUNDARY_MARGIN
    )


# --- EV5: profile intervals ---------------------------------------------------------


def test_ev5_the_profile_interval_brackets_the_optimum():
    series = model_consistent_series(TRUTH, n_obs=300, seed=2_000_800)
    dataset = [prepare_series(series.observations)]
    fitted = fit(dataset, sigma_v0=TRUTH.sigma_v0)
    interval = profile_ci(dataset, 0, fitted, threshold=CHI2_1_95)
    assert interval.lo <= fitted.log10_sigma_obs <= interval.hi
    assert interval.width > 0.0


def test_ev5_a_well_determined_parameter_gives_a_closed_interval_around_the_truth(identified):
    """With enough data both endpoints are real crossings, not bounds.

    Measured widths: ``0.025`` for the measurement noise and ``0.142`` for the process
    noise, both in orders of magnitude, both containing the truth.
    """
    dataset, fitted = identified
    for index in (0, 1):
        interval = profile_ci(dataset, index, fitted, threshold=CHI2_1_95)
        assert not interval.lo_censored
        assert not interval.hi_censored
        assert interval.contains(TRUTH_LOG10[index])
        assert interval.width < 0.5


def test_ev5_a_short_series_censors_the_process_noise_interval():
    """The finding E3 quantifies, pinned as a test.

    Thirty daily readings do not determine the process-noise intensity: the profile never
    rises far enough on the way down, so the interval runs off the bottom of the search
    space and is reported as censored rather than as a crossing that did not happen.
    """
    series = model_consistent_series(TRUTH, n_obs=30, start_kg=80.0, seed=2_000_100)
    dataset = [prepare_series(series.observations)]
    fitted = fit(dataset, sigma_v0=TRUTH.sigma_v0)
    interval = profile_ci(dataset, 1, fitted, threshold=CHI2_1_95)
    assert interval.lo_censored
    assert interval.lo == SEARCH_BOX[1][0]
    assert interval.width > 2.0  # orders of magnitude


def test_ev5_a_wider_threshold_gives_a_wider_interval():
    series = model_consistent_series(TRUTH, n_obs=300, seed=2_000_800)
    dataset = [prepare_series(series.observations)]
    fitted = fit(dataset, sigma_v0=TRUTH.sigma_v0)
    narrow = profile_ci(dataset, 0, fitted, threshold=CHI2_1_95)
    wide = profile_ci(dataset, 0, fitted, threshold=4.0 * CHI2_1_95)
    assert wide.width > narrow.width


# --- EV5: the q = 0 boundary test ---------------------------------------------------


def test_ev5_the_q_zero_statistic_is_non_negative_and_uses_the_mixture_cutoff():
    series = model_consistent_series(TRUTH, n_obs=300, seed=2_000_800)
    dataset = [prepare_series(series.observations)]
    fitted = fit(dataset, sigma_v0=TRUTH.sigma_v0)
    statistic = q_zero_statistic(dataset, fitted)
    assert statistic >= 0.0
    # The boundary cutoff is the one that applies, and it is smaller than the interior one.
    assert CHI2_MIX_95 < CHI2_1_95


def test_ev5_process_noise_is_detected_when_there_is_plenty_of_it(identified):
    """Long, densely-sampled, model-consistent data must reject "the trend never drifts".

    Measured statistic is about 3900 against a cutoff of 2.71 -- not a marginal call. The
    contrast with a single 30-reading series, where E3 finds the test rejects almost never,
    is the whole identifiability story in two numbers.
    """
    dataset, fitted = identified
    assert q_zero_statistic(dataset, fitted) > CHI2_MIX_95


def test_ev5_exactly_linear_data_does_not_support_process_noise():
    """Why an exact-linear synthetic truth alone would have been a misleading basis.

    A straight line with measurement noise is a local-linear-trend series whose process
    noise really is zero. Fitted to it, the model reports as much: the estimate falls to the
    floor of the search space and the boundary test does not reject. A study built only on
    exactly-linear truths would have been quietly measuring this corner and calling it
    performance, which is why E5 carries a curvature regime.
    """
    from testing.synthetic import gradual_loss_series

    series = gradual_loss_series(n_obs=200, rate_kg_per_week=-0.35, noise_sd_kg=0.5, seed=3)
    dataset = [prepare_series(series.observations)]
    fitted = fit(dataset, sigma_v0=TRUTH.sigma_v0)

    assert fitted.log10_sigma_accel < TRUTH_LOG10[1] - 1.0
    assert q_zero_statistic(dataset, fitted) < CHI2_MIX_95
    assert fitted.log10_sigma_obs == pytest.approx(math.log10(0.5), abs=0.1)
