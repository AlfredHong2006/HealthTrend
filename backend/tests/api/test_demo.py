"""The demo catalogue and the five scenarios.

Two properties matter beyond "it returns 200": every scenario must be reproducible under a
fixed clock, and every scenario must end near the present. The second one is easy to get
wrong and expensive when it is: because forecast variance carries a ``tau**3`` term, a series
anchored to a fixed past date would return a band tens of kilograms wide.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.demo.scenarios import SCENARIO_IDS, catalogue, generate
from app.errors import UnknownScenarioError
from tests.api.conftest import FROZEN_NOW, build_app

EXPECTED_SCENARIOS = ("gradual-loss", "plateau", "reversal", "noisy", "irregular")


# --- catalogue ------------------------------------------------------------


def test_the_catalogue_lists_exactly_the_registered_scenarios(client: TestClient):
    body = client.get("/api/demo").json()
    assert [scenario["id"] for scenario in body["scenarios"]] == list(EXPECTED_SCENARIOS)
    assert list(SCENARIO_IDS) == list(EXPECTED_SCENARIOS)


def test_the_catalogue_declares_itself_synthetic(client: TestClient):
    body = client.get("/api/demo").json()
    assert body["synthetic"] is True
    for scenario in body["scenarios"]:
        assert "synthetic" in scenario["label"].lower()


def test_every_catalogued_scenario_describes_itself(client: TestClient):
    for scenario in client.get("/api/demo").json()["scenarios"]:
        assert scenario["title"]
        assert scenario["description"]
        assert {"seed", "n_obs", "start_kg", "noise_sd_kg"} <= set(scenario["parameters"])


def test_the_catalogue_exposes_no_internal_code_paths(client: TestClient):
    """A Python module path is not a stable public identifier.

    The parameters block once published `app.demo.scenarios.generate`, which made renaming
    an internal function a breaking API change. Provenance is the scenario id, the seed and
    the generator arguments -- never where the code happens to live.
    """
    for scenario in client.get("/api/demo").json()["scenarios"]:
        assert "app." not in json.dumps(scenario["parameters"])


def test_the_catalogue_generates_no_data(client: TestClient):
    """Listing scenarios must not cost a hundred Kalman updates each."""
    body = client.get("/api/demo").json()
    assert all("observations" not in scenario for scenario in body["scenarios"])


# --- each scenario --------------------------------------------------------


@pytest.mark.parametrize("scenario_id", EXPECTED_SCENARIOS)
def test_each_scenario_analyses_successfully(strict_client: TestClient, scenario_id: str):
    response = strict_client.get(f"/api/demo/{scenario_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["n_obs"] > 1
    assert len(body["trajectory"]) == body["n_obs"]
    assert body["current"]["w_sd"] > 0.0
    assert len(body["forecast"]["horizons"]) == 3


@pytest.mark.parametrize("scenario_id", EXPECTED_SCENARIOS)
def test_each_scenario_is_marked_synthetic(strict_client: TestClient, scenario_id: str):
    """`meta.source` says the API generated this data; the label spells out synthetic."""
    body = strict_client.get(f"/api/demo/{scenario_id}").json()
    assert body["meta"]["source"] == "demo"
    assert "synthetic" in body["scenario"]["label"].lower()
    assert body["scenario"]["id"] == scenario_id


@pytest.mark.parametrize("scenario_id", EXPECTED_SCENARIOS)
def test_each_scenario_ends_just_before_now(strict_client: TestClient, scenario_id: str):
    """Anchored to the clock, not to a fixed date. See the module docstring."""
    body = strict_client.get(f"/api/demo/{scenario_id}").json()
    last = datetime.fromisoformat(body["forecast"]["last_observation_timestamp"])
    lead_days = (FROZEN_NOW - last).total_seconds() / 86400.0
    assert 0.0 < lead_days <= 1.0


@pytest.mark.parametrize("scenario_id", EXPECTED_SCENARIOS)
def test_each_scenario_returns_a_plausible_forecast_band(
    strict_client: TestClient, scenario_id: str
):
    """A first impression must be informative, which means the band cannot be absurd."""
    body = strict_client.get(f"/api/demo/{scenario_id}").json()
    at_30 = next(p for p in body["forecast"]["horizons"] if p["horizon_days"] == 30.0)
    width = at_30["w_upper95"] - at_30["w_lower95"]
    assert 0.2 < width < 8.0
    assert 40.0 < at_30["w_kg"] < 150.0


@pytest.mark.parametrize("scenario_id", EXPECTED_SCENARIOS)
def test_each_scenario_is_chronological(strict_client: TestClient, scenario_id: str):
    stamps = [
        point["timestamp"]
        for point in strict_client.get(f"/api/demo/{scenario_id}").json()["observations"]
    ]
    assert stamps == sorted(stamps)


# --- the shapes the scenarios are supposed to show ------------------------


def test_gradual_loss_is_estimated_as_a_loss(strict_client: TestClient):
    body = strict_client.get("/api/demo/gradual-loss").json()
    assert body["current"]["weekly_rate_kg"] < -0.1


def test_reversal_ends_with_the_velocity_pointing_the_other_way(strict_client: TestClient):
    """The estimator has to change the sign of its velocity, with the lag that implies."""
    body = strict_client.get("/api/demo/reversal").json()
    assert body["current"]["weekly_rate_kg"] > 0.0


def test_plateau_ends_slower_than_it_began(strict_client: TestClient):
    body = strict_client.get("/api/demo/plateau").json()
    assert body["current"]["weekly_rate_kg"] > -0.45


def test_irregular_spans_far_more_days_than_it_has_readings(strict_client: TestClient):
    body = strict_client.get("/api/demo/irregular").json()
    assert body["span_days"] > 3.0 * body["n_obs"]


def test_noisy_readings_scatter_further_from_the_trend_than_gradual_loss(
    strict_client: TestClient,
):
    def mean_absolute_residual(scenario_id: str) -> float:
        body = strict_client.get(f"/api/demo/{scenario_id}").json()
        residuals = [
            abs(observation["weight_kg"] - point["w_kg"])
            for observation, point in zip(body["observations"], body["trajectory"], strict=True)
        ]
        return sum(residuals) / len(residuals)

    assert mean_absolute_residual("noisy") > mean_absolute_residual("gradual-loss")


# --- determinism ----------------------------------------------------------


@pytest.mark.parametrize("scenario_id", EXPECTED_SCENARIOS)
def test_a_scenario_is_byte_identical_under_the_same_clock(
    strict_client: TestClient, scenario_id: str
):
    first = strict_client.get(f"/api/demo/{scenario_id}").content
    second = strict_client.get(f"/api/demo/{scenario_id}").content
    assert first == second


def test_the_same_clock_in_a_fresh_application_gives_the_same_series():
    """Determinism must come from the seed and the clock, not from process state."""
    first = TestClient(build_app()).get("/api/demo/plateau").content
    second = TestClient(build_app()).get("/api/demo/plateau").content
    assert first == second


def test_advancing_the_clock_moves_the_dates_but_not_the_shape():
    later = FROZEN_NOW + timedelta(days=10)
    original = TestClient(build_app()).get("/api/demo/gradual-loss").json()
    shifted = TestClient(build_app(later)).get("/api/demo/gradual-loss").json()

    assert shifted["observations"][0]["timestamp"] != original["observations"][0]["timestamp"]
    assert shifted["n_obs"] == original["n_obs"]
    assert shifted["observations"][0]["weight_kg"] == pytest.approx(
        original["observations"][0]["weight_kg"]
    )
    assert shifted["current"]["w_kg"] == pytest.approx(original["current"]["w_kg"])


def test_generating_directly_needs_no_http_layer():
    """The demo package is usable from a script, which is why it holds no HTTP types."""
    series = generate("gradual-loss", FROZEN_NOW)
    assert len(series.observations) == series.spec.n_obs
    assert series.observations[-1].timestamp < FROZEN_NOW


# --- errors ---------------------------------------------------------------


def test_an_unknown_scenario_is_a_404(client: TestClient):
    response = client.get("/api/demo/does-not-exist")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_scenario"


def test_an_unknown_scenario_raises_a_named_error_below_http():
    with pytest.raises(UnknownScenarioError):
        generate("does-not-exist", FROZEN_NOW)


def test_the_registry_and_the_catalogue_cannot_disagree():
    assert tuple(spec.scenario_id for spec in catalogue()) == SCENARIO_IDS
