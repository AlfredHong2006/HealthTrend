"""E6, Milestone 7A: whether the on-plan probability is calibrated, sharp and robust.

The quantity is ``P(rate in [target - delta, target + delta] | data)`` from the shipped
filter's posterior velocity -- arithmetic on a published Gaussian, nothing learned. What is
not known is whether it deserves to be shown, and E6 asks that three ways.

**Calibration.** On data drawn from the model, with targets independent of the truth, the
posterior is the exact conditional distribution and the probability must be calibrated;
anything else is a defect. On the fixed-rate and changing regimes, which the model does not
describe, calibration is not guaranteed, and what matters for a claim is the direction of
any error: a probability that is too *moderate* is safe, one that is too *extreme* is not.
So the gating checks are one-sided, on the two tails a product statement would rest on.

**Sharpness.** A calibrated probability can still be useless if it never leaves the middle.
The ceiling is analytic -- ``2 Phi(delta / s) - 1`` for posterior rate sd ``s`` -- and the
table in ``sharpness`` computes it from the covariance recursion for every schedule and
history, deterministically, with no simulation at all.

**Robustness.** A single displaced reading at day 56, paired with its clean twin, and the
change it makes to the probability at the check-ins that follow.

The baselines are leakage-safe by construction: every window ends at the check-in.
"""

from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from datetime import timedelta
from typing import Any, Final

import numpy as np

from app.core.types import ModelParams, Observation
from evaluation.common import SEED_BASES, RunConfig
from evaluation.constants import normal_ppf
from evaluation.metrics import cluster_summary, clustered_rate
from evaluation.plan_alignment import (
    CONSISTENCY_TAIL,
    DEPARTURE_TAIL,
    PLAN_TOLERANCE_KG_PER_WEEK,
    PREREGISTRATION,
    PRIOR_WEIGHT_GATE,
    PROBABILITY_METHODS,
    SHARP_CONSISTENT,
    SHARPNESS_TOLERANCES_KG_PER_WEEK,
    PlanBand,
    band_probability,
    max_attainable_probability,
    shipped_trace,
    trend_established,
)
from evaluation.plan_scenarios import (
    BAD_READING_MAGNITUDES_KG,
    CHECKIN_DAYS,
    PRIMARY_CHECKIN_DAYS,
    CheckinEstimates,
    SeriesEvaluation,
    draw,
    evaluate_series,
    random_target,
    with_bad_reading,
)
from testing.synthetic import DEFAULT_START

FULL_N_SERIES: Final = 1000
SMOKE_N_SERIES: Final = 6

CONFIGS: Final = (
    ("model_consistent", "daily"),
    ("model_consistent", "irregular"),
    ("steady", "daily"),
    ("steady_irregular", "irregular"),
    ("steady_missing", "missing"),
    ("plateau", "daily"),
    ("gradual_rate_change", "daily"),
    ("curved", "daily"),
    ("level_shift", "daily"),
)

GATE_A_CONFIGS: Final = ("model_consistent/daily", "model_consistent/irregular")
GATE_B_CONFIGS: Final = ("steady/daily", "steady_irregular/irregular", "steady_missing/missing")
GATE_C_CONFIGS: Final = ("plateau/daily", "gradual_rate_change/daily", "curved/daily")

N_RELIABILITY_BINS: Final = 10
SHARPNESS_SCHEDULE_DAYS: Final = (1.0, 2.0, 3.5, 7.0)
SHARPNESS_HISTORY_DAYS: Final = (7.0, 14.0, 21.0, 28.0, 42.0, 56.0, 84.0)
STEADY_STATE_DAYS: Final = 1000.0
BAD_READING_CHECKINS: Final = (56.0, 63.0, 70.0)

Pair = tuple[float, float, float]
"""``(day, probability, label)`` for one assessable check-in."""


def config_key(regime: str, schedule: str) -> str:
    """Return the ``regime/schedule`` key used throughout the results."""
    return f"{regime}/{schedule}"


def method_pair(
    method: str, checkin: CheckinEstimates, band: PlanBand
) -> tuple[float, float] | None:
    """Return ``(probability, label)`` for one method at one check-in, or ``None``."""
    if method == "kalman":
        if not trend_established(checkin.kalman_prior_weight):
            return None
        return band_probability(checkin.kalman, band), float(
            band.contains(checkin.kalman_true_rate)
        )
    if method == "gated":
        if not trend_established(checkin.gated_prior_weight):
            return None
        return band_probability(checkin.gated, band), float(band.contains(checkin.gated_true_rate))
    label = float(band.contains(checkin.window_true_rate))
    if method == "ols28":
        return None if checkin.ols28 is None else (band_probability(checkin.ols28, band), label)
    if method == "weekly_means":
        if checkin.weekly_means is None:
            return None
        return band_probability(checkin.weekly_means, band), label
    if method == "weekly_means_point":
        if checkin.weekly_means is None:
            return None
        return float(band.contains(checkin.weekly_means.mean_kg_per_week)), label
    raise ValueError(f"unknown method {method!r}")


def ungated_kalman_pair(checkin: CheckinEstimates, band: PlanBand) -> tuple[float, float] | None:
    """Return the shipped probability *only where the gate is closed*: the diagnostic."""
    if trend_established(checkin.kalman_prior_weight):
        return None
    return band_probability(checkin.kalman, band), float(band.contains(checkin.kalman_true_rate))


def _pairs(
    evaluation: SeriesEvaluation,
    band: PlanBand,
    extractor: Callable[[CheckinEstimates, PlanBand], tuple[float, float] | None],
    days: Sequence[float],
) -> list[Pair]:
    wanted = set(days)
    out: list[Pair] = []
    for checkin in evaluation.checkins:
        if checkin.day not in wanted:
            continue
        pair = extractor(checkin, band)
        if pair is not None:
            out.append((checkin.day, pair[0], pair[1]))
    return out


def _tail(
    series_pairs: Sequence[Sequence[Pair]], select: Callable[[float], bool]
) -> dict[str, Any] | None:
    numerators = [sum(1 for _, p, y in pairs if select(p) and y == 1.0) for pairs in series_pairs]
    denominators = [sum(1 for _, p, _ in pairs if select(p)) for pairs in series_pairs]
    if sum(denominators) == 0:
        return None
    selected = [p for pairs in series_pairs for _, p, _ in pairs if select(p)]
    return {
        **clustered_rate(numerators, denominators).to_dict(),
        "mean_probability": math.fsum(selected) / len(selected),
    }


def _share(
    series_pairs: Sequence[Sequence[Pair]], select: Callable[[float], bool]
) -> dict[str, Any] | None:
    numerators = [sum(1 for _, p, _ in pairs if select(p)) for pairs in series_pairs]
    denominators = [len(pairs) for pairs in series_pairs]
    if sum(denominators) == 0:
        return None
    return clustered_rate(numerators, denominators).to_dict()


def probability_metrics(series_pairs: Sequence[Sequence[Pair]], n_checkins: int) -> dict[str, Any]:
    """Summarise one method's ``(probability, label)`` pairs across series.

    Series are the unit of inference throughout: calibration-in-the-large and the Brier
    score are per-series means summarised across series, and the tails are cluster ratio
    estimates. ECE and the reliability bins pool the pairs and are descriptive.
    """
    flat = [(p, y) for pairs in series_pairs for _, p, y in pairs]
    n_series = len(series_pairs)
    result: dict[str, Any] = {
        "n_pairs": len(flat),
        "assessable_share": len(flat) / (n_series * n_checkins) if n_series else 0.0,
    }
    if not flat:
        result.update(
            {
                "citl": None,
                "ece": None,
                "brier": None,
                "bins": [],
                "departure_tail": None,
                "consistency_tail": None,
                "share_departure": None,
                "share_sharp_consistent": None,
            }
        )
        return result

    contributing = [pairs for pairs in series_pairs if pairs]
    citl_values = [math.fsum(p - y for _, p, y in pairs) / len(pairs) for pairs in contributing]
    brier_values = [
        math.fsum((p - y) ** 2 for _, p, y in pairs) / len(pairs) for pairs in contributing
    ]
    bins: list[dict[str, Any]] = []
    ece = 0.0
    for b in range(N_RELIABILITY_BINS):
        lo = b / N_RELIABILITY_BINS
        hi = (b + 1) / N_RELIABILITY_BINS
        members = [
            (p, y) for p, y in flat if lo <= p < hi or (b == N_RELIABILITY_BINS - 1 and p == 1.0)
        ]
        if not members:
            bins.append({"lo": lo, "hi": hi, "n": 0})
            continue
        mean_p = math.fsum(p for p, _ in members) / len(members)
        freq = math.fsum(y for _, y in members) / len(members)
        ece += len(members) / len(flat) * abs(mean_p - freq)
        bins.append({"lo": lo, "hi": hi, "n": len(members), "mean_p": mean_p, "freq": freq})

    result.update(
        {
            "citl": cluster_summary(citl_values).to_dict() if len(contributing) >= 2 else None,
            "ece": ece,
            "brier": cluster_summary(brier_values).to_dict() if len(contributing) >= 2 else None,
            "bins": bins,
            "departure_tail": _tail(series_pairs, lambda p: p <= DEPARTURE_TAIL),
            "consistency_tail": _tail(series_pairs, lambda p: p >= CONSISTENCY_TAIL),
            "share_departure": _share(series_pairs, lambda p: p <= DEPARTURE_TAIL),
            "share_sharp_consistent": _share(series_pairs, lambda p: p >= SHARP_CONSISTENT),
        }
    )
    return result


def by_checkin(series_pairs: Sequence[Sequence[Pair]], n_series: int) -> dict[str, Any]:
    """Assessable share, tail shares and signed calibration error for each check-in day."""
    out: dict[str, Any] = {}
    for day in CHECKIN_DAYS:
        pairs = [(p, y) for sp in series_pairs for d, p, y in sp if d == day]
        entry: dict[str, Any] = {"assessable_share": len(pairs) / n_series if n_series else 0.0}
        if pairs:
            entry["share_departure"] = sum(1 for p, _ in pairs if p <= DEPARTURE_TAIL) / len(pairs)
            entry["share_sharp_consistent"] = sum(
                1 for p, _ in pairs if p >= SHARP_CONSISTENT
            ) / len(pairs)
            entry["mean_p_minus_label"] = math.fsum(p - y for p, y in pairs) / len(pairs)
        out[f"{day:g}"] = entry
    return out


def paired_brier(
    evaluations: Sequence[SeriesEvaluation], bands: Sequence[PlanBand], method: str
) -> dict[str, float | int] | None:
    """Return the per-series Brier difference ``method - kalman``.

    Only check-ins where both methods are assessable enter, so neither is scored on days
    the other declined.
    """
    differences: list[float] = []
    for evaluation, band in zip(evaluations, bands, strict=True):
        values: list[float] = []
        for checkin in evaluation.checkins:
            if checkin.day not in PRIMARY_CHECKIN_DAYS:
                continue
            ours = method_pair(method, checkin, band)
            reference = method_pair("kalman", checkin, band)
            if ours is None or reference is None:
                continue
            values.append((ours[0] - ours[1]) ** 2 - (reference[0] - reference[1]) ** 2)
        if values:
            differences.append(math.fsum(values) / len(values))
    if len(differences) < 2:
        return None
    return cluster_summary(differences).to_dict()


def run_config(
    regime: str, schedule: str, n_series: int, offset: int, params: ModelParams
) -> dict[str, Any]:
    """Draw, evaluate and summarise one configuration."""
    block = SEED_BASES["e6"]
    evaluations: list[SeriesEvaluation] = []
    bands: list[PlanBand] = []
    for index in range(n_series):
        seed = block.at(offset + index)
        series = draw(regime, schedule, seed, params)
        evaluation = evaluate_series(series, params)
        evaluations.append(evaluation)
        bands.append(PlanBand(random_target(seed, regime, evaluation.initial_true_rate)))

    methods: dict[str, Any] = {}
    for method in PROBABILITY_METHODS:

        def extractor(
            c: CheckinEstimates, b: PlanBand, m: str = method
        ) -> tuple[float, float] | None:
            return method_pair(m, c, b)

        primary = [
            _pairs(e, b, extractor, PRIMARY_CHECKIN_DAYS)
            for e, b in zip(evaluations, bands, strict=True)
        ]
        every = [
            _pairs(e, b, extractor, CHECKIN_DAYS) for e, b in zip(evaluations, bands, strict=True)
        ]
        entry = probability_metrics(primary, len(PRIMARY_CHECKIN_DAYS))
        entry["by_checkin"] = by_checkin(every, n_series)
        if method != "kalman":
            entry["brier_difference_vs_kalman"] = paired_brier(evaluations, bands, method)
        methods[method] = entry

    ungated = [
        _pairs(e, b, ungated_kalman_pair, CHECKIN_DAYS)
        for e, b in zip(evaluations, bands, strict=True)
    ]
    return {
        "regime": regime,
        "schedule": schedule,
        "n_series": n_series,
        "seed_range": [block.at(offset), block.at(offset + n_series - 1)],
        "methods": methods,
        "ungated_kalman_diagnostic": probability_metrics(ungated, len(CHECKIN_DAYS)),
        "gated_filter_activity": {
            "mean_held_per_series": math.fsum(e.gated_held for e in evaluations) / n_series,
            "mean_discarded_per_series": math.fsum(e.gated_discarded for e in evaluations)
            / n_series,
        },
    }


# ---------------------------------------------------------------------------
# Sharpness: the ceiling the priors impose, computed rather than simulated
# ---------------------------------------------------------------------------


def _regular_observations(step_days: float, span_days: float) -> tuple[Observation, ...]:
    count = round(span_days / step_days) + 1
    return tuple(
        Observation(timestamp=DEFAULT_START + timedelta(days=i * step_days), weight_kg=80.0)
        for i in range(count)
    )


def sharpness_table(params: ModelParams) -> dict[str, Any]:
    """Posterior rate sd, prior weight and the attainable on-plan probability, per schedule.

    The covariance recursion and the gains do not depend on the readings, so constant
    readings give exactly the uncertainty any series on that schedule would carry. This is
    a property of the priors and the schedule, not an estimate.
    """
    table: dict[str, Any] = {}
    for step in SHARPNESS_SCHEDULE_DAYS:
        trace = shipped_trace(_regular_observations(step, STEADY_STATE_DAYS), params)
        rows: dict[str, Any] = {}
        for history in (*SHARPNESS_HISTORY_DAYS, STEADY_STATE_DAYS):
            estimate, weight, _ = trace.estimate_at(history)
            sd = estimate.sd_kg_per_week
            rows[f"{history:g}"] = {
                "rate_sd_kg_per_week": sd,
                "prior_weight": weight,
                "trend_established": trend_established(weight),
                "max_on_plan_probability": {
                    f"{delta:g}": max_attainable_probability(sd, delta)
                    for delta in SHARPNESS_TOLERANCES_KG_PER_WEEK
                },
                "tolerance_for_probability_0_8": sd * normal_ppf(0.5 + SHARP_CONSISTENT / 2.0),
            }
        gate_day = next(
            (
                day
                for day, weight in zip(trace.elapsed_days, trace.prior_weight, strict=True)
                if weight <= PRIOR_WEIGHT_GATE
            ),
            None,
        )
        early, late = (
            trace.estimate_at(STEADY_STATE_DAYS - 100.0),
            trace.estimate_at(STEADY_STATE_DAYS),
        )
        table[f"{step:g}"] = {
            "histories": rows,
            "first_day_trend_established": gate_day,
            "steady_state_converged": math.isclose(
                early[0].sd_kg_per_week, late[0].sd_kg_per_week, rel_tol=1e-9
            ),
        }
    return table


# ---------------------------------------------------------------------------
# A single bad reading
# ---------------------------------------------------------------------------


def bad_reading_sensitivity(n_series: int, offset: int, params: ModelParams) -> dict[str, Any]:
    """How far one displaced reading moves the on-plan probability, paired with its twin.

    Drawn from the same seeds as the ``steady/daily`` configuration, with the target at the
    true rate so the clean probability is as high as it gets. Reported as quantiles of the
    absolute change; the claim consequences are E7's.
    """
    block = SEED_BASES["e6"]
    out: dict[str, Any] = {}
    clean: list[SeriesEvaluation] = []
    for index in range(n_series):
        series = draw("steady", "daily", block.at(offset + index), params)
        clean.append(evaluate_series(series, params))
    for magnitude in BAD_READING_MAGNITUDES_KG:
        per_method: dict[str, Any] = {}
        shifted: list[SeriesEvaluation] = []
        for index in range(n_series):
            series = draw("steady", "daily", block.at(offset + index), params)
            shifted.append(evaluate_series(with_bad_reading(series, magnitude), params))
        for method in ("kalman", "gated"):
            per_day: dict[str, Any] = {}
            for day in BAD_READING_CHECKINS:
                deltas: list[float] = []
                rate_shifts: list[float] = []
                for base, moved in zip(clean, shifted, strict=True):
                    band = PlanBand(base.initial_true_rate)
                    a = method_pair(method, base.at(day), band)
                    b = method_pair(method, moved.at(day), band)
                    if a is None or b is None:
                        continue
                    deltas.append(abs(b[0] - a[0]))
                    estimate_a = base.at(day).kalman if method == "kalman" else base.at(day).gated
                    estimate_b = moved.at(day).kalman if method == "kalman" else moved.at(day).gated
                    rate_shifts.append(estimate_b.mean_kg_per_week - estimate_a.mean_kg_per_week)
                if not deltas:
                    per_day[f"{day:g}"] = {"n": 0}
                    continue
                array = np.asarray(deltas, dtype=np.float64)
                per_day[f"{day:g}"] = {
                    "n": len(deltas),
                    "abs_probability_change_median": float(np.quantile(array, 0.5)),
                    "abs_probability_change_q90": float(np.quantile(array, 0.9)),
                    "abs_probability_change_max": float(array.max()),
                    "mean_rate_shift_kg_per_week": math.fsum(rate_shifts) / len(rate_shifts),
                }
            per_method[method] = per_day
        out[f"{magnitude:g}"] = per_method
    return out


# ---------------------------------------------------------------------------
# The pre-registered verdict
# ---------------------------------------------------------------------------


def _check(name: str, value: float | None, passed: bool, note: str = "") -> dict[str, Any]:
    return {"check": name, "value": value, "passed": passed, "note": note}


def assess(configs: dict[str, Any], method: str) -> dict[str, Any]:
    """Apply E6-A, E6-B and E6-C to one probability method."""
    criteria = PREREGISTRATION["criteria"]
    checks: list[dict[str, Any]] = []

    for key in GATE_A_CONFIGS:
        entry = configs[key]["methods"][method]
        citl = entry["citl"]
        ece = entry["ece"]
        contains = citl is not None and citl["ci_lo"] <= 0.0 <= citl["ci_hi"]
        checks.append(
            _check(f"E6-A {key} citl contains 0", None if citl is None else citl["mean"], contains)
        )
        checks.append(
            _check(
                f"E6-A {key} ece",
                ece,
                ece is not None and ece <= criteria["e6_a"]["ece_max"],
            )
        )

    for key in GATE_B_CONFIGS:
        entry = configs[key]["methods"][method]
        tail = entry["departure_tail"]
        if tail is None:
            checks.append(
                _check(f"E6-B {key} departure tail", None, True, "vacuous: no pi <= 0.05")
            )
        else:
            checks.append(
                _check(
                    f"E6-B {key} departure tail",
                    tail["rate"],
                    tail["rate"] <= criteria["e6_b"]["departure_tail_max"]
                    and tail["ci_hi"] <= criteria["e6_b"]["departure_tail_upper_max"],
                    f"upper {tail['ci_hi']:.4f}",
                )
            )
        consistency = entry["consistency_tail"]
        if consistency is None:
            checks.append(
                _check(f"E6-B {key} consistency tail", None, True, "vacuous: no pi >= 0.6")
            )
        else:
            floor = consistency["mean_probability"] - criteria["e6_b"]["consistency_tail_slack"]
            checks.append(
                _check(
                    f"E6-B {key} consistency tail",
                    consistency["rate"],
                    consistency["rate"] >= floor,
                    f"mean pi {consistency['mean_probability']:.4f}",
                )
            )

    for key in GATE_C_CONFIGS:
        tail = configs[key]["methods"][method]["departure_tail"]
        if tail is None:
            checks.append(
                _check(f"E6-C {key} departure tail", None, True, "vacuous: no pi <= 0.05")
            )
        else:
            checks.append(
                _check(
                    f"E6-C {key} departure tail",
                    tail["rate"],
                    tail["rate"] <= criteria["e6_c"]["departure_tail_max"]
                    and tail["ci_hi"] <= criteria["e6_c"]["departure_tail_upper_max"],
                    f"upper {tail['ci_hi']:.4f}",
                )
            )

    return {
        "method": method,
        "checks": checks,
        "n_failed": sum(1 for c in checks if not c["passed"]),
        "eligible": all(c["passed"] for c in checks),
    }


def run(scale: str) -> dict[str, Any]:
    """Run every E6 configuration, the sharpness table and the bad-reading sensitivity."""
    params = ModelParams.default()
    n_series = FULL_N_SERIES if scale == "full" else SMOKE_N_SERIES

    configs: dict[str, Any] = {}
    for index, (regime, schedule) in enumerate(CONFIGS):
        configs[config_key(regime, schedule)] = run_config(
            regime, schedule, n_series, index * n_series, params
        )

    steady_offset = CONFIGS.index(("steady", "daily")) * n_series
    verdicts = {method: assess(configs, method) for method in ("kalman", "gated")}

    results: dict[str, Any] = {
        "configs": configs,
        "sharpness": sharpness_table(params),
        "bad_reading": bad_reading_sensitivity(n_series, steady_offset, params),
        "eligibility": verdicts,
        "on_plan_probability_eligible": verdicts["kalman"]["eligible"],
        "gated_probability_eligible": verdicts["gated"]["eligible"],
        "n_series_per_config": n_series,
    }
    config = RunConfig.build(
        "e6",
        scale,
        seed_keys=("e6",),
        grid={
            "configs": [config_key(r, s) for r, s in CONFIGS],
            "methods": list(PROBABILITY_METHODS),
            "checkin_days": list(CHECKIN_DAYS),
            "primary_checkin_days": list(PRIMARY_CHECKIN_DAYS),
            "plan_tolerance_kg_per_week": PLAN_TOLERANCE_KG_PER_WEEK,
            "n_series": n_series,
            "preregistration": PREREGISTRATION,
        },
    )
    return {"_config": config, "results": results}
