"""Unit conversions and prior interpretation. Test IDs U1-U3."""

from __future__ import annotations

import math

import pytest

from app.core.types import (
    DEFAULT_INITIAL_WEEKLY_RATE_SPREAD_KG_PER_WEEK,
    DEFAULT_SIGMA_OBS_KG,
    DEFAULT_WEEKLY_RATE_DRIFT_KG_PER_WEEK,
    CoreError,
    ModelParams,
)
from app.core.units import (
    DAYS_PER_WEEK,
    KG_PER_LB,
    kg_to_lb,
    lb_to_kg,
    per_day_to_per_week,
    per_week_to_per_day,
    sigma_accel_from_weekly_rate_drift,
    weekly_rate_drift_from_sigma_accel,
)

# --- U1: pounds ------------------------------------------------------------


def test_u1_pound_definition_is_exact():
    assert KG_PER_LB == 0.45359237


def test_u1_pound_conversion_matches_the_definition():
    assert lb_to_kg(150.0) == 150.0 * 0.45359237


def test_u1_pound_conversion_round_trips():
    for pounds in (0.1, 1.0, 150.0, 154.3, 400.0):
        assert kg_to_lb(lb_to_kg(pounds)) == pytest.approx(pounds, rel=1e-12)


# --- U2: weekly rate -------------------------------------------------------


def test_u2_days_per_week():
    assert DAYS_PER_WEEK == 7.0


def test_u2_daily_velocity_becomes_a_weekly_rate():
    # -0.05 kg/day is the -0.35 kg/week the product would display.
    assert per_day_to_per_week(-0.05) == pytest.approx(-0.35, rel=1e-15)


def test_u2_weekly_rate_round_trips():
    for weekly in (-1.5, -0.35, 0.0, 0.2, 1.0):
        assert per_day_to_per_week(per_week_to_per_day(weekly)) == pytest.approx(weekly, rel=1e-15)


def test_u2_standard_deviations_scale_by_the_same_factor():
    # A velocity SD converts exactly like a velocity: the transform is linear.
    assert per_day_to_per_week(0.02) == pytest.approx(0.14, rel=1e-15)


# --- U3: interpretable priors ---------------------------------------------


def test_u3_sigma_accel_round_trips():
    for drift in (0.05, 0.15, 0.5, 1.0):
        recovered = weekly_rate_drift_from_sigma_accel(sigma_accel_from_weekly_rate_drift(drift))
        assert recovered == pytest.approx(drift, rel=1e-12)


def test_u3_sigma_accel_matches_the_documented_derivation():
    # sigma_a = d / (7 * sqrt(7)); the default d = 0.15 kg/week per week.
    expected = 0.15 / (7.0 * math.sqrt(7.0))
    assert sigma_accel_from_weekly_rate_drift(0.15) == pytest.approx(expected, rel=1e-15)
    # Recorded so the documented default cannot drift silently.
    assert sigma_accel_from_weekly_rate_drift(0.15) == pytest.approx(0.0080992, abs=1e-7)


def test_u3_velocity_drift_over_a_week_has_the_stated_meaning():
    # The prior says: over 7 days the weekly rate can wander by `drift` kg/week.
    drift = 0.15
    sigma_accel = sigma_accel_from_weekly_rate_drift(drift)
    velocity_sd_after_a_week = sigma_accel * math.sqrt(7.0)  # kg/day
    assert per_day_to_per_week(velocity_sd_after_a_week) == pytest.approx(drift, rel=1e-12)


# --- Model parameters ------------------------------------------------------


def test_default_params_use_the_documented_priors():
    p = ModelParams.default()
    assert p.sigma_obs_kg == DEFAULT_SIGMA_OBS_KG
    assert p.obs_variance == pytest.approx(0.25)
    assert p.weekly_rate_drift_kg_per_week == pytest.approx(
        DEFAULT_WEEKLY_RATE_DRIFT_KG_PER_WEEK, rel=1e-12
    )
    assert p.initial_weekly_rate_spread_kg_per_week == pytest.approx(
        DEFAULT_INITIAL_WEEKLY_RATE_SPREAD_KG_PER_WEEK, rel=1e-12
    )
    assert p.sigma_v0 == pytest.approx(1.0 / 7.0, rel=1e-12)


@pytest.mark.parametrize(
    "kwargs",
    [
        {"sigma_obs_kg": 0.0, "sigma_accel": 0.01, "sigma_v0": 0.1},
        {"sigma_obs_kg": 0.5, "sigma_accel": -1.0, "sigma_v0": 0.1},
        {"sigma_obs_kg": 0.5, "sigma_accel": 0.01, "sigma_v0": float("nan")},
        {"sigma_obs_kg": float("inf"), "sigma_accel": 0.01, "sigma_v0": 0.1},
    ],
)
def test_params_reject_non_positive_or_non_finite_values(kwargs):
    with pytest.raises(CoreError):
        ModelParams(**kwargs)


def test_params_to_dict_is_json_friendly():
    payload = ModelParams.default().to_dict()
    assert set(payload) == {
        "sigma_obs_kg",
        "sigma_accel",
        "sigma_v0",
        "weekly_rate_drift_kg_per_week",
        "initial_weekly_rate_spread_kg_per_week",
    }
    assert all(isinstance(value, float) for value in payload.values())
