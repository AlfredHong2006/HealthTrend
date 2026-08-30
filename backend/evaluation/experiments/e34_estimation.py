"""E3 and E4: what the data can and cannot say about the parameters.

Two views of one set of maximum-likelihood fits, computed once and reported twice:

``E3`` **identifiability**, across a grid of calendar span by observation count. How wide
    is the profile-likelihood interval for each parameter? How often does it run off the
    edge of the search space instead of closing? How often does the fitted process noise
    come to rest on its floor, and how often can the data reject "the trend never drifts"
    at all?

``E4`` **recovery**, on the daily diagonal at four times the replication. Bias and root
    mean squared error in ``log10`` units, each with its own Monte Carlo standard error --
    a bias reported without one is a number that cannot be distinguished from zero or from
    anything else. Plus the ``sigma_v0`` sensitivity sweep that ADR-0003 deferred to this
    milestone.

Both views come from the same cells because fitting is the expensive part and because two
commands writing one file is two ways for that file to mean different things on different
days. :func:`run` computes every cell exactly once and is the only writer of
``e34_estimation.json``.

**None of this changes the shipped parameters.** The product's priors are documented
choices, and E3 is largely an account of why fitting them per user would be a bad idea even
if the architecture allowed it: over a month of daily readings the process-noise intensity
is not identified to within two orders of magnitude, so a per-user maximum-likelihood
estimate would mostly be reporting the shape of its own search space.

**Two things this experiment does with boundaries, which are not the same thing.**
Profile intervals are built by inverting a two-sided test at ``CHI2_1_95``, appropriate for
covering a true value that lies in the interior -- which the truth does. Whether the data
can reject ``sigma_accel = 0`` is a different question, with the null on the *edge* of the
parameter space, where the likelihood-ratio statistic follows a 50:50 mixture and the
critical value is ``CHI2_MIX_95``. Both are reported, separately labelled. Conflating them
would overstate one and understate the other.

**A censored interval endpoint is counted at the bound, never dropped.** Dropping
replicates whose intervals failed to close would condition the coverage figure on the cases
where estimation happened to work, which is the one thing a study of when estimation works
must not do. Counting the interval as reaching the bound can only make coverage look better
than it is; the censoring rate is reported alongside so a reader can see how much of the
coverage is real and how much is an interval that never closed.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from typing import Any, Final

import numpy as np

from app.core.filter import run_filter
from app.core.forecast import forecast_at
from app.core.types import Z_95, CoreError, ModelParams
from evaluation.common import SEED_BASES, RunConfig
from evaluation.constants import CHI2_1_95, CHI2_MIX_95
from evaluation.metrics import cluster_summary
from evaluation.mle import (
    SEARCH_BOX,
    FitResult,
    fit,
    objective_discrepancy,
    prepare_series,
    profile_ci,
    q_zero_statistic,
)
from testing.synthetic import SyntheticSeries, model_consistent_series

SPANS_DAYS: Final = (30.0, 90.0, 365.0)
COUNTS: Final = (30, 120, 300)
DAILY_DIAGONAL: Final = ((29.0, 30), (119.0, 120), (299.0, 300))
"""Cells where the spacing is exactly one day, which is the case E4 reports on."""

FULL_GRID_REPLICATES: Final = 50
FULL_DIAGONAL_REPLICATES: Final = 200
SMOKE_REPLICATES: Final = 3

START_KG: Final = 80.0
SIGMA_V0_FACTORS: Final = (0.5, 1.0, 2.0)
SENSITIVITY_CELL: Final = (29.0, 30)
"""Where the ``sigma_v0`` estimation sweep runs: 30 daily readings."""

SENSITIVITY_COUNTS: Final = (2, 5, 10, 30)
"""Series lengths for the user-visible arm of the ``sigma_v0`` sweep.

ADR-0003 describes ``sigma_v0`` as governing "how confidently a trend is inferred from the
first few measurements", and flags it as the one prior with no principled source. *The
first few* is the operative phrase: by thirty daily readings the data has overwhelmed the
prior, so a sweep run only there would answer a question nobody asked and report reassuring
insensitivity. Two readings is where the prior does its work -- it is the entire reason two
points a week apart do not imply the trend their difference suggests -- so the sweep starts
there.
"""

MAX_REDRAWS: Final = 200
OBJECTIVE_TOLERANCE: Final = 1e-8
"""Largest tolerated gap between the fitting objective and ``run_filter`` at an optimum."""


@dataclass(frozen=True, slots=True)
class Cell:
    """One point of the span-by-count grid.

    Attributes:
        span_days: calendar time from first reading to last.
        n_obs: number of readings.
        n_replicates: independent series fitted at this cell.
        seed_offset: where this cell's seeds start within the E3/E4 block.
        on_diagonal: whether the spacing is exactly daily, making it an E4 cell.
    """

    span_days: float
    n_obs: int
    n_replicates: int
    seed_offset: int
    on_diagonal: bool

    @property
    def dt_days(self) -> float:
        """Spacing between consecutive readings."""
        return self.span_days / (self.n_obs - 1)

    @property
    def label(self) -> str:
        """Short identifier used as a dictionary key in the results."""
        return f"span{self.span_days:g}_n{self.n_obs}"


def build_cells(grid_replicates: int, diagonal_replicates: int) -> tuple[Cell, ...]:
    """Return every cell, each with its own disjoint slice of the seed block."""
    cells: list[Cell] = []
    offset = 0
    stride = max(grid_replicates, diagonal_replicates) + MAX_REDRAWS
    for span in SPANS_DAYS:
        for count in COUNTS:
            cells.append(
                Cell(
                    span_days=span,
                    n_obs=count,
                    n_replicates=grid_replicates,
                    seed_offset=offset,
                    on_diagonal=False,
                )
            )
            offset += stride
    for span, count in DAILY_DIAGONAL:
        cells.append(
            Cell(
                span_days=span,
                n_obs=count,
                n_replicates=diagonal_replicates,
                seed_offset=offset,
                on_diagonal=True,
            )
        )
        offset += stride
    return tuple(cells)


def draw_replicate(
    cell: Cell,
    replicate: int,
    params: ModelParams,
) -> tuple[SyntheticSeries, int]:
    """Draw one model-consistent series for a cell, redrawing if it wanders below zero.

    The model has no mean reversion, so the spread of a simulated weight grows like
    ``sigma_accel sqrt(t**3 / 3)`` -- about 33 kg over a year, from a start of 80. A draw
    that reaches zero is not a bug in the simulator but a true statement about the model,
    and :class:`~app.core.types.Observation` refuses it because a non-positive body weight
    is not a measurement.

    Replacements are drawn from a seed block no other experiment touches, and the count is
    reported per cell. This does condition the long-span cells on staying positive, which
    is a mild selection effect in the direction of smaller realised process noise; the
    honest response is to report how often it happened rather than to hide it or to weaken
    the check that caught it.

    Returns the series and how many redraws it took.
    """
    primary = SEED_BASES["e34"].at(cell.seed_offset + replicate)
    redraws = 0
    seed = primary
    while True:
        try:
            return (
                model_consistent_series(
                    params,
                    n_obs=cell.n_obs,
                    step_days=cell.dt_days,
                    start_kg=START_KG,
                    seed=seed,
                ),
                redraws,
            )
        except CoreError:
            redraws += 1
            if redraws > MAX_REDRAWS:
                raise
            seed = SEED_BASES["e34_redraw"].at(cell.seed_offset + replicate * MAX_REDRAWS + redraws)


def _replicate_record(
    series: SyntheticSeries,
    truth: tuple[float, float],
    sigma_v0: float,
) -> dict[str, Any]:
    """Fit one series, profile both parameters, and test the ``q = 0`` boundary."""
    prepared = [prepare_series(series.observations)]
    fitted: FitResult = fit(prepared, sigma_v0=sigma_v0)

    record: dict[str, Any] = {
        "log10_sigma_obs": fitted.log10_sigma_obs,
        "log10_sigma_accel": fitted.log10_sigma_accel,
        "accel_at_floor": fitted.at_lower_bound[1],
        "obs_at_bound": fitted.at_lower_bound[0] or fitted.at_upper_bound[0],
        "q_zero_statistic": q_zero_statistic(prepared, fitted),
        "objective_discrepancy": objective_discrepancy(
            series.observations,
            fitted.log10_sigma_obs,
            fitted.log10_sigma_accel,
            sigma_v0,
        ),
    }
    record["q_zero_rejected"] = record["q_zero_statistic"] > CHI2_MIX_95

    for index, name in enumerate(("sigma_obs", "sigma_accel")):
        interval = profile_ci(prepared, index, fitted, threshold=CHI2_1_95)
        record[f"ci_{name}"] = {
            **interval.to_dict(),
            "covers_truth": interval.contains(truth[index]),
        }
    return record


def _aggregate(records: list[dict[str, Any]], truth: tuple[float, float]) -> dict[str, Any]:
    """Summarise one cell's replicates into the quantities the report tables use."""
    summary: dict[str, Any] = {}
    for index, name in enumerate(("sigma_obs", "sigma_accel")):
        estimates = [record[f"log10_{name}"] for record in records]
        errors = [estimate - truth[index] for estimate in estimates]
        bias = cluster_summary(errors)
        intervals = [record[f"ci_{name}"] for record in records]
        covered = sum(1 for interval in intervals if interval["covers_truth"])
        summary[name] = {
            "median_log10": statistics.median(estimates),
            "iqr_log10": float(np.quantile(estimates, 0.75) - np.quantile(estimates, 0.25)),
            "median_ratio_to_truth": 10.0 ** (statistics.median(estimates) - truth[index]),
            "bias_log10": {
                "mean": bias.mean,
                "mc_se": bias.se,
                "ci_lo": bias.ci_lo,
                "ci_hi": bias.ci_hi,
                "distinguishable_from_zero": not bias.contains(0.0),
            },
            "rmse_log10": float(np.sqrt(np.mean(np.square(errors)))),
            "ci": {
                "mean_width_log10": float(np.mean([i["width"] for i in intervals])),
                "coverage": {"covered": covered, "total": len(intervals)},
                "coverage_rate": covered / len(intervals),
                "censor_lo_rate": sum(1 for i in intervals if i["lo_censored"]) / len(intervals),
                "censor_hi_rate": sum(1 for i in intervals if i["hi_censored"]) / len(intervals),
            },
        }
    summary["sigma_accel"]["floor_rate"] = sum(
        1 for record in records if record["accel_at_floor"]
    ) / len(records)
    summary["sigma_accel"]["q_zero_reject_rate"] = sum(
        1 for record in records if record["q_zero_rejected"]
    ) / len(records)
    summary["max_objective_discrepancy"] = max(
        record["objective_discrepancy"] for record in records
    )
    return summary


def run_cell(cell: Cell, truth: tuple[float, float], params: ModelParams) -> dict[str, Any]:
    """Fit every replicate at one cell and summarise them."""
    records: list[dict[str, Any]] = []
    redraws = 0
    for replicate in range(cell.n_replicates):
        series, extra = draw_replicate(cell, replicate, params)
        redraws += extra
        records.append(_replicate_record(series, truth, params.sigma_v0))
    return {
        "span_days": cell.span_days,
        "n_obs": cell.n_obs,
        "dt_days": cell.dt_days,
        "n_replicates": cell.n_replicates,
        "on_diagonal": cell.on_diagonal,
        "n_redraws": redraws,
        **_aggregate(records, truth),
    }


def sigma_v0_sensitivity(
    n_replicates: int,
    truth: tuple[float, float],
    params: ModelParams,
) -> dict[str, Any]:
    """Sweep the initial-velocity prior, which ADR-0003 called a judgement call.

    Two questions, because they have different audiences.

    *For the estimation:* if ``sigma_v0`` is held at the wrong value while the other two are
    fitted, how much bias does that push into them? This is the cost of a prior that cannot
    be estimated from the data it conditions.

    *For the user:* what does the choice do to the numbers a person actually sees -- the
    interval around their current weight, the interval around the weekly rate the product
    reports, and the width of the 30-day forecast band? Measured across
    :data:`SENSITIVITY_COUNTS`, starting at two readings, because that is where the prior
    is doing the work ADR-0003 credits it with. The shipped estimator is run with the
    shipped priors and only ``sigma_v0`` varied, so this is the visible consequence of the
    unvalidated choice rather than a statement about fitting.
    """
    cell = Cell(
        span_days=SENSITIVITY_CELL[0],
        n_obs=SENSITIVITY_CELL[1],
        n_replicates=n_replicates,
        seed_offset=0,
        on_diagonal=True,
    )
    ensemble = [draw_replicate(cell, replicate, params)[0] for replicate in range(n_replicates)]

    estimation: dict[str, Any] = {}
    for factor in SIGMA_V0_FACTORS:
        assumed_v0 = params.sigma_v0 * factor
        fits = [
            fit([prepare_series(series.observations)], sigma_v0=assumed_v0) for series in ensemble
        ]
        estimation[f"{factor:g}"] = {
            "sigma_v0_assumed": assumed_v0,
            "bias_log10_sigma_obs": cluster_summary(
                [f.log10_sigma_obs - truth[0] for f in fits]
            ).to_dict(),
            "bias_log10_sigma_accel": cluster_summary(
                [f.log10_sigma_accel - truth[1] for f in fits]
            ).to_dict(),
        }

    visible: dict[str, Any] = {}
    for n_obs in SENSITIVITY_COUNTS:
        prefix = Cell(
            span_days=float(n_obs - 1),
            n_obs=n_obs,
            n_replicates=n_replicates,
            seed_offset=0,
            on_diagonal=True,
        )
        short = [draw_replicate(prefix, replicate, params)[0] for replicate in range(n_replicates)]
        per_factor: dict[str, Any] = {}
        for factor in SIGMA_V0_FACTORS:
            assumed = ModelParams(
                sigma_obs_kg=params.sigma_obs_kg,
                sigma_accel=params.sigma_accel,
                sigma_v0=params.sigma_v0 * factor,
            )
            weight_widths: list[float] = []
            rate_widths: list[float] = []
            forecast_widths: list[float] = []
            for series in short:
                result = run_filter(series.observations, assumed)
                weight_widths.append(2.0 * Z_95 * result.final.w_sd)
                rate_widths.append(2.0 * Z_95 * result.final.weekly_rate_sd_kg)
                point = forecast_at(result.final, assumed, 30.0)
                forecast_widths.append(point.w_upper95 - point.w_lower95)
            per_factor[f"{factor:g}"] = {
                "sigma_v0_assumed": assumed.sigma_v0,
                "weight_ci_width_kg": cluster_summary(weight_widths).to_dict(),
                "weekly_rate_ci_width_kg": cluster_summary(rate_widths).to_dict(),
                "forecast30_ci_width_kg": cluster_summary(forecast_widths).to_dict(),
            }
        visible[f"n{n_obs}"] = per_factor

    return {
        "estimation_cell": {"span_days": SENSITIVITY_CELL[0], "n_obs": SENSITIVITY_CELL[1]},
        "n_replicates": n_replicates,
        "factors": list(SIGMA_V0_FACTORS),
        "estimation_bias": estimation,
        "visible_widths": visible,
        "visible_counts": list(SENSITIVITY_COUNTS),
    }


def extract_e3(cells: dict[str, Any]) -> dict[str, Any]:
    """Extract the identifiability view: interval width, censoring, floor, boundary power."""
    return {
        "cells": {
            label: {
                "span_days": cell["span_days"],
                "n_obs": cell["n_obs"],
                "dt_days": cell["dt_days"],
                "n_replicates": cell["n_replicates"],
                "sigma_obs_ci_width_log10": cell["sigma_obs"]["ci"]["mean_width_log10"],
                "sigma_accel_ci_width_log10": cell["sigma_accel"]["ci"]["mean_width_log10"],
                "sigma_accel_censor_lo_rate": cell["sigma_accel"]["ci"]["censor_lo_rate"],
                "sigma_accel_censor_hi_rate": cell["sigma_accel"]["ci"]["censor_hi_rate"],
                "sigma_accel_floor_rate": cell["sigma_accel"]["floor_rate"],
                "q_zero_reject_rate": cell["sigma_accel"]["q_zero_reject_rate"],
                "sigma_obs_ci_coverage": cell["sigma_obs"]["ci"]["coverage_rate"],
                "sigma_accel_ci_coverage": cell["sigma_accel"]["ci"]["coverage_rate"],
            }
            for label, cell in cells.items()
        },
        "ci_threshold": CHI2_1_95,
        "q_zero_threshold": CHI2_MIX_95,
    }


def extract_e4(cells: dict[str, Any]) -> dict[str, Any]:
    """Extract the recovery view: bias with Monte Carlo error and error magnitude, daily only."""
    return {
        "cells": {
            label: {
                "span_days": cell["span_days"],
                "n_obs": cell["n_obs"],
                "n_replicates": cell["n_replicates"],
                "sigma_obs": {
                    "bias_log10": cell["sigma_obs"]["bias_log10"],
                    "rmse_log10": cell["sigma_obs"]["rmse_log10"],
                    "median_ratio_to_truth": cell["sigma_obs"]["median_ratio_to_truth"],
                    "ci_coverage_rate": cell["sigma_obs"]["ci"]["coverage_rate"],
                },
                "sigma_accel": {
                    "bias_log10": cell["sigma_accel"]["bias_log10"],
                    "rmse_log10": cell["sigma_accel"]["rmse_log10"],
                    "median_ratio_to_truth": cell["sigma_accel"]["median_ratio_to_truth"],
                    "ci_coverage_rate": cell["sigma_accel"]["ci"]["coverage_rate"],
                    "floor_rate": cell["sigma_accel"]["floor_rate"],
                },
            }
            for label, cell in cells.items()
            if cell["on_diagonal"]
        }
    }


def run(scale: str) -> dict[str, Any]:
    """Fit every cell once, then derive both the E3 and the E4 views from the result."""
    params = ModelParams.default()
    truth = (
        float(np.log10(params.sigma_obs_kg)),
        float(np.log10(params.sigma_accel)),
    )
    if scale == "full":
        cells = build_cells(FULL_GRID_REPLICATES, FULL_DIAGONAL_REPLICATES)
        sensitivity_replicates = FULL_DIAGONAL_REPLICATES
    else:
        cells = build_cells(SMOKE_REPLICATES, SMOKE_REPLICATES)
        sensitivity_replicates = SMOKE_REPLICATES

    computed = {cell.label: run_cell(cell, truth, params) for cell in cells}
    max_discrepancy = max(cell["max_objective_discrepancy"] for cell in computed.values())
    if max_discrepancy > OBJECTIVE_TOLERANCE:
        raise RuntimeError(
            f"the fitting objective and run_filter disagree by {max_discrepancy:.3e} at a "
            f"fitted optimum, above the {OBJECTIVE_TOLERANCE:.0e} tolerance"
        )

    results: dict[str, Any] = {
        "truth_log10": {"sigma_obs": truth[0], "sigma_accel": truth[1]},
        "search_box_log10": {"sigma_obs": list(SEARCH_BOX[0]), "sigma_accel": list(SEARCH_BOX[1])},
        "cells": computed,
        "e3_identifiability": extract_e3(computed),
        "e4_recovery": extract_e4(computed),
        "sigma_v0_sensitivity": sigma_v0_sensitivity(sensitivity_replicates, truth, params),
        "total_redraws": sum(cell["n_redraws"] for cell in computed.values()),
        "max_objective_discrepancy": max_discrepancy,
        "n_cells": len(computed),
    }
    config = RunConfig.build(
        "e34",
        scale,
        seed_keys=("e34", "e34_redraw"),
        grid={
            "spans_days": list(SPANS_DAYS),
            "counts": list(COUNTS),
            "daily_diagonal": [list(entry) for entry in DAILY_DIAGONAL],
            "grid_replicates": cells[0].n_replicates,
            "diagonal_replicates": cells[-1].n_replicates,
            "sigma_v0_factors": list(SIGMA_V0_FACTORS),
            "start_kg": START_KG,
        },
    )
    return {"_config": config, "results": results}
