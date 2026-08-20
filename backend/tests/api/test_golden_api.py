"""Golden regression for the HTTP response. Test IDs H1-H3.

The Milestone 1 golden fixture pins the mathematics. This one pins the *contract*: field
names, nesting, timestamp formatting, which horizons appear, and the numbers as they are
actually serialised. A change to either file is a change users would notice, and neither
should ever be accepted casually.

The input is a fixed literal request built by :func:`golden_request`, deliberately **not** a
demo scenario. Two reasons. The demo generators are free to be tuned for a better first
impression, and this fixture must not move when they are. And the request exercises things a
demo cannot: a pound reading, an out-of-order submission and a same-instant duplicate, all of
which are ingestion behaviour that belongs under regression.

There is no randomness anywhere in the input. The wobble is integer arithmetic, so the
fixture is reproducible bit for bit on any platform.

To regenerate after a *deliberate* change, run from ``backend/``::

    uv run python -m tests.api.regenerate_golden_api

and review the diff.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

GOLDEN_PATH = Path(__file__).parents[1] / "fixtures" / "golden_api_analyse.json"

GOLDEN_NOW = datetime(2026, 6, 12, 9, 0, tzinfo=UTC)
"""The frozen clock for this fixture. Must stay independent of the shared test fixture."""

GOLDEN_START = datetime(2026, 5, 1, 7, 30, tzinfo=UTC)
GOLDEN_N_DAILY = 40
GOLDEN_LB_READING = 171.9
GOLDEN_TRUE_START_KG = 80.0
GOLDEN_RATE_KG_PER_DAY = -0.05


def _wobble_kg(index: int) -> float:
    """A deterministic stand-in for measurement noise, in exact integer arithmetic.

    Roughly plus or minus 0.2 kg with no period aligned to the weekly rate. Chosen over a
    seeded RNG or a sine so that the fixture cannot move by one floating-point unit when
    NumPy or the platform's libm changes.
    """
    return ((index * 7) % 11 - 5) / 25.0


def _timestamp(offset_days: float) -> str:
    return (GOLDEN_START + timedelta(days=offset_days)).isoformat().replace("+00:00", "Z")


def golden_request() -> dict[str, Any]:
    """Return the exact request the fixture records."""
    observations: list[dict[str, Any]] = [
        {
            "timestamp": _timestamp(index),
            "weight": GOLDEN_TRUE_START_KG + GOLDEN_RATE_KG_PER_DAY * index + _wobble_kg(index),
            "unit": "kg",
        }
        for index in range(GOLDEN_N_DAILY)
    ]
    # A same-instant repeat weigh-in: dt = 0, absorbed as a second update (ADR-0004).
    observations.append(dict(observations[-1], weight=observations[-1]["weight"] + 0.15))
    # A reading in pounds, submitted out of order, to pin conversion and sorting too.
    observations.insert(
        5, {"timestamp": _timestamp(12.5), "weight": GOLDEN_LB_READING, "unit": "lb"}
    )
    return {"observations": observations, "forecast_from": "now"}


def build_golden_response() -> dict[str, Any]:
    """Post the golden request against a clock frozen at :data:`GOLDEN_NOW`."""
    from tests.api.conftest import build_app

    client = TestClient(build_app(GOLDEN_NOW))
    response = client.post("/api/analyse", json=golden_request())
    assert response.status_code == 200, response.json()
    body: dict[str, Any] = response.json()
    return body


def load_golden() -> dict[str, Any]:
    payload: dict[str, Any] = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    return payload


# --- H1: determinism ------------------------------------------------------


def test_h1_the_same_request_produces_byte_identical_output():
    first = json.dumps(build_golden_response(), sort_keys=True)
    second = json.dumps(build_golden_response(), sort_keys=True)
    assert first == second


# --- H2: golden regression ------------------------------------------------


def test_h2_the_response_matches_the_committed_fixture():
    expected = load_golden()
    actual = build_golden_response()

    assert actual["n_obs"] == expected["n_obs"]
    assert actual["span_days"] == pytest.approx(expected["span_days"], rel=1e-10)
    assert actual["meta"] == expected["meta"]
    assert actual["params"] == pytest.approx(expected["params"], rel=1e-10)

    assert len(actual["observations"]) == len(expected["observations"])
    for got, want in zip(actual["observations"], expected["observations"], strict=True):
        assert got["timestamp"] == want["timestamp"]
        assert got["weight_kg"] == pytest.approx(want["weight_kg"], rel=1e-12)

    assert len(actual["trajectory"]) == len(expected["trajectory"])
    for got, want in zip(actual["trajectory"], expected["trajectory"], strict=True):
        assert got["timestamp"] == want["timestamp"]
        for key in ("w_kg", "w_sd", "w_lower95", "w_upper95"):
            assert got[key] == pytest.approx(want[key], rel=1e-10)

    for key, want_value in expected["current"].items():
        if key == "timestamp":
            assert actual["current"][key] == want_value
        else:
            assert actual["current"][key] == pytest.approx(want_value, rel=1e-10)

    got_forecast, want_forecast = actual["forecast"], expected["forecast"]
    assert got_forecast["origin_timestamp"] == want_forecast["origin_timestamp"]
    assert got_forecast["last_observation_timestamp"] == want_forecast["last_observation_timestamp"]
    assert got_forecast["lead_days"] == pytest.approx(want_forecast["lead_days"], rel=1e-12)
    assert got_forecast["includes_observation_noise"] is False
    for section in ("horizons", "path"):
        assert len(got_forecast[section]) == len(want_forecast[section])
        for got, want in zip(got_forecast[section], want_forecast[section], strict=True):
            assert got["timestamp"] == want["timestamp"]
            assert got["horizon_days"] == pytest.approx(want["horizon_days"], rel=1e-12)
            for key in ("w_kg", "w_sd", "w_lower95", "w_upper95"):
                assert got[key] == pytest.approx(want[key], rel=1e-10)


def test_h2_the_fixture_records_the_request_that_produced_it():
    """A fixture whose input is not recorded alongside it is not reviewable."""
    expected = load_golden()
    assert expected["_request"] == golden_request()
    assert expected["_frozen_now"] == GOLDEN_NOW.isoformat()


# --- H3: what the fixture is supposed to demonstrate ----------------------


def test_h3_the_fixture_pins_pound_conversion_and_sorting():
    actual = build_golden_response()
    stamps = [observation["timestamp"] for observation in actual["observations"]]
    assert stamps == sorted(stamps), "the out-of-order pound reading was not sorted into place"
    assert actual["n_obs"] == GOLDEN_N_DAILY + 2


def test_h3_the_fixture_pins_a_non_zero_forecast_lead():
    """The request is deliberately stale, so the lead handling of ADR-0005 is under regression."""
    actual = build_golden_response()
    assert actual["forecast"]["lead_days"] > 1.0
