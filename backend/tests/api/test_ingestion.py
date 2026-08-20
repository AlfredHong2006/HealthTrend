"""Normalisation at the boundary: units, timezones, ordering and what is kept.

These are the four responsibilities the numerical core explicitly refuses (ADR-0001,
ADR-0004). Each one is checked here through HTTP, because that is where they have to hold,
and a couple are also checked directly against
:func:`app.ingestion.normalise_observations` where the unit under test is the function
rather than the endpoint.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.units import KG_PER_LB
from app.ingestion import normalise_observations
from app.schemas.analysis import MAX_OBSERVATIONS, ObservationIn

JSON_HEADERS = {"content-type": "application/json"}


def observation(timestamp: str, weight: float, unit: str = "kg") -> dict[str, object]:
    return {"timestamp": timestamp, "weight": weight, "unit": unit}


def analyse(client: TestClient, *observations: dict[str, object], **extra: object) -> dict:
    response = client.post("/api/analyse", json={"observations": list(observations), **extra})
    return {"status": response.status_code, "body": response.json()}


# --- units ----------------------------------------------------------------


def test_pounds_are_converted_using_the_exact_avoirdupois_factor(client: TestClient):
    result = analyse(client, observation("2026-05-01T07:00:00Z", 160.0, "lb"))
    assert result["status"] == 200
    assert result["body"]["observations"][0]["weight_kg"] == pytest.approx(160.0 * KG_PER_LB)


def test_kilograms_pass_through_unchanged(client: TestClient):
    result = analyse(client, observation("2026-05-01T07:00:00Z", 72.4))
    assert result["body"]["observations"][0]["weight_kg"] == 72.4


def test_the_unit_defaults_to_kilograms(client: TestClient):
    response = client.post(
        "/api/analyse",
        json={"observations": [{"timestamp": "2026-05-01T07:00:00Z", "weight": 72.4}]},
    )
    assert response.status_code == 200
    assert response.json()["observations"][0]["weight_kg"] == 72.4


def test_an_unrecognised_unit_is_rejected(client: TestClient):
    result = analyse(client, observation("2026-05-01T07:00:00Z", 11.4, "stone"))
    assert result["status"] == 422
    assert result["body"]["error"]["details"][0]["code"] == "literal_error"


def test_mixed_units_in_one_series_are_each_converted(client: TestClient):
    result = analyse(
        client,
        observation("2026-05-01T07:00:00Z", 160.0, "lb"),
        observation("2026-05-02T07:00:00Z", 72.4, "kg"),
    )
    weights = [point["weight_kg"] for point in result["body"]["observations"]]
    assert weights == pytest.approx([160.0 * KG_PER_LB, 72.4])


# --- timezones ------------------------------------------------------------


def test_offsets_are_normalised_to_utc(client: TestClient):
    result = analyse(
        client,
        observation("2026-05-01T07:00:00+02:00", 72.0),
        observation("2026-05-02T07:00:00-05:00", 71.8),
    )
    assert [point["timestamp"] for point in result["body"]["observations"]] == [
        "2026-05-01T05:00:00Z",
        "2026-05-02T12:00:00Z",
    ]


def test_a_naive_timestamp_is_rejected_rather_than_guessed(client: TestClient):
    """The core will not guess a timezone, and neither will the boundary.

    A naive datetime does not identify an instant. Inferring one would silently shift every
    weigh-in by up to a day, which for a model whose whole premise is elapsed time is not a
    small error.
    """
    result = analyse(client, observation("2026-05-01T07:00:00", 72.0))
    assert result["status"] == 422
    detail = result["body"]["error"]["details"][0]
    assert detail["code"] == "timezone_aware"
    assert detail["location"] == "body.observations.0.timestamp"


def test_a_malformed_timestamp_is_rejected(client: TestClient):
    result = analyse(client, observation("not a date", 72.0))
    assert result["status"] == 422
    assert result["body"]["error"]["details"][0]["code"].startswith("datetime")


# --- ordering -------------------------------------------------------------


def test_unsorted_input_is_sorted_rather_than_refused(client: TestClient):
    result = analyse(
        client,
        observation("2026-05-10T07:00:00Z", 71.0),
        observation("2026-05-01T07:00:00Z", 72.0),
        observation("2026-05-05T07:00:00Z", 71.5),
    )
    assert result["status"] == 200
    stamps = [point["timestamp"] for point in result["body"]["observations"]]
    assert stamps == sorted(stamps)


def test_the_cores_ordering_guard_is_unreachable_through_http(client: TestClient):
    """``run_filter`` raises on unsorted input on purpose, so ingestion must always sort.

    If this ever fails, the boundary has stopped meeting the contract the core relies on,
    and the caller would see a 500 for data that is perfectly valid.
    """
    result = analyse(
        client,
        observation("2026-05-20T07:00:00Z", 70.0),
        observation("2026-05-02T07:00:00Z", 72.0),
    )
    assert result["status"] == 200


def test_sorting_is_stable_for_readings_at_the_same_instant():
    """Same-instant readings keep submission order.

    Sequential Gaussian updates commute, so the estimate does not depend on this. Keeping
    it stable means the echoed observations match what was sent, which a client rendering
    raw points would otherwise find baffling.
    """
    submitted = [
        ObservationIn(timestamp=datetime(2026, 5, 1, 7, tzinfo=UTC), weight=72.4),
        ObservationIn(timestamp=datetime(2026, 5, 1, 7, tzinfo=UTC), weight=71.9),
        ObservationIn(timestamp=datetime(2026, 5, 1, 7, tzinfo=UTC), weight=72.1),
    ]
    assert [obs.weight_kg for obs in normalise_observations(submitted)] == [72.4, 71.9, 72.1]


# --- what is kept ---------------------------------------------------------


def test_duplicate_readings_are_retained(client: TestClient):
    """ADR-0004: keep every observation. De-duplication is not this milestone's decision."""
    result = analyse(
        client,
        observation("2026-05-01T07:00:00Z", 72.0),
        observation("2026-05-01T07:00:00Z", 72.0),
        observation("2026-05-02T07:00:00Z", 71.9),
    )
    assert result["body"]["n_obs"] == 3
    assert len(result["body"]["observations"]) == 3


def test_simultaneous_readings_are_absorbed_and_sharpen_the_estimate(client: TestClient):
    """Two readings at one instant give ``dt = 0``, which the model handles exactly."""
    one = analyse(
        client,
        observation("2026-05-01T07:00:00Z", 72.0),
        observation("2026-05-08T07:00:00Z", 71.5),
    )
    two = analyse(
        client,
        observation("2026-05-01T07:00:00Z", 72.0),
        observation("2026-05-08T07:00:00Z", 71.5),
        observation("2026-05-08T07:00:00Z", 71.5),
    )
    assert two["body"]["current"]["w_sd"] < one["body"]["current"]["w_sd"]


def test_no_daily_aggregation_happens(client: TestClient):
    """Four readings in one day stay four readings. A median rule would be a Week 2 change."""
    result = analyse(
        client,
        observation("2026-05-01T06:00:00Z", 72.6),
        observation("2026-05-01T07:00:00Z", 72.2),
        observation("2026-05-01T08:00:00Z", 72.4),
        observation("2026-05-01T21:00:00Z", 73.1),
    )
    assert result["body"]["n_obs"] == 4


# --- rejected values ------------------------------------------------------


def test_a_non_positive_weight_is_rejected(client: TestClient):
    for weight in (0.0, -5.0):
        result = analyse(client, observation("2026-05-01T07:00:00Z", weight))
        assert result["status"] == 422
        assert result["body"]["error"]["details"][0]["code"] == "greater_than"


@pytest.mark.parametrize("literal", ["Infinity", "-Infinity", "NaN"])
def test_a_non_finite_weight_is_rejected(client: TestClient, literal: str):
    """Python's JSON parser accepts these literals even though the JSON spec does not."""
    body = '{"observations": [{"timestamp": "2026-05-01T07:00:00Z", "weight": ' + literal + "}]}"
    response = client.post("/api/analyse", content=body.encode(), headers=JSON_HEADERS)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "finite_number"


def test_an_empty_series_is_rejected(client: TestClient):
    response = client.post("/api/analyse", json={"observations": []})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "too_short"


def test_a_missing_observations_field_is_rejected(client: TestClient):
    response = client.post("/api/analyse", json={})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "missing"


def test_an_unrecognised_field_is_rejected(client: TestClient):
    response = client.post(
        "/api/analyse",
        json={
            "observations": [{"timestamp": "2026-05-01T07:00:00Z", "weight": 72.0}],
            "goal_kg": 70.0,
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "extra_forbidden"


def test_malformed_json_is_rejected(client: TestClient):
    response = client.post("/api/analyse", content=b"{not json", headers=JSON_HEADERS)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "json_invalid"


def test_a_series_at_the_limit_is_accepted(client: TestClient):
    """The limit is an accepted value, not the first rejected one."""
    start = datetime(2026, 1, 1, tzinfo=UTC)
    observations = [
        observation(
            (start + timedelta(minutes=index)).isoformat().replace("+00:00", "Z"),
            72.0,
        )
        for index in range(MAX_OBSERVATIONS)
    ]
    response = client.post("/api/analyse", json={"observations": observations})
    assert response.status_code == 200
    assert response.json()["n_obs"] == MAX_OBSERVATIONS


def test_a_series_over_the_limit_is_rejected_by_count(client: TestClient):
    """Rejected on a count, and the message names the limit but nothing that was sent."""
    observations = [observation("2026-05-01T07:00:00Z", 72.0)] * (MAX_OBSERVATIONS + 1)
    response = client.post("/api/analyse", json={"observations": observations})
    assert response.status_code == 422
    detail = response.json()["error"]["details"][0]
    assert detail["code"] == "too_long"
    assert str(MAX_OBSERVATIONS) in detail["message"]
