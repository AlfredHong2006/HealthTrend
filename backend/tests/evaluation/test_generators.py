"""The Milestone 6 generators and the E5 regime suites. Test ID EV3.

Every conclusion in E5 is a statement about a hidden trajectory, so a generator whose truth
arrays did not match the observations it produced would not fail loudly -- it would produce
a plausible, wrong number. These tests check the truth itself: against closed forms, against
the covariance identity the model rests on, and against the distinction between a reading
that is wrong and a weight that has moved.
"""

from __future__ import annotations

import math
from itertools import pairwise

import numpy as np
import pytest

from app.core.model import process_noise, transition_matrix
from app.core.types import ModelParams
from evaluation.common import SEED_BASES
from evaluation.scenarios import (
    IRREGULAR_N_OBS,
    REGIMES,
    REGULAR_N_OBS,
    forecast_origins,
    regime_suite,
    suites_for_split,
)
from testing.synthetic import (
    IRREGULAR_GAPS_DAYS,
    contaminate,
    curvature_series,
    gradual_loss_series,
    jump_series,
    model_consistent_series,
    plateau_series,
)

# --- EV3: the new trajectories ----------------------------------------------------


def test_ev3_the_plateau_truth_is_two_straight_lines():
    """Loss at the stated rate until the break, exactly flat after it."""
    series = plateau_series(
        start_kg=84.0, rate_kg_per_week=-0.7, break_day=30.0, n_obs=60, noise_sd_kg=0.0, seed=1
    )
    rate_per_day = -0.7 / 7.0

    assert series.true_weight_kg[0] == pytest.approx(84.0)
    assert series.true_weight_kg[30] == pytest.approx(84.0 + rate_per_day * 30.0)
    # Flat after the break: every later truth equals the value at the break.
    assert series.true_weight_kg[59] == pytest.approx(series.true_weight_kg[30])
    assert series.true_velocity_kg_per_day[29] == pytest.approx(rate_per_day)
    assert series.true_velocity_kg_per_day[30] == 0.0
    assert series.true_velocity_kg_per_day[59] == 0.0


def test_ev3_the_curvature_truth_is_the_exponential_and_its_derivative():
    """``w(t) = floor + (start - floor) exp(-t / T)`` and ``v`` is exactly ``dw/dt``.

    Checked twice: against the closed form, and against a central difference of the weight
    truth. The second check is what would catch a velocity array that was internally
    consistent but described a different trajectory.
    """
    series = curvature_series(
        start_kg=82.0, floor_kg=76.0, time_constant_days=40.0, n_obs=80, noise_sd_kg=0.0, seed=1
    )
    for index, days in enumerate(series.elapsed_days):
        decay = math.exp(-days / 40.0)
        assert series.true_weight_kg[index] == pytest.approx(76.0 + 6.0 * decay, rel=1e-14)
        assert series.true_velocity_kg_per_day[index] == pytest.approx(
            -6.0 / 40.0 * decay, rel=1e-14
        )

    for index in range(1, len(series.elapsed_days) - 1):
        derivative = (series.true_weight_kg[index + 1] - series.true_weight_kg[index - 1]) / (
            series.elapsed_days[index + 1] - series.elapsed_days[index - 1]
        )
        # Central difference on a smooth exponential: second-order accurate, so 1e-4 is
        # generous. Measured worst case here is 1.6e-5.
        assert derivative == pytest.approx(series.true_velocity_kg_per_day[index], abs=1e-4)


def test_ev3_the_curvature_velocity_actually_changes():
    """The regime exists to supply a rate that is never constant."""
    series = curvature_series(n_obs=120, noise_sd_kg=0.0, seed=1)
    velocities = series.true_velocity_kg_per_day
    assert abs(velocities[0]) > abs(velocities[-1]) * 2.0
    assert len(set(velocities)) == len(velocities)


def test_ev3_a_jump_moves_the_truth_and_an_outlier_does_not():
    """The distinction the estimator cannot make and the evaluation must.

    Both produce a displaced reading. Only one is a real change in latent weight, and a
    method that follows it is right in one case and wrong in the other.
    """
    jumped = jump_series(
        start_kg=80.0,
        rate_kg_per_week=0.0,
        jump_day=30.0,
        jump_kg=-2.0,
        n_obs=60,
        noise_sd_kg=0.0,
        seed=1,
    )
    assert jumped.true_weight_kg[29] == pytest.approx(80.0)
    assert jumped.true_weight_kg[30] == pytest.approx(78.0)
    assert jumped.observations[30].weight_kg == pytest.approx(78.0)

    clean = gradual_loss_series(n_obs=60, rate_kg_per_week=0.0, noise_sd_kg=0.0, seed=1)
    spiked = clean.with_outlier(30, -2.0)
    assert spiked.true_weight_kg == clean.true_weight_kg
    assert spiked.observations[30].weight_kg == pytest.approx(
        clean.observations[30].weight_kg - 2.0
    )


# --- EV3: contamination ------------------------------------------------------------


def test_ev3_contamination_displaces_the_stated_fraction_and_nothing_else():
    clean = gradual_loss_series(n_obs=100, noise_sd_kg=0.4, seed=5)
    dirty = contaminate(clean, rate=0.05, magnitudes_kg=(3.0, 5.0), seed=7)

    assert dirty.true_weight_kg == clean.true_weight_kg
    assert dirty.true_velocity_kg_per_day == clean.true_velocity_kg_per_day

    displaced = [
        index
        for index in range(clean.n_obs)
        if abs(dirty.observations[index].weight_kg - clean.observations[index].weight_kg) > 1e-12
    ]
    assert len(displaced) == 5  # round(0.05 * 100)


def test_ev3_contamination_alternates_sign_so_it_carries_no_net_bias():
    """Each magnitude must appear once with each sign.

    This test failed on the first implementation, which advanced the sign and the magnitude
    on the same period: with two magnitudes that produced ``+3, -5, +3, -5``, a net drift of
    -1 kg per outlier, which would have shown up in the results as the estimator handling a
    level shift rather than handling contamination.
    """
    clean = gradual_loss_series(n_obs=100, noise_sd_kg=0.0, seed=5)
    dirty = contaminate(clean, rate=0.04, magnitudes_kg=(3.0, 5.0), seed=7)
    deltas = [
        dirty.observations[index].weight_kg - clean.observations[index].weight_kg
        for index in range(clean.n_obs)
    ]
    nonzero = sorted(round(delta, 9) for delta in deltas if abs(delta) > 1e-12)
    assert nonzero == [-5.0, -3.0, 3.0, 5.0]
    assert sum(nonzero) == pytest.approx(0.0)


def test_ev3_contamination_is_reproducible_and_rate_zero_is_a_no_op():
    clean = gradual_loss_series(n_obs=100, noise_sd_kg=0.4, seed=5)
    first = contaminate(clean, rate=0.05, seed=7)
    second = contaminate(clean, rate=0.05, seed=7)
    assert [o.weight_kg for o in first.observations] == [o.weight_kg for o in second.observations]
    assert contaminate(clean, rate=0.0, seed=7) is clean


def test_ev3_contamination_rejects_an_impossible_rate():
    clean = gradual_loss_series(n_obs=20, seed=5)
    with pytest.raises(ValueError, match="fraction"):
        contaminate(clean, rate=1.5, seed=7)


# --- EV3: model-consistent draws on irregular schedules ----------------------------


def test_ev3_splitting_a_gap_leaves_the_distribution_unchanged():
    """``F(b) Q(a) F(b)' + Q(b) == Q(a + b)`` is what makes irregular draws exact.

    The generator steps through ``Q(dt)`` for whatever gaps it is given, so this identity
    is the reason a series drawn on awkward spacing is drawn from precisely the
    distribution the filter assumes rather than an approximation of it.
    """
    params = ModelParams.default()
    a, b = 3.0, 11.0
    combined = process_noise(a + b, params)
    split = transition_matrix(b) @ process_noise(a, params) @ transition_matrix(
        b
    ).T + process_noise(b, params)
    np.testing.assert_allclose(split, combined, rtol=1e-14, atol=1e-30)


def test_ev3_explicit_gaps_override_the_regular_schedule():
    params = ModelParams.default()
    gaps = (0.5, 3.0, 1.0, 14.0)
    series = model_consistent_series(params, gaps_days=gaps, seed=11)
    assert series.n_obs == len(gaps) + 1
    assert series.elapsed_days == pytest.approx((0.0, 0.5, 3.5, 4.5, 18.5))


def test_ev3_a_model_consistent_draw_refuses_a_zero_gap():
    """``Q(0)`` is the zero matrix and has no Cholesky factor.

    The filter handles ``dt = 0`` exactly, so this is a limitation of simulating the model
    rather than of estimating it -- which is why E1 builds its zero-gap case by hand
    instead of asking for one here.
    """
    params = ModelParams.default()
    with pytest.raises(ValueError, match="strictly positive gaps"):
        model_consistent_series(params, gaps_days=(1.0, 0.0, 1.0), seed=11)


def test_ev3_the_regular_path_is_unchanged_by_the_new_argument():
    """The default path must produce exactly what it produced before ``gaps_days`` existed."""
    params = ModelParams.default()
    explicit = model_consistent_series(params, n_obs=20, step_days=1.0, seed=3)
    forwarded = model_consistent_series(params, gaps_days=tuple([1.0] * 19), seed=3)
    assert [o.weight_kg for o in explicit.observations] == [
        o.weight_kg for o in forwarded.observations
    ]


# --- EV3: regime suites and forecast tasks -----------------------------------------


@pytest.mark.parametrize("regime", REGIMES)
def test_ev3_every_regime_draws_labelled_synthetic_series(regime):
    suite = regime_suite(regime, n_series=3, block=SEED_BASES["e5_train"], split="train")
    assert suite.n_series == 3
    assert suite.split == "train"
    for series in suite.series:
        assert "synthetic" in series.label.lower()
        assert series.n_obs in (REGULAR_N_OBS, IRREGULAR_N_OBS)
        assert len(series.true_weight_kg) == series.n_obs


def test_ev3_regimes_within_a_split_never_share_seeds():
    suites = suites_for_split(n_series=10, block=SEED_BASES["e5_train"], split="train")
    ranges = sorted((suite.seed_lo, suite.seed_hi) for suite in suites.values())
    for (_, earlier_hi), (later_lo, _) in pairwise(ranges):
        assert earlier_hi < later_lo


def test_ev3_an_unknown_regime_is_refused():
    with pytest.raises(ValueError, match="unknown regime"):
        regime_suite("wishful", n_series=2, block=SEED_BASES["e5_train"], split="train")


def test_ev3_forecast_targets_are_real_observations_at_least_thirty_days_out():
    suites = suites_for_split(n_series=2, block=SEED_BASES["e5_test"], split="test")
    for regime, suite in suites.items():
        for series in suite.series:
            tasks = forecast_origins(series)
            assert tasks, f"{regime} produced no forecast tasks"
            for task in tasks:
                assert 0 <= task.origin_index < task.target_index < series.n_obs
                achieved = (
                    series.elapsed_days[task.target_index] - series.elapsed_days[task.origin_index]
                )
                assert achieved >= 30.0
                assert task.horizon_days == pytest.approx(achieved)


def test_ev3_a_daily_series_achieves_exactly_thirty_days():
    suite = regime_suite("steady_loss", n_series=1, block=SEED_BASES["e5_test"], split="test")
    tasks = forecast_origins(suite.series[0])
    assert [task.horizon_days for task in tasks] == pytest.approx([30.0, 30.0, 30.0])


def test_ev3_the_irregular_schedule_overshoots_and_says_so():
    """A 21-day silence means the first reading past 30 days can be well past it."""
    suite = regime_suite("irregular", n_series=1, block=SEED_BASES["e5_test"], split="test")
    tasks = forecast_origins(suite.series[0])
    assert any(task.horizon_days > 31.0 for task in tasks)
    assert max(IRREGULAR_GAPS_DAYS) == 21.0
