"""Calibration diagnostics and the quantiles behind every interval. Test ID EV4.

The numbers in this module size every confidence interval the study reports, so they are
checked against closed forms rather than against themselves: chi-square quantiles against
their exact expressions, Student-t against the two degrees of freedom that have elementary
quantile functions, and the cluster interval against arithmetic done by hand.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.core.filter import run_filter
from app.core.types import Z_95, ModelParams
from evaluation.constants import (
    CHI2_1_95,
    CHI2_MIX_95,
    Z_90,
    regularised_incomplete_beta,
    student_t_ppf,
    student_t_sf_two_sided,
    t_975,
)
from evaluation.metrics import cluster_summary, nees, quantiles, series_diagnostics
from testing.synthetic import gradual_loss_series, model_consistent_series

# --- EV4: quantiles, against closed forms ------------------------------------------


def test_ev4_the_chi_square_quantiles_are_their_exact_expressions():
    """Each is derivable, so none is transcribed.

    A chi-square with one degree of freedom is a squared standard normal; with two, it is
    exponential with mean two.
    """
    one_df, mixture = CHI2_1_95, CHI2_MIX_95
    assert one_df == pytest.approx(Z_95**2, rel=1e-15)
    assert one_df == pytest.approx(3.841458820694124, rel=1e-12)
    assert mixture == pytest.approx(Z_90**2, rel=1e-15)
    assert mixture == pytest.approx(2.705543454095404, rel=1e-12)


def test_ev4_the_boundary_cutoff_is_below_the_two_sided_one():
    """The mixture null is easier to reject than the interior one, which is the point.

    Using ``CHI2_1_95`` for the ``q = 0`` test would be conservative and would understate
    how often the data can detect process noise at all.
    """
    assert CHI2_MIX_95 < CHI2_1_95


def test_ev4_the_t_quantile_matches_the_cauchy_closed_form():
    """One degree of freedom is Cauchy: the quantile is ``tan(pi (p - 1/2))``."""
    assert student_t_ppf(0.975, 1) == pytest.approx(math.tan(math.pi * 0.475), rel=1e-12)


def test_ev4_the_t_quantile_matches_the_two_degree_closed_form():
    """Two degrees of freedom: ``t = sqrt(2 / (4 p (1 - p)) - 2)``."""
    expected = math.sqrt(2.0 / (4.0 * 0.975 * 0.025) - 2.0)
    assert student_t_ppf(0.975, 2) == pytest.approx(expected, rel=1e-12)


@pytest.mark.parametrize("df", [1, 2, 5, 11, 29, 49, 99, 199, 499])
def test_ev4_the_t_quantile_round_trips_through_its_own_tail(df):
    """The strongest self-check available: the quantile must invert the survival function.

    Measured worst deviation across these degrees of freedom is ``5e-16``.
    """
    assert student_t_sf_two_sided(t_975(df), df) == pytest.approx(0.05, abs=1e-14)


def test_ev4_the_t_quantile_decreases_towards_the_normal():
    """Monotone in the degrees of freedom, approaching ``Z_95`` from above and never below.

    Checked against the Cornish-Fisher expansion rather than against ``Z_95`` alone. At ten
    thousand degrees of freedom the gap from the normal is ``2.4e-4`` -- small, but far
    larger than the expansion's own error, so the expansion is the sharper statement.

    Two terms are needed, not one. With only the first the residual is ``2.8e-6`` at a
    thousand degrees of freedom, which is the ``O(v**-2)`` term rather than any defect --
    a tolerance loose enough to absorb it would have stopped testing anything.
    """
    values = [t_975(df) for df in (2, 5, 10, 30, 100, 1000, 10000)]
    assert values == sorted(values, reverse=True)
    assert all(value > Z_95 for value in values)

    z = Z_95
    for df in (1000, 10000):
        expansion = (
            z + (z + z**3) / (4.0 * df) + (5.0 * z**5 + 16.0 * z**3 + 3.0 * z) / (96.0 * df * df)
        )
        assert t_975(df) == pytest.approx(expansion, abs=1e-7)


def test_ev4_the_incomplete_beta_agrees_with_its_elementary_cases():
    """``I_x(1, 1) = x`` and ``I_x(1, 2) = 1 - (1 - x)**2``."""
    for x in (0.01, 0.25, 0.5, 0.9, 0.999):
        assert regularised_incomplete_beta(1.0, 1.0, x) == pytest.approx(x, rel=1e-13)
        assert regularised_incomplete_beta(1.0, 2.0, x) == pytest.approx(
            1.0 - (1.0 - x) ** 2, rel=1e-13
        )
    assert regularised_incomplete_beta(2.0, 3.0, 0.0) == 0.0
    assert regularised_incomplete_beta(2.0, 3.0, 1.0) == 1.0


def test_ev4_an_interval_needs_at_least_two_clusters():
    with pytest.raises(ValueError, match="at least two"):
        cluster_summary([0.95])
    with pytest.raises(ValueError, match="at least two"):
        t_975(0)


# --- EV4: the cluster interval, against arithmetic done by hand ---------------------


def test_ev4_the_cluster_interval_is_the_textbook_one():
    values = [0.90, 0.92, 0.95, 0.97, 1.00]
    summary = cluster_summary(values)

    mean = sum(values) / 5
    variance = sum((value - mean) ** 2 for value in values) / 4
    sd = math.sqrt(variance)
    se = sd / math.sqrt(5)

    assert summary.mean == pytest.approx(mean, rel=1e-15)
    assert summary.sd == pytest.approx(sd, rel=1e-14)
    assert summary.se == pytest.approx(se, rel=1e-14)
    assert summary.n_clusters == 5
    assert summary.ci_lo == pytest.approx(mean - t_975(4) * se, rel=1e-13)
    assert summary.ci_hi == pytest.approx(mean + t_975(4) * se, rel=1e-13)


def test_ev4_the_deviation_is_measured_in_standard_errors():
    summary = cluster_summary([1.0, 1.0, 1.0, 1.2, 0.8])
    assert summary.mean == pytest.approx(1.0)
    assert summary.deviation_in_se(1.0) == pytest.approx(0.0, abs=1e-14)
    # Nominal one standard error below the mean.
    assert summary.deviation_in_se(1.0 - summary.se) == pytest.approx(1.0, rel=1e-12)


def test_ev4_identical_series_give_a_zero_width_interval_and_no_false_alarm():
    """Zero spread means zero standard error, and a deviation that must not divide by it."""
    summary = cluster_summary([0.5, 0.5, 0.5])
    assert summary.se == 0.0
    assert summary.ci_lo == summary.ci_hi == 0.5
    assert summary.deviation_in_se(0.4) == 0.0


def test_ev4_the_interval_narrows_as_the_square_root_of_the_count():
    rng = np.random.default_rng(4)
    narrow = cluster_summary(rng.normal(1.0, 0.1, size=400))
    wide = cluster_summary(rng.normal(1.0, 0.1, size=25))
    assert narrow.se < wide.se


def test_ev4_quantiles_are_labelled_by_probability():
    result = quantiles([1.0, 2.0, 3.0, 4.0, 5.0], (0.05, 0.5, 0.95))
    assert set(result) == {"q0.05", "q0.5", "q0.95"}
    assert result["q0.5"] == pytest.approx(3.0)


# --- EV4: NEES ---------------------------------------------------------------------


def test_ev4_nees_matches_a_hand_inverted_two_by_two():
    covariance = np.array([[4.0, 1.0], [1.0, 2.0]], dtype=np.float64)
    error = np.array([1.5, -0.5], dtype=np.float64)

    determinant = 4.0 * 2.0 - 1.0 * 1.0
    expected = (2.0 * 1.5**2 - 2.0 * 1.0 * 1.5 * -0.5 + 4.0 * 0.5**2) / determinant

    assert nees(error, covariance) == pytest.approx(expected, rel=1e-14)
    assert nees(error, covariance) == pytest.approx(
        float(error @ np.linalg.inv(covariance) @ error), rel=1e-12
    )


def test_ev4_nees_uses_the_cross_covariance():
    """Two coverage checks read the diagonal twice; only NEES reads the rest of ``P``."""
    error = np.array([1.0, 1.0], dtype=np.float64)
    diagonal = np.array([[4.0, 0.0], [0.0, 2.0]], dtype=np.float64)
    correlated = np.array([[4.0, 1.5], [1.5, 2.0]], dtype=np.float64)
    assert nees(error, diagonal) != pytest.approx(nees(error, correlated))


def test_ev4_nees_refuses_a_singular_covariance():
    singular = np.array([[1.0, 1.0], [1.0, 1.0]], dtype=np.float64)
    with pytest.raises(ValueError, match="singular"):
        nees(np.array([1.0, 0.0]), singular)


# --- EV4: per-series diagnostics ----------------------------------------------------


def test_ev4_diagnostics_count_every_posterior_and_one_fewer_innovation(params):
    series = model_consistent_series(params, n_obs=25, seed=1_100_000)
    diagnostics = series_diagnostics(series, run_filter(series.observations, params))
    assert diagnostics.n_posteriors == 25
    assert diagnostics.n_steps == 24
    assert 0.0 <= diagnostics.coverage_w <= 1.0
    assert diagnostics.inside_w == round(diagnostics.coverage_w * 25)


def test_ev4_the_initial_posterior_is_included_and_is_exactly_checkable(params):
    """The first posterior is ``N([y_0, 0], diag(R, sigma_v0**2))`` and its error is too.

    Under a model-consistent draw the initial error is ``(-measurement noise, v_0)``, whose
    distribution is exactly ``P_0``. So the first term of NEES is computable by hand from
    the generator's own draws, which is what this checks -- and why the initial state is
    counted rather than skipped.
    """
    series = model_consistent_series(params, n_obs=8, seed=1_100_001)
    result = run_filter(series.observations, params)
    initial = result.posteriors[0]

    assert initial.w_kg == pytest.approx(series.observations[0].weight_kg, rel=1e-15)
    assert initial.v_kg_per_day == 0.0
    assert initial.w_var == pytest.approx(params.obs_variance, rel=1e-15)
    assert initial.v_var == pytest.approx(params.sigma_v0**2, rel=1e-15)

    error_w = series.true_weight_kg[0] - initial.w_kg
    error_v = series.true_velocity_kg_per_day[0] - initial.v_kg_per_day
    expected = error_w**2 / params.obs_variance + error_v**2 / params.sigma_v0**2
    assert nees(np.array([error_w, error_v]), initial.P) == pytest.approx(expected, rel=1e-13)


def test_ev4_coverage_counts_what_the_interval_actually_says(params):
    """Coverage must use the same ``Z_95`` half-width the product publishes."""
    series = model_consistent_series(params, n_obs=40, seed=1_100_002)
    result = run_filter(series.observations, params)
    diagnostics = series_diagnostics(series, result)

    manual = sum(
        1
        for index, posterior in enumerate(result.posteriors)
        if abs(series.true_weight_kg[index] - posterior.w_kg) <= Z_95 * posterior.w_sd
    )
    assert diagnostics.inside_w == manual

    lower, upper = result.posteriors[10].w_ci95
    truth = series.true_weight_kg[10]
    assert (lower <= truth <= upper) == (
        abs(truth - result.posteriors[10].w_kg) <= Z_95 * result.posteriors[10].w_sd
    )


def test_ev4_a_mismatched_series_and_result_is_refused(params):
    """Silently pairing the wrong truth with a filter run would produce a plausible lie."""
    series = model_consistent_series(params, n_obs=20, seed=1_100_003)
    other = gradual_loss_series(n_obs=15, noise_sd_kg=0.4, seed=1)
    with pytest.raises(ValueError, match="does not match"):
        series_diagnostics(series, run_filter(other.observations, params))


def test_ev4_a_badly_scaled_filter_is_detected(params):
    """The diagnostics must move the right way when the model is wrong.

    Filtering model-consistent data with a measurement noise four times too large should
    over-smooth and produce innovations that are too small for the variance claimed, so
    the average normalised innovation squared falls well below one.
    """
    series = model_consistent_series(params, n_obs=200, seed=1_100_004)
    wrong = ModelParams(
        sigma_obs_kg=params.sigma_obs_kg * 4.0,
        sigma_accel=params.sigma_accel,
        sigma_v0=params.sigma_v0,
    )
    honest = series_diagnostics(series, run_filter(series.observations, params))
    misspecified = series_diagnostics(series, run_filter(series.observations, wrong))

    assert honest.anis == pytest.approx(1.0, abs=0.4)
    assert misspecified.anis < 0.5
    assert misspecified.coverage_w > honest.coverage_w  # over-wide intervals over-cover
