"""Deterministic synthetic weight series with a known hidden trajectory.

Real weight data never exposes the true latent weight, so the only way to check that the
estimator recovers a trajectory is to generate one. Every series
here carries the truth alongside the observations, and every series is explicitly labelled
synthetic -- enforced by :class:`SyntheticSeries`, not left to the caller's discipline.

Milestone 1 needs only the scenarios its tests exercise: constant weight, gradual loss,
irregular weigh-in times, simultaneous measurements, a single extreme outlier, and data
drawn from the model's own assumptions for calibration. The wider scenario library of
a wider scenario library belongs to the evaluation milestone.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from itertools import islice
from typing import Final

import numpy as np

from app.core.model import process_noise, transition_matrix
from app.core.time_axis import DEFAULT_TIME_AXIS
from app.core.types import ModelParams, Observation

DEFAULT_START: Final = datetime(2025, 1, 1, 7, 30, tzinfo=UTC)
"""A plausible morning weigh-in, fixed so that no generator depends on the clock."""

IRREGULAR_GAPS_DAYS: Final = (0.5, 3.0, 1.0, 14.0, 0.25, 7.0, 21.0, 2.0, 0.75, 5.0)
"""A fixed, deliberately awkward weigh-in pattern: twice a day, then a three-week gap."""


@dataclass(frozen=True, slots=True)
class SyntheticSeries:
    """Observations plus the hidden trajectory that generated them.

    Attributes:
        label: human-readable scenario name. Must identify the data as synthetic.
        observations: what the estimator sees.
        true_weight_kg: the latent weight at each observation instant.
        true_velocity_kg_per_day: the latent velocity at each observation instant.
        elapsed_days: days since the first observation, one per observation.
    """

    label: str
    observations: tuple[Observation, ...]
    true_weight_kg: tuple[float, ...]
    true_velocity_kg_per_day: tuple[float, ...]
    elapsed_days: tuple[float, ...]

    def __post_init__(self) -> None:
        """Enforce the synthetic label and internal consistency."""
        if "synthetic" not in self.label.lower():
            raise ValueError(
                "a synthetic series must be labelled synthetic so it can never be "
                "mistaken for real measurements"
            )
        lengths = {
            len(self.observations),
            len(self.true_weight_kg),
            len(self.true_velocity_kg_per_day),
            len(self.elapsed_days),
        }
        if len(lengths) != 1:
            raise ValueError("observations and truth arrays must have the same length")

    @property
    def n_obs(self) -> int:
        """Number of observations."""
        return len(self.observations)

    @property
    def final_true_weight_kg(self) -> float:
        """Latent weight at the last observation."""
        return self.true_weight_kg[-1]

    @property
    def final_true_velocity_kg_per_day(self) -> float:
        """Latent velocity at the last observation."""
        return self.true_velocity_kg_per_day[-1]

    def with_outlier(self, index: int, delta_kg: float) -> SyntheticSeries:
        """Return a copy with one observation displaced by ``delta_kg``.

        The hidden trajectory is unchanged: this models a mistyped or mis-measured
        reading, not a real change in weight.
        """
        observations = list(self.observations)
        original = observations[index]
        observations[index] = Observation(
            timestamp=original.timestamp,
            weight_kg=original.weight_kg + delta_kg,
            obs_variance=original.obs_variance,
        )
        return SyntheticSeries(
            label=f"{self.label} + synthetic outlier at index {index}",
            observations=tuple(observations),
            true_weight_kg=self.true_weight_kg,
            true_velocity_kg_per_day=self.true_velocity_kg_per_day,
            elapsed_days=self.elapsed_days,
        )


def regular_gaps(n_obs: int, step_days: float = 1.0) -> tuple[float, ...]:
    """Return ``n_obs - 1`` equal gaps of ``step_days`` days."""
    if n_obs < 1:
        raise ValueError("n_obs must be at least 1")
    return tuple(float(step_days) for _ in range(n_obs - 1))


def irregular_gaps(
    n_obs: int,
    pattern: tuple[float, ...] = IRREGULAR_GAPS_DAYS,
) -> tuple[float, ...]:
    """Return ``n_obs - 1`` gaps by cycling ``pattern``."""
    if n_obs < 1:
        raise ValueError("n_obs must be at least 1")
    repeated = (pattern[index % len(pattern)] for index in range(n_obs - 1))
    return tuple(islice(repeated, n_obs - 1))


def _timestamps(gaps_days: tuple[float, ...], start: datetime) -> tuple[datetime, ...]:
    """Turn a gap list into absolute instants."""
    stamps = [start]
    cumulative = 0.0
    for gap in gaps_days:
        cumulative += gap
        stamps.append(start + timedelta(days=cumulative))
    return tuple(stamps)


def linear_series(
    *,
    start_kg: float = 80.0,
    rate_kg_per_day: float = -0.05,
    gaps_days: tuple[float, ...],
    noise_sd_kg: float = 0.0,
    seed: int = 0,
    start: datetime = DEFAULT_START,
    label: str | None = None,
) -> SyntheticSeries:
    """Generate a latent weight moving at a constant rate, optionally observed with noise.

    Elapsed times are read back from the generated timestamps rather than from the
    nominal gap list, so the truth is exactly consistent with what the estimator will
    compute from those same timestamps.

    Args:
        start_kg: latent weight at the first observation.
        rate_kg_per_day: constant latent velocity. Zero gives a flat trajectory.
        gaps_days: intervals between consecutive observations.
        noise_sd_kg: measurement noise standard deviation. Zero gives noise-free data,
            which is what the recovery tests use.
        seed: seed for the measurement noise.
        start: instant of the first observation.
        label: scenario name; must contain "synthetic".
    """
    stamps = _timestamps(gaps_days, start)
    elapsed = tuple(DEFAULT_TIME_AXIS.elapsed_days(start, stamp) for stamp in stamps)
    true_weight = tuple(start_kg + rate_kg_per_day * days for days in elapsed)

    if noise_sd_kg > 0.0:
        rng = np.random.default_rng(seed)
        noise = rng.normal(0.0, noise_sd_kg, size=len(stamps))
    else:
        noise = np.zeros(len(stamps))

    observations = tuple(
        Observation(timestamp=stamp, weight_kg=weight + float(error))
        for stamp, weight, error in zip(stamps, true_weight, noise, strict=True)
    )
    resolved_label = label or (
        f"synthetic linear trend, {rate_kg_per_day:+.4f} kg/day, noise sd {noise_sd_kg:.3f} kg"
    )
    return SyntheticSeries(
        label=resolved_label,
        observations=observations,
        true_weight_kg=true_weight,
        true_velocity_kg_per_day=tuple(rate_kg_per_day for _ in stamps),
        elapsed_days=elapsed,
    )


def constant_series(
    *,
    weight_kg: float = 70.0,
    n_obs: int = 60,
    step_days: float = 1.0,
    noise_sd_kg: float = 0.0,
    seed: int = 0,
    start: datetime = DEFAULT_START,
) -> SyntheticSeries:
    """Generate a latent weight that does not change."""
    return linear_series(
        start_kg=weight_kg,
        rate_kg_per_day=0.0,
        gaps_days=regular_gaps(n_obs, step_days),
        noise_sd_kg=noise_sd_kg,
        seed=seed,
        start=start,
        label=f"synthetic constant weight at {weight_kg:.1f} kg",
    )


def gradual_loss_series(
    *,
    start_kg: float = 80.0,
    rate_kg_per_week: float = -0.35,
    n_obs: int = 120,
    step_days: float = 1.0,
    noise_sd_kg: float = 0.0,
    seed: int = 0,
    start: datetime = DEFAULT_START,
) -> SyntheticSeries:
    """Generate a steady, plausible weight loss expressed as a weekly rate."""
    rate_per_day = rate_kg_per_week / 7.0
    return linear_series(
        start_kg=start_kg,
        rate_kg_per_day=rate_per_day,
        gaps_days=regular_gaps(n_obs, step_days),
        noise_sd_kg=noise_sd_kg,
        seed=seed,
        start=start,
        label=f"synthetic gradual loss, {rate_kg_per_week:+.2f} kg/week",
    )


def irregular_loss_series(
    *,
    start_kg: float = 80.0,
    rate_kg_per_week: float = -0.35,
    n_obs: int = 60,
    noise_sd_kg: float = 0.0,
    seed: int = 0,
    start: datetime = DEFAULT_START,
    pattern: tuple[float, ...] = IRREGULAR_GAPS_DAYS,
) -> SyntheticSeries:
    """Generate the same steady loss, observed on a deliberately awkward schedule."""
    return linear_series(
        start_kg=start_kg,
        rate_kg_per_day=rate_kg_per_week / 7.0,
        gaps_days=irregular_gaps(n_obs, pattern),
        noise_sd_kg=noise_sd_kg,
        seed=seed,
        start=start,
        label=f"synthetic irregular loss, {rate_kg_per_week:+.2f} kg/week",
    )


def simultaneous_pair_series(
    *,
    start_kg: float = 72.0,
    first_kg: float = 72.4,
    second_kg: float = 71.9,
    lead_gap_days: float = 1.0,
    start: datetime = DEFAULT_START,
) -> SyntheticSeries:
    """Three observations, the last two recorded at exactly the same instant.

    Someone stepping on the scale twice in a row produces this. The interval between them
    is zero, which the transition and process-noise matrices handle exactly.
    """
    gaps = (lead_gap_days, 0.0)
    stamps = _timestamps(gaps, start)
    elapsed = tuple(DEFAULT_TIME_AXIS.elapsed_days(start, stamp) for stamp in stamps)
    weights = (start_kg, first_kg, second_kg)
    return SyntheticSeries(
        label="synthetic simultaneous weigh-in pair",
        observations=tuple(
            Observation(timestamp=stamp, weight_kg=weight)
            for stamp, weight in zip(stamps, weights, strict=True)
        ),
        true_weight_kg=tuple(start_kg for _ in stamps),
        true_velocity_kg_per_day=tuple(0.0 for _ in stamps),
        elapsed_days=elapsed,
    )


def model_consistent_series(
    params: ModelParams,
    *,
    n_obs: int = 50,
    step_days: float = 1.0,
    start_kg: float = 75.0,
    seed: int = 20250819,
    start: datetime = DEFAULT_START,
) -> SyntheticSeries:
    """Generate data drawn from the estimator's own assumptions.

    Simulates the state-space model exactly: the initial velocity comes from the same
    ``N(0, sigma_v0**2)`` prior the filter uses, state noise comes from ``Q(dt)`` via its
    Cholesky factor, and measurement noise from ``N(0, sigma_obs**2)``. The filter is
    therefore perfectly specified for this data, so its normalised innovations should
    behave like standard normal draws. That is the reference point every later calibration
    claim is measured against.

    **Keep the span short.** The local-linear-trend model has no mean reversion: velocity
    random-walks freely, so the standard deviation of the simulated weight grows like
    ``sigma_accel * sqrt(t**3 / 3)``. Over 2000 days that is roughly 400 kg, and the
    generator will produce physically impossible weights that :class:`Observation`
    rightly rejects. That is a true property of the model, not a bug in the simulator,
    and it is exactly why the product forecasts 30 days rather than 3 years. For
    calibration, average over many short draws with
    :func:`model_consistent_ensemble` instead of taking one long one.
    """
    rng = np.random.default_rng(seed)
    gaps = regular_gaps(n_obs, step_days)
    stamps = _timestamps(gaps, start)
    elapsed = tuple(DEFAULT_TIME_AXIS.elapsed_days(start, stamp) for stamp in stamps)

    state = np.array([start_kg, rng.normal(0.0, params.sigma_v0)], dtype=np.float64)
    true_weight = [float(state[0])]
    true_velocity = [float(state[1])]
    weights = [float(state[0] + rng.normal(0.0, params.sigma_obs_kg))]

    for index in range(1, len(stamps)):
        dt_days = elapsed[index] - elapsed[index - 1]
        factor = np.linalg.cholesky(process_noise(dt_days, params))
        state = transition_matrix(dt_days) @ state + factor @ rng.standard_normal(2)
        true_weight.append(float(state[0]))
        true_velocity.append(float(state[1]))
        weights.append(float(state[0] + rng.normal(0.0, params.sigma_obs_kg)))

    return SyntheticSeries(
        label=f"synthetic model-consistent draw, seed {seed}",
        observations=tuple(
            Observation(timestamp=stamp, weight_kg=weight)
            for stamp, weight in zip(stamps, weights, strict=True)
        ),
        true_weight_kg=tuple(true_weight),
        true_velocity_kg_per_day=tuple(true_velocity),
        elapsed_days=elapsed,
    )


def model_consistent_ensemble(
    params: ModelParams,
    *,
    n_series: int = 40,
    n_obs: int = 50,
    step_days: float = 1.0,
    start_kg: float = 75.0,
    base_seed: int = 20250819,
    start: datetime = DEFAULT_START,
) -> tuple[SyntheticSeries, ...]:
    """Generate many independent short draws from the model.

    The right shape for a calibration check. One long trajectory both diverges (see
    :func:`model_consistent_series`) and yields autocorrelated diagnostics; independent
    replications give the same number of innovations over spans the model can plausibly
    describe, and they are genuinely independent.

    Seeds are derived as ``base_seed + index``, so the ensemble is reproducible.
    """
    if n_series < 1:
        raise ValueError("n_series must be at least 1")
    return tuple(
        model_consistent_series(
            params,
            n_obs=n_obs,
            step_days=step_days,
            start_kg=start_kg,
            seed=base_seed + index,
            start=start,
        )
        for index in range(n_series)
    )
