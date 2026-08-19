"""End-to-end analysis, determinism and golden regression. Test IDs A1-A3.

To regenerate the golden fixture after a *deliberate* change to the mathematics, run from
``backend/``::

    uv run python -m tests.core.regenerate_golden

and review the diff. A change to that file is a change to the model, and should never be
accepted casually.
"""

from __future__ import annotations

import json
from datetime import timedelta
from pathlib import Path

import pytest

from app.core.analyse import run_analysis
from app.core.model import validate_covariance
from app.core.types import (
    InsufficientDataError,
    ModelParams,
    Observation,
    UnsortedObservationsError,
)
from testing.synthetic import DEFAULT_START, gradual_loss_series, irregular_loss_series

GOLDEN_PATH = Path(__file__).parents[1] / "fixtures" / "golden_gradual_loss.json"

GOLDEN_SCENARIO = {"start_kg": 80.0, "rate_kg_per_week": -0.35, "n_obs": 60, "noise_sd_kg": 0.4}
GOLDEN_SEED = 20250819


def build_golden_result():
    """Construct the exact analysis the golden fixture records."""
    series = gradual_loss_series(seed=GOLDEN_SEED, **GOLDEN_SCENARIO)
    return run_analysis(series.observations, ModelParams.default())


# --- A1: determinism ------------------------------------------------------


def test_a1_the_same_input_produces_byte_identical_output():
    first = json.dumps(build_golden_result().to_dict(), sort_keys=True)
    second = json.dumps(build_golden_result().to_dict(), sort_keys=True)
    assert first == second


def test_a1_the_output_is_json_serialisable():
    payload = json.dumps(build_golden_result().to_dict(), sort_keys=True)
    assert json.loads(payload)["n_obs"] == GOLDEN_SCENARIO["n_obs"]


# --- A2: golden regression ------------------------------------------------


def test_a2_the_analysis_matches_the_committed_golden_fixture():
    expected = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    actual = build_golden_result().to_dict()

    assert actual["n_obs"] == expected["n_obs"]
    assert actual["params"] == pytest.approx(expected["params"], rel=1e-10)
    assert actual["span_days"] == pytest.approx(expected["span_days"], rel=1e-10)
    assert actual["loglik"] == pytest.approx(expected["loglik"], rel=1e-10)

    assert len(actual["trajectory"]) == len(expected["trajectory"])
    for got, want in zip(actual["trajectory"], expected["trajectory"], strict=True):
        assert got["timestamp"] == want["timestamp"]
        for key in ("w_kg", "w_sd", "w_lower95", "w_upper95"):
            assert got[key] == pytest.approx(want[key], rel=1e-10)

    for key in ("w_kg", "w_sd", "v_kg_per_day", "weekly_rate_kg", "weekly_rate_sd_kg"):
        assert actual["current"][key] == pytest.approx(expected["current"][key], rel=1e-10)

    assert len(actual["forecast"]["points"]) == len(expected["forecast"]["points"])
    for got, want in zip(actual["forecast"]["points"], expected["forecast"]["points"], strict=True):
        assert got["timestamp"] == want["timestamp"]
        assert got["horizon_days"] == pytest.approx(want["horizon_days"], rel=1e-12)
        for key in ("w_kg", "w_sd", "w_lower95", "w_upper95"):
            assert got[key] == pytest.approx(want[key], rel=1e-10)


def test_a2_the_fixture_is_labelled_synthetic():
    expected = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    assert "synthetic" in expected["_scenario"]["label"].lower()


# --- A3: shape and internal consistency ----------------------------------


def test_a3_one_trajectory_point_per_observation(params: ModelParams):
    series = irregular_loss_series(n_obs=45, noise_sd_kg=0.4, seed=5)
    result = run_analysis(series.observations, params)
    assert len(result.trajectory) == result.n_obs == 45
    assert len(result.observations) == 45


def test_a3_trajectory_timestamps_are_non_decreasing_and_match_the_observations(
    params: ModelParams,
):
    series = irregular_loss_series(n_obs=45, noise_sd_kg=0.4, seed=5)
    result = run_analysis(series.observations, params)
    stamps = [point.timestamp for point in result.trajectory]
    assert stamps == sorted(stamps)
    assert stamps == [obs.timestamp for obs in result.observations]


def test_a3_every_trajectory_point_brackets_its_estimate(params: ModelParams):
    series = irregular_loss_series(n_obs=45, noise_sd_kg=0.4, seed=5)
    result = run_analysis(series.observations, params)
    for point in result.trajectory:
        assert point.w_lower95 < point.w_kg < point.w_upper95
        assert point.w_sd > 0.0


def test_a3_the_current_estimate_is_the_last_trajectory_point(params: ModelParams):
    series = irregular_loss_series(n_obs=45, noise_sd_kg=0.4, seed=5)
    result = run_analysis(series.observations, params)
    last = result.trajectory[-1]
    assert result.current.timestamp == last.timestamp
    assert result.current.w_kg == last.w_kg
    assert result.current.w_sd == last.w_sd
    assert result.current.timestamp == result.observations[-1].timestamp


def test_a3_the_span_is_the_elapsed_time_of_the_series(params: ModelParams):
    series = irregular_loss_series(n_obs=45, seed=5)
    result = run_analysis(series.observations, params)
    assert result.span_days == pytest.approx(series.elapsed_days[-1], rel=1e-12)


def test_a3_the_forecast_starts_at_the_last_observation_by_default(params: ModelParams):
    series = irregular_loss_series(n_obs=45, seed=5)
    result = run_analysis(series.observations, params)
    assert result.forecast.origin_timestamp == result.observations[-1].timestamp
    assert result.forecast.horizon_days == 30.0
    assert result.forecast.terminal.horizon_days == 30.0


def test_a3_the_forecast_continues_the_trajectory_without_a_discontinuity(
    params: ModelParams,
):
    series = irregular_loss_series(n_obs=45, seed=5)
    result = run_analysis(series.observations, params)
    join = result.forecast.points[0]
    assert join.w_kg == result.trajectory[-1].w_kg
    assert join.w_sd == pytest.approx(result.trajectory[-1].w_sd, rel=1e-15)


def test_a3_covariances_stay_valid_throughout(params: ModelParams):
    series = irregular_loss_series(n_obs=45, noise_sd_kg=0.4, seed=5)
    result = run_analysis(series.observations, params)
    for state in result.filter_result.posteriors:
        validate_covariance(state.P)


# --- Milestone 1 acceptance path in one test -----------------------------


def test_the_milestone_one_spine_end_to_end(params: ModelParams):
    """Timestamped measurements -> latent trajectory -> uncertainty -> velocity -> forecast."""
    series = irregular_loss_series(
        start_kg=80.0, rate_kg_per_week=-0.35, n_obs=60, noise_sd_kg=0.4, seed=2
    )
    result = run_analysis(series.observations, params)

    assert result.current.w_kg == pytest.approx(series.final_true_weight_kg, abs=1.0)
    assert result.current.w_sd > 0.0
    assert result.current.weekly_rate_kg < 0.0
    forecast = result.forecast.terminal
    assert forecast.w_kg < result.current.w_kg
    assert forecast.w_lower95 < forecast.w_kg < forecast.w_upper95
    assert forecast.w_sd > result.current.w_sd


# --- Error propagation ---------------------------------------------------


def test_analysis_rejects_an_empty_series():
    with pytest.raises(InsufficientDataError):
        run_analysis([])


def test_analysis_rejects_unsorted_observations():
    observations = [
        Observation(timestamp=DEFAULT_START + timedelta(days=2), weight_kg=72.0),
        Observation(timestamp=DEFAULT_START, weight_kg=71.5),
    ]
    with pytest.raises(UnsortedObservationsError):
        run_analysis(observations)


def test_analysis_works_from_a_single_observation():
    result = run_analysis([Observation(timestamp=DEFAULT_START, weight_kg=72.4)])
    assert result.n_obs == 1
    assert result.span_days == 0.0
    assert result.current.weekly_rate_kg == 0.0
    assert len(result.trajectory) == 1
    assert result.forecast.terminal.w_kg == 72.4
