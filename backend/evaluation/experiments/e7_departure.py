"""E7, Milestone 7A: whether any rule can claim a departure without crying wolf.

Nine claim rules are evaluated under one protocol: weekly check-ins over an 84-day phase,
a claim or no claim at each, using only the readings up to that day. Six rules are
plan-relative. They claim "the estimated rate has departed from the plan band", built
from the shipped posterior (three candidates), from the experimental gated filter (one),
or from the leakage-safe baselines (two). The other three are model-relative. They claim
"recent readings are not consistent with the estimated trajectory", built from the
shipped filter's normalised innovations.

**The two families answer different questions, and neither may stand in for the other.**
An innovation test detects what the model did not expect; a slow drift the process-noise
prior considers normal is absorbed into the velocity estimate without ever surprising it.
A plan rule detects the estimated rate leaving the user's band, whatever caused it. So the
roles in :data:`ROLES` differ by family, exactly as pre-registered: a level shift is an
alternative for an innovation rule and a nuisance for a plan rule, whose band is about
rate.

**What counts as a false claim** is decided by the role, never after the fact:

- on a null, any claim at a primary check-in
- on a bad reading, a claim the clean twin does not make at the same check-in
- on an alternative, any claim before the onset, reported separately from detection

Every rate here has series as its unit, with a Wilson interval, because "did this phase
ever produce a false claim" is one Bernoulli outcome per series.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any, Final

from app.core.types import ModelParams
from evaluation.common import SEED_BASES, RunConfig
from evaluation.metrics import RateSummary, clustered_rate, wilson_interval
from evaluation.plan_alignment import (
    ALPHA_CHECK,
    CONFIRMATION_LAG_DAYS,
    DEPARTURE_TAIL,
    INNOVATION_RULES,
    PLAN_RULES,
    PLAN_TOLERANCE_KG_PER_WEEK,
    PREREGISTRATION,
    PlanBand,
    band_probability,
    trend_established,
)
from evaluation.plan_scenarios import (
    BAD_READING_DAY,
    BAD_READING_MAGNITUDES_KG,
    CHANGE_DAY,
    CHECKIN_DAYS,
    PRIMARY_CHECKIN_DAYS,
    CheckinEstimates,
    SeriesEvaluation,
    band_exit_day,
    draw,
    evaluate_series,
    with_bad_reading,
)

FULL_N_SERIES: Final = 1000
SMOKE_N_SERIES: Final = 6

PLACEMENTS: Final[dict[str, float]] = {"centre": 0.0, "upper_edge": 0.9, "lower_edge": -0.9}
"""Where the true rate sits in the band, in units of the tolerance: ``r* = r - o delta``."""

CONFIGS: Final = (
    ("model_consistent", "daily"),
    ("model_consistent", "3.5d"),
    ("model_consistent", "weekly"),
    ("steady", "daily"),
    ("steady", "3.5d"),
    ("steady", "weekly"),
    ("steady_irregular", "irregular"),
    ("steady_missing", "missing"),
    ("level_shift", "daily"),
    ("level_shift", "3.5d"),
    ("level_shift", "weekly"),
    ("plateau", "daily"),
    ("plateau", "3.5d"),
    ("plateau", "weekly"),
    ("gradual_rate_change", "daily"),
    ("curved", "daily"),
)

ROLES: Final[dict[str, dict[str, tuple[str, bool]]]] = {
    "plan": {
        "steady/daily": ("null", True),
        "steady/3.5d": ("null", False),
        "steady/weekly": ("null", False),
        "steady_irregular/irregular": ("null", True),
        "steady_missing/missing": ("null", True),
        "level_shift/daily": ("nuisance", False),
        "level_shift/3.5d": ("nuisance", False),
        "level_shift/weekly": ("nuisance", False),
        "plateau/daily": ("alternative", True),
        "plateau/3.5d": ("alternative", False),
        "plateau/weekly": ("alternative", False),
        "gradual_rate_change/daily": ("alternative", True),
        "curved/daily": ("alternative", True),
    },
    "innovation": {
        "model_consistent/daily": ("null", True),
        "model_consistent/3.5d": ("null", False),
        "model_consistent/weekly": ("null", False),
        "steady/daily": ("null", True),
        "steady/3.5d": ("null", False),
        "steady/weekly": ("null", False),
        "steady_irregular/irregular": ("null", True),
        "steady_missing/missing": ("null", True),
        "level_shift/daily": ("alternative", True),
        "level_shift/3.5d": ("alternative", False),
        "level_shift/weekly": ("alternative", False),
        "plateau/daily": ("alternative", True),
        "plateau/3.5d": ("alternative", False),
        "plateau/weekly": ("alternative", False),
        "gradual_rate_change/daily": ("alternative", False),
        "curved/daily": ("descriptive", False),
    },
}
"""``family -> config -> (role, gating)``, exactly as in the pre-registration's roles table."""

Claims = dict[float, bool | None]
"""Check-in day to claim, ``None`` where the rule could not assess."""


def config_key(regime: str, schedule: str) -> str:
    """Return the ``regime/schedule`` key used throughout the results."""
    return f"{regime}/{schedule}"


def _kalman_p(checkin: CheckinEstimates, band: PlanBand) -> float | None:
    if not trend_established(checkin.kalman_prior_weight):
        return None
    return band_probability(checkin.kalman, band)


def plan_claims(evaluation: SeriesEvaluation, band: PlanBand) -> dict[str, Claims]:
    """Evaluate the six plan-relative rules at every check-in against one band."""
    out: dict[str, Claims] = {rule: {} for rule in PLAN_RULES}
    for checkin in evaluation.checkins:
        day = checkin.day
        p = _kalman_p(checkin, band)
        out["kalman_plan_05"][day] = None if p is None else p <= DEPARTURE_TAIL
        out["kalman_plan_bonf"][day] = None if p is None else p <= ALPHA_CHECK

        previous_day = day - CONFIRMATION_LAG_DAYS
        previous = next((c for c in evaluation.checkins if math.isclose(c.day, previous_day)), None)
        if previous is None or p is None:
            out["kalman_plan_confirmed"][day] = None
        else:
            q = _kalman_p(previous, band)
            out["kalman_plan_confirmed"][day] = (
                None if q is None else (p <= DEPARTURE_TAIL and q <= DEPARTURE_TAIL)
            )

        if trend_established(checkin.gated_prior_weight):
            out["gated_plan_bonf"][day] = band_probability(checkin.gated, band) <= ALPHA_CHECK
        else:
            out["gated_plan_bonf"][day] = None

        out["ols28_plan_bonf"][day] = (
            None if checkin.ols28 is None else band_probability(checkin.ols28, band) <= ALPHA_CHECK
        )
        out["weekly_means_point"][day] = (
            None
            if checkin.weekly_means is None
            else not band.contains(checkin.weekly_means.mean_kg_per_week)
        )
    return out


def innovation_claims(evaluation: SeriesEvaluation) -> dict[str, Claims]:
    """Evaluate the three innovation rules at every check-in. No band is involved."""
    return {
        rule: {checkin.day: checkin.innovations[rule] for checkin in evaluation.checkins}
        for rule in INNOVATION_RULES
    }


def _any_claim(claims: Claims, days: Sequence[float]) -> bool:
    return any(claims.get(day) is True for day in days)


def _rate(summary: RateSummary) -> dict[str, Any]:
    return summary.to_dict()


def null_metrics(per_series: Sequence[Claims]) -> dict[str, Any]:
    """Phase false-claim rate, per-check-in claim rate and the rate at each check-in."""
    n = len(per_series)
    phase = sum(1 for claims in per_series if _any_claim(claims, PRIMARY_CHECKIN_DAYS))
    numerators = [sum(1 for d in PRIMARY_CHECKIN_DAYS if c.get(d) is True) for c in per_series]
    denominators = [
        sum(1 for d in PRIMARY_CHECKIN_DAYS if c.get(d) is not None) for c in per_series
    ]
    return {
        "phase_claim": _rate(wilson_interval(phase, n)),
        "per_checkin_claim": (
            _rate(clustered_rate(numerators, denominators)) if sum(denominators) else None
        ),
        "assessable_share": sum(denominators) / (n * len(PRIMARY_CHECKIN_DAYS)),
        "by_checkin": {
            f"{day:g}": {
                "claim_share": sum(1 for c in per_series if c.get(day) is True) / n,
                "assessable_share": sum(1 for c in per_series if c.get(day) is not None) / n,
            }
            for day in CHECKIN_DAYS
        },
    }


def _median(values: Sequence[float]) -> float:
    ordered = sorted(values)
    count = len(ordered)
    middle = count // 2
    if count % 2:
        return ordered[middle]
    return 0.5 * (ordered[middle - 1] + ordered[middle])


def alternative_metrics(
    per_series: Sequence[Claims], onsets: Sequence[float | None]
) -> dict[str, Any]:
    """Pre-onset claims, detection within 14 and 28 days and by day 84, and the median delay."""
    n = len(per_series)
    pre = 0
    within_14 = 0
    within_28 = 0
    by_end = 0
    delays: list[float] = []
    no_onset = 0
    finite_onsets: list[float] = []
    for claims, onset in zip(per_series, onsets, strict=True):
        if onset is None:
            no_onset += 1
            delays.append(math.inf)
            continue
        finite_onsets.append(onset)
        if _any_claim(claims, [d for d in PRIMARY_CHECKIN_DAYS if d < onset - 1.0e-9]):
            pre += 1
        after = [d for d in PRIMARY_CHECKIN_DAYS if d >= onset - 1.0e-9 and claims.get(d) is True]
        if not after:
            delays.append(math.inf)
            continue
        delay = after[0] - onset
        delays.append(delay)
        by_end += 1
        within_28 += int(delay <= 28.0 + 1.0e-9)
        within_14 += int(delay <= 14.0 + 1.0e-9)
    median = _median(delays)
    censored = sum(1 for d in delays if math.isinf(d))
    return {
        "onset_days": (
            {
                "min": min(finite_onsets),
                "max": max(finite_onsets),
                "mean": math.fsum(finite_onsets) / len(finite_onsets),
            }
            if finite_onsets
            else None
        ),
        "n_without_onset": no_onset,
        "pre_onset_claim": _rate(wilson_interval(pre, n)),
        "detected_within_14": _rate(wilson_interval(within_14, n)),
        "detected_within_28": _rate(wilson_interval(within_28, n)),
        "detected_by_end": _rate(wilson_interval(by_end, n)),
        "median_delay_days": None if math.isinf(median) else median,
        "censored_share": censored / n,
        "by_checkin": {
            f"{day:g}": sum(1 for c in per_series if c.get(day) is True) / n for day in CHECKIN_DAYS
        },
    }


def bad_reading_metrics(clean: Sequence[Claims], shifted: Sequence[Claims]) -> dict[str, Any]:
    """Claims a displaced reading adds that its clean twin does not make, from day 56 on."""
    after = [d for d in PRIMARY_CHECKIN_DAYS if d >= BAD_READING_DAY]
    n = len(clean)
    attributable = 0
    at_outlier_day = 0
    for base, moved in zip(clean, shifted, strict=True):
        if any(moved.get(d) is True and base.get(d) is not True for d in after):
            attributable += 1
        if moved.get(BAD_READING_DAY) is True and base.get(BAD_READING_DAY) is not True:
            at_outlier_day += 1
    return {
        "attributable_claim": _rate(wilson_interval(attributable, n)),
        "attributable_at_day_56": _rate(wilson_interval(at_outlier_day, n)),
        "shifted_post_claim": _rate(
            wilson_interval(sum(1 for c in shifted if _any_claim(c, after)), n)
        ),
        "clean_post_claim": _rate(
            wilson_interval(sum(1 for c in clean if _any_claim(c, after)), n)
        ),
    }


def _evaluate(
    regime: str, schedule: str, n_series: int, offset: int, params: ModelParams
) -> list[SeriesEvaluation]:
    block = SEED_BASES["e7"]
    return [
        evaluate_series(draw(regime, schedule, block.at(offset + i), params), params)
        for i in range(n_series)
    ]


def run_all(n_series: int, params: ModelParams) -> dict[str, Any]:
    """Evaluate every configuration once, then score both families against their roles."""
    evaluations: dict[str, list[SeriesEvaluation]] = {}
    for index, (regime, schedule) in enumerate(CONFIGS):
        evaluations[config_key(regime, schedule)] = _evaluate(
            regime, schedule, n_series, index * n_series, params
        )

    plan: dict[str, Any] = {rule: {} for rule in PLAN_RULES}
    innovation: dict[str, Any] = {rule: {} for rule in INNOVATION_RULES}

    for key, (role, gating) in ROLES["plan"].items():
        series_evaluations = evaluations[key]
        if role == "null":
            for placement, offset in PLACEMENTS.items():
                per_rule: dict[str, list[Claims]] = {rule: [] for rule in PLAN_RULES}
                for evaluation in series_evaluations:
                    band = PlanBand(
                        evaluation.initial_true_rate - offset * PLAN_TOLERANCE_KG_PER_WEEK
                    )
                    for rule, claims in plan_claims(evaluation, band).items():
                        per_rule[rule].append(claims)
                for rule in PLAN_RULES:
                    plan[rule][f"{key}@{placement}"] = {
                        "role": role,
                        "gating": gating,
                        **null_metrics(per_rule[rule]),
                    }
            continue
        per_rule = {rule: [] for rule in PLAN_RULES}
        onsets: list[float | None] = []
        for evaluation in series_evaluations:
            band = PlanBand(evaluation.initial_true_rate)
            onsets.append(
                band_exit_day(evaluation, band.target_kg_per_week, band.tolerance_kg_per_week)
            )
            for rule, claims in plan_claims(evaluation, band).items():
                per_rule[rule].append(claims)
        for rule in PLAN_RULES:
            metrics = (
                alternative_metrics(per_rule[rule], onsets)
                if role == "alternative"
                else null_metrics(per_rule[rule])
            )
            plan[rule][f"{key}@centre"] = {"role": role, "gating": gating, **metrics}

    for key, (role, gating) in ROLES["innovation"].items():
        per_rule = {rule: [] for rule in INNOVATION_RULES}
        for evaluation in evaluations[key]:
            for rule, claims in innovation_claims(evaluation).items():
                per_rule[rule].append(claims)
        for rule in INNOVATION_RULES:
            if role == "alternative":
                metrics = alternative_metrics(per_rule[rule], [CHANGE_DAY] * len(per_rule[rule]))
            else:
                metrics = null_metrics(per_rule[rule])
            innovation[rule][key] = {"role": role, "gating": gating, **metrics}

    steady_offset = CONFIGS.index(("steady", "daily")) * n_series
    clean = evaluations["steady/daily"]
    for magnitude in BAD_READING_MAGNITUDES_KG:
        block = SEED_BASES["e7"]
        shifted = [
            evaluate_series(
                with_bad_reading(
                    draw("steady", "daily", block.at(steady_offset + i), params), magnitude
                ),
                params,
            )
            for i in range(n_series)
        ]
        label = f"bad_reading/+{magnitude:g}kg"
        for placement, offset in PLACEMENTS.items():
            clean_claims: dict[str, list[Claims]] = {rule: [] for rule in PLAN_RULES}
            shifted_claims: dict[str, list[Claims]] = {rule: [] for rule in PLAN_RULES}
            for base, moved in zip(clean, shifted, strict=True):
                band = PlanBand(base.initial_true_rate - offset * PLAN_TOLERANCE_KG_PER_WEEK)
                for rule, claims in plan_claims(base, band).items():
                    clean_claims[rule].append(claims)
                for rule, claims in plan_claims(moved, band).items():
                    shifted_claims[rule].append(claims)
            for rule in PLAN_RULES:
                plan[rule][f"{label}@{placement}"] = {
                    "role": "bad_reading",
                    "gating": True,
                    **bad_reading_metrics(clean_claims[rule], shifted_claims[rule]),
                }
        clean_innov = [innovation_claims(e) for e in clean]
        shifted_innov = [innovation_claims(e) for e in shifted]
        for rule in INNOVATION_RULES:
            innovation[rule][label] = {
                "role": "bad_reading",
                "gating": True,
                **bad_reading_metrics(
                    [c[rule] for c in clean_innov], [c[rule] for c in shifted_innov]
                ),
            }

    return {"plan_rules": plan, "innovation_rules": innovation}


# ---------------------------------------------------------------------------
# The pre-registered verdict
# ---------------------------------------------------------------------------


def _check(name: str, value: float | None, passed: bool, note: str = "") -> dict[str, Any]:
    return {"check": name, "value": value, "passed": passed, "note": note}


def _null_checks(table: dict[str, Any], keys: Sequence[str]) -> list[dict[str, Any]]:
    limits = PREREGISTRATION["criteria"]["r_a"]
    checks = []
    for key in keys:
        phase = table[key]["phase_claim"]
        checks.append(
            _check(
                f"R-A {key} phase false-claim rate",
                phase["rate"],
                phase["rate"] <= limits["phase_false_claim_max"]
                and phase["ci_hi"] <= limits["wilson_upper_max"],
                f"Wilson upper {phase['ci_hi']:.4f}",
            )
        )
    return checks


def _bad_checks(table: dict[str, Any], keys: Sequence[str]) -> list[dict[str, Any]]:
    limit = PREREGISTRATION["criteria"]["r_b"]["attributable_max"]
    return [
        _check(
            f"R-B {key} attributable claim rate",
            table[key]["attributable_claim"]["rate"],
            table[key]["attributable_claim"]["rate"] <= limit,
        )
        for key in keys
    ]


def _delay_ok(entry: dict[str, Any], limit: float) -> bool:
    median = entry["median_delay_days"]
    return median is not None and median <= limit


def assess_plan_rule(rule: str, table: dict[str, Any], schedule: str = "daily") -> dict[str, Any]:
    """Apply R-A, R-B and R-C to one plan-relative rule on ``schedule`` (daily gates)."""
    limits = PREREGISTRATION["criteria"]["r_c_plan"]
    if schedule == "daily":
        null_keys = [
            f"{config}@{placement}"
            for config in ("steady/daily", "steady_irregular/irregular", "steady_missing/missing")
            for placement in PLACEMENTS
        ]
        bad_keys = [
            f"bad_reading/+{m:g}kg@{placement}"
            for m in BAD_READING_MAGNITUDES_KG
            for placement in PLACEMENTS
        ]
    else:
        null_keys = [f"steady/{schedule}@{placement}" for placement in PLACEMENTS]
        bad_keys = []
    checks = _null_checks(table, null_keys) + _bad_checks(table, bad_keys)

    plateau = table[f"plateau/{schedule}@centre"]
    checks.append(
        _check(
            f"R-C plateau/{schedule} detected within 28 days",
            plateau["detected_within_28"]["rate"],
            plateau["detected_within_28"]["rate"] >= limits["plateau_within_28_min"],
        )
    )
    checks.append(
        _check(
            f"R-C plateau/{schedule} median delay",
            plateau["median_delay_days"],
            _delay_ok(plateau, limits["plateau_median_delay_max_days"]),
        )
    )
    if schedule == "daily":
        for key, minimum in (
            ("gradual_rate_change/daily@centre", limits["gradual_by_end_min"]),
            ("curved/daily@centre", limits["curved_by_end_min"]),
        ):
            rate = table[key]["detected_by_end"]["rate"]
            checks.append(_check(f"R-C {key} detected by day 84", rate, rate >= minimum))
    return {
        "checks": checks,
        "n_failed": sum(1 for c in checks if not c["passed"]),
        "eligible": all(c["passed"] for c in checks),
    }


def assess_innovation_rule(
    rule: str, table: dict[str, Any], schedule: str = "daily"
) -> dict[str, Any]:
    """Apply R-A, R-B and R-C to one innovation rule on ``schedule`` (daily gates)."""
    limits = PREREGISTRATION["criteria"]["r_c_innovation"]
    if schedule == "daily":
        null_keys = [
            "model_consistent/daily",
            "steady/daily",
            "steady_irregular/irregular",
            "steady_missing/missing",
        ]
        bad_keys = [f"bad_reading/+{m:g}kg" for m in BAD_READING_MAGNITUDES_KG]
    else:
        null_keys = [f"model_consistent/{schedule}", f"steady/{schedule}"]
        bad_keys = []
    checks = _null_checks(table, null_keys) + _bad_checks(table, bad_keys)

    shift = table[f"level_shift/{schedule}"]
    checks.append(
        _check(
            f"R-C level_shift/{schedule} detected within 14 days",
            shift["detected_within_14"]["rate"],
            shift["detected_within_14"]["rate"] >= limits["level_shift_within_14_min"],
        )
    )
    plateau = table[f"plateau/{schedule}"]
    checks.append(
        _check(
            f"R-C plateau/{schedule} detected within 28 days",
            plateau["detected_within_28"]["rate"],
            plateau["detected_within_28"]["rate"] >= limits["plateau_within_28_min"],
        )
    )
    checks.append(
        _check(
            f"R-C plateau/{schedule} median delay",
            plateau["median_delay_days"],
            _delay_ok(plateau, limits["plateau_median_delay_max_days"]),
        )
    )
    return {
        "checks": checks,
        "n_failed": sum(1 for c in checks if not c["passed"]),
        "eligible": all(c["passed"] for c in checks),
    }


def run(scale: str) -> dict[str, Any]:
    """Run every E7 configuration and apply the pre-registered criteria to every rule."""
    params = ModelParams.default()
    n_series = FULL_N_SERIES if scale == "full" else SMOKE_N_SERIES
    tables = run_all(n_series, params)

    eligibility: dict[str, Any] = {}
    for rule in PLAN_RULES:
        daily = assess_plan_rule(rule, tables["plan_rules"][rule])
        eligibility[rule] = {
            "family": "plan",
            "daily": daily,
            "extends_to": {
                schedule: assess_plan_rule(rule, tables["plan_rules"][rule], schedule)["eligible"]
                for schedule in ("3.5d", "weekly")
            },
            "eligible": daily["eligible"],
        }
    for rule in INNOVATION_RULES:
        daily = assess_innovation_rule(rule, tables["innovation_rules"][rule])
        eligibility[rule] = {
            "family": "innovation",
            "daily": daily,
            "extends_to": {
                schedule: assess_innovation_rule(rule, tables["innovation_rules"][rule], schedule)[
                    "eligible"
                ]
                for schedule in ("3.5d", "weekly")
            },
            "eligible": daily["eligible"],
        }

    eligible = sorted(rule for rule, entry in eligibility.items() if entry["eligible"])
    results: dict[str, Any] = {
        **tables,
        "eligibility": eligibility,
        "eligible_rules": eligible,
        "n_eligible_rules": len(eligible),
        "n_rules": len(eligibility),
        "n_series_per_config": n_series,
    }
    config = RunConfig.build(
        "e7",
        scale,
        seed_keys=("e7",),
        grid={
            "configs": [config_key(r, s) for r, s in CONFIGS],
            "roles": {
                family: {k: list(v) for k, v in table.items()} for family, table in ROLES.items()
            },
            "placements": PLACEMENTS,
            "bad_reading_magnitudes_kg": list(BAD_READING_MAGNITUDES_KG),
            "checkin_days": list(CHECKIN_DAYS),
            "primary_checkin_days": list(PRIMARY_CHECKIN_DAYS),
            "n_series": n_series,
            "preregistration": PREREGISTRATION,
        },
    )
    return {"_config": config, "results": results}
