"""Forecast propagation. Test IDs P1-P9."""

from __future__ import annotations

from datetime import timedelta

import numpy as np
import pytest

from app.core.filter import run_filter
from app.core.forecast import forecast_at, forecast_path, propagate
from app.core.types import (
    Z_95,
    CoreError,
    ModelParams,
    Observation,
    StateEstimate,
)
from testing.synthetic import DEFAULT_START, constant_series, gradual_loss_series


def _state(w: float = 72.0, v: float = -0.05, P=None) -> StateEstimate:
    covariance = np.array([[0.20, 0.01], [0.01, 0.004]]) if P is None else P
    return StateEstimate(timestamp=DEFAULT_START, w_kg=w, v_kg_per_day=v, P=covariance)


def _expected_w_var(state: StateEstimate, h: float, params: ModelParams) -> float:
    return (
        state.w_var
        + 2.0 * h * state.wv_cov
        + h * h * state.v_var
        + params.sigma_accel**2 * h**3 / 3.0
    )


# --- P1: a flat trend forecasts flat, with a widening band -----------------


def test_p1_zero_velocity_gives_a_flat_forecast(params: ModelParams):
    state = _state(w=70.0, v=0.0)
    result = forecast_path(state, params, 30.0)
    assert all(point.w_kg == pytest.approx(70.0, rel=1e-15) for point in result.points)


def test_p1_the_band_widens_monotonically_with_horizon(params: ModelParams):
    result = forecast_path(_state(), params, 90.0)
    widths = [point.w_upper95 - point.w_lower95 for point in result.points]
    assert widths == sorted(widths)
    assert len(set(widths)) == len(widths)


# --- P2: the forecast mean ------------------------------------------------


@pytest.mark.parametrize("h", (0.0, 1.0, 7.0, 30.0, 90.0, 365.0))
def test_p2_the_forecast_mean_extrapolates_the_current_trend(h, params: ModelParams):
    state = _state(w=72.0, v=-0.05)
    point = forecast_at(state, params, h)
    assert point.w_kg == pytest.approx(72.0 - 0.05 * h, rel=1e-14, abs=1e-14)


def test_p2_a_thirty_day_forecast_is_a_plausible_product_number(params: ModelParams):
    # -0.35 kg/week over 30 days is -1.5 kg.
    point = forecast_at(_state(w=72.2, v=-0.05), params, 30.0)
    assert point.w_kg == pytest.approx(70.7, abs=1e-9)


# --- P3: the forecast variance -------------------------------------------


@pytest.mark.parametrize("h", (0.0, 1.0, 7.0, 30.0, 90.0))
def test_p3_the_interval_matches_the_closed_form(h, params: ModelParams):
    state = _state()
    point = forecast_at(state, params, h)
    expected_var = _expected_w_var(state, h, params)

    assert point.w_sd == pytest.approx(np.sqrt(expected_var), rel=1e-14)
    half_width = Z_95 * np.sqrt(expected_var)
    assert point.w_upper95 - point.w_kg == pytest.approx(half_width, rel=1e-14)
    assert point.w_kg - point.w_lower95 == pytest.approx(half_width, rel=1e-14)


def test_p3_propagate_agrees_with_the_closed_form(params: ModelParams):
    state = _state()
    _, P = propagate(state, 30.0, params)
    assert float(P[0, 0]) == pytest.approx(_expected_w_var(state, 30.0, params), rel=1e-14)


def test_p3_the_cubic_process_noise_term_dominates_at_long_horizons(params: ModelParams):
    # Confirms the h**3 term is present, which is what makes distant forecasts vague.
    state = _state(P=np.zeros((2, 2)) + np.array([[1e-12, 0.0], [0.0, 1e-16]]))
    point = forecast_at(state, params, 365.0)
    drift_only = np.sqrt(params.sigma_accel**2 * 365.0**3 / 3.0)
    assert point.w_sd == pytest.approx(drift_only, rel=1e-3)


# --- P4: the forecast path ------------------------------------------------


def test_p4_a_daily_path_to_thirty_days_has_thirty_one_points(params: ModelParams):
    result = forecast_path(_state(), params, 30.0, step_days=1.0)
    assert len(result.points) == 31
    assert [point.horizon_days for point in result.points] == [float(i) for i in range(31)]


def test_p4_horizon_zero_reproduces_the_state_being_forecast_from(params: ModelParams):
    state = _state()
    first = forecast_path(state, params, 30.0).points[0]
    assert first.horizon_days == 0.0
    assert first.w_kg == state.w_kg
    assert first.w_sd == pytest.approx(state.w_sd, rel=1e-15)
    assert first.timestamp == state.timestamp


def test_p4_the_last_path_point_equals_the_single_horizon_forecast(params: ModelParams):
    state = _state()
    terminal = forecast_path(state, params, 30.0, step_days=1.0).terminal
    single = forecast_at(state, params, 30.0)
    assert terminal.w_kg == single.w_kg
    assert terminal.w_sd == single.w_sd
    assert terminal.timestamp == single.timestamp


def test_p4_the_path_step_does_not_change_the_endpoint(params: ModelParams):
    state = _state()
    endpoints = {
        forecast_path(state, params, 30.0, step_days=step).terminal.w_sd
        for step in (0.5, 1.0, 3.0, 7.0, 30.0)
    }
    assert len(endpoints) == 1


def test_p4_a_ragged_step_still_terminates_exactly_at_the_horizon(params: ModelParams):
    result = forecast_path(_state(), params, 30.0, step_days=7.0)
    horizons = [point.horizon_days for point in result.points]
    assert horizons == [0.0, 7.0, 14.0, 21.0, 28.0, 30.0]
    assert result.terminal.horizon_days == 30.0


def test_p4_point_at_finds_a_horizon_and_rejects_a_missing_one(params: ModelParams):
    result = forecast_path(_state(), params, 30.0, step_days=7.0)
    assert result.point_at(14.0).horizon_days == 14.0
    with pytest.raises(CoreError):
        result.point_at(13.0)


def test_p4_path_timestamps_advance_with_the_horizon(params: ModelParams):
    result = forecast_path(_state(), params, 30.0, step_days=7.0)
    for point in result.points:
        assert point.timestamp == DEFAULT_START + timedelta(days=point.horizon_days)


# --- P5: the forecast origin ----------------------------------------------


def test_p5_shifting_the_origin_is_the_same_as_extending_the_horizon(params: ModelParams):
    state = _state()
    origin = DEFAULT_START + timedelta(days=5)

    from_origin = forecast_at(state, params, 30.0, origin=origin)
    from_state = forecast_at(state, params, 35.0)

    assert from_origin.w_kg == pytest.approx(from_state.w_kg, rel=1e-14)
    assert from_origin.w_sd == pytest.approx(from_state.w_sd, rel=1e-14)
    assert from_origin.timestamp == from_state.timestamp
    # Only the label differs: one is "30 days from now", the other "35 days from then".
    assert from_origin.horizon_days == 30.0
    assert from_state.horizon_days == 35.0


@pytest.mark.parametrize(("lead", "h"), ((5.0, 30.0), (0.5, 7.0), (12.0, 90.0), (3.0, 0.0)))
def test_p5_propagation_uses_the_total_elapsed_time_not_just_the_horizon(
    lead, h, params: ModelParams
):
    """The state is propagated over (t_origin - t_T) + h, verified against the closed form.

    Checked directly rather than only by comparing two code paths, so that computing the
    lead time wrongly -- or dropping it -- cannot pass. The mean and the variance are both
    pinned, since a dropped lead term would show up in each.
    """
    state = _state(w=72.0, v=-0.05)
    total = lead + h
    point = forecast_at(state, params, h, origin=DEFAULT_START + timedelta(days=lead))

    assert point.w_kg == pytest.approx(72.0 - 0.05 * total, rel=1e-14, abs=1e-14)
    assert point.w_sd == pytest.approx(np.sqrt(_expected_w_var(state, total, params)), rel=1e-14)
    # The point sits h days after the origin, which is total days after the state.
    assert point.timestamp == DEFAULT_START + timedelta(days=total)
    # And the horizon it reports is measured from the origin, not from the state.
    assert point.horizon_days == h


def test_p5_the_lead_time_is_not_silently_dropped(params: ModelParams):
    """A non-zero lead must change the answer. Guards against `total = h`."""
    state = _state()
    no_lead = forecast_at(state, params, 30.0)
    with_lead = forecast_at(state, params, 30.0, origin=DEFAULT_START + timedelta(days=5))
    assert with_lead.w_kg != no_lead.w_kg
    assert with_lead.w_sd > no_lead.w_sd
    assert with_lead.timestamp == no_lead.timestamp + timedelta(days=5)


def test_p5_the_whole_path_is_offset_by_the_lead_time(params: ModelParams):
    lead = 5.0
    origin = DEFAULT_START + timedelta(days=lead)
    state = _state()
    path = forecast_path(state, params, 30.0, step_days=10.0, origin=origin)

    for point in path.points:
        total = lead + point.horizon_days
        assert point.timestamp == origin + timedelta(days=point.horizon_days)
        assert point.w_sd == pytest.approx(
            np.sqrt(_expected_w_var(state, total, params)), rel=1e-14
        )


def test_p5_the_path_origin_is_recorded(params: ModelParams):
    origin = DEFAULT_START + timedelta(days=5)
    result = forecast_path(_state(), params, 30.0, origin=origin)
    assert result.origin_timestamp == origin
    assert result.points[0].timestamp == origin


def test_p5_a_stale_last_weigh_in_widens_the_forecast(params: ModelParams):
    state = _state()
    fresh = forecast_at(state, params, 30.0)
    stale = forecast_at(state, params, 30.0, origin=DEFAULT_START + timedelta(days=10))
    assert stale.w_sd > fresh.w_sd


# --- P6: horizon monotonicity (evidence for the later 7/90 surfaces) -------


def test_p6_uncertainty_grows_across_the_seven_thirty_ninety_day_horizons(
    params: ModelParams,
):
    state = _state()
    widths = [
        forecast_at(state, params, h).w_upper95 - forecast_at(state, params, h).w_lower95
        for h in (7.0, 30.0, 90.0)
    ]
    assert widths[0] < widths[1] < widths[2]


# --- P7: minimal data ----------------------------------------------------


def test_p7_a_single_observation_forecasts_flat_and_very_wide(params: ModelParams):
    result = run_filter([Observation(timestamp=DEFAULT_START, weight_kg=72.4)], params)
    point = forecast_at(result.final, params, 30.0)

    assert point.w_kg == 72.4  # no trend was inferred, so none is extrapolated
    # The width is dominated by the velocity prior carried over 30 days.
    velocity_contribution = params.sigma_v0 * 30.0
    assert point.w_sd > 0.9 * velocity_contribution
    assert point.w_upper95 - point.w_lower95 > 15.0  # honestly says nothing


def test_p7_more_data_narrows_the_thirty_day_forecast(params: ModelParams):
    one = run_filter([Observation(timestamp=DEFAULT_START, weight_kg=80.0)], params).final
    many = run_filter(gradual_loss_series(n_obs=120).observations, params).final
    assert forecast_at(many, params, 30.0).w_sd < forecast_at(one, params, 30.0).w_sd


# --- P8: invalid arguments -----------------------------------------------


def test_p8_an_origin_before_the_state_is_rejected(params: ModelParams):
    with pytest.raises(CoreError, match="must not precede"):
        forecast_at(_state(), params, 30.0, origin=DEFAULT_START - timedelta(days=1))


@pytest.mark.parametrize("h", (-1e-9, -30.0, float("nan"), float("inf")))
def test_p8_an_invalid_horizon_is_rejected(h, params: ModelParams):
    with pytest.raises(CoreError):
        forecast_at(_state(), params, h)
    with pytest.raises(CoreError):
        forecast_path(_state(), params, h)


@pytest.mark.parametrize("step", (0.0, -1.0, float("nan")))
def test_p8_an_invalid_path_step_is_rejected(step, params: ModelParams):
    with pytest.raises(CoreError):
        forecast_path(_state(), params, 30.0, step_days=step)


# --- P9: observation-space intervals ------------------------------------


def test_p9_including_observation_noise_adds_exactly_r(params: ModelParams):
    state = _state()
    latent = forecast_at(state, params, 30.0)
    reading = forecast_at(state, params, 30.0, include_observation_noise=True)

    assert reading.w_kg == latent.w_kg
    assert reading.w_sd**2 == pytest.approx(latent.w_sd**2 + params.obs_variance, rel=1e-14)
    assert reading.w_sd > latent.w_sd


def test_p9_the_default_is_the_latent_interval(params: ModelParams):
    result = forecast_path(_state(), params, 30.0)
    assert result.includes_observation_noise is False


def test_p9_the_flag_is_recorded_on_the_result(params: ModelParams):
    result = forecast_path(_state(), params, 30.0, include_observation_noise=True)
    assert result.includes_observation_noise is True


# --- Consistency with the filter ----------------------------------------


def test_a_flat_history_forecasts_the_same_weight(params: ModelParams):
    result = run_filter(constant_series(weight_kg=70.0, n_obs=60).observations, params)
    point = forecast_at(result.final, params, 30.0)
    assert point.w_kg == pytest.approx(70.0, abs=1e-4)


def test_a_declining_history_forecasts_a_lower_weight(params: ModelParams):
    series = gradual_loss_series(start_kg=80.0, rate_kg_per_week=-0.35, n_obs=120)
    result = run_filter(series.observations, params)
    point = forecast_at(result.final, params, 30.0)
    expected = series.final_true_weight_kg - 0.05 * 30.0
    assert point.w_kg == pytest.approx(expected, abs=0.05)
