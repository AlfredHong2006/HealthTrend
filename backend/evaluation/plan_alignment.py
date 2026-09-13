"""Milestone 7A: plan alignment and departure detection, as definitions.

The pre-registration is ``docs/evaluation/m7a_preregistration.md``. Every constant that
decides a claim, a gate or an eligibility verdict is in :data:`PREREGISTRATION`, which the
runners copy into the ``_config`` block of their committed result files so that test
``EV16`` can refuse evidence produced under different rules.

**Nothing here is part of the application, and nothing here changes the estimator.** The
shipped filter is run exactly as it ships (:func:`app.core.filter.run_filter`), and what
this module reads from it -- the posterior velocity, the gains, the normalised innovations
-- is what the filter already records. The one filter that is *not* the shipped one,
:func:`gated_trace`, is an evaluation-only experiment assembled from the public
:func:`app.core.kalman.predict` and :func:`app.core.kalman.update` primitives; it modifies
neither, and ``tests/test_layering.py`` keeps the application from importing it.

Three kinds of object:

**Rate estimates.** :class:`RateEstimate` is a location, a scale and optionally degrees of
freedom, so a Gaussian posterior and a Student-t frequentist slope share one probability
function. :func:`band_probability` is the on-plan probability, and nothing more than the
distribution function of the estimate evaluated at the two band edges.

**Traces.** :class:`Trace` records, after each reading is processed, which reading the state
last absorbed, the velocity posterior there, and the exact weight the prior's zero-velocity
mean still carries in it. That weight is what gates "trend established" -- see
:func:`prior_weight_on_velocity`.

**Window statistics.** The three innovation rules, each a pure function of the normalised
innovations in a window and a per-check-in level.
"""

from __future__ import annotations

import bisect
import math
from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Final

import numpy as np
from numpy.typing import NDArray

from app.core.filter import run_filter
from app.core.kalman import predict, update
from app.core.model import IDENTITY, H, initial_state, transition_matrix
from app.core.types import FilterResult, ModelParams, Observation
from evaluation.constants import (
    chi2_ppf,
    clipped_normal_second_moment,
    normal_cdf,
    normal_ppf,
    student_t_cdf,
)

DAYS_PER_WEEK: Final = 7.0
TIME_EPSILON_DAYS: Final = 1.0e-9
"""Slack when comparing an elapsed time against a check-in day, absorbing float round-off."""

# ---------------------------------------------------------------------------
# The pre-registered constants
# ---------------------------------------------------------------------------

PLAN_TOLERANCE_KG_PER_WEEK: Final = 0.2
SHARPNESS_TOLERANCES_KG_PER_WEEK: Final = (0.1, 0.2, 0.3)
PRIOR_WEIGHT_GATE: Final = 0.05
DEPARTURE_TAIL: Final = 0.05
CONSISTENCY_TAIL: Final = 0.6
SHARP_CONSISTENT: Final = 0.8
ALPHA_PHASE: Final = 0.05
N_PRIMARY_CHECKINS: Final = 9
ALPHA_CHECK: Final = ALPHA_PHASE / N_PRIMARY_CHECKINS
GATE_Z: Final = 3.0
CLIP_C: Final = 2.0
INNOVATION_WINDOW_DAYS: Final = 14.0
OLS_WINDOW_DAYS: Final = 28.0
OLS_MIN_SPREAD_DAYS: Final = 14.0
CONFIRMATION_LAG_DAYS: Final = 7.0

PLAN_RULES: Final = (
    "kalman_plan_05",
    "kalman_plan_bonf",
    "kalman_plan_confirmed",
    "gated_plan_bonf",
    "ols28_plan_bonf",
    "weekly_means_point",
)
"""Plan-relative claim rules: "the estimated rate has departed from the plan band"."""

INNOVATION_RULES: Final = ("innov_chi2_bonf", "innov_mean_bonf", "innov_robust_bonf")
"""Model-relative claim rules: "recent readings are not consistent with the estimate"."""

CANDIDATE_RULES: Final = ("kalman_plan_05", "kalman_plan_bonf", "kalman_plan_confirmed")
EXPERIMENTAL_RULES: Final = ("gated_plan_bonf",)
BASELINE_RULES: Final = ("ols28_plan_bonf", "weekly_means_point")

PROBABILITY_METHODS: Final = ("kalman", "gated", "ols28", "weekly_means", "weekly_means_point")
"""On-plan probability methods compared in E6. ``weekly_means_point`` is 0 or 1."""

PREREGISTRATION: Final[dict[str, Any]] = {
    "document": "docs/evaluation/m7a_preregistration.md",
    "plan_tolerance_kg_per_week": PLAN_TOLERANCE_KG_PER_WEEK,
    "sharpness_tolerances_kg_per_week": list(SHARPNESS_TOLERANCES_KG_PER_WEEK),
    "prior_weight_gate": PRIOR_WEIGHT_GATE,
    "departure_tail": DEPARTURE_TAIL,
    "consistency_tail": CONSISTENCY_TAIL,
    "alpha_phase": ALPHA_PHASE,
    "n_primary_checkins": N_PRIMARY_CHECKINS,
    "gate_z": GATE_Z,
    "clip_c": CLIP_C,
    "innovation_window_days": INNOVATION_WINDOW_DAYS,
    "ols_window_days": OLS_WINDOW_DAYS,
    "ols_min_spread_days": OLS_MIN_SPREAD_DAYS,
    "confirmation_lag_days": CONFIRMATION_LAG_DAYS,
    "plan_rules": list(PLAN_RULES),
    "innovation_rules": list(INNOVATION_RULES),
    "criteria": {
        "e6_a": {"ece_max": 0.03, "citl_ci_contains_zero": True},
        "e6_b": {
            "departure_tail_max": 0.05,
            "departure_tail_upper_max": 0.10,
            "consistency_tail_slack": 0.05,
        },
        "e6_c": {"departure_tail_max": 0.10, "departure_tail_upper_max": 0.15},
        "r_a": {"phase_false_claim_max": 0.05, "wilson_upper_max": 0.075},
        "r_b": {"attributable_max": 0.02},
        "r_c_plan": {
            "plateau_within_28_min": 0.80,
            "plateau_median_delay_max_days": 21.0,
            "gradual_by_end_min": 0.50,
            "curved_by_end_min": 0.50,
        },
        "r_c_innovation": {
            "level_shift_within_14_min": 0.80,
            "plateau_within_28_min": 0.80,
            "plateau_median_delay_max_days": 21.0,
        },
    },
}
"""Everything a verdict depends on, as written in the pre-registration."""


# ---------------------------------------------------------------------------
# Rate estimates and the on-plan probability
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class PlanBand:
    """A target weekly rate and a symmetric tolerance, both kg/week."""

    target_kg_per_week: float
    tolerance_kg_per_week: float = PLAN_TOLERANCE_KG_PER_WEEK

    def __post_init__(self) -> None:
        """Reject a band with no width."""
        if not self.tolerance_kg_per_week > 0.0:
            raise ValueError("a plan tolerance must be positive")

    @property
    def lo(self) -> float:
        """Lower edge of the band."""
        return self.target_kg_per_week - self.tolerance_kg_per_week

    @property
    def hi(self) -> float:
        """Upper edge of the band."""
        return self.target_kg_per_week + self.tolerance_kg_per_week

    def contains(self, rate_kg_per_week: float) -> bool:
        """Return whether a rate lies inside the band, edges included."""
        return self.lo <= rate_kg_per_week <= self.hi


@dataclass(frozen=True, slots=True)
class RateEstimate:
    """A weekly-rate estimate with its uncertainty.

    Attributes:
        mean_kg_per_week: the location.
        sd_kg_per_week: the scale: a posterior standard deviation, or a standard error.
        df: Student-t degrees of freedom, or ``None`` for a Gaussian.
    """

    mean_kg_per_week: float
    sd_kg_per_week: float
    df: int | None = None

    def cdf(self, rate_kg_per_week: float) -> float:
        """Return the estimate's distribution function at ``rate_kg_per_week``."""
        standardised = (rate_kg_per_week - self.mean_kg_per_week) / self.sd_kg_per_week
        if self.df is None:
            return normal_cdf(standardised)
        return student_t_cdf(standardised, self.df)


def band_probability(estimate: RateEstimate, band: PlanBand) -> float:
    """Return the on-plan probability, ``F(hi) - F(lo)``.

    Clamped at zero only against round-off in the subtraction; nothing else is adjusted.
    """
    return max(0.0, estimate.cdf(band.hi) - estimate.cdf(band.lo))


def max_attainable_probability(sd_kg_per_week: float, tolerance_kg_per_week: float) -> float:
    """Return the largest on-plan probability a Gaussian with this sd can ever report.

    Attained when the posterior mean sits exactly at the target: ``2 Phi(delta / s) - 1``.
    No amount of agreement between data and plan can push the probability higher, which
    makes this the sharpness ceiling the product would inherit from the priors.
    """
    return 2.0 * normal_cdf(tolerance_kg_per_week / sd_kg_per_week) - 1.0


# ---------------------------------------------------------------------------
# Traces: what the state was after each reading
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class Trace:
    """The velocity posterior after each reading was processed.

    Every tuple has one entry per reading. For the shipped filter ``absorbed_index[i] == i``;
    for the gated experiment a held reading leaves the state where it was, so the entry
    points back at the last reading actually absorbed.

    Attributes:
        elapsed_days: elapsed time of each reading.
        absorbed_index: the reading the state last absorbed.
        v_mean_kg_per_week: posterior velocity mean, kg/week.
        v_sd_kg_per_week: posterior velocity sd, kg/week.
        prior_weight: ``|Phi[1, 1]|``, the coefficient on the prior's zero velocity mean.
        normalized_innovation: ``z`` for each absorbed reading, ``None`` for the first
            reading and for any reading that was not absorbed.
        held: readings held by the gate at the time they arrived.
        discarded: readings the gate held and then discarded as isolated.
    """

    elapsed_days: tuple[float, ...]
    absorbed_index: tuple[int, ...]
    v_mean_kg_per_week: tuple[float, ...]
    v_sd_kg_per_week: tuple[float, ...]
    prior_weight: tuple[float, ...]
    normalized_innovation: tuple[float | None, ...]
    held: tuple[int, ...] = ()
    discarded: tuple[int, ...] = ()

    def index_at(self, day: float) -> int:
        """Return the last reading at or before ``day``; the first reading is at day zero."""
        position = bisect.bisect_right(self.elapsed_days, day + TIME_EPSILON_DAYS) - 1
        if position < 0:
            raise ValueError("a check-in precedes the first reading")
        return position

    def estimate_at(self, day: float) -> tuple[RateEstimate, float, int]:
        """Return the rate estimate, its prior weight and the absorbed reading, at ``day``."""
        index = self.index_at(day)
        return (
            RateEstimate(self.v_mean_kg_per_week[index], self.v_sd_kg_per_week[index]),
            self.prior_weight[index],
            self.absorbed_index[index],
        )


def _elapsed(observations: Sequence[Observation]) -> tuple[float, ...]:
    """Return elapsed days from the first observation, exactly as the filter measures them."""
    first = observations[0].timestamp
    return tuple((obs.timestamp - first).total_seconds() / 86_400.0 for obs in observations)


def prior_weight_on_velocity(result: FilterResult) -> tuple[float, ...]:
    """Return, after each reading, the exact weight of the prior velocity mean in the estimate.

    The filter is linear: ``x_t = (I - K_t H) F(dt_t) x_{t-1} + K_t y_t``. So the posterior
    mean is ``Phi_t x_0 + (terms in the readings)`` with
    ``Phi_t = prod (I - K_t H) F(dt_t)``, where the gains do not depend on the readings at
    all. ``x_0 = [y_0, 0]`` (ADR-0003), so ``Phi_t[1, 1]`` is precisely how much of the
    reported velocity is the prior's zero rather than evidence. Test ``EV12`` checks this
    against a filter started from a different prior mean.

    A zero-span series has ``F = I`` and a zero velocity gain at every step, so the weight is
    exactly one: the gate this feeds can never open without elapsed time.
    """
    phi = IDENTITY.copy()
    weights = [1.0]
    for step in result.steps:
        gain = np.asarray(step.gain, dtype=np.float64).reshape(2, 1)
        phi = (IDENTITY - gain @ H) @ transition_matrix(step.dt_days) @ phi
        weights.append(abs(float(phi[1, 1])))
    return tuple(weights)


def shipped_trace(observations: Sequence[Observation], params: ModelParams) -> Trace:
    """Run the shipped filter, unmodified, and record its velocity posterior after each reading."""
    result = run_filter(observations, params)
    posteriors = result.posteriors
    z: list[float | None] = [None]
    z.extend(step.normalized_innovation for step in result.steps)
    return Trace(
        elapsed_days=_elapsed(observations),
        absorbed_index=tuple(range(len(posteriors))),
        v_mean_kg_per_week=tuple(p.v_kg_per_day * DAYS_PER_WEEK for p in posteriors),
        v_sd_kg_per_week=tuple(p.v_sd * DAYS_PER_WEEK for p in posteriors),
        prior_weight=prior_weight_on_velocity(result),
        normalized_innovation=tuple(z),
    )


def gated_trace(
    observations: Sequence[Observation], params: ModelParams, *, gate_z: float = GATE_Z
) -> Trace:
    """Run the experimental gated filter, for evaluation only and never as the estimator.

    A reading with ``|z| > gate_z`` against the last absorbed state is held. If the next
    reading also exceeds the gate with the same sign, both are absorbed in time order --
    a real step is followed one reading late. Otherwise the held reading is discarded as
    isolated. Built from :func:`app.core.kalman.predict` and :func:`update`, neither of
    which is changed.

    Known and stated limitations: two consecutive same-sign bad readings are absorbed; a
    genuine change is followed one reading late; the latest reading at a check-in may be
    held and therefore absent from the state.
    """
    elapsed = _elapsed(observations)
    x, P = initial_state(observations[0].weight_kg, params)
    phi = IDENTITY.copy()
    last = 0

    absorbed: list[int] = [0]
    means: list[float] = [float(x[1]) * DAYS_PER_WEEK]
    sds: list[float] = [math.sqrt(float(P[1, 1])) * DAYS_PER_WEEK]
    weights: list[float] = [1.0]
    z_record: list[float | None] = [None]
    held: list[int] = []
    discarded: list[int] = []
    pending: tuple[int, float] | None = None

    def absorb(
        index: int,
        state: tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.float64], int],
    ) -> tuple[NDArray[np.float64], NDArray[np.float64], NDArray[np.float64], int, float]:
        x_, P_, phi_, last_ = state
        dt = elapsed[index] - elapsed[last_]
        x_prior, P_prior = predict(x_, P_, dt, params)
        outcome = update(x_prior, P_prior, observations[index].weight_kg, params.obs_variance)
        gain = outcome.gain.reshape(2, 1)
        phi_next = (IDENTITY - gain @ H) @ transition_matrix(dt) @ phi_
        return outcome.x, outcome.P, phi_next, index, outcome.normalized_innovation

    for index in range(1, len(observations)):
        dt = elapsed[index] - elapsed[last]
        x_prior, P_prior = predict(x, P, dt, params)
        s = float(P_prior[0, 0]) + params.obs_variance
        z = (observations[index].weight_kg - float(x_prior[0])) / math.sqrt(s)
        sign = 1.0 if z > 0.0 else -1.0
        z_value: float | None = None

        if abs(z) > gate_z:
            if pending is not None and pending[1] == sign:
                x, P, phi, last, _ = absorb(pending[0], (x, P, phi, last))
                x, P, phi, last, z_value = absorb(index, (x, P, phi, last))
                pending = None
            else:
                if pending is not None:
                    discarded.append(pending[0])
                pending = (index, sign)
                held.append(index)
        else:
            if pending is not None:
                discarded.append(pending[0])
                pending = None
            x, P, phi, last, z_value = absorb(index, (x, P, phi, last))

        absorbed.append(last)
        means.append(float(x[1]) * DAYS_PER_WEEK)
        sds.append(math.sqrt(float(P[1, 1])) * DAYS_PER_WEEK)
        weights.append(abs(float(phi[1, 1])))
        z_record.append(z_value)

    return Trace(
        elapsed_days=elapsed,
        absorbed_index=tuple(absorbed),
        v_mean_kg_per_week=tuple(means),
        v_sd_kg_per_week=tuple(sds),
        prior_weight=tuple(weights),
        normalized_innovation=tuple(z_record),
        held=tuple(held),
        discarded=tuple(discarded),
    )


def trend_established(prior_weight: float) -> bool:
    """Return whether the pre-registered gate is open: at most 5% of the rate is prior."""
    return prior_weight <= PRIOR_WEIGHT_GATE


# ---------------------------------------------------------------------------
# Leakage-safe baselines: windows that end at the check-in
# ---------------------------------------------------------------------------


def _window(
    elapsed: Sequence[float], values: Sequence[float], start: float, end: float
) -> tuple[list[float], list[float]]:
    """Return the readings with ``start < t <= end``. Nothing after ``end`` is ever read."""
    lo = bisect.bisect_right(elapsed, start + TIME_EPSILON_DAYS)
    hi = bisect.bisect_right(elapsed, end + TIME_EPSILON_DAYS)
    return list(elapsed[lo:hi]), list(values[lo:hi])


def ols_window_estimate(
    elapsed: Sequence[float], weights_kg: Sequence[float], day: float
) -> RateEstimate | None:
    """Return the OLS slope over ``(day - 28, day]`` as a Student-t rate estimate.

    Assessable with at least three readings spread over at least fourteen days. The error
    model is the textbook one -- independent residuals of constant variance around a straight
    line -- which is exactly the assumption a user fitting a trend line in a spreadsheet makes.
    """
    times, values = _window(elapsed, weights_kg, day - OLS_WINDOW_DAYS, day)
    n = len(times)
    if n < 3 or times[-1] - times[0] < OLS_MIN_SPREAD_DAYS:
        return None
    t = np.asarray(times, dtype=np.float64)
    y = np.asarray(values, dtype=np.float64)
    t_centre = t - t.mean()
    sxx = float(np.dot(t_centre, t_centre))
    slope = float(np.dot(t_centre, y - y.mean())) / sxx
    residual = y - (y.mean() + slope * t_centre)
    s2 = float(np.dot(residual, residual)) / (n - 2)
    se = math.sqrt(s2 / sxx) if s2 > 0.0 else 0.0
    if se <= 0.0:
        return None
    return RateEstimate(slope * DAYS_PER_WEEK, se * DAYS_PER_WEEK, df=n - 2)


def weekly_means_estimate(
    elapsed: Sequence[float], weights_kg: Sequence[float], day: float
) -> RateEstimate | None:
    """Return last week's mean minus the previous week's, per week, as a Student-t estimate.

    Weeks are ``(day - 14, day - 7]`` and ``(day - 7, day]``; each needs two readings. The
    rate divides by the difference of the two weeks' mean times, so an uneven week is not
    silently treated as seven days. Pooled within-week variance gives the standard error.
    """
    t1, y1 = _window(elapsed, weights_kg, day - 2.0 * DAYS_PER_WEEK, day - DAYS_PER_WEEK)
    t2, y2 = _window(elapsed, weights_kg, day - DAYS_PER_WEEK, day)
    n1, n2 = len(y1), len(y2)
    if n1 < 2 or n2 < 2:
        return None
    gap = float(np.mean(t2)) - float(np.mean(t1))
    if gap <= 0.0:
        return None
    a1 = np.asarray(y1, dtype=np.float64)
    a2 = np.asarray(y2, dtype=np.float64)
    df = n1 + n2 - 2
    pooled = (float(np.sum((a1 - a1.mean()) ** 2)) + float(np.sum((a2 - a2.mean()) ** 2))) / df
    se = math.sqrt(pooled * (1.0 / n1 + 1.0 / n2)) / gap
    if se <= 0.0:
        return None
    rate = (float(a2.mean()) - float(a1.mean())) / gap
    return RateEstimate(rate * DAYS_PER_WEEK, se * DAYS_PER_WEEK, df=df)


# ---------------------------------------------------------------------------
# Innovation window rules
# ---------------------------------------------------------------------------


def window_innovations(trace: Trace, day: float) -> list[float]:
    """Return the absorbed normalised innovations with ``day - 14 < t <= day``."""
    lo = bisect.bisect_right(trace.elapsed_days, day - INNOVATION_WINDOW_DAYS + TIME_EPSILON_DAYS)
    hi = bisect.bisect_right(trace.elapsed_days, day + TIME_EPSILON_DAYS)
    return [z for z in trace.normalized_innovation[lo:hi] if z is not None]


@lru_cache(maxsize=256)
def chi2_threshold(k: int, alpha: float = ALPHA_CHECK) -> float:
    """Return the upper ``alpha`` point of a chi-square with ``k`` degrees of freedom."""
    return chi2_ppf(1.0 - alpha, k)


@lru_cache(maxsize=8)
def two_sided_normal_threshold(alpha: float = ALPHA_CHECK) -> float:
    """Return ``Phi^-1(1 - alpha / 2)``."""
    return normal_ppf(1.0 - alpha / 2.0)


CLIPPED_SECOND_MOMENT: Final = clipped_normal_second_moment(CLIP_C)


def innov_chi2_claim(z: Sequence[float], alpha: float = ALPHA_CHECK) -> bool | None:
    """I1: ``sum z**2`` beyond the chi-square quantile. ``None`` when not assessable."""
    k = len(z)
    if k < 2:
        return None
    return math.fsum(value * value for value in z) > chi2_threshold(k, alpha)


def innov_mean_claim(z: Sequence[float], alpha: float = ALPHA_CHECK) -> bool | None:
    """I2: ``|sum z| / sqrt(k)`` beyond the two-sided normal quantile."""
    k = len(z)
    if k < 2:
        return None
    return abs(math.fsum(z)) / math.sqrt(k) > two_sided_normal_threshold(alpha)


def innov_robust_statistic(z: Sequence[float]) -> float:
    """Return the leave-one-out minimum of the clipped standardised sum.

    ``min_j |sum_{i != j} psi_i| / sqrt((k - 1) E[psi**2])`` with ``psi = clip(z, -2, 2)``.
    Because the minimum runs over every single omission, no single innovation can be what
    carries the statistic over its threshold. That is a statement about *that innovation's
    own value*; a bad reading also disturbs the state and so the innovations after it,
    which is why the evaluation measures the rule rather than trusting this property.
    """
    k = len(z)
    if k < 3:
        raise ValueError("the robust statistic needs at least three innovations")
    psi = [max(-CLIP_C, min(CLIP_C, value)) for value in z]
    total = math.fsum(psi)
    scale = math.sqrt((k - 1) * CLIPPED_SECOND_MOMENT)
    return min(abs(total - value) for value in psi) / scale


def innov_robust_claim(z: Sequence[float], alpha: float = ALPHA_CHECK) -> bool | None:
    """I3: the leave-one-out clipped sum beyond the two-sided normal quantile."""
    if len(z) < 3:
        return None
    return innov_robust_statistic(z) > two_sided_normal_threshold(alpha)
