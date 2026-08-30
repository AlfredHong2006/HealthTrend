"""E2: whether the estimator is calibrated on data drawn from its own assumptions.

This is the narrowest question in M6 and the one with the clearest right answer. The data
comes from the model the filter assumes, with the parameters the filter uses, so the
posterior *is* the exact conditional distribution of the state. Coverage must be 95%, the
normalised innovations must have unit mean square, and the normalised estimation error must
average two. Not approximately for a good filter and less so for a worse one -- exactly, up
to Monte Carlo noise, or something is wrong with the implementation.

What that means for interpretation cuts both ways, and the report says both:

- A failure here is a bug. It cannot be a modelling limitation, because there is no
  modelling error to be limited by. The response is to find the defect, never to adjust a
  prior until the number improves.
- A pass here establishes nothing whatever about real weight data. It validates the
  implementation and the arithmetic, and ``docs/mathematics.md`` has said so since
  Milestone 1. E5 is where misspecification gets measured; this is where the instrument
  gets checked before being pointed at anything.

Two configurations, differing in one thing: whether the readings are evenly spaced. The
process-noise matrix satisfies ``F(b) Q(a) F(b)' + Q(b) == Q(a + b)``, so irregular spacing
is claimed to be exact rather than approximated. The irregular configuration is what turns
that claim into a measurement -- it uses the deliberately awkward fixed cycle from
:data:`testing.synthetic.IRREGULAR_GAPS_DAYS`, which runs from two readings in one day to a
three-week silence.

**The stop criterion is deliberately not "a 95% interval missed".** Eight statistics are
checked across two configurations; under a correct implementation the chance that at least
one interval misses is around a third. Treating a single marginal miss as proof of a defect
would guarantee a false alarm most of the time the study is run, and the natural response to
a false alarm -- look harder until something is found to change -- is how a correct
implementation gets quietly broken. So the criterion is a coherent failure or a large one:
four standard errors, or three of eight misses, or the same statistic missing in the same
direction in both configurations. A lone marginal miss is reported honestly and rechecked on
the fresh seed block reserved for exactly that purpose.
"""

from __future__ import annotations

from typing import Any, Final

from app.core.filter import run_filter
from app.core.types import ModelParams
from evaluation.common import SEED_BASES, RunConfig, SeedRange
from evaluation.metrics import (
    ClusterSummary,
    SeriesDiagnostics,
    cluster_summary,
    quantiles,
    series_diagnostics,
    summarise_checks,
)
from testing.synthetic import IRREGULAR_GAPS_DAYS, irregular_gaps, model_consistent_ensemble

FULL_N_SERIES: Final = 500
SMOKE_N_SERIES: Final = 12

DAILY_N_OBS: Final = 60
"""Daily readings per series: 59 days, over which the model's own spread is about 2 kg."""

IRREGULAR_N_OBS: Final = 23
"""Readings per series on the irregular cycle: 22 gaps, about 112 days.

Shorter than the 322 days that 60 irregular readings would span, and deliberately so. The
local-linear-trend model has no mean reversion, so the standard deviation of a simulated
weight grows like ``sigma_accel sqrt(t**3 / 3)`` -- 27 kg over 322 days, at which point a
meaningful share of draws wander to physically impossible weights that
:class:`~app.core.types.Observation` rightly refuses. Discarding those draws would condition
the ensemble on staying positive and bias the very coverage being measured. Keeping the span
where the model is plausible avoids the problem rather than correcting for it.
"""

QUANTILE_PROBABILITIES: Final = (0.05, 0.5, 0.95)

NOMINAL_COVERAGE: Final = 0.95
NOMINAL_ANIS: Final = 1.0
NOMINAL_ANEES: Final = 2.0

INVESTIGATION_SE_THRESHOLD: Final = 4.0
"""Deviation, in standard errors, beyond which a statistic is not Monte Carlo noise.

Four standard errors is a two-sided p-value below ``1e-4``; across eight checks the chance
of one arising by accident is under a thousandth.
"""

INVESTIGATION_MISS_COUNT: Final = 3
"""Number of 95% interval misses across the eight checks that stops being a coincidence.

Under a correct implementation each check misses with probability 0.05, so three or more of
eight happens about once in 850 runs.
"""


def _run_config(
    label: str,
    n_series: int,
    n_obs: int,
    block: SeedRange,
    gaps_days: tuple[float, ...] | None,
    params: ModelParams,
) -> dict[str, Any]:
    """Draw one ensemble, filter it and summarise every diagnostic."""
    ensemble = model_consistent_ensemble(
        params,
        n_series=n_series,
        n_obs=n_obs,
        start_kg=80.0,
        base_seed=block.base,
        gaps_days=gaps_days,
    )
    diagnostics: list[SeriesDiagnostics] = [
        series_diagnostics(series, run_filter(series.observations, params)) for series in ensemble
    ]

    checks: dict[str, tuple[ClusterSummary, float]] = {
        "coverage_w": (
            cluster_summary([d.coverage_w for d in diagnostics]),
            NOMINAL_COVERAGE,
        ),
        "coverage_v": (
            cluster_summary([d.coverage_v for d in diagnostics]),
            NOMINAL_COVERAGE,
        ),
        "anis": (cluster_summary([d.anis for d in diagnostics]), NOMINAL_ANIS),
        "anees": (cluster_summary([d.anees for d in diagnostics]), NOMINAL_ANEES),
    }

    inside_w = sum(d.inside_w for d in diagnostics)
    inside_v = sum(d.inside_v for d in diagnostics)
    total_posteriors = sum(d.n_posteriors for d in diagnostics)
    total_steps = sum(d.n_steps for d in diagnostics)

    return {
        "label": label,
        "n_series": n_series,
        "n_obs": n_obs,
        "span_days": ensemble[0].elapsed_days[-1],
        "seed_range": [block.base, block.base + n_series - 1],
        "pooled": {
            "inside_w": inside_w,
            "inside_v": inside_v,
            "n_posteriors": total_posteriors,
            "n_steps": total_steps,
            "coverage_w": inside_w / total_posteriors,
            "coverage_v": inside_v / total_posteriors,
        },
        "spread_across_series": {
            "anis": quantiles([d.anis for d in diagnostics], QUANTILE_PROBABILITIES),
            "anees": quantiles([d.anees for d in diagnostics], QUANTILE_PROBABILITIES),
            "coverage_w": quantiles([d.coverage_w for d in diagnostics], QUANTILE_PROBABILITIES),
        },
        **summarise_checks(checks),
    }


def assess(configurations: list[dict[str, Any]]) -> dict[str, Any]:
    """Apply the stop criterion to the finished configurations.

    Returns the verdict and every input to it, so a reader can disagree with the threshold
    without having to rerun anything.
    """
    misses: list[str] = []
    large: list[dict[str, Any]] = []
    directions: dict[str, set[str]] = {}

    for configuration in configurations:
        label = configuration["label"]
        for name, contained in configuration["ci_contains_nominal"].items():
            deviation = configuration["deviation_in_se"][name]
            if not contained:
                misses.append(f"{label}.{name}")
                directions.setdefault(name, set()).add("high" if deviation > 0 else "low")
            if abs(deviation) > INVESTIGATION_SE_THRESHOLD:
                large.append({"check": f"{label}.{name}", "deviation_in_se": deviation})

    coherent = sorted(
        name
        for name, seen in directions.items()
        if len(seen) == 1 and sum(1 for miss in misses if miss.endswith(f".{name}")) > 1
    )

    reasons: list[str] = []
    if large:
        reasons.append(
            f"{len(large)} statistic(s) beyond {INVESTIGATION_SE_THRESHOLD} standard errors"
        )
    if len(misses) >= INVESTIGATION_MISS_COUNT:
        reasons.append(f"{len(misses)} of 8 interval checks missed")
    if coherent:
        reasons.append(f"both configurations missed {', '.join(coherent)} in the same direction")

    return {
        "n_checks": sum(len(c["ci_contains_nominal"]) for c in configurations),
        "n_interval_misses": len(misses),
        "interval_misses": misses,
        "large_deviations": large,
        "coherent_misses": coherent,
        "investigation_se_threshold": INVESTIGATION_SE_THRESHOLD,
        "investigation_miss_count": INVESTIGATION_MISS_COUNT,
        "investigate": bool(reasons),
        "reasons": reasons,
    }


def run(scale: str) -> dict[str, Any]:
    """Run both calibration configurations and apply the stop criterion."""
    n_series = FULL_N_SERIES if scale == "full" else SMOKE_N_SERIES
    params = ModelParams.default()

    configurations = [
        _run_config(
            "daily",
            n_series,
            DAILY_N_OBS,
            SEED_BASES["e2_daily"],
            None,
            params,
        ),
        _run_config(
            "irregular",
            n_series,
            IRREGULAR_N_OBS,
            SEED_BASES["e2_irregular"],
            irregular_gaps(IRREGULAR_N_OBS, IRREGULAR_GAPS_DAYS),
            params,
        ),
    ]
    verdict = assess(configurations)

    results: dict[str, Any] = {
        "configurations": configurations,
        "assessment": verdict,
        "investigate": verdict["investigate"],
        "n_interval_misses": verdict["n_interval_misses"],
    }
    config = RunConfig.build(
        "e2",
        scale,
        seed_keys=("e2_daily", "e2_irregular", "e2_recheck"),
        grid={
            "n_series": n_series,
            "daily_n_obs": DAILY_N_OBS,
            "irregular_n_obs": IRREGULAR_N_OBS,
            "irregular_pattern_days": list(IRREGULAR_GAPS_DAYS),
            "nominal": {
                "coverage": NOMINAL_COVERAGE,
                "anis": NOMINAL_ANIS,
                "anees": NOMINAL_ANEES,
            },
        },
    )
    return {"_config": config, "results": results}
