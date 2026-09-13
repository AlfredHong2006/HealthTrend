"""Milestone 7A: the phase protocol, the regimes, and one series evaluated at its check-ins.

The protocol is the one in ``docs/evaluation/m7a_preregistration.md``: an 84-day phase,
weekly check-ins from day 14, the primary nine from day 28, a change at day 42. Every
trajectory is drawn by an existing generator in :mod:`testing.synthetic` -- plus
:func:`~testing.synthetic.rate_change_series`, added there for this milestone -- so the
truth arrays carry the same guarantees E5's do.

**Leakage.** A check-in at day ``c`` reads the trace at the last reading at or before ``c``,
and every window baseline slices readings with ``t <= c``. The filter is causal, so reading
a full-series trace at an index is identical to filtering the truncated series; test
``EV15`` checks that identity directly rather than relying on the argument.

:func:`evaluate_series` does all the per-series work once. What it returns depends on no
plan target, so the E7 placements can re-score the same estimates against three bands
without refiltering anything.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from itertools import pairwise
from typing import Final

import numpy as np

from app.core.types import ModelParams
from evaluation.plan_alignment import (
    DAYS_PER_WEEK,
    RateEstimate,
    Trace,
    gated_trace,
    innov_chi2_claim,
    innov_mean_claim,
    innov_robust_claim,
    ols_window_estimate,
    shipped_trace,
    weekly_means_estimate,
    window_innovations,
)
from testing.synthetic import (
    IRREGULAR_GAPS_DAYS,
    SyntheticSeries,
    curvature_series,
    gradual_loss_series,
    irregular_gaps,
    irregular_loss_series,
    jump_series,
    linear_series,
    model_consistent_series,
    plateau_series,
    rate_change_series,
)

PHASE_DAYS: Final = 84.0
CHECKIN_DAYS: Final = (14.0, 21.0, 28.0, 35.0, 42.0, 49.0, 56.0, 63.0, 70.0, 77.0, 84.0)
PRIMARY_CHECKIN_DAYS: Final = CHECKIN_DAYS[2:]
CHANGE_DAY: Final = 42.0
BASE_RATE_KG_PER_WEEK: Final = -0.5
NOISE_SD_KG: Final = 0.5
START_KG: Final = 80.0
CURVED_START_KG: Final = 84.0
CURVED_TIME_CONSTANT_DAYS: Final = 60.0
LEVEL_SHIFT_KG: Final = 2.0
RAMP_DAYS: Final = 28.0
MISSING_KEEP_PROBABILITY: Final = 0.6
MISSING_SILENCE_DAYS: Final = (50, 59)
IRREGULAR_N_OBS: Final = 18
BAD_READING_DAY: Final = 56.0
BAD_READING_MAGNITUDES_KG: Final = (2.0, 3.0, 5.0)

SCHEDULE_STEPS: Final[dict[str, float]] = {"daily": 1.0, "3.5d": 3.5, "weekly": 7.0}
"""Regular schedules and their spacing in days."""

TARGET_STREAM: Final = 7
MISSING_STREAM: Final = 11
"""Stream keys: a target or a schedule is drawn from ``default_rng((seed, key))``, a stream
provably distinct from the ``default_rng(seed)`` the generators use for measurement noise."""

REGIMES: Final = (
    "model_consistent",
    "steady",
    "steady_irregular",
    "steady_missing",
    "level_shift",
    "plateau",
    "gradual_rate_change",
    "curved",
)


def _n_obs(step_days: float) -> int:
    """Return the reading count covering days 0 to 84 inclusive on a regular schedule."""
    return round(PHASE_DAYS / step_days) + 1


def missing_data_gaps(seed: int) -> tuple[float, ...]:
    """Return the gap list for the missing-data schedule drawn at ``seed``.

    Days 1 to 84 are each kept with probability 0.6; day 0 is always kept; days 50 to 59
    are always dropped, a ten-day silence inside the post-change window.
    """
    rng = np.random.default_rng((seed, MISSING_STREAM))
    draws = rng.random(int(PHASE_DAYS))
    kept = [0]
    silence_lo, silence_hi = MISSING_SILENCE_DAYS
    for day in range(1, int(PHASE_DAYS) + 1):
        if silence_lo <= day <= silence_hi:
            continue
        if draws[day - 1] < MISSING_KEEP_PROBABILITY:
            kept.append(day)
    return tuple(float(b - a) for a, b in pairwise(kept))


def draw(regime: str, schedule: str, seed: int, params: ModelParams) -> SyntheticSeries:
    """Draw one series for ``regime`` on ``schedule`` at ``seed``.

    ``schedule`` is ``"daily"``, ``"3.5d"`` or ``"weekly"`` for the regular regimes,
    ``"irregular"`` for the two irregular configurations and ``"missing"`` for
    ``steady_missing``.
    """
    rate = BASE_RATE_KG_PER_WEEK
    if schedule == "irregular":
        if regime == "steady_irregular":
            return irregular_loss_series(
                start_kg=START_KG,
                rate_kg_per_week=rate,
                n_obs=IRREGULAR_N_OBS,
                noise_sd_kg=NOISE_SD_KG,
                seed=seed,
                pattern=IRREGULAR_GAPS_DAYS,
            )
        if regime == "model_consistent":
            return model_consistent_series(
                params,
                start_kg=START_KG,
                seed=seed,
                gaps_days=irregular_gaps(IRREGULAR_N_OBS, IRREGULAR_GAPS_DAYS),
            )
        raise ValueError(f"regime {regime!r} has no irregular schedule")
    if schedule == "missing":
        if regime != "steady_missing":
            raise ValueError(f"regime {regime!r} has no missing-data schedule")
        return linear_series(
            start_kg=START_KG,
            rate_kg_per_day=rate / DAYS_PER_WEEK,
            gaps_days=missing_data_gaps(seed),
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
            label=f"synthetic missing-data loss, {rate:+.2f} kg/week",
        )
    if schedule not in SCHEDULE_STEPS:
        raise ValueError(f"unknown schedule {schedule!r}")
    step = SCHEDULE_STEPS[schedule]
    n_obs = _n_obs(step)
    if regime == "model_consistent":
        return model_consistent_series(
            params, n_obs=n_obs, step_days=step, start_kg=START_KG, seed=seed
        )
    if regime == "steady":
        return gradual_loss_series(
            start_kg=START_KG,
            rate_kg_per_week=rate,
            n_obs=n_obs,
            step_days=step,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "level_shift":
        return jump_series(
            start_kg=START_KG,
            rate_kg_per_week=rate,
            jump_day=CHANGE_DAY,
            jump_kg=LEVEL_SHIFT_KG,
            n_obs=n_obs,
            step_days=step,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "plateau":
        return plateau_series(
            start_kg=START_KG,
            rate_kg_per_week=rate,
            break_day=CHANGE_DAY,
            n_obs=n_obs,
            step_days=step,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "gradual_rate_change":
        return rate_change_series(
            start_kg=START_KG,
            initial_rate_kg_per_week=rate,
            final_rate_kg_per_week=0.0,
            change_start_day=CHANGE_DAY,
            ramp_days=RAMP_DAYS,
            n_obs=n_obs,
            step_days=step,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "curved":
        amplitude = -rate / DAYS_PER_WEEK * CURVED_TIME_CONSTANT_DAYS
        return curvature_series(
            start_kg=CURVED_START_KG,
            floor_kg=CURVED_START_KG - amplitude,
            time_constant_days=CURVED_TIME_CONSTANT_DAYS,
            n_obs=n_obs,
            step_days=step,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    raise ValueError(f"unknown regime {regime!r}")


def with_bad_reading(series: SyntheticSeries, magnitude_kg: float) -> SyntheticSeries:
    """Displace the reading at day 56 by ``magnitude_kg``, leaving the truth untouched."""
    index = min(range(series.n_obs), key=lambda i: abs(series.elapsed_days[i] - BAD_READING_DAY))
    if abs(series.elapsed_days[index] - BAD_READING_DAY) > 1.0e-9:
        raise ValueError("the bad-reading schedule needs a reading exactly at day 56")
    return series.with_outlier(index, magnitude_kg)


def random_target(seed: int, regime: str, initial_rate_kg_per_week: float) -> float:
    """Return the E6 plan target for one series.

    ``model_consistent`` targets are ``U(-1, 1)`` and independent of the truth, which is
    what exact calibration requires; the fixed-truth regimes centre ``U(-0.5, 0.5)`` on the
    series' own initial rate so that the band catches the truth about 40% of the time.
    """
    rng = np.random.default_rng((seed, TARGET_STREAM))
    if regime == "model_consistent":
        return float(rng.uniform(-1.0, 1.0))
    return initial_rate_kg_per_week + float(rng.uniform(-0.5, 0.5))


# ---------------------------------------------------------------------------
# One series, every check-in
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class CheckinEstimates:
    """Everything any method concluded at one check-in, before any plan target is applied.

    Attributes:
        day: the check-in day.
        kalman: the shipped posterior rate estimate.
        kalman_prior_weight: its exact prior weight; the gate reads this.
        kalman_true_rate: true weekly rate at the reading the estimate describes.
        gated: the experimental gated filter's estimate.
        gated_prior_weight: its prior weight.
        gated_true_rate: true weekly rate at the reading the gated state last absorbed.
        ols28: the 28-day OLS estimate, or ``None`` if not assessable.
        weekly_means: the weekly-means estimate, or ``None``.
        window_true_rate: true weekly rate at the last reading at or before the check-in,
            which is what the window baselines describe.
        innovations: the three innovation rules' verdicts, ``None`` where not assessable.
        n_window_innovations: how many innovations the window held.
    """

    day: float
    kalman: RateEstimate
    kalman_prior_weight: float
    kalman_true_rate: float
    gated: RateEstimate
    gated_prior_weight: float
    gated_true_rate: float
    ols28: RateEstimate | None
    weekly_means: RateEstimate | None
    window_true_rate: float
    innovations: dict[str, bool | None]
    n_window_innovations: int


@dataclass(frozen=True, slots=True)
class SeriesEvaluation:
    """One series evaluated at every check-in, plus what the gate did to it."""

    checkins: tuple[CheckinEstimates, ...]
    initial_true_rate: float
    true_rates: tuple[float, ...]
    elapsed_days: tuple[float, ...]
    gated_held: int
    gated_discarded: int

    def at(self, day: float) -> CheckinEstimates:
        """Return the check-in on ``day``."""
        for checkin in self.checkins:
            if math.isclose(checkin.day, day):
                return checkin
        raise KeyError(f"no check-in on day {day:g}")


def evaluate_series(series: SyntheticSeries, params: ModelParams) -> SeriesEvaluation:
    """Filter once (shipped and gated) and evaluate every method at every check-in."""
    shipped: Trace = shipped_trace(series.observations, params)
    gated: Trace = gated_trace(series.observations, params)
    weights = [obs.weight_kg for obs in series.observations]
    true_rates = tuple(v * DAYS_PER_WEEK for v in series.true_velocity_kg_per_day)
    elapsed = shipped.elapsed_days

    checkins: list[CheckinEstimates] = []
    for day in CHECKIN_DAYS:
        k_estimate, k_weight, k_index = shipped.estimate_at(day)
        g_estimate, g_weight, g_index = gated.estimate_at(day)
        z = window_innovations(shipped, day)
        checkins.append(
            CheckinEstimates(
                day=day,
                kalman=k_estimate,
                kalman_prior_weight=k_weight,
                kalman_true_rate=true_rates[k_index],
                gated=g_estimate,
                gated_prior_weight=g_weight,
                gated_true_rate=true_rates[g_index],
                ols28=ols_window_estimate(elapsed, weights, day),
                weekly_means=weekly_means_estimate(elapsed, weights, day),
                window_true_rate=true_rates[shipped.index_at(day)],
                innovations={
                    "innov_chi2_bonf": innov_chi2_claim(z),
                    "innov_mean_bonf": innov_mean_claim(z),
                    "innov_robust_bonf": innov_robust_claim(z),
                },
                n_window_innovations=len(z),
            )
        )
    return SeriesEvaluation(
        checkins=tuple(checkins),
        initial_true_rate=true_rates[0],
        true_rates=true_rates,
        elapsed_days=elapsed,
        gated_held=len(gated.held),
        gated_discarded=len(gated.discarded),
    )


def band_exit_day(evaluation: SeriesEvaluation, target: float, tolerance: float) -> float | None:
    """Return the first reading instant at which the true rate is outside the plan band."""
    for day, rate in zip(evaluation.elapsed_days, evaluation.true_rates, strict=True):
        if not target - tolerance <= rate <= target + tolerance:
            return day
    return None
