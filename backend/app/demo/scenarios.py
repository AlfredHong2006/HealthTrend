"""Generators for the five demo scenarios, and the registry that names them.

Two design decisions here are load-bearing.

**A scenario is anchored to the current instant, not to a fixed date.** The last observation
lands ``_TRAILING_LAG_DAYS`` before the clock's ``now``, and the rest of the series runs
backwards from there. This matters more than it looks: a series anchored to a fixed date in
the past accumulates lead time, and because the forecast variance carries a
``sigma_accel**2 * tau**3 / 3`` term (see :mod:`app.core.forecast`), a demo generated a year
ago would return an interval tens of kilograms wide. Mathematically correct, and a useless
first impression. Seeds are fixed, so the *shape* of a scenario is always the same; only the
dates move with the clock, and a fixed clock makes the whole thing byte-reproducible.

**The latent path is piecewise-constant in velocity.** A plateau is "minus 0.45 kg/week for
seventy days, then zero", and a reversal is "down, then up". Integrating those segments gives
a continuous weight path with no jumps, which is what a real trajectory looks like -- and it
gives the local-linear-trend estimator exactly the structure it is known to track with a lag
(``docs/mathematics.md`` section 8.6). The demo therefore shows an honest limitation rather
than hiding it.

The measurement noise is Gaussian and seeded. Note that the ``noisy`` scenario uses a
standard deviation well above the estimator's own ``sigma_obs`` prior of 0.5 kg: the filter
is then genuinely misspecified for that series and will smooth less than it ideally should.
That is deliberate. The priors are unfitted (ADR-0003), and a demo that only ever showed
data matching them would be flattering rather than informative.
"""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from itertools import islice
from types import MappingProxyType
from typing import Final

import numpy as np

from app.core.types import Observation
from app.core.units import per_week_to_per_day
from app.errors import UnknownScenarioError

_TRAILING_LAG_DAYS: Final = 0.25
"""How long before ``now`` the most recent demo weigh-in sits, in days.

Six hours. Nobody steps on the scale at the exact instant a page loads, and a small
non-zero lead means the demo also exercises the forecast-origin machinery of ADR-0005
instead of always hitting the degenerate zero-lead case.
"""

_IRREGULAR_GAP_PATTERN: Final = (0.5, 3.0, 1.0, 14.0, 0.25, 7.0, 21.0, 2.0, 0.75, 5.0)
"""A deliberately awkward weigh-in rhythm: twice in a day, then a three-week silence."""

_DAILY_GAP_PATTERN: Final = (1.0,)


@dataclass(frozen=True, slots=True)
class Segment:
    """A stretch of time over which the latent weight moves at a constant weekly rate.

    Attributes:
        days: duration of the segment. The final segment of a scenario uses ``math.inf``
            so that it covers whatever remains of the series.
        rate_kg_per_week: latent velocity during the segment, in product units.
    """

    days: float
    rate_kg_per_week: float

    @property
    def rate_kg_per_day(self) -> float:
        """The rate in the core's internal units."""
        return per_week_to_per_day(self.rate_kg_per_week)


@dataclass(frozen=True, slots=True)
class ScenarioSpec:
    """The fixed definition of one demo scenario.

    Attributes:
        scenario_id: URL identifier, used as the path parameter.
        title: short human-readable name.
        description: one line explaining what the scenario demonstrates.
        start_kg: latent weight at the first observation.
        segments: the piecewise-constant velocity schedule.
        n_obs: number of observations generated.
        gap_pattern: intervals between consecutive observations, cycled as needed.
        noise_sd_kg: measurement-noise standard deviation.
        seed: seed for that noise, fixed so the shape is reproducible.
    """

    scenario_id: str
    title: str
    description: str
    start_kg: float
    segments: tuple[Segment, ...]
    n_obs: int
    gap_pattern: tuple[float, ...]
    noise_sd_kg: float
    seed: int

    @property
    def label(self) -> str:
        """A provenance label that always identifies the data as synthetic."""
        return f"synthetic {self.title.lower()} (seed {self.seed})"

    @property
    def parameters(self) -> Mapping[str, float | int | str]:
        """A JSON-friendly record of exactly what generated the series.

        Deliberately does not name the Python module or function that implements the
        generator: an internal code path is not a stable public identifier, and renaming a
        function must never be an API break. The scenario id, the seed and these arguments
        are the reproduction recipe; where the code lives is documented in ADR-0007.
        """
        schedule = ", ".join(
            f"{segment.rate_kg_per_week:+.2f} kg/week"
            + ("" if math.isinf(segment.days) else f" for {segment.days:g} d")
            for segment in self.segments
        )
        return MappingProxyType(
            {
                "seed": self.seed,
                "n_obs": self.n_obs,
                "start_kg": self.start_kg,
                "noise_sd_kg": self.noise_sd_kg,
                "velocity_schedule": schedule,
                "gap_pattern_days": ", ".join(f"{gap:g}" for gap in self.gap_pattern),
                "trailing_lag_days": _TRAILING_LAG_DAYS,
            }
        )


@dataclass(frozen=True, slots=True)
class DemoSeries:
    """A generated series, with the provenance needed to present it honestly.

    Attributes:
        spec: the scenario definition that produced this series.
        observations: the generated weigh-ins, chronological, in kg and UTC.
    """

    spec: ScenarioSpec
    observations: tuple[Observation, ...]

    def __post_init__(self) -> None:
        """Refuse to exist unless the series is labelled synthetic.

        The same guard :class:`testing.synthetic.SyntheticSeries` applies, for the same
        reason: generated data must never be capable of being mistaken for measurements
        (``docs/privacy.md``).
        """
        if "synthetic" not in self.spec.label.lower():
            raise ValueError(
                "a demo series must be labelled synthetic so it can never be mistaken "
                "for real measurements"
            )


_SPECS: Final = (
    ScenarioSpec(
        scenario_id="gradual-loss",
        title="Gradual loss",
        description="A steady downward trend under ordinary day-to-day measurement noise.",
        start_kg=82.0,
        segments=(Segment(math.inf, -0.35),),
        n_obs=120,
        gap_pattern=_DAILY_GAP_PATTERN,
        noise_sd_kg=0.4,
        seed=101,
    ),
    ScenarioSpec(
        scenario_id="plateau",
        title="Plateau",
        description=(
            "Sustained loss that flattens out, which a local-linear trend tracks with a lag."
        ),
        start_kg=84.5,
        segments=(Segment(70.0, -0.45), Segment(math.inf, 0.0)),
        n_obs=120,
        gap_pattern=_DAILY_GAP_PATTERN,
        noise_sd_kg=0.4,
        seed=102,
    ),
    ScenarioSpec(
        scenario_id="reversal",
        title="Reversal",
        description="Loss that turns into gain, so the estimated velocity has to change sign.",
        start_kg=86.0,
        segments=(Segment(80.0, -0.5), Segment(math.inf, 0.3)),
        n_obs=140,
        gap_pattern=_DAILY_GAP_PATTERN,
        noise_sd_kg=0.4,
        seed=103,
    ),
    ScenarioSpec(
        scenario_id="noisy",
        title="Noisy readings",
        description=(
            "A modest real trend buried in large daily fluctuation, above the assumed noise."
        ),
        start_kg=78.0,
        segments=(Segment(math.inf, -0.25),),
        n_obs=90,
        gap_pattern=_DAILY_GAP_PATTERN,
        noise_sd_kg=1.0,
        seed=104,
    ),
    ScenarioSpec(
        scenario_id="irregular",
        title="Irregular weigh-ins",
        description="The same trend seen through twice-daily readings and three-week silences.",
        start_kg=80.0,
        segments=(Segment(math.inf, -0.3),),
        n_obs=45,
        gap_pattern=_IRREGULAR_GAP_PATTERN,
        noise_sd_kg=0.5,
        seed=105,
    ),
)

_REGISTRY: Final[Mapping[str, ScenarioSpec]] = MappingProxyType(
    {spec.scenario_id: spec for spec in _SPECS}
)

SCENARIO_IDS: Final = tuple(spec.scenario_id for spec in _SPECS)
"""The registered scenario identifiers, in catalogue order."""


def catalogue() -> tuple[ScenarioSpec, ...]:
    """Return every registered scenario, without generating any data."""
    return _SPECS


def spec_for(scenario_id: str) -> ScenarioSpec:
    """Return the named scenario definition.

    Raises:
        UnknownScenarioError: if nothing is registered under ``scenario_id``.
    """
    try:
        return _REGISTRY[scenario_id]
    except KeyError as exc:
        raise UnknownScenarioError(scenario_id) from exc


def generate(scenario_id: str, now: datetime) -> DemoSeries:
    """Generate the named scenario so that its last weigh-in sits just before ``now``.

    Args:
        scenario_id: one of :data:`SCENARIO_IDS`.
        now: the current instant, supplied by the caller's clock. Must be timezone-aware.

    Returns:
        A :class:`DemoSeries` whose observations are chronological, in kg and UTC.

    Raises:
        UnknownScenarioError: if nothing is registered under ``scenario_id``.
    """
    spec = spec_for(scenario_id)
    elapsed = _elapsed_days(spec.n_obs, spec.gap_pattern)
    span_days = elapsed[-1]
    first = now - timedelta(days=_TRAILING_LAG_DAYS + span_days)

    rng = np.random.default_rng(spec.seed)
    noise = (
        rng.normal(0.0, spec.noise_sd_kg, size=spec.n_obs)
        if spec.noise_sd_kg > 0.0
        else np.zeros(spec.n_obs)
    )

    observations = tuple(
        Observation(
            timestamp=first + timedelta(days=days),
            weight_kg=_weight_at(spec, days) + float(error),
        )
        for days, error in zip(elapsed, noise, strict=True)
    )
    return DemoSeries(spec=spec, observations=observations)


def _elapsed_days(n_obs: int, gap_pattern: Sequence[float]) -> tuple[float, ...]:
    """Return days since the first observation, one entry per observation."""
    if n_obs < 1:
        raise ValueError("n_obs must be at least 1")
    gaps = islice((gap_pattern[index % len(gap_pattern)] for index in range(n_obs - 1)), n_obs - 1)
    elapsed = [0.0]
    for gap in gaps:
        elapsed.append(elapsed[-1] + gap)
    return tuple(elapsed)


def _weight_at(spec: ScenarioSpec, days: float) -> float:
    """Integrate the piecewise-constant velocity schedule out to ``days``."""
    weight = spec.start_kg
    remaining = days
    for segment in spec.segments:
        step = min(remaining, segment.days)
        weight += segment.rate_kg_per_day * step
        remaining -= step
        if remaining <= 0.0:
            return weight
    # Past the end of the schedule, the final segment's rate continues.
    return weight + spec.segments[-1].rate_kg_per_day * remaining
