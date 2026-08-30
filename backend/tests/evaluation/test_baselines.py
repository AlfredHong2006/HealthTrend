"""The comparison baselines and the leakage guards. Test IDs EV6-EV7.

E5 concludes things like "a tuned EWMA beats the shipped estimator in this regime". That
claim is worth only as much as the baseline implementation behind it: a moving average that
silently counted observations instead of days would lose on irregular data for reasons that
have nothing to do with the estimator, and would win nothing anywhere. So each method is
checked against arithmetic done by hand on a four-point irregular series, and the
time-awareness is demonstrated rather than asserted.
"""

from __future__ import annotations

import math
from datetime import timedelta
from itertools import pairwise

import pytest

from app.core.types import ModelParams, Observation
from evaluation.baselines import (
    BURN_IN,
    METHODS,
    REFERENCE_METHOD,
    absolute_errors,
    build_runs,
    ewma_run,
    holt_run,
    index_weighted_ewma_run,
    kalman_run,
    locf_run,
    moving_average_run,
    squared_errors,
    tune_ewma,
    tune_holt,
    tune_moving_average,
    tuned_parameters,
)
from evaluation.common import SEED_BASES, seeds_are_disjoint
from evaluation.mle import prepare_series
from evaluation.scenarios import regime_suite
from testing.synthetic import DEFAULT_START, gradual_loss_series

TRUTH = ModelParams.default()

# A four-point series on deliberately uneven gaps: 1 day, 10 days, 1 day.
OFFSETS = (0.0, 1.0, 11.0, 12.0)
WEIGHTS = (80.0, 79.0, 76.0, 75.0)


@pytest.fixture
def uneven():
    observations = tuple(
        Observation(timestamp=DEFAULT_START + timedelta(days=offset), weight_kg=weight)
        for offset, weight in zip(OFFSETS, WEIGHTS, strict=True)
    )
    return prepare_series(observations)


# --- EV6: each method, against arithmetic done by hand ------------------------------


def test_ev6_locf_carries_the_last_reading(uneven):
    run = locf_run(uneven)
    assert run.predictions == (None, 80.0, 79.0, 76.0)
    assert run.level == 75.0
    assert run.trend == 0.0
    assert run.forecast(30.0) == 75.0


def test_ev6_the_moving_average_window_is_measured_in_days(uneven):
    """A three-day window at index 2 must see nothing, because the gap is ten days.

    An index-based three-point window would have averaged the two readings before it. The
    day-based window correctly finds the history empty and falls back to the last value.
    """
    run = moving_average_run(uneven, 3.0)
    assert run.predictions[1] == pytest.approx(80.0)  # only day 0 is within three days
    assert run.predictions[2] == pytest.approx(79.0)  # nothing within three days: LOCF
    assert run.predictions[3] == pytest.approx(76.0)  # only day 11


def test_ev6_a_wide_moving_average_window_averages_everything_before_it(uneven):
    run = moving_average_run(uneven, 100.0)
    assert run.predictions[1] == pytest.approx(80.0)
    assert run.predictions[2] == pytest.approx((80.0 + 79.0) / 2)
    assert run.predictions[3] == pytest.approx((80.0 + 79.0 + 76.0) / 3)
    assert run.level == pytest.approx(sum(WEIGHTS) / 4)


def test_ev6_the_ewma_weight_is_the_elapsed_time_kernel(uneven):
    """``level += (1 - exp(-dt / tau)) (y - level)``, computed by hand for every step."""
    tau = 5.0
    run = ewma_run(uneven, tau)

    level = 80.0
    expected = [None]
    for gap, value in zip((1.0, 10.0, 1.0), WEIGHTS[1:], strict=True):
        expected.append(level)
        level += (1.0 - math.exp(-gap / tau)) * (value - level)

    assert run.predictions[0] is None
    for produced, wanted in zip(run.predictions[1:], expected[1:], strict=True):
        assert produced == pytest.approx(wanted, rel=1e-14)
    assert run.level == pytest.approx(level, rel=1e-14)


def test_ev6_time_awareness_changes_the_answer_on_irregular_gaps(uneven):
    """The control: an index-weighted EWMA must disagree here, and agree on a regular grid.

    If both gave the same answer the time-aware machinery would be decoration.
    """
    time_aware = ewma_run(uneven, 5.0)
    by_index = index_weighted_ewma_run(uneven, 5.0)
    assert time_aware.level != pytest.approx(by_index.level, rel=1e-6)

    regular = prepare_series(gradual_loss_series(n_obs=30, noise_sd_kg=0.4, seed=3).observations)
    assert ewma_run(regular, 5.0).level == pytest.approx(
        index_weighted_ewma_run(regular, 5.0).level, rel=1e-12
    )


def test_ev6_holt_predicts_level_plus_trend_times_the_gap(uneven):
    """Every Holt step recomputed by hand, including the trend's division by elapsed days."""
    tau_level, tau_trend = 4.0, 20.0
    run = holt_run(uneven, tau_level, tau_trend)

    level, trend = 80.0, 0.0
    expected: list[float | None] = [None]
    for gap, value in zip((1.0, 10.0, 1.0), WEIGHTS[1:], strict=True):
        prediction = level + trend * gap
        expected.append(prediction)
        level_weight = 1.0 - math.exp(-gap / tau_level)
        trend_weight = 1.0 - math.exp(-gap / tau_trend)
        previous = level
        level = prediction + level_weight * (value - prediction)
        trend = trend_weight * (level - previous) / gap + (1.0 - trend_weight) * trend

    for produced, wanted in zip(run.predictions[1:], expected[1:], strict=True):
        assert produced == pytest.approx(wanted, rel=1e-13)
    assert run.level == pytest.approx(level, rel=1e-13)
    assert run.trend == pytest.approx(trend, rel=1e-13)


def test_ev6_holt_forecasts_along_its_trend(uneven):
    run = holt_run(uneven, 4.0, 20.0)
    assert run.forecast(30.0) == pytest.approx(run.level + run.trend * 30.0, rel=1e-14)
    assert run.forecast(0.0) == pytest.approx(run.level, rel=1e-14)


def test_ev6_holt_starts_with_no_trend_just_as_the_filter_does(uneven):
    """One reading implies no rate, so neither method invents one."""
    single = prepare_series(uneven_observations()[:1])
    assert holt_run(single, 4.0, 20.0).trend == 0.0


def uneven_observations():
    return tuple(
        Observation(timestamp=DEFAULT_START + timedelta(days=offset), weight_kg=weight)
        for offset, weight in zip(OFFSETS, WEIGHTS, strict=True)
    )


def test_ev6_a_zero_gap_does_not_divide_by_zero():
    """Two readings at the same instant: the trend update has no elapsed time to divide by."""
    stamps = (0.0, 1.0, 1.0, 2.0)
    observations = tuple(
        Observation(timestamp=DEFAULT_START + timedelta(days=offset), weight_kg=weight)
        for offset, weight in zip(stamps, WEIGHTS, strict=True)
    )
    prepared = prepare_series(observations)
    run = holt_run(prepared, 4.0, 20.0)
    assert all(math.isfinite(p) for p in run.predictions[1:])
    assert math.isfinite(ewma_run(prepared, 5.0).level)


def test_ev6_the_kalman_predictions_are_the_filters_own_priors():
    """The estimator is scored on exactly what the baselines are scored on."""
    from app.core.filter import run_filter

    series = gradual_loss_series(n_obs=30, noise_sd_kg=0.4, seed=3)
    run = kalman_run(series.observations, TRUTH)
    result = run_filter(series.observations, TRUTH)
    assert run.predictions[0] is None
    for index, step in enumerate(result.steps, start=1):
        assert run.predictions[index] == pytest.approx(step.prior.w_kg, rel=1e-15)
    assert run.level == pytest.approx(result.final.w_kg, rel=1e-15)


def test_ev6_extrapolating_the_state_equals_the_shipped_propagation():
    """The equivalence E5 relies on when it forecasts the Kalman variants via `forecast_at`.

    ``level + trend * horizon`` and :func:`app.core.forecast.forecast_at` must agree in the
    mean, because the model is linear. E5 uses the latter so the comparison measures the
    shipped code path; this is what licenses treating the two as the same method.
    """
    from app.core.filter import run_filter
    from app.core.forecast import forecast_at

    series = gradual_loss_series(n_obs=30, noise_sd_kg=0.4, seed=3)
    run = kalman_run(series.observations, TRUTH)
    result = run_filter(series.observations, TRUTH)
    for horizon in (7.0, 30.0, 90.0):
        shipped = forecast_at(result.final, TRUTH, horizon).w_kg
        assert run.forecast(horizon) == pytest.approx(shipped, rel=1e-12)


def test_ev6_errors_start_after_the_burn_in(uneven):
    run = locf_run(uneven)
    assert squared_errors(run, uneven, burn_in=1) == pytest.approx([1.0, 9.0, 1.0])
    assert absolute_errors(run, uneven, burn_in=1) == pytest.approx([1.0, 3.0, 1.0])
    assert squared_errors(run, uneven, burn_in=3) == pytest.approx([1.0])
    assert BURN_IN == 10


# --- EV7: leakage guards -------------------------------------------------------------


def test_ev7_every_seed_block_is_disjoint():
    """The structural guarantee the whole train/test split rests on."""
    assert seeds_are_disjoint()
    blocks = sorted(SEED_BASES.values(), key=lambda block: block.base)
    for earlier, later in pairwise(blocks):
        assert earlier.end <= later.base


def test_ev7_train_and_test_blocks_do_not_overlap():
    train = SEED_BASES["e5_train"]
    test = SEED_BASES["e5_test"]
    assert train.end <= test.base or test.end <= train.base


def test_ev7_a_seed_may_not_run_past_the_end_of_its_block():
    block = SEED_BASES["e5_train"]
    assert block.at(0) == block.base
    with pytest.raises(ValueError, match="leaves a block"):
        block.at(block.span)
    with pytest.raises(ValueError, match="leaves a block"):
        block.at(-1)


@pytest.mark.parametrize(
    "tuner",
    [tune_moving_average, tune_ewma, tune_holt, lambda s: tuned_parameters(s, sigma_v0=0.1)],
)
def test_ev7_no_tuner_will_touch_the_test_split(tuner):
    """The guard that makes the split hold after somebody refactors the caller."""
    test_suite = regime_suite("steady_loss", n_series=3, block=SEED_BASES["e5_test"], split="test")
    with pytest.raises(ValueError, match="training split"):
        tuner(test_suite)


def test_ev7_tuning_records_where_its_data_came_from():
    """Tuned parameters that do not say what they were tuned on cannot be audited."""
    train = regime_suite("steady_loss", n_series=4, block=SEED_BASES["e5_train"], split="train")
    tuned = tuned_parameters(train, sigma_v0=TRUTH.sigma_v0)
    assert tuned["train_seed_range"] == [train.seed_lo, train.seed_hi]
    assert tuned["train_n_series"] == 4
    assert SEED_BASES["e5_train"].base <= train.seed_lo
    assert train.seed_hi < SEED_BASES["e5_train"].end


def test_ev7_tuning_picks_a_value_from_the_grid_it_was_offered():
    from evaluation.baselines import EWMA_TAU_GRID_DAYS, MA_WINDOW_GRID_DAYS

    train = regime_suite("steady_loss", n_series=4, block=SEED_BASES["e5_train"], split="train")
    assert tune_moving_average(train)["window_days"] in MA_WINDOW_GRID_DAYS
    assert tune_ewma(train)["tau_days"] in EWMA_TAU_GRID_DAYS


def test_ev7_every_method_runs_and_the_reference_is_among_them():
    train = regime_suite("steady_loss", n_series=4, block=SEED_BASES["e5_train"], split="train")
    tuned = tuned_parameters(train, sigma_v0=TRUTH.sigma_v0)
    test_suite = regime_suite("steady_loss", n_series=2, block=SEED_BASES["e5_test"], split="test")
    runs = build_runs(test_suite.series[0].observations, tuned, TRUTH)

    assert set(runs) == set(METHODS)
    assert REFERENCE_METHOD in runs
    for name, run in runs.items():
        assert run.predictions[0] is None, name
        assert len(run.predictions) == test_suite.series[0].n_obs, name
        assert all(p is not None and math.isfinite(p) for p in run.predictions[1:]), name


def test_ev7_a_one_step_prediction_never_sees_its_own_observation(uneven):
    """The structural anti-leakage property: change a reading, and only later predictions move.

    Displacing the reading at index 2 must leave the predictions at indices 1 and 2
    untouched, because both were made before it arrived.
    """
    displaced = list(uneven_observations())
    displaced[2] = Observation(
        timestamp=displaced[2].timestamp, weight_kg=displaced[2].weight_kg + 5.0
    )
    moved = prepare_series(displaced)

    for runner in (
        lambda p: locf_run(p),
        lambda p: ewma_run(p, 5.0),
        lambda p: moving_average_run(p, 100.0),
        lambda p: holt_run(p, 4.0, 20.0),
    ):
        before = runner(uneven)
        after = runner(moved)
        assert after.predictions[1] == pytest.approx(before.predictions[1])
        assert after.predictions[2] == pytest.approx(before.predictions[2])
        assert after.predictions[3] != pytest.approx(before.predictions[3])
