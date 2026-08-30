"""Simple methods to compare the estimator against, all of them time-aware.

**Every window here is measured in days, never in observations.** That is not a detail. A
seven-point moving average over the fixed cycle in
:data:`testing.synthetic.IRREGULAR_GAPS_DAYS` averages readings spanning anywhere from two
days to seven weeks depending on where in the cycle it lands, so an index-based baseline on
irregular data is not a seven-day average that performs poorly -- it is a different method
at every point in the series, and comparing the estimator against it would measure the
comparison's own defect. Test ``EV6`` checks the distinction by running an index-weighted
variant alongside and confirming it gives a different answer.

The four baselines, in increasing order of what they assume:

``LOCF``
    The last reading, carried forward. No smoothing at all, so on noisy data it inherits
    the full measurement error -- and on a genuine level jump it is the fastest possible
    responder. Both facts show up in E5.
``moving average``
    The mean of readings within a window. Smooths, but weights a reading from the edge of
    the window as heavily as the most recent one, and drops it entirely one day later.
``EWMA``
    Exponentially weighted by elapsed time, ``exp(-dt / tau)``. Smooths without a cliff,
    but has no notion of a trend, so on any sustained slope it lags by construction.
``Holt``
    Exponential smoothing with a level *and* a trend, in continuous time.

Holt deserves a warning, stated before any results were computed. On a regular grid,
linear exponential smoothing is the steady-state form of exactly the local-linear-trend
model this product uses -- the two are the same predictor once the Kalman gain has
converged. So near-identical one-step accuracy between tuned Holt and a fitted Kalman on
daily data is a mathematical identity, not a finding, and reporting it as "the Kalman filter
adds nothing" would be a misreading. What the filter has that Holt does not: exact handling
of irregular gaps (Holt discounts per day, the filter integrates ``Q`` over the actual
interval), a principled transient before the gain settles, and a covariance -- so it can
state an interval, which none of these baselines can. E5 measures the first two and reports
the third as unavailable rather than inventing one.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Final

from app.core.filter import run_filter
from app.core.types import ModelParams
from evaluation.mle import PreparedSeries, fit, prepare_dataset, prepare_series
from evaluation.scenarios import RegimeSuite

BURN_IN: Final = 10
"""First observation index scored, for every method alike.

Ten readings in, the filter's transient has largely passed and every baseline has a
window's worth of history. Scoring earlier would mostly compare initialisation choices;
scoring different methods over different index sets would not be a comparison at all.
"""

MA_WINDOW_GRID_DAYS: Final = (3.0, 7.0, 14.0, 28.0)
EWMA_TAU_GRID_DAYS: Final = (1.0, 2.0, 4.0, 7.0, 14.0, 28.0, 45.0, 60.0)
HOLT_LEVEL_TAU_GRID_DAYS: Final = (1.0, 2.0, 4.0, 7.0, 14.0, 28.0, 60.0, 120.0)
HOLT_TREND_TAU_GRID_DAYS: Final = (3.0, 7.0, 14.0, 28.0, 60.0, 120.0, 240.0, 480.0)


@dataclass(frozen=True, slots=True)
class BaselineRun:
    """What a baseline produced on one series.

    Attributes:
        predictions: one-step-ahead prediction before each reading was seen. Index zero is
            ``None`` -- nothing precedes the first reading, and inventing a prediction for
            it would score a method on its initialisation rather than on its filtering.
        level: the final level estimate, the base of any forecast.
        trend: the final rate estimate in kg/day; zero for the methods that have none.
    """

    predictions: tuple[float | None, ...]
    level: float
    trend: float

    def forecast(self, horizon_days: float) -> float:
        """Return the forecast level ``horizon_days`` ahead of the last reading."""
        return self.level + self.trend * horizon_days


def _elapsed(prepared: PreparedSeries) -> list[float]:
    """Return cumulative days since the first reading."""
    days = [0.0]
    for gap in prepared.dt_days:
        days.append(days[-1] + gap)
    return days


def locf_run(prepared: PreparedSeries) -> BaselineRun:
    """Carry the last reading forward. No parameters, so nothing to tune."""
    values = prepared.y_kg
    predictions: list[float | None] = [None]
    predictions.extend(values[:-1])
    return BaselineRun(predictions=tuple(predictions), level=values[-1], trend=0.0)


def moving_average_run(prepared: PreparedSeries, window_days: float) -> BaselineRun:
    """Average the readings within ``window_days`` before each instant.

    A window that catches nothing -- which the 21-day silence in the irregular schedule
    guarantees will happen -- falls back to the last reading. The alternative, declining to
    predict, would drop exactly the hardest instants from the comparison and flatter every
    windowed method.
    """
    values = prepared.y_kg
    days = _elapsed(prepared)
    predictions: list[float | None] = [None]
    for index in range(1, len(values)):
        cutoff = days[index] - window_days
        inside = [values[j] for j in range(index) if days[j] >= cutoff]
        predictions.append(sum(inside) / len(inside) if inside else values[index - 1])

    cutoff = days[-1] - window_days
    trailing = [values[j] for j in range(len(values)) if days[j] >= cutoff]
    return BaselineRun(
        predictions=tuple(predictions),
        level=sum(trailing) / len(trailing),
        trend=0.0,
    )


def ewma_run(prepared: PreparedSeries, tau_days: float) -> BaselineRun:
    """Exponentially weight readings by elapsed time, with time constant ``tau_days``.

    The update weight is ``1 - exp(-dt / tau)``: a reading after a long silence largely
    replaces the level, one taken minutes later barely moves it. An index-based EWMA would
    apply the same weight to both.
    """
    values = prepared.y_kg
    level = values[0]
    predictions: list[float | None] = [None]
    for index, gap in enumerate(prepared.dt_days, start=1):
        predictions.append(level)
        weight = 1.0 - math.exp(-gap / tau_days) if gap > 0.0 else 0.0
        level += weight * (values[index] - level)
    return BaselineRun(predictions=tuple(predictions), level=level, trend=0.0)


def holt_run(
    prepared: PreparedSeries,
    tau_level_days: float,
    tau_trend_days: float,
) -> BaselineRun:
    """Exponential smoothing with a level and a trend, in continuous time.

    Initialised at the first reading with a trend of zero, matching what the filter does
    for the same reason: one measurement carries no information about a rate, and starting
    anywhere else would be inventing one.

    A zero-length gap leaves the trend untouched -- the rate over no elapsed time is not a
    quantity -- and updates the level not at all, since the exponential weight is zero.
    Without that guard two readings at the same instant would divide by zero.
    """
    values = prepared.y_kg
    level = values[0]
    trend = 0.0
    predictions: list[float | None] = [None]
    for index, gap in enumerate(prepared.dt_days, start=1):
        prediction = level + trend * gap
        predictions.append(prediction)
        if gap <= 0.0:
            continue
        level_weight = 1.0 - math.exp(-gap / tau_level_days)
        trend_weight = 1.0 - math.exp(-gap / tau_trend_days)
        previous_level = level
        level = prediction + level_weight * (values[index] - prediction)
        trend = trend_weight * (level - previous_level) / gap + (1.0 - trend_weight) * trend
    return BaselineRun(predictions=tuple(predictions), level=level, trend=trend)


def index_weighted_ewma_run(prepared: PreparedSeries, span: float) -> BaselineRun:
    """Run an EWMA that counts observations instead of days: a control, not a baseline.

    Used only by test ``EV6``, to demonstrate that the time-aware methods really are time
    aware: on irregular spacing this gives a different answer, and on regular spacing it
    gives the same one.
    """
    values = prepared.y_kg
    weight = 1.0 - math.exp(-1.0 / span)
    level = values[0]
    predictions: list[float | None] = [None]
    for index in range(1, len(values)):
        predictions.append(level)
        level += weight * (values[index] - level)
    return BaselineRun(predictions=tuple(predictions), level=level, trend=0.0)


def kalman_run(prepared_observations: Sequence[Any], params: ModelParams) -> BaselineRun:
    """Run the shipped filter and expose it through the same interface as the baselines.

    The one-step predictions are the filter's own prior means -- what it believed just
    before each reading arrived -- so it is scored on exactly the quantity every baseline is
    scored on, with no allowance made for it being the method under test.

    :meth:`BaselineRun.forecast` extrapolates ``level + trend * horizon`` from these, which
    for a linear model is identical to :func:`app.core.forecast.forecast_at` -- test ``EV6``
    checks that. E5 nonetheless forecasts through ``forecast_at`` itself, so the comparison
    measures the shipped code path rather than an equivalent reimplementation of it.
    """
    result = run_filter(prepared_observations, params)
    predictions: list[float | None] = [None]
    predictions.extend(step.prior.w_kg for step in result.steps)
    return BaselineRun(
        predictions=tuple(predictions),
        level=result.final.w_kg,
        trend=result.final.v_kg_per_day,
    )


# ---------------------------------------------------------------------------
# Scoring and tuning
# ---------------------------------------------------------------------------


def signed_errors(
    run: BaselineRun, prepared: PreparedSeries, burn_in: int = BURN_IN
) -> list[float]:
    """Return signed one-step errors from ``burn_in`` onward, skipping absent predictions."""
    errors: list[float] = []
    for index in range(burn_in, prepared.n_obs):
        prediction = run.predictions[index]
        if prediction is not None:
            errors.append(prediction - prepared.y_kg[index])
    return errors


def squared_errors(
    run: BaselineRun, prepared: PreparedSeries, burn_in: int = BURN_IN
) -> list[float]:
    """Return squared one-step errors from ``burn_in`` onward."""
    return [error * error for error in signed_errors(run, prepared, burn_in)]


def absolute_errors(
    run: BaselineRun, prepared: PreparedSeries, burn_in: int = BURN_IN
) -> list[float]:
    """Return absolute one-step errors from ``burn_in`` onward."""
    return [abs(error) for error in signed_errors(run, prepared, burn_in)]


def _require_training_data(suite: RegimeSuite) -> None:
    """Refuse to tune on anything that is not the training split.

    The leakage guard. A train/test split maintained by remembering to pass the right
    argument is a split that holds until somebody refactors; one checked on the data
    itself fails loudly the first time it is violated.
    """
    if suite.split != "train":
        raise ValueError(
            f"tuning must use the training split, but this suite is labelled "
            f"{suite.split!r} (seeds {suite.seed_lo}-{suite.seed_hi})"
        )


def _pooled_mse(runs: Sequence[tuple[BaselineRun, PreparedSeries]]) -> float:
    """Mean squared one-step error pooled over the training series."""
    errors: list[float] = []
    for run, prepared in runs:
        errors.extend(squared_errors(run, prepared))
    return math.fsum(errors) / len(errors) if errors else math.inf


def tune_moving_average(suite: RegimeSuite) -> dict[str, float]:
    """Choose the window minimising pooled training one-step mean squared error."""
    _require_training_data(suite)
    dataset = prepare_dataset([series.observations for series in suite.series])
    scores = {
        window: _pooled_mse([(moving_average_run(p, window), p) for p in dataset])
        for window in MA_WINDOW_GRID_DAYS
    }
    best = min(scores, key=lambda window: scores[window])
    return {"window_days": best, "train_mse": scores[best]}


def tune_ewma(suite: RegimeSuite) -> dict[str, float]:
    """Choose the EWMA time constant minimising pooled training one-step error."""
    _require_training_data(suite)
    dataset = prepare_dataset([series.observations for series in suite.series])
    scores = {
        tau: _pooled_mse([(ewma_run(p, tau), p) for p in dataset]) for tau in EWMA_TAU_GRID_DAYS
    }
    best = min(scores, key=lambda tau: scores[tau])
    return {"tau_days": best, "train_mse": scores[best]}


def tune_holt(suite: RegimeSuite) -> dict[str, float]:
    """Choose both Holt time constants on the training split, by exhaustive grid search."""
    _require_training_data(suite)
    dataset = prepare_dataset([series.observations for series in suite.series])
    best_score = math.inf
    best = (HOLT_LEVEL_TAU_GRID_DAYS[0], HOLT_TREND_TAU_GRID_DAYS[0])
    for level_tau in HOLT_LEVEL_TAU_GRID_DAYS:
        for trend_tau in HOLT_TREND_TAU_GRID_DAYS:
            score = _pooled_mse([(holt_run(p, level_tau, trend_tau), p) for p in dataset])
            if score < best_score:
                best_score = score
                best = (level_tau, trend_tau)
    return {
        "tau_level_days": best[0],
        "tau_trend_days": best[1],
        "train_mse": best_score,
    }


def fit_kalman(suite: RegimeSuite, *, sigma_v0: float) -> dict[str, float]:
    """Fit the filter's two parameters by maximum likelihood on the training split.

    The estimand is deliberately "the best single fixed parameterisation for this regime",
    not a per-user fit: one set of parameters is chosen from the training series and applied
    unchanged to every test series. That is the strongest form the comparison can take
    while remaining something the product could in principle do, and it is still more than
    the shipped estimator gets, which is nothing.

    ``sigma_v0`` is held at the shipped value. E3 explains why it is not fitted.
    """
    _require_training_data(suite)
    dataset = prepare_dataset([series.observations for series in suite.series])
    fitted = fit(dataset, sigma_v0=sigma_v0)
    return {
        "sigma_obs_kg": fitted.sigma_obs_kg,
        "sigma_accel": fitted.sigma_accel,
        "sigma_v0": sigma_v0,
        "train_loglik": fitted.loglik,
        "sigma_accel_at_floor": fitted.at_lower_bound[1],
    }


def tuned_parameters(suite: RegimeSuite, *, sigma_v0: float) -> dict[str, Any]:
    """Tune every tunable method on one training suite, and record where it came from."""
    _require_training_data(suite)
    return {
        "moving_average": tune_moving_average(suite),
        "ewma": tune_ewma(suite),
        "holt": tune_holt(suite),
        "kalman_fitted": fit_kalman(suite, sigma_v0=sigma_v0),
        "train_seed_range": [suite.seed_lo, suite.seed_hi],
        "train_n_series": suite.n_series,
    }


def build_runs(
    observations: Sequence[Any],
    tuned: dict[str, Any],
    shipped: ModelParams,
) -> dict[str, BaselineRun]:
    """Run every method over one series, returning its predictions and final state."""
    prepared = prepare_series(observations)
    fitted_params = ModelParams(
        sigma_obs_kg=tuned["kalman_fitted"]["sigma_obs_kg"],
        sigma_accel=tuned["kalman_fitted"]["sigma_accel"],
        sigma_v0=tuned["kalman_fitted"]["sigma_v0"],
    )
    return {
        "locf": locf_run(prepared),
        "moving_average": moving_average_run(prepared, tuned["moving_average"]["window_days"]),
        "ewma": ewma_run(prepared, tuned["ewma"]["tau_days"]),
        "holt": holt_run(
            prepared, tuned["holt"]["tau_level_days"], tuned["holt"]["tau_trend_days"]
        ),
        "kalman_shipped": kalman_run(observations, shipped),
        "kalman_fitted": kalman_run(observations, fitted_params),
    }


METHODS: Final = (
    "locf",
    "moving_average",
    "ewma",
    "holt",
    "kalman_shipped",
    "kalman_fitted",
)
"""Every method compared, in the order the report tables use."""

REFERENCE_METHOD: Final = "kalman_shipped"
"""What the paired differences are measured against: the estimator as it ships."""
