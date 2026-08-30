"""Render the committed result files as markdown tables.

Generated, never hand-edited, for the same reason ``openapi.json`` is: a table typed by
hand is a table that drifts from the numbers it claims to report. ``docs/evaluation/
results.md`` carries a header saying so, and regenerating it after a rerun should produce
no diff unless a result actually changed.

The narrative lives in ``docs/evaluation/report.md``, which *is* hand-written. This module
produces only tables -- what was measured, not what it means.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Final

from evaluation.baselines import METHODS, REFERENCE_METHOD
from evaluation.common import DOCS_EVALUATION_DIR, read_results
from evaluation.run import RESULT_STEMS
from evaluation.scenarios import REGIMES

METHOD_LABELS: Final[dict[str, str]] = {
    "locf": "LOCF",
    "moving_average": "Moving avg",
    "ewma": "EWMA",
    "holt": "Holt",
    "kalman_shipped": "Kalman (shipped)",
    "kalman_fitted": "Kalman (fitted)",
}

HEADER: Final = """<!-- GENERATED FILE - DO NOT EDIT.

Regenerate with, from `backend/`:

    uv run python -m evaluation.run tables

The numbers come from `backend/evaluation/results/*.json`, which are themselves produced
by `uv run python -m evaluation.run all`. Interpretation lives in `report.md`; this file
is only the measurements.
-->

# M6 evaluation results

Every figure below comes from synthetic data. No real health data has been used for any
evaluation. See [report.md](report.md) for what these numbers do and do not establish.
"""


def _f(value: float, digits: int = 4) -> str:
    """Format a float for a table cell."""
    return f"{value:.{digits}f}"


def _pct(value: float) -> str:
    """Format a rate as a percentage."""
    return f"{100.0 * value:.1f}%"


def _table(headers: list[str], rows: list[list[str]]) -> str:
    """Render a markdown table."""
    lines = ["| " + " | ".join(headers) + " |"]
    lines.append("|" + "|".join(["---"] * len(headers)) + "|")
    for row in rows:
        lines.append("| " + " | ".join(row) + " |")
    return "\n".join(lines)


def render_e1(payload: dict[str, Any]) -> str:
    """Render the exact-likelihood verification."""
    results = payload["results"]
    maxima = results["well_conditioned_maxima"]
    lines = [
        "## E1 - independent exact likelihood verification",
        "",
        "Three computations of the same log-likelihood compared across every combination of "
        "27 parameter settings, five gap patterns and six series lengths: the shipped "
        "filter, the lean recursion the fits optimise, and an independent `O(n^3)` "
        "joint-Gaussian oracle.",
        "",
        _table(
            ["Quantity", "Value"],
            [
                ["Cases", str(results["n_cases"])],
                ["Well conditioned (oracle usable)", str(results["n_well_conditioned"])],
                ["Ill conditioned (oracle not arbiter)", str(results["n_ill_conditioned"])],
                [
                    "Max filter-vs-lean relative difference",
                    f"{results['max_recursion_rel_diff']:.2e}",
                ],
                [
                    "Max filter-vs-oracle relative difference (well conditioned)",
                    f"{maxima['filter_rel_diff']:.2e}",
                ],
                [
                    "Max lean-vs-oracle relative difference (well conditioned)",
                    f"{maxima['lean_rel_diff']:.2e}",
                ],
                [
                    "Max forecast mean difference, kg",
                    f"{maxima['forecast_mean_abs_diff']:.2e}",
                ],
                [
                    "Max forecast variance relative difference",
                    f"{maxima['forecast_variance_rel_diff']:.2e}",
                ],
                [
                    "Max condition number encountered",
                    f"{results['max_condition_number']:.2e}",
                ],
                ["Recursions agree", "yes" if results["recursions_agree"] else "**no**"],
                [
                    "Oracle agrees where conditioned",
                    "yes" if results["oracle_agrees_where_conditioned"] else "**no**",
                ],
                ["**Gate passed**", "**yes**" if results["gate_passed"] else "**NO**"],
            ],
        ),
        "",
        f"Tolerances: `{results['recursion_relative_tolerance']:.0e}` between the two "
        f"recursions, `{results['oracle_relative_tolerance']:.0e}` against the oracle on "
        f"cases whose covariance condition number is at or below "
        f"`{results['oracle_condition_limit']:.0e}`.",
        "",
    ]
    return "\n".join(lines)


def render_e2(payload: dict[str, Any]) -> str:
    """Render the model-consistent calibration study."""
    results = payload["results"]
    lines = [
        "## E2 - calibration on model-consistent data",
        "",
        "Data drawn from the estimator's own assumptions, so the posterior is the exact "
        "conditional distribution and every nominal value below must be met. Intervals are "
        "clustered by series: the mean across series plus or minus the Student-t interval "
        "on that mean.",
        "",
    ]
    for configuration in results["configurations"]:
        rows = []
        # Committed JSON is key-sorted, so impose the order the reader wants instead of
        # the alphabetical one: the user-facing claim first, the internal diagnostics after.
        for name in ("coverage_w", "coverage_v", "anis", "anees"):
            summary = configuration["summaries"][name]
            nominal = configuration["nominal"][name]
            rows.append(
                [
                    f"`{name}`",
                    _f(nominal, 2),
                    _f(summary["mean"], 4),
                    f"[{_f(summary['ci_lo'], 4)}, {_f(summary['ci_hi'], 4)}]",
                    f"{configuration['deviation_in_se'][name]:+.2f}",
                    "yes" if configuration["ci_contains_nominal"][name] else "**no**",
                ]
            )
        lines.extend(
            [
                f"### {configuration['label']} "
                f"({configuration['n_series']} series, {configuration['n_obs']} readings, "
                f"{_f(configuration['span_days'], 1)} days)",
                "",
                _table(
                    ["Statistic", "Nominal", "Mean", "95% CI", "Deviation (SE)", "Contains"],
                    rows,
                ),
                "",
            ]
        )
    assessment = results["assessment"]
    lines.extend(
        [
            "### Verdict",
            "",
            _table(
                ["Check", "Value"],
                [
                    ["Interval checks", str(assessment["n_checks"])],
                    ["Interval misses", str(assessment["n_interval_misses"])],
                    [
                        f"Statistics beyond {assessment['investigation_se_threshold']:.0f} SE",
                        str(len(assessment["large_deviations"])),
                    ],
                    [
                        "Investigation triggered",
                        "**yes**" if assessment["investigate"] else "no",
                    ],
                ],
            ),
            "",
        ]
    )
    return "\n".join(lines)


def render_e3(payload: dict[str, Any]) -> str:
    """Render the identifiability grid."""
    results = payload["results"]
    cells = results["e3_identifiability"]["cells"]
    # The E3 view holds the identifiability summaries; the shared cells behind it hold the
    # profile-interval coverage and the redraw count. Both are computed for every cell and
    # were previously printed only for the three rows E4 reports on.
    source_cells = results["cells"]
    rows = []
    ordered = sorted(cells.items(), key=lambda item: (item[1]["span_days"], item[1]["n_obs"]))
    for label, cell in ordered:
        source = source_cells[label]
        rows.append(
            [
                f"{cell['span_days']:g}",
                str(cell["n_obs"]),
                _f(cell["dt_days"], 3),
                _f(cell["sigma_obs_ci_width_log10"], 3),
                _f(cell["sigma_accel_ci_width_log10"], 3),
                _pct(cell["sigma_accel_censor_lo_rate"]),
                _pct(cell["sigma_accel_floor_rate"]),
                _pct(cell["q_zero_reject_rate"]),
                _pct(source["sigma_obs"]["ci"]["coverage_rate"]),
                _pct(source["sigma_accel"]["ci"]["coverage_rate"]),
                f"{source['n_redraws']}/{source['n_replicates']}",
            ]
        )
    return "\n".join(
        [
            "## E3 - identifiability across calendar span and observation count",
            "",
            "Interval widths are in orders of magnitude (`log10`). *Censored* means the "
            "profile never crossed the threshold before reaching the bottom of the search "
            "space, so the interval was reported at the bound. *Floor* means the point "
            "estimate itself came to rest there. *Detect drift* is the share of replicates "
            "rejecting `sigma_accel = 0` at the boundary-corrected 5% cutoff of "
            f"`{results['e3_identifiability']['q_zero_threshold']:.3f}`.",
            "",
            "The two *CI covers* columns are the profile interval's coverage of the true "
            "value, against a nominal 95%. A censored endpoint is counted at the search "
            "bound rather than dropped, which can only make coverage look better than it "
            "is, so those columns are read alongside *Censored low* and not instead of it. "
            "*Redrawn* is how many of the cell's replicates were resampled because a "
            "model-consistent draw wandered to a non-positive weight, which `Observation` "
            "refuses.",
            "",
            _table(
                [
                    "Span (d)",
                    "n",
                    "dt (d)",
                    "sigma_obs CI width",
                    "sigma_accel CI width",
                    "Censored low",
                    "At floor",
                    "Detect drift",
                    "sigma_obs CI covers",
                    "sigma_accel CI covers",
                    "Redrawn",
                ],
                rows,
            ),
            "",
        ]
    )


def render_e4(payload: dict[str, Any]) -> str:
    """Render the recovery table and the sigma_v0 sensitivity sweep."""
    results = payload["results"]
    cells = results["e4_recovery"]["cells"]
    rows = []
    for cell in sorted(cells.values(), key=lambda c: c["n_obs"]):
        for name in ("sigma_obs", "sigma_accel"):
            entry = cell[name]
            bias = entry["bias_log10"]
            rows.append(
                [
                    str(cell["n_obs"]),
                    f"`{name}`",
                    f"{bias['mean']:+.4f} +- {bias['mc_se']:.4f}",
                    "yes" if bias["distinguishable_from_zero"] else "no",
                    _f(entry["rmse_log10"], 4),
                    _f(entry["median_ratio_to_truth"], 3),
                    _pct(entry["ci_coverage_rate"]),
                ]
            )
    lines = [
        "## E4 - parameter recovery on daily data",
        "",
        "Bias and error in orders of magnitude, each with its Monte Carlo standard error "
        f"over {next(iter(cells.values()))['n_replicates']} replicates. *Median ratio* is "
        "the median estimate divided by the truth, on the natural scale.",
        "",
        _table(
            [
                "n",
                "Parameter",
                "Bias (log10)",
                "Distinguishable from 0",
                "RMSE (log10)",
                "Median ratio",
                "CI coverage",
            ],
            rows,
        ),
        "",
    ]

    sensitivity = results["sigma_v0_sensitivity"]
    estimation_rows = [
        [
            f"x{factor}",
            f"{entry['sigma_v0_assumed']:.5f}",
            f"{entry['bias_log10_sigma_obs']['mean']:+.4f}",
            f"{entry['bias_log10_sigma_accel']['mean']:+.4f}",
        ]
        for factor, entry in sensitivity["estimation_bias"].items()
    ]
    lines.extend(
        [
            "### sigma_v0 sensitivity - effect on the other two estimates",
            "",
            f"Fitted on {sensitivity['n_replicates']} series of "
            f"{sensitivity['estimation_cell']['n_obs']} daily readings, with `sigma_v0` held "
            "at each multiple of its shipped value.",
            "",
            _table(
                ["Factor", "sigma_v0", "Bias in sigma_obs", "Bias in sigma_accel"],
                estimation_rows,
            ),
            "",
        ]
    )

    visible_rows = []
    # Sorted numerically, not lexically: the committed JSON is key-sorted, which would
    # otherwise print 10 before 2 and hide the trend this table exists to show.
    for key in sorted(sensitivity["visible_widths"], key=lambda name: int(name.lstrip("n"))):
        per_factor = sensitivity["visible_widths"][key]
        count = key.lstrip("n")
        for factor, entry in per_factor.items():
            visible_rows.append(
                [
                    count,
                    f"x{factor}",
                    _f(entry["weight_ci_width_kg"]["mean"], 3),
                    _f(entry["weekly_rate_ci_width_kg"]["mean"], 3),
                    _f(entry["forecast30_ci_width_kg"]["mean"], 2),
                ]
            )
    lines.extend(
        [
            "### sigma_v0 sensitivity - effect on what the user sees",
            "",
            "The shipped estimator run with the shipped priors and only `sigma_v0` varied. "
            "Widths are full 95% interval widths in kg.",
            "",
            _table(
                [
                    "Readings",
                    "Factor",
                    "Weight interval",
                    "Weekly-rate interval",
                    "30-day forecast interval",
                ],
                visible_rows,
            ),
            "",
        ]
    )
    return "\n".join(lines)


def _method_rows(table: dict[str, Any], digits: int = 4) -> list[list[str]]:
    """Render one metric table: score per method plus the paired difference."""
    rows = []
    for method in METHODS:
        entry = table[method]
        score = _f(entry["score"]["mean"], digits)
        if method == REFERENCE_METHOD:
            rows.append([METHOD_LABELS[method], score, "reference", "-"])
            continue
        difference = entry["difference_vs_shipped"]
        verdict = (
            "better"
            if entry["beats_shipped"]
            else ("worse" if entry["loses_to_shipped"] else "unclear")
        )
        rows.append(
            [
                METHOD_LABELS[method],
                score,
                f"{difference['mean']:+.4f} "
                f"[{difference['ci_lo']:+.4f}, {difference['ci_hi']:+.4f}]",
                verdict,
            ]
        )
    return rows


def render_e5(payload: dict[str, Any]) -> str:
    """Render the baseline comparison, regime by regime."""
    results = payload["results"]
    summary = results["summary"]
    lines = [
        "## E5 - comparison against simpler methods",
        "",
        "Every baseline is tuned on a disjoint training split drawn from the same regime; "
        "the shipped estimator is not tuned at all. *Better* and *worse* mean the paired "
        "per-series difference against the shipped estimator has a 95% interval entirely "
        "below or above zero.",
        "",
        _table(
            ["Quantity", "Value"],
            [
                ["Comparisons", str(summary["n_comparisons"])],
                ["Methods beating the shipped estimator", str(summary["n_beating_shipped"])],
                [
                    "...of which are not Kalman variants",
                    str(summary["n_simple_baselines_beating_shipped"]),
                ],
                ["Methods losing to the shipped estimator", str(summary["n_losing_to_shipped"])],
                [
                    "Regimes where a simple baseline wins",
                    ", ".join(summary["regimes_where_a_simple_baseline_wins"]) or "none",
                ],
            ],
        ),
        "",
        "### Tuned parameters",
        "",
    ]

    tuning_rows = []
    for regime in REGIMES:
        tuned = results["regimes"][regime]["tuned"]
        tuning_rows.append(
            [
                f"`{regime}`",
                f"{tuned['moving_average']['window_days']:g} d",
                f"{tuned['ewma']['tau_days']:g} d",
                f"{tuned['holt']['tau_level_days']:g} / {tuned['holt']['tau_trend_days']:g} d",
                f"{tuned['kalman_fitted']['sigma_obs_kg']:.4f}",
                f"{tuned['kalman_fitted']['sigma_accel']:.6f}"
                + (" (floor)" if tuned["kalman_fitted"]["sigma_accel_at_floor"] else ""),
            ]
        )
    lines.extend(
        [
            _table(
                [
                    "Regime",
                    "MA window",
                    "EWMA tau",
                    "Holt level / trend tau",
                    "Fitted sigma_obs",
                    "Fitted sigma_accel",
                ],
                tuning_rows,
            ),
            "",
        ]
    )

    for metric, title, note in (
        (
            "one_step",
            "One-step-ahead mean absolute error, observed space (kg)",
            "Scored against noisy readings, so no method can do better than the measurement "
            "noise itself: about 0.40 kg here. The methods are closer together than they are "
            "different.",
        ),
        (
            "forecast30",
            "Thirty-day forecast mean absolute error against latent truth (kg)",
            "What the product claims to do, and only measurable because the truth is known.",
        ),
    ):
        lines.extend([f"### {title}", "", note, ""])
        for regime in REGIMES:
            table = results["regimes"][regime][metric]["mae"]
            lines.extend(
                [
                    f"**`{regime}`**",
                    "",
                    _table(
                        ["Method", "MAE (kg)", "Difference vs shipped [95% CI]", "Verdict"],
                        _method_rows(table),
                    ),
                    "",
                ]
            )

    coverage_rows = []
    for regime in REGIMES:
        intervals = results["regimes"][regime]["kalman_intervals"]
        horizon = results["regimes"][regime]["forecast30"]["achieved_horizon_days"]
        coverage_rows.append(
            [
                f"`{regime}`",
                _pct(intervals["one_step_coverage"]["kalman_shipped"]["mean"]),
                _pct(intervals["one_step_coverage"]["kalman_fitted"]["mean"]),
                _pct(intervals["forecast30_coverage"]["kalman_shipped"]["mean"]),
                _pct(intervals["forecast30_coverage"]["kalman_fitted"]["mean"]),
                f"{horizon['min']:.1f}-{horizon['max']:.1f}",
            ]
        )
    lines.extend(
        [
            "### Interval coverage, nominal 95%",
            "",
            "Only the two Kalman variants state an interval. LOCF, moving average, EWMA and "
            "Holt produce point predictions with no error model, so no coverage is reported "
            "for them rather than one being invented.",
            "",
            _table(
                [
                    "Regime",
                    "One-step (shipped)",
                    "One-step (fitted)",
                    "30-day (shipped)",
                    "30-day (fitted)",
                    "Achieved horizon (d)",
                ],
                coverage_rows,
            ),
            "",
        ]
    )
    return "\n".join(lines)


def render_all() -> str:
    """Render the whole results document from the committed result files."""
    payloads = {name: read_results(stem) for name, stem in RESULT_STEMS.items()}
    sections = [
        HEADER,
        render_e1(payloads["e1"]),
        render_e2(payloads["e2"]),
        render_e3(payloads["e34"]),
        render_e4(payloads["e34"]),
        render_e5(payloads["e5"]),
    ]
    return "\n".join(sections).rstrip() + "\n"


def write_results_document() -> Path:
    """Write ``docs/evaluation/results.md`` and return its path."""
    path = DOCS_EVALUATION_DIR / "results.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_all(), encoding="utf-8")
    return path
