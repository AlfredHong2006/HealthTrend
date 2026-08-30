"""The eight regimes E5 compares methods across, and where it asks them to forecast.

Each regime breaks a different assumption, and the set is chosen so that the estimator is
neither uniformly flattered nor uniformly disadvantaged:

=================  ==========================================================
regime             what it asks of a method
=================  ==========================================================
``model_correct``  nothing it was not built for; the estimator's best case
``flat``           notice that nothing is happening, and do not invent a trend
``steady_loss``    follow a constant rate through noise
``plateau``        stop following a trend that has ended
``curvature``      track a rate that is always changing
``jump``           follow a real discontinuity in latent weight
``irregular``      handle awkward spacing, where index-based windows go wrong
``outliers``       survive 5% contaminated readings
=================  ==========================================================

Only ``model_correct`` draws its hidden trajectory from the estimator's own assumptions;
the other seven are misspecified on purpose, because a study that only measured the
best case would establish nothing anybody should act on.

**The truth is fixed within a regime and only the measurement noise varies across series.**
That makes the paired comparisons sharp -- two methods see identical trajectories -- and it
makes the per-regime tuning in E5 explicitly generous to the baselines: a tuned EWMA gets
window parameters chosen for this exact shape, while the shipped estimator gets the same
documented priors it ships with and no tuning at all. Any regime where the shipped
estimator still wins, it wins against a baseline that was handed an advantage; any regime
where it loses, the loss is real but the margin is an upper bound on what a baseline would
achieve without knowing the shape in advance. Both readings belong in the report.

Forecast origins are observation indices, never arbitrary instants, because
:class:`~testing.synthetic.SyntheticSeries` carries the hidden trajectory only at the
instants it generated. Interpolating a truth between two observations would be wrong for
every regime and catastrophically wrong for ``model_correct``, where the latent path
between observations is a Brownian bridge and not a straight line.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from app.core.types import ModelParams
from evaluation.common import SeedRange
from testing.synthetic import (
    IRREGULAR_GAPS_DAYS,
    SyntheticSeries,
    constant_series,
    contaminate,
    curvature_series,
    gradual_loss_series,
    irregular_loss_series,
    jump_series,
    model_consistent_series,
    plateau_series,
)

REGIMES: Final = (
    "model_correct",
    "flat",
    "steady_loss",
    "plateau",
    "curvature",
    "jump",
    "irregular",
    "outliers",
)
"""The eight regimes, in the order the report tables use."""

REGULAR_N_OBS: Final = 120
"""Daily observations per series in the seven regularly-spaced regimes: four months."""

IRREGULAR_N_OBS: Final = 60
"""Observations in the irregular regime. The fixed gap cycle averages 5.45 days, so this
spans about 322 days -- longer in calendar time than the daily regimes, on a third as many
readings, which is the point.
"""

NOISE_SD_KG: Final = 0.5
"""Measurement noise, set to the shipped ``sigma_obs`` prior.

The estimator is therefore correctly specified about its measurement noise in every
regime, and any misspecification the study finds is about the trend, not the scale.
"""

CONTAMINATION_RATE: Final = 0.05
CONTAMINATION_MAGNITUDES_KG: Final = (3.0, 5.0)

FORECAST_HORIZON_DAYS: Final = 30.0
ORIGIN_FRACTIONS: Final = (0.50, 0.625, 0.75)
"""Where in each series the forecasts are made from, as fractions of its span.

Three origins, placed late enough that the filter has data to work with and early enough
that a 30-day target still exists. They are aggregated within a series before anything is
compared across series, because three forecasts from one trajectory are strongly
correlated and treating them as independent would understate every interval.
"""


@dataclass(frozen=True, slots=True)
class OriginTarget:
    """One forecast task: forecast from ``origin_index`` to ``target_index``.

    Attributes:
        origin_index: last observation a method may see. Everything after it is withheld.
        target_index: the observation whose latent truth is the forecast target.
        horizon_days: the achieved horizon, at least
            :data:`FORECAST_HORIZON_DAYS` but longer where the schedule has a gap.
    """

    origin_index: int
    target_index: int
    horizon_days: float


@dataclass(frozen=True, slots=True)
class RegimeSuite:
    """A set of series drawn for one regime, tagged with the seeds that produced them.

    The seed range is carried so that a tuner can refuse data it should not be tuning on.
    A train/test split enforced by convention is a split that eventually stops holding;
    one carried on the data itself fails loudly instead.

    Attributes:
        regime: which of :data:`REGIMES` this is.
        series: the drawn series.
        seed_lo: first seed used, inclusive.
        seed_hi: last seed used, inclusive.
        split: ``"train"`` or ``"test"``.
    """

    regime: str
    series: tuple[SyntheticSeries, ...]
    seed_lo: int
    seed_hi: int
    split: str

    @property
    def n_series(self) -> int:
        """Number of series in the suite."""
        return len(self.series)

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serialisable view of the provenance, not the data."""
        return {
            "regime": self.regime,
            "split": self.split,
            "n_series": self.n_series,
            "seed_range": [self.seed_lo, self.seed_hi],
        }


def _draw(regime: str, seed: int, params: ModelParams) -> SyntheticSeries:
    """Draw one series for ``regime`` at ``seed``."""
    if regime == "model_correct":
        return model_consistent_series(
            params, n_obs=REGULAR_N_OBS, step_days=1.0, start_kg=80.0, seed=seed
        )
    if regime == "flat":
        return constant_series(
            weight_kg=75.0, n_obs=REGULAR_N_OBS, noise_sd_kg=NOISE_SD_KG, seed=seed
        )
    if regime == "steady_loss":
        return gradual_loss_series(
            start_kg=80.0,
            rate_kg_per_week=-0.35,
            n_obs=REGULAR_N_OBS,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "plateau":
        return plateau_series(
            start_kg=84.0,
            rate_kg_per_week=-0.45,
            break_day=60.0,
            n_obs=REGULAR_N_OBS,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "curvature":
        return curvature_series(
            start_kg=82.0,
            floor_kg=76.0,
            time_constant_days=60.0,
            n_obs=REGULAR_N_OBS,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "jump":
        return jump_series(
            start_kg=80.0,
            rate_kg_per_week=-0.35,
            jump_day=60.0,
            jump_kg=-2.5,
            n_obs=REGULAR_N_OBS,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
    if regime == "irregular":
        return irregular_loss_series(
            start_kg=80.0,
            rate_kg_per_week=-0.35,
            n_obs=IRREGULAR_N_OBS,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
            pattern=IRREGULAR_GAPS_DAYS,
        )
    if regime == "outliers":
        clean = gradual_loss_series(
            start_kg=80.0,
            rate_kg_per_week=-0.35,
            n_obs=REGULAR_N_OBS,
            noise_sd_kg=NOISE_SD_KG,
            seed=seed,
        )
        return contaminate(
            clean,
            rate=CONTAMINATION_RATE,
            magnitudes_kg=CONTAMINATION_MAGNITUDES_KG,
            seed=seed,
        )
    raise ValueError(f"unknown regime {regime!r}")


def regime_suite(
    regime: str,
    *,
    n_series: int,
    block: SeedRange,
    split: str,
    offset: int = 0,
    params: ModelParams | None = None,
) -> RegimeSuite:
    """Draw ``n_series`` series for one regime from a named seed block.

    Args:
        regime: one of :data:`REGIMES`.
        n_series: how many independent series to draw.
        block: the seed block to draw from; train and test blocks are disjoint.
        split: ``"train"`` or ``"test"``, recorded on the suite.
        offset: where in the block to start, so that regimes do not share seeds.
        params: the model to simulate for ``model_correct``; defaults to the priors.
    """
    if regime not in REGIMES:
        raise ValueError(f"unknown regime {regime!r}")
    resolved = ModelParams.default() if params is None else params
    seeds = [block.at(offset + index) for index in range(n_series)]
    return RegimeSuite(
        regime=regime,
        series=tuple(_draw(regime, seed, resolved) for seed in seeds),
        seed_lo=seeds[0],
        seed_hi=seeds[-1],
        split=split,
    )


def suites_for_split(
    *,
    n_series: int,
    block: SeedRange,
    split: str,
    params: ModelParams | None = None,
) -> dict[str, RegimeSuite]:
    """Draw one suite per regime, giving each regime a disjoint slice of the block."""
    return {
        regime: regime_suite(
            regime,
            n_series=n_series,
            block=block,
            split=split,
            offset=index * n_series,
            params=params,
        )
        for index, regime in enumerate(REGIMES)
    }


def forecast_origins(
    series: SyntheticSeries,
    *,
    horizon_days: float = FORECAST_HORIZON_DAYS,
    fractions: tuple[float, ...] = ORIGIN_FRACTIONS,
) -> tuple[OriginTarget, ...]:
    """Return the forecast tasks for one series.

    For each fraction of the span, the origin is the observation nearest to it and the
    target is the first observation at least ``horizon_days`` later. On a daily schedule
    the achieved horizon is exactly 30 days; on the irregular schedule it is whatever the
    next reading after 30 days happens to be, which is recorded rather than smoothed over.

    An origin whose target would fall past the end of the series is dropped, so a method is
    never scored against a truth that does not exist.
    """
    elapsed = series.elapsed_days
    span = elapsed[-1]
    tasks: list[OriginTarget] = []
    seen: set[tuple[int, int]] = set()
    for fraction in fractions:
        wanted = fraction * span
        origin_index = min(range(len(elapsed)), key=lambda i: abs(elapsed[i] - wanted))
        deadline = elapsed[origin_index] + horizon_days
        target_index = next(
            (
                index
                for index in range(origin_index + 1, len(elapsed))
                if elapsed[index] >= deadline
            ),
            None,
        )
        if target_index is None:
            continue
        key = (origin_index, target_index)
        if key in seen:
            continue
        seen.add(key)
        tasks.append(
            OriginTarget(
                origin_index=origin_index,
                target_index=target_index,
                horizon_days=elapsed[target_index] - elapsed[origin_index],
            )
        )
    return tuple(tasks)
