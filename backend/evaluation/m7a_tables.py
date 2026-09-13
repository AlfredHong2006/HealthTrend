"""Render the Milestone 7A result files as ``docs/evaluation/m7a_results.md``.

A separate generated document rather than new sections in ``results.md``: M6 is closed, and
its generated document stays byte-identical. The same rules apply as there. This file is
generated and never hand-edited, test ``EV16`` re-renders it and fails on any drift, and
interpretation lives in the hand-written ``m7a_report.md``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Final

from evaluation.common import DOCS_EVALUATION_DIR, read_results

HEADER: Final = """<!-- GENERATED FILE - DO NOT EDIT.

Regenerate with, from `backend/`:

    uv run python -m evaluation.run tables

The numbers come from `backend/evaluation/results/e6_plan_alignment.json` and
`e7_departure.json`, produced by `uv run python -m evaluation.run m7a`. The rules and
thresholds are in `m7a_preregistration.md`; interpretation lives in `m7a_report.md`.
-->

# M7A evaluation results: plan alignment and departure detection

Every figure below comes from synthetic data. No real health data has been used for any
evaluation, and nothing here is a product capability. See
[m7a_preregistration.md](m7a_preregistration.md) for the rules and
[m7a_report.md](m7a_report.md) for what the numbers do and do not establish.
"""

PROBABILITY_METHOD_LABELS: Final[dict[str, str]] = {
    "kalman": "Kalman posterior (shipped)",
    "gated": "Gated filter (experimental)",
    "ols28": "OLS 28-day",
    "weekly_means": "Weekly means",
    "weekly_means_point": "Weekly means, point (0/1)",
}


def _f(value: float, digits: int = 4) -> str:
    return f"{value:.{digits}f}"


def _pct(value: float) -> str:
    return f"{100.0 * value:.1f}%"


def _table(headers: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def _opt(value: float | None, digits: int = 3) -> str:
    return "n/a" if value is None else _f(value, digits)


def _rate_cell(entry: dict[str, Any] | None) -> str:
    if entry is None:
        return "n/a"
    return f"{_pct(entry['rate'])} [{_pct(entry['ci_lo'])}, {_pct(entry['ci_hi'])}]"


def _yes(flag: bool) -> str:
    return "yes" if flag else "**no**"


def _checks_table(checks: list[dict[str, Any]]) -> str:
    rows = [
        [
            check["check"],
            _opt(check["value"], 4),
            "pass" if check["passed"] else "**FAIL**",
            check["note"],
        ]
        for check in checks
    ]
    return _table(["Criterion", "Value", "Result", "Note"], rows)


def render_e6(payload: dict[str, Any]) -> str:
    """Render the on-plan probability study."""
    results = payload["results"]
    configs = results["configs"]
    lines = [
        "## E6 - on-plan probability",
        "",
        f"{results['n_series_per_config']} series per configuration. Primary check-ins are days "
        "28 to 84. The shipped probability is computed only once the trend-established gate "
        "is open.",
        "",
        "### Pre-registered verdict",
        "",
    ]
    for method, verdict in results["eligibility"].items():
        lines.extend(
            [
                f"**{PROBABILITY_METHOD_LABELS[method]}: eligible = {_yes(verdict['eligible'])}** "
                f"({verdict['n_failed']} failed)",
                "",
                _checks_table(verdict["checks"]),
                "",
            ]
        )

    lines.extend(["### Calibration and sharpness", ""])
    headers = [
        "Configuration",
        "Method",
        "Assessable",
        "CITL [95% CI]",
        "ECE",
        "Brier",
        "In band when pi <= 0.05",
        "In band when pi >= 0.6 (mean pi)",
        "Share pi <= 0.05",
        "Share pi >= 0.8",
    ]
    rows: list[list[str]] = []
    for key, entry in configs.items():
        for method, metrics in entry["methods"].items():
            citl = metrics["citl"]
            consistency = metrics["consistency_tail"]
            departure = metrics["departure_tail"]
            rows.append(
                [
                    key,
                    PROBABILITY_METHOD_LABELS[method],
                    _pct(metrics["assessable_share"]),
                    "n/a"
                    if citl is None
                    else f"{_f(citl['mean'], 4)} [{_f(citl['ci_lo'], 4)}, {_f(citl['ci_hi'], 4)}]",
                    _opt(metrics["ece"], 4),
                    "n/a" if metrics["brier"] is None else _f(metrics["brier"]["mean"], 4),
                    "none"
                    if departure is None
                    else f"{_rate_cell(departure)} (n={departure['trials']})",
                    "none"
                    if consistency is None
                    else f"{_pct(consistency['rate'])} ({_f(consistency['mean_probability'], 3)})",
                    "n/a"
                    if metrics["share_departure"] is None
                    else _pct(metrics["share_departure"]["rate"]),
                    "n/a"
                    if metrics["share_sharp_consistent"] is None
                    else _pct(metrics["share_sharp_consistent"]["rate"]),
                ]
            )
    lines.extend([_table(headers, rows), ""])

    lines.extend(
        [
            "### Brier score against the shipped posterior",
            "",
            "Per-series difference `method - kalman` on check-ins where both are assessable. "
            "Negative means the method scored better.",
            "",
        ]
    )
    rows = []
    for key, entry in configs.items():
        for method, metrics in entry["methods"].items():
            difference = metrics.get("brier_difference_vs_kalman")
            if method == "kalman" or difference is None:
                continue
            rows.append(
                [
                    key,
                    PROBABILITY_METHOD_LABELS[method],
                    f"{_f(difference['mean'], 4)} "
                    f"[{_f(difference['ci_lo'], 4)}, {_f(difference['ci_hi'], 4)}]",
                ]
            )
    lines.extend([_table(["Configuration", "Method", "Difference [95% CI]"], rows), ""])

    sharpness = results["sharpness"]
    lines.extend(
        [
            "### Sharpness ceiling from the priors",
            "",
            "Deterministic, from the covariance recursion on a regular schedule. Max pi is the "
            "largest on-plan probability the posterior can report at tolerance delta, reached "
            "only when its mean sits exactly on the target.",
            "",
        ]
    )
    rows = []
    # JSON keys are sorted as strings; the table reads in numeric order.
    for step, entry in sorted(sharpness.items(), key=lambda item: float(item[0])):
        histories = sorted(entry["histories"].items(), key=lambda item: float(item[0]))
        for history, row in histories:
            rows.append(
                [
                    f"every {step} d",
                    history,
                    _f(row["rate_sd_kg_per_week"], 3),
                    f"{row['prior_weight']:.3g}",
                    "yes" if row["trend_established"] else "no",
                    _f(row["max_on_plan_probability"]["0.1"], 3),
                    _f(row["max_on_plan_probability"]["0.2"], 3),
                    _f(row["max_on_plan_probability"]["0.3"], 3),
                    _f(row["tolerance_for_probability_0_8"], 3),
                ]
            )
    lines.extend(
        [
            _table(
                [
                    "Schedule",
                    "History, days",
                    "Rate sd, kg/wk",
                    "Prior weight",
                    "Gate open",
                    "Max pi, delta 0.1",
                    "Max pi, delta 0.2",
                    "Max pi, delta 0.3",
                    "delta needed for pi 0.8",
                ],
                rows,
            ),
            "",
            _table(
                ["Schedule", "First day the gate opens", "Steady state converged"],
                [
                    [
                        f"every {step} d",
                        _opt(entry["first_day_trend_established"], 2),
                        "yes" if entry["steady_state_converged"] else "no",
                    ]
                    for step, entry in sorted(sharpness.items(), key=lambda item: float(item[0]))
                ],
            ),
            "",
        ]
    )

    lines.extend(
        [
            "### A single bad reading",
            "",
            "One reading at day 56 displaced upwards, target at the true rate, paired with the "
            "clean twin. Absolute change in pi, and mean shift of the estimated rate.",
            "",
        ]
    )
    rows = []
    for magnitude, methods in results["bad_reading"].items():
        for method, days in methods.items():
            for day, row in days.items():
                if row["n"] == 0:
                    continue
                rows.append(
                    [
                        f"+{magnitude} kg",
                        PROBABILITY_METHOD_LABELS[method],
                        day,
                        _f(row["abs_probability_change_median"], 3),
                        _f(row["abs_probability_change_q90"], 3),
                        _f(row["abs_probability_change_max"], 3),
                        _f(row["mean_rate_shift_kg_per_week"], 3),
                    ]
                )
    lines.extend(
        [
            _table(
                [
                    "Reading",
                    "Method",
                    "Check-in",
                    "Median |dpi|",
                    "90th pct |dpi|",
                    "Max |dpi|",
                    "Mean rate shift, kg/wk",
                ],
                rows,
            ),
            "",
        ]
    )

    lines.extend(
        [
            "### History: assessable share and departure share by check-in (shipped posterior)",
            "",
        ]
    )
    days = list(next(iter(configs.values()))["methods"]["kalman"]["by_checkin"])
    rows = []
    for key, entry in configs.items():
        by_day = entry["methods"]["kalman"]["by_checkin"]
        rows.append(
            [key]
            + [
                f"{_pct(by_day[d]['assessable_share'])}"
                + (
                    f" / {_pct(by_day[d]['share_departure'])}"
                    if "share_departure" in by_day[d]
                    else ""
                )
                for d in days
            ]
        )
    lines.extend([_table(["Configuration", *[f"day {d}" for d in days]], rows), ""])

    lines.extend(
        [
            "### What the gate prevents",
            "",
            "The shipped probability on check-ins where the gate was closed. A diagnostic, "
            "never a candidate.",
            "",
        ]
    )
    rows = []
    for key, entry in configs.items():
        diagnostic = entry["ungated_kalman_diagnostic"]
        departure = diagnostic["departure_tail"]
        rows.append(
            [
                key,
                str(diagnostic["n_pairs"]),
                "none"
                if departure is None
                else f"{_rate_cell(departure)} (n={departure['trials']})",
                _opt(diagnostic["ece"], 4),
            ]
        )
    lines.extend(
        [
            _table(
                ["Configuration", "Gate-closed check-ins", "In band when pi <= 0.05", "ECE"], rows
            ),
            "",
        ]
    )

    rows = [
        [
            key,
            _f(entry["gated_filter_activity"]["mean_held_per_series"], 3),
            _f(entry["gated_filter_activity"]["mean_discarded_per_series"], 3),
        ]
        for key, entry in configs.items()
    ]
    lines.extend(
        [
            "### Experimental gate activity",
            "",
            _table(["Configuration", "Held per series", "Discarded per series"], rows),
            "",
        ]
    )
    return "\n".join(lines)


def render_e7(payload: dict[str, Any]) -> str:
    """Render the departure-claim study."""
    results = payload["results"]
    eligibility = results["eligibility"]
    lines = [
        "## E7 - departure claims",
        "",
        f"{results['n_series_per_config']} series per configuration. Rates are per series "
        "with Wilson 95% intervals. A phase is the nine primary check-ins, days 28 to 84.",
        "",
        "### Pre-registered verdict",
        "",
        _table(
            [
                "Rule",
                "Family",
                "Eligible (daily)",
                "Failed checks",
                "Holds at 3.5 d",
                "Holds weekly",
            ],
            [
                [
                    rule,
                    entry["family"],
                    _yes(entry["eligible"]),
                    str(entry["daily"]["n_failed"]),
                    "yes" if entry["extends_to"]["3.5d"] else "no",
                    "yes" if entry["extends_to"]["weekly"] else "no",
                ]
                for rule, entry in eligibility.items()
            ],
        ),
        "",
    ]
    for rule, entry in eligibility.items():
        lines.extend([f"#### {rule}", "", _checks_table(entry["daily"]["checks"]), ""])

    for family_key, title in (("plan_rules", "Plan-relative"), ("innovation_rules", "Innovation")):
        tables = results[family_key]
        rules = list(tables)
        keys = list(tables[rules[0]])
        null_keys = [k for k in keys if tables[rules[0]][k]["role"] in ("null", "nuisance")]
        bad_keys = [k for k in keys if tables[rules[0]][k]["role"] == "bad_reading"]
        alt_keys = [k for k in keys if tables[rules[0]][k]["role"] == "alternative"]
        desc_keys = [k for k in keys if tables[rules[0]][k]["role"] == "descriptive"]

        lines.extend(
            [
                f"### {title} rules: nulls and nuisances",
                "",
                "Share of series with any claim over the phase. For a null every claim is false; "
                "for a nuisance the table reports what happens.",
                "",
            ]
        )
        rows = []
        for key in null_keys:
            role = tables[rules[0]][key]["role"]
            gating = tables[rules[0]][key]["gating"]
            rows.append(
                [f"{key} ({role}{', gating' if gating else ''})"]
                + [_rate_cell(tables[rule][key]["phase_claim"]) for rule in rules]
            )
        lines.extend([_table(["Configuration", *rules], rows), ""])

        lines.extend(
            [
                f"### {title} rules: a single bad reading",
                "",
                "Series with a claim from day 56 on that the clean twin does not make.",
                "",
            ]
        )
        rows = [
            [key] + [_rate_cell(tables[rule][key]["attributable_claim"]) for rule in rules]
            for key in bad_keys
        ]
        lines.extend([_table(["Configuration", *rules], rows), ""])

        lines.extend([f"### {title} rules: alternatives", ""])
        rows = []
        for key in alt_keys:
            for rule in rules:
                entry = tables[rule][key]
                onset = entry["onset_days"]
                rows.append(
                    [
                        f"{key}{' (gating)' if entry['gating'] else ''}",
                        rule,
                        "n/a" if onset is None else _f(onset["mean"], 1),
                        _rate_cell(entry["pre_onset_claim"]),
                        _rate_cell(entry["detected_within_14"]),
                        _rate_cell(entry["detected_within_28"]),
                        _rate_cell(entry["detected_by_end"]),
                        _opt(entry["median_delay_days"], 1),
                        _pct(entry["censored_share"]),
                    ]
                )
        lines.extend(
            [
                _table(
                    [
                        "Configuration",
                        "Rule",
                        "Onset day",
                        "Pre-onset claim",
                        "Within 14 d",
                        "Within 28 d",
                        "By day 84",
                        "Median delay, d",
                        "Censored",
                    ],
                    rows,
                ),
                "",
            ]
        )
        if desc_keys:
            rows = [
                [key, rule, _rate_cell(tables[rule][key]["phase_claim"])]
                for key in desc_keys
                for rule in rules
            ]
            lines.extend(
                [
                    f"### {title} rules: descriptive",
                    "",
                    _table(["Configuration", "Rule", "Any claim over the phase"], rows),
                    "",
                ]
            )
    return "\n".join(lines)


def render_all() -> str:
    """Render the whole M7A results document from the committed result files."""
    sections = [
        HEADER,
        render_e6(read_results("e6_plan_alignment")),
        render_e7(read_results("e7_departure")),
    ]
    return "\n".join(sections).rstrip() + "\n"


def write_results_document() -> Path:
    """Write ``docs/evaluation/m7a_results.md`` and return its path."""
    path = DOCS_EVALUATION_DIR / "m7a_results.md"
    path.write_text(render_all(), encoding="utf-8")
    return path
