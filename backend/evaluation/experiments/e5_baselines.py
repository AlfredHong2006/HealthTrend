"""E5: whether the estimator earns its complexity against much simpler methods.

The question a state-space model has to answer before it deserves to ship: does it beat a
seven-day average? E5 asks it across eight regimes and six methods, on two metrics that
measure genuinely different things.

**One-step-ahead, in observation space.** How well does each method predict the next
reading? Computable on real data, which makes it the metric that could one day be repeated
outside a simulation. It is also the metric that rewards the wrong thing if taken alone: a
method is scored against a *noisy* reading, so predicting the noise would score perfectly
and predicting the latent weight cannot. A pure smoother and a good estimator look more
alike here than they are.

**Thirty-day ahead, against the latent truth.** What the product actually claims to do.
Only computable because the data is synthetic and the hidden trajectory is known, and it is
where the methods separate: a level-only method must forecast flat, which on any sustained
trend is wrong by the trend times thirty days.

Reporting both is the point. Either alone would mislead, in opposite directions.

**The comparison is deliberately generous to the baselines.** Each of them gets its window
or time constant chosen by grid search on a training split drawn from the same regime, and
the fitted Kalman gets its two parameters by maximum likelihood on that split. The shipped
estimator gets the documented priors it ships with and no tuning at all. So a regime where
the shipped estimator still wins, it wins against methods handed an advantage no real
deployment could give them; a regime where it loses, the loss is real but the margin is an
upper bound on what an untuned baseline would manage. Both readings belong in the report.

**Inference is paired and clustered by series.** Every method sees the same series, the
same burn-in and the same evaluation indices, so the per-series difference against the
shipped estimator removes the trajectory and the noise realisation from the comparison and
leaves the method. Series are the independent unit; the observations inside one are not.

**Intervals are reported only where they exist.** LOCF, moving average, EWMA and Holt
produce point predictions and nothing else. Attaching an interval to them would require
inventing an error model none of them has, so the interval table has two rows, not six.
That is an honest gap in the comparison and is labelled as one rather than filled in.
"""

from __future__ import annotations

import math
from typing import Any, Final

from app.core.filter import run_filter
from app.core.forecast import forecast_at
from app.core.types import Z_95, ModelParams
from evaluation.baselines import (
    BURN_IN,
    METHODS,
    REFERENCE_METHOD,
    absolute_errors,
    build_runs,
    squared_errors,
    tuned_parameters,
)
from evaluation.common import SEED_BASES, RunConfig
from evaluation.metrics import ClusterSummary, cluster_summary
from evaluation.mle import prepare_series
from evaluation.scenarios import (
    FORECAST_HORIZON_DAYS,
    REGIMES,
    RegimeSuite,
    forecast_origins,
    suites_for_split,
)

FULL_TRAIN_SERIES: Final = 30
FULL_TEST_SERIES: Final = 100
SMOKE_TRAIN_SERIES: Final = 4
SMOKE_TEST_SERIES: Final = 6


def _fitted_params(tuned: dict[str, Any]) -> ModelParams:
    """Rebuild the fitted filter's parameters from the tuning record."""
    return ModelParams(
        sigma_obs_kg=tuned["kalman_fitted"]["sigma_obs_kg"],
        sigma_accel=tuned["kalman_fitted"]["sigma_accel"],
        sigma_v0=tuned["kalman_fitted"]["sigma_v0"],
    )


def _one_step_scores(
    suite: RegimeSuite,
    tuned: dict[str, Any],
    shipped: ModelParams,
) -> dict[str, dict[str, list[float]]]:
    """Per-series one-step mean squared and mean absolute error, for every method."""
    scores: dict[str, dict[str, list[float]]] = {
        method: {"mse": [], "mae": []} for method in METHODS
    }
    for series in suite.series:
        prepared = prepare_series(series.observations)
        runs = build_runs(series.observations, tuned, shipped)
        for method, run in runs.items():
            squared = squared_errors(run, prepared)
            absolute = absolute_errors(run, prepared)
            scores[method]["mse"].append(math.fsum(squared) / len(squared))
            scores[method]["mae"].append(math.fsum(absolute) / len(absolute))
    return scores


def _forecast_scores(
    suite: RegimeSuite,
    tuned: dict[str, Any],
    shipped: ModelParams,
) -> tuple[dict[str, list[float]], list[float], dict[str, list[float]]]:
    """Per-series 30-day latent forecast error, achieved horizons, and interval coverage.

    Each series contributes one number per method: the mean absolute error over its
    origins. Averaging within the series first is not a convenience -- three forecasts made
    from one trajectory are strongly correlated, and treating them as independent
    observations would shrink every interval in the table by roughly the square root of
    three for no reason.
    """
    fitted = _fitted_params(tuned)
    errors: dict[str, list[float]] = {method: [] for method in METHODS}
    coverage: dict[str, list[float]] = {"kalman_shipped": [], "kalman_fitted": []}
    horizons: list[float] = []

    for series in suite.series:
        tasks = forecast_origins(series)
        if not tasks:
            continue
        per_method: dict[str, list[float]] = {method: [] for method in METHODS}
        inside: dict[str, list[float]] = {"kalman_shipped": [], "kalman_fitted": []}

        for task in tasks:
            horizons.append(task.horizon_days)
            visible = series.observations[: task.origin_index + 1]
            truth = series.true_weight_kg[task.target_index]

            runs = build_runs(visible, tuned, shipped)
            for method, run in runs.items():
                if method not in inside:
                    per_method[method].append(abs(run.forecast(task.horizon_days) - truth))

            # The two Kalman variants forecast through the shipped propagation rather than
            # through a straight-line extrapolation of the same state. The two are identical
            # for a linear model -- test EV6 checks it -- but routing the comparison through
            # `forecast_at` means E5 measures the code the product runs, and the point and
            # its interval then come from one call rather than two that could drift apart.
            for name, params in (("kalman_shipped", shipped), ("kalman_fitted", fitted)):
                result = run_filter(visible, params)
                point = forecast_at(result.final, params, task.horizon_days)
                per_method[name].append(abs(point.w_kg - truth))
                inside[name].append(float(abs(point.w_kg - truth) <= Z_95 * point.w_sd))

        for method, values in per_method.items():
            errors[method].append(math.fsum(values) / len(values))
        for name, flags in inside.items():
            coverage[name].append(math.fsum(flags) / len(flags))

    return errors, horizons, coverage


def _one_step_coverage(
    suite: RegimeSuite,
    tuned: dict[str, Any],
    shipped: ModelParams,
) -> dict[str, list[float]]:
    """Per-series share of readings inside the filter's own one-step predictive interval.

    Only the two Kalman variants appear: they are the only methods that state an interval.
    On the misspecified regimes this is where the cost of a model that cannot represent the
    trajectory becomes visible as something other than a slightly larger error.
    """
    fitted = _fitted_params(tuned)
    coverage: dict[str, list[float]] = {"kalman_shipped": [], "kalman_fitted": []}
    for series in suite.series:
        for name, params in (("kalman_shipped", shipped), ("kalman_fitted", fitted)):
            result = run_filter(series.observations, params)
            flags = [
                float(abs(step.normalized_innovation) <= Z_95)
                for step in result.steps[max(0, BURN_IN - 1) :]
            ]
            coverage[name].append(math.fsum(flags) / len(flags))
    return coverage


def _paired(values: dict[str, list[float]]) -> dict[str, Any]:
    """Summarise each method and its paired difference against the shipped estimator.

    A negative difference means the method beat the shipped estimator on that metric. The
    interval comes from the spread of per-series differences, so it accounts for the fact
    that both methods saw the same trajectories.
    """
    reference = values[REFERENCE_METHOD]
    summarised: dict[str, Any] = {}
    for method, series_values in values.items():
        summary: ClusterSummary = cluster_summary(series_values)
        entry: dict[str, Any] = {"score": summary.to_dict()}
        if method != REFERENCE_METHOD:
            differences = [
                value - baseline for value, baseline in zip(series_values, reference, strict=True)
            ]
            difference = cluster_summary(differences)
            entry["difference_vs_shipped"] = difference.to_dict()
            entry["beats_shipped"] = difference.ci_hi < 0.0
            entry["loses_to_shipped"] = difference.ci_lo > 0.0
        summarised[method] = entry
    return summarised


def run_regime(
    regime: str,
    train: RegimeSuite,
    test: RegimeSuite,
    shipped: ModelParams,
) -> dict[str, Any]:
    """Tune on the training suite, then score every method on the test suite."""
    tuned = tuned_parameters(train, sigma_v0=shipped.sigma_v0)
    one_step = _one_step_scores(test, tuned, shipped)
    forecast_errors, horizons, forecast_coverage = _forecast_scores(test, tuned, shipped)
    step_coverage = _one_step_coverage(test, tuned, shipped)

    return {
        "regime": regime,
        "tuned": tuned,
        "test_seed_range": [test.seed_lo, test.seed_hi],
        "n_test_series": test.n_series,
        "one_step": {
            "mse": _paired({method: one_step[method]["mse"] for method in METHODS}),
            "mae": _paired({method: one_step[method]["mae"] for method in METHODS}),
        },
        "forecast30": {
            "mae": _paired(forecast_errors),
            "achieved_horizon_days": {
                "min": min(horizons),
                "max": max(horizons),
                "mean": math.fsum(horizons) / len(horizons),
            },
        },
        "kalman_intervals": {
            "one_step_coverage": {
                name: cluster_summary(values).to_dict() for name, values in step_coverage.items()
            },
            "forecast30_coverage": {
                name: cluster_summary(values).to_dict()
                for name, values in forecast_coverage.items()
            },
            "note": (
                "Only the two Kalman variants state an interval. LOCF, moving average, EWMA "
                "and Holt produce point predictions with no error model, so no coverage is "
                "reported for them rather than one being invented."
            ),
        },
    }


def summarise(regimes: dict[str, Any]) -> dict[str, Any]:
    """Collect which methods beat the shipped estimator where, and on which metric.

    Written to be readable as a headline, because the headline is the honest one: the
    shipped estimator is not expected to win everywhere, and a summary that buried the
    regimes where it loses would be the wrong summary.

    Losses are split by who inflicted them, because they mean different things. Being beaten
    by ``kalman_fitted`` says the *parameters* are not optimal for that regime -- the model
    is fine, the priors are generic. Being beaten by a moving average says something much
    stronger: that the extra structure is not paying for itself there at all. Counting the
    two together would let the first quietly inflate the second.
    """
    beats: list[str] = []
    loses: list[str] = []
    simple_beats: list[str] = []
    for regime, entry in regimes.items():
        for metric_path, metric in (
            ("one_step.mae", entry["one_step"]["mae"]),
            ("forecast30.mae", entry["forecast30"]["mae"]),
        ):
            for method, values in metric.items():
                if method == REFERENCE_METHOD:
                    continue
                if values.get("beats_shipped"):
                    beats.append(f"{regime}/{metric_path}/{method}")
                    if not method.startswith("kalman"):
                        simple_beats.append(f"{regime}/{metric_path}/{method}")
                elif values.get("loses_to_shipped"):
                    loses.append(f"{regime}/{metric_path}/{method}")

    regimes_lost_to_simple = sorted({entry.split("/")[0] for entry in simple_beats})
    return {
        "methods_beating_shipped": sorted(beats),
        "simple_baselines_beating_shipped": sorted(simple_beats),
        "methods_losing_to_shipped": sorted(loses),
        "regimes_where_a_simple_baseline_wins": regimes_lost_to_simple,
        "n_beating_shipped": len(beats),
        "n_simple_baselines_beating_shipped": len(simple_beats),
        "n_losing_to_shipped": len(loses),
        "n_comparisons": sum(2 * (len(METHODS) - 1) for _ in regimes),
    }


def run(scale: str) -> dict[str, Any]:
    """Tune on the training split and compare every method on the test split."""
    shipped = ModelParams.default()
    if scale == "full":
        n_train, n_test = FULL_TRAIN_SERIES, FULL_TEST_SERIES
    else:
        n_train, n_test = SMOKE_TRAIN_SERIES, SMOKE_TEST_SERIES

    train_suites = suites_for_split(n_series=n_train, block=SEED_BASES["e5_train"], split="train")
    test_suites = suites_for_split(n_series=n_test, block=SEED_BASES["e5_test"], split="test")

    regimes = {
        regime: run_regime(regime, train_suites[regime], test_suites[regime], shipped)
        for regime in REGIMES
    }
    headline = summarise(regimes)

    results: dict[str, Any] = {
        "regimes": regimes,
        "summary": headline,
        "n_comparisons": headline["n_comparisons"],
        "n_beating_shipped": headline["n_beating_shipped"],
        "n_simple_baselines_beating_shipped": headline["n_simple_baselines_beating_shipped"],
        "n_losing_to_shipped": headline["n_losing_to_shipped"],
        "burn_in_index": BURN_IN,
        "forecast_horizon_days": FORECAST_HORIZON_DAYS,
    }
    config = RunConfig.build(
        "e5",
        scale,
        seed_keys=("e5_train", "e5_test"),
        grid={
            "regimes": list(REGIMES),
            "methods": list(METHODS),
            "reference_method": REFERENCE_METHOD,
            "n_train_series": n_train,
            "n_test_series": n_test,
            "burn_in_index": BURN_IN,
            "forecast_horizon_days": FORECAST_HORIZON_DAYS,
        },
    )
    return {"_config": config, "results": results}
