"""E1: whether the filter's log-likelihood equals the one the model implies.

The filter accumulates a log-likelihood from innovations, one observation at a time.
:mod:`evaluation.exact_likelihood` computes the same quantity from the joint Gaussian
density of the whole observation vector, using the model's marginal covariances and a
single Cholesky factorisation. The two share nothing but the model definition.

Three implementations are compared at every point of the battery:

1. :func:`app.core.filter.run_filter` -- the shipped recursion.
2. :func:`evaluation.mle.innovations_loglik` -- the lean recursion every fit optimises.
3. :func:`evaluation.exact_likelihood.direct_loglik` -- the oracle.

and, separately, the forecast moments: :func:`app.core.forecast.forecast_at` propagates
the filter's final posterior, while
:func:`evaluation.exact_likelihood.direct_latent_forecast` conditions the joint Gaussian
of the observations and the future latent weight. Same number, different route.

**This experiment gates the rest of M6.** E3, E4 and E5 all select parameters by
maximising a likelihood; if the likelihood is wrong, every estimate downstream is wrong in
a way no amount of replication would reveal.

**What the first full run found, and what was done about it.** Six of 810 cases exceeded
the ``1e-8`` agreement tolerance, all of them at ``n = 300`` with condition numbers above
``5e9``. In every one, the filter and the lean recursion agreed with *each other* to
better than ``1e-15`` while both differed from the oracle by ``3e-8`` -- which is the
signature of the oracle being the inaccurate party, not the estimator. Recomputing the
worst case at 60 significant digits with :func:`evaluation.exact_likelihood.decimal_loglik`
settled it: the filter was accurate to ``7.4e-13`` and the float64 oracle wrong by
``3.7e-5``.

So the criterion was wrong, not the code, and it is now two criteria:

- **Strict, unconditional.** The filter and the lean fitting objective must agree to
  ``1e-10`` relative on every case. Both are ``O(n)`` recursions with no conditioning
  problem, this is the comparison that actually guards the thing E3 to E5 optimise, and it
  is not allowed to be relaxed for any reason.
- **Oracle, where the oracle can speak.** Agreement to ``1e-8`` relative is required on
  every case whose covariance condition number is at or below
  :data:`ORACLE_CONDITION_LIMIT`. Above that the case is still run and still reported, but
  classified as ill-conditioned rather than counted as a failure.

The classification is not a widened tolerance dressed up. It is the statement that a
double-precision ``O(n**3)`` factorisation of a matrix with condition number ``1e10`` has
about five digits left, and cannot adjudicate a comparison at the eighth -- while the
filter has meanwhile been confirmed correct to ``1e-12`` by exact arithmetic, which is a
stronger result than the one the float64 oracle was ever able to deliver.
"""

from __future__ import annotations

from typing import Any, Final

import numpy as np

from app.core.filter import run_filter
from app.core.forecast import forecast_at
from app.core.types import ModelParams, Observation
from evaluation.common import SEED_BASES, RunConfig
from evaluation.exact_likelihood import direct_latent_forecast, direct_loglik, joint_moments
from evaluation.mle import innovations_loglik, prepare_series
from testing.synthetic import IRREGULAR_GAPS_DAYS, linear_series

PARAM_FACTORS: Final = (0.25, 1.0, 4.0)
"""Multipliers applied to each default prior, giving 27 parameter combinations."""

GAP_PATTERNS: Final[dict[str, tuple[float, ...]]] = {
    "daily": (1.0,),
    "twice_daily": (0.25,),
    "weekly": (7.0,),
    "irregular": IRREGULAR_GAPS_DAYS,
    "duplicated": (0.0, 1.0),
}
"""Gap cycles. ``duplicated`` puts pairs of readings at the same instant, giving ``dt = 0``.

The zero-gap pattern is built here rather than drawn from
:func:`testing.synthetic.model_consistent_series`, which refuses zero gaps because
``Q(0)`` is the zero matrix and has no Cholesky factor. The filter handles ``dt = 0``
exactly -- it degenerates to two consecutive updates -- and so must the oracle, so the
case is constructed directly from a gap cycle containing a zero.
"""

FULL_LENGTHS: Final = (2, 3, 5, 10, 60, 300)
SMOKE_LENGTHS: Final = (2, 3, 10)

FORECAST_HORIZONS: Final = (7.0, 30.0, 90.0)

RELATIVE_TOLERANCE: Final = 1.0e-8
"""Agreement required against the oracle, on cases the oracle can adjudicate.

Scaled by ``max(1, |loglik|)``, so it is a relative tolerance where the value is large and
an absolute one where it is small.
"""

RECURSION_TOLERANCE: Final = 1.0e-10
"""Agreement required between the filter and the lean fitting objective, on every case.

Stricter than the oracle tolerance and unconditional, because both are ``O(n)`` recursions
with no conditioning problem and this is the comparison that guards what E3 to E5 actually
optimise. The measured maximum across the full battery is far below it.
"""

ORACLE_CONDITION_LIMIT: Final = 1.0e8
"""Covariance condition number above which the float64 oracle is not treated as arbiter.

Chosen from measurement, not taste. The first full run disagreed only above ``5e9``, and
exact-arithmetic recomputation showed the oracle -- not the filter -- was the party in
error there, by seven orders of magnitude. ``1e8`` sits a factor of fifty below the
lowest observed disagreement, so every case it admits has ample precision in hand.
"""

# A slow drift, chosen so that even the longest battery case -- 300 weekly readings, 2093
# days -- stays comfortably above zero and inside what Observation accepts.
SERIES_START_KG: Final = 80.0
SERIES_RATE_KG_PER_DAY: Final = -0.002
SERIES_NOISE_SD_KG: Final = 0.4


def parameter_grid(factors: tuple[float, ...]) -> tuple[tuple[str, ModelParams], ...]:
    """Return every combination of the three priors scaled by ``factors``, with labels."""
    default = ModelParams.default()
    combinations: list[tuple[str, ModelParams]] = []
    for obs_factor in factors:
        for accel_factor in factors:
            for v0_factor in factors:
                label = f"obs*{obs_factor:g} accel*{accel_factor:g} v0*{v0_factor:g}"
                combinations.append(
                    (
                        label,
                        ModelParams(
                            sigma_obs_kg=default.sigma_obs_kg * obs_factor,
                            sigma_accel=default.sigma_accel * accel_factor,
                            sigma_v0=default.sigma_v0 * v0_factor,
                        ),
                    )
                )
    return tuple(combinations)


def _gaps(pattern: tuple[float, ...], n_obs: int) -> tuple[float, ...]:
    """Return ``n_obs - 1`` gaps by cycling ``pattern``."""
    return tuple(pattern[index % len(pattern)] for index in range(n_obs - 1))


def build_case(pattern_name: str, n_obs: int, seed: int) -> tuple[Observation, ...]:
    """Return one battery series. The data-generating process is irrelevant to E1.

    E1 asks whether two computations of the same density agree on the same numbers, which
    is an algebraic question. The series only has to be a valid, non-degenerate set of
    observations at the requested spacing.
    """
    series = linear_series(
        start_kg=SERIES_START_KG,
        rate_kg_per_day=SERIES_RATE_KG_PER_DAY,
        gaps_days=_gaps(GAP_PATTERNS[pattern_name], n_obs),
        noise_sd_kg=SERIES_NOISE_SD_KG,
        seed=seed,
        label=f"synthetic E1 battery, {pattern_name}, n={n_obs}",
    )
    return series.observations


def _condition_number(observations: tuple[Observation, ...], params: ModelParams) -> float:
    """Return the 2-norm condition number of the oracle's covariance matrix."""
    _, covariance = joint_moments(observations, params)
    return float(np.linalg.cond(covariance))


def compare_case(
    observations: tuple[Observation, ...],
    params: ModelParams,
) -> dict[str, float]:
    """Return every discrepancy for one battery case, unrounded."""
    result = run_filter(observations, params)
    oracle = direct_loglik(observations, params)
    lean = innovations_loglik(
        prepare_series(observations),
        params.sigma_obs_kg,
        params.sigma_accel,
        params.sigma_v0,
    )

    scale = max(1.0, abs(oracle))
    comparison = {
        "loglik": oracle,
        "filter_abs_diff": abs(result.loglik - oracle),
        "filter_rel_diff": abs(result.loglik - oracle) / scale,
        "lean_abs_diff": abs(lean - oracle),
        "lean_rel_diff": abs(lean - oracle) / scale,
        "recursion_abs_diff": abs(result.loglik - lean),
        "recursion_rel_diff": abs(result.loglik - lean) / scale,
        "condition_number": _condition_number(observations, params),
    }

    mean_diff = 0.0
    variance_rel_diff = 0.0
    noise_diff = 0.0
    for horizon in FORECAST_HORIZONS:
        expected_mean, expected_variance = direct_latent_forecast(observations, params, horizon)
        point = forecast_at(result.final, params, horizon)
        mean_diff = max(mean_diff, abs(point.w_kg - expected_mean))
        variance_rel_diff = max(
            variance_rel_diff,
            abs(point.w_sd * point.w_sd - expected_variance) / abs(expected_variance),
        )
        noisy = forecast_at(result.final, params, horizon, include_observation_noise=True)
        noise_diff = max(
            noise_diff,
            abs(noisy.w_sd * noisy.w_sd - (point.w_sd * point.w_sd + params.obs_variance)),
        )

    comparison["forecast_mean_abs_diff"] = mean_diff
    comparison["forecast_variance_rel_diff"] = variance_rel_diff
    comparison["forecast_observation_noise_abs_diff"] = noise_diff
    return comparison


def run(scale: str) -> dict[str, Any]:
    """Run the E1 battery and summarise every discrepancy."""
    factors = PARAM_FACTORS if scale == "full" else (0.25, 1.0)
    lengths = FULL_LENGTHS if scale == "full" else SMOKE_LENGTHS
    combinations = parameter_grid(factors)
    block = SEED_BASES["e1"]

    tracked = (
        "filter_abs_diff",
        "filter_rel_diff",
        "lean_abs_diff",
        "lean_rel_diff",
        "recursion_abs_diff",
        "recursion_rel_diff",
        "forecast_mean_abs_diff",
        "forecast_variance_rel_diff",
        "forecast_observation_noise_abs_diff",
    )
    worst: dict[str, dict[str, Any]] = {}
    conditioned_maxima: dict[str, float] = dict.fromkeys(tracked, 0.0)
    recursion_max = 0.0
    recursion_worst: dict[str, Any] = {}
    max_condition_number = 0.0
    n_cases = 0
    n_ill_conditioned = 0
    oracle_failures: list[dict[str, Any]] = []
    recursion_failures: list[dict[str, Any]] = []
    ill_conditioned: list[dict[str, Any]] = []

    for pattern_index, pattern_name in enumerate(GAP_PATTERNS):
        for length_index, n_obs in enumerate(lengths):
            seed = block.at(pattern_index * len(FULL_LENGTHS) + length_index)
            observations = build_case(pattern_name, n_obs, seed)
            for params_label, params in combinations:
                comparison = compare_case(observations, params)
                n_cases += 1
                condition_number = comparison["condition_number"]
                max_condition_number = max(max_condition_number, condition_number)
                identity = {
                    "params": params_label,
                    "gap_pattern": pattern_name,
                    "n_obs": n_obs,
                    "condition_number": condition_number,
                }

                # The strict gate applies everywhere: two O(n) recursions have no excuse.
                if comparison["recursion_rel_diff"] > recursion_max:
                    recursion_max = comparison["recursion_rel_diff"]
                    recursion_worst = {**identity, "value": recursion_max}
                if comparison["recursion_rel_diff"] > RECURSION_TOLERANCE:
                    recursion_failures.append(
                        {**identity, "recursion_rel_diff": comparison["recursion_rel_diff"]}
                    )

                if condition_number > ORACLE_CONDITION_LIMIT:
                    n_ill_conditioned += 1
                    ill_conditioned.append(
                        {
                            **identity,
                            "filter_rel_diff": comparison["filter_rel_diff"],
                            "lean_rel_diff": comparison["lean_rel_diff"],
                            "recursion_rel_diff": comparison["recursion_rel_diff"],
                        }
                    )
                    continue

                for key in tracked:
                    if comparison[key] > conditioned_maxima[key]:
                        conditioned_maxima[key] = comparison[key]
                        worst[key] = {**identity, "value": comparison[key]}
                if max(comparison["filter_rel_diff"], comparison["lean_rel_diff"]) > (
                    RELATIVE_TOLERANCE
                ):
                    oracle_failures.append(
                        {
                            **identity,
                            "filter_rel_diff": comparison["filter_rel_diff"],
                            "lean_rel_diff": comparison["lean_rel_diff"],
                        }
                    )

    ill_conditioned.sort(key=lambda case: -case["filter_rel_diff"])
    results: dict[str, Any] = {
        "n_cases": n_cases,
        "n_well_conditioned": n_cases - n_ill_conditioned,
        "n_ill_conditioned": n_ill_conditioned,
        "oracle_relative_tolerance": RELATIVE_TOLERANCE,
        "recursion_relative_tolerance": RECURSION_TOLERANCE,
        "oracle_condition_limit": ORACLE_CONDITION_LIMIT,
        "max_condition_number": max_condition_number,
        "max_recursion_rel_diff": recursion_max,
        "worst_recursion_case": recursion_worst,
        "well_conditioned_maxima": conditioned_maxima,
        "well_conditioned_worst_cases": worst,
        "n_oracle_failures": len(oracle_failures),
        "oracle_failures": oracle_failures[:20],
        "n_recursion_failures": len(recursion_failures),
        "recursion_failures": recursion_failures[:20],
        "ill_conditioned_cases": ill_conditioned[:20],
        "recursions_agree": not recursion_failures,
        "oracle_agrees_where_conditioned": not oracle_failures,
        "gate_passed": not recursion_failures and not oracle_failures,
    }
    config = RunConfig.build(
        "e1",
        scale,
        seed_keys=("e1",),
        grid={
            "param_factors": list(factors),
            "gap_patterns": list(GAP_PATTERNS),
            "lengths": list(lengths),
            "forecast_horizons_days": list(FORECAST_HORIZONS),
        },
    )
    return {"_config": config, "results": results}
