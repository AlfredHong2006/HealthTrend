"""The analysis endpoint: horizons, the forecast origin, and honest minimal-data behaviour."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.schemas.analysis import (
    FORECAST_HORIZONS_DAYS,
    MAX_HORIZON_DAYS,
    MAX_OBSERVATION_TIMESTAMP,
)
from tests.api.conftest import FROZEN_NOW, build_app

SERIES_START = datetime(2026, 5, 1, 7, 30, tzinfo=UTC)

SERIES_LEAD_DAYS = 14.0
"""How stale the helper series is: its last reading sits this long before the frozen clock.

The series is built *backwards* from that point rather than forwards from a fixed date, so
that lengthening it cannot accidentally push a reading past ``now`` and turn every
assertion into a rejected request.
"""

SERIES_END = FROZEN_NOW - timedelta(days=SERIES_LEAD_DAYS)


def daily_series(
    n_obs: int, *, start_kg: float = 80.0, rate_kg_per_day: float = -0.05
) -> list[dict]:
    """A deterministic noise-free daily series ending a fixed distance before the clock."""
    start = SERIES_END - timedelta(days=n_obs - 1)
    return [
        {
            "timestamp": (start + timedelta(days=index)).isoformat().replace("+00:00", "Z"),
            "weight": start_kg + rate_kg_per_day * index,
            "unit": "kg",
        }
        for index in range(n_obs)
    ]


def analyse(client: TestClient, observations: list[dict], **extra: object) -> dict:
    response = client.post("/api/analyse", json={"observations": observations, **extra})
    assert response.status_code == 200, response.json()
    return response.json()


# --- shape ----------------------------------------------------------------


def test_the_response_carries_the_whole_product_surface(client: TestClient):
    body = analyse(client, daily_series(30))
    assert set(body) == {
        "n_obs",
        "span_days",
        "params",
        "observations",
        "trajectory",
        "current",
        "forecast",
        "meta",
    }


def test_one_trajectory_point_per_observation(client: TestClient):
    body = analyse(client, daily_series(30))
    assert body["n_obs"] == 30
    assert len(body["trajectory"]) == 30
    assert len(body["observations"]) == 30


def test_every_trajectory_point_brackets_its_estimate(client: TestClient):
    body = analyse(client, daily_series(30))
    for point in body["trajectory"]:
        assert point["w_lower95"] < point["w_kg"] < point["w_upper95"]
        assert point["w_sd"] > 0.0


def test_a_steady_decline_is_reported_as_a_negative_weekly_rate(client: TestClient):
    body = analyse(client, daily_series(60, rate_kg_per_day=-0.05))
    assert body["current"]["weekly_rate_kg"] == pytest.approx(-0.35, abs=0.02)


def test_the_span_is_the_elapsed_time_of_the_series(client: TestClient):
    body = analyse(client, daily_series(30))
    assert body["span_days"] == pytest.approx(29.0)


def test_the_metadata_states_what_the_numbers_mean(client: TestClient):
    """`source` says where the data came from, which is all the server can honestly claim.

    It is deliberately not a `synthetic` flag: the server has no way of knowing whether
    caller-submitted observations are real measurements or generated ones.
    """
    body = analyse(client, daily_series(10))
    assert body["meta"] == {
        "source": "submitted",
        "filtered_not_smoothed": True,
        "interval_describes": "latent_weight",
    }


def test_the_parameters_used_are_echoed(client: TestClient):
    body = analyse(client, daily_series(10))
    assert body["params"]["sigma_obs_kg"] == pytest.approx(0.5)
    assert body["params"]["weekly_rate_drift_kg_per_week"] == pytest.approx(0.15)
    assert body["params"]["initial_weekly_rate_spread_kg_per_week"] == pytest.approx(1.0)


# --- horizons -------------------------------------------------------------


def test_exactly_the_three_published_horizons_are_returned(client: TestClient):
    body = analyse(client, daily_series(30))
    assert [point["horizon_days"] for point in body["forecast"]["horizons"]] == list(
        FORECAST_HORIZONS_DAYS
    )


def test_the_horizons_are_not_caller_selectable(client: TestClient):
    """A caller cannot widen the contract by asking for its own horizons."""
    response = client.post(
        "/api/analyse",
        json={"observations": daily_series(10), "horizons_days": [1, 2, 3]},
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "extra_forbidden"


def test_the_band_widens_with_the_horizon(client: TestClient):
    """The tau-cubed term is what makes distant forecasts honestly vague."""
    horizons = analyse(client, daily_series(60))["forecast"]["horizons"]
    widths = [point["w_upper95"] - point["w_lower95"] for point in horizons]
    assert widths[0] < widths[1] < widths[2]


def test_the_path_is_daily_and_reaches_the_furthest_horizon(client: TestClient):
    path = analyse(client, daily_series(30))["forecast"]["path"]
    assert len(path) == int(MAX_HORIZON_DAYS) + 1
    assert path[0]["horizon_days"] == 0.0
    assert path[-1]["horizon_days"] == MAX_HORIZON_DAYS


def test_each_published_horizon_lies_on_the_path(client: TestClient):
    """One propagation drives both, so the summary points cannot disagree with the band."""
    forecast = analyse(client, daily_series(30))["forecast"]
    by_horizon = {point["horizon_days"]: point for point in forecast["path"]}
    for point in forecast["horizons"]:
        assert by_horizon[point["horizon_days"]] == point


def test_the_forecast_joins_the_trajectory_without_a_discontinuity(client: TestClient):
    """Horizon zero reproduces the state forecast from, so the graph line is continuous."""
    body = analyse(client, daily_series(30), forecast_from="last_observation")
    join = body["forecast"]["path"][0]
    assert join["w_kg"] == pytest.approx(body["current"]["w_kg"], rel=1e-12)
    assert join["w_sd"] == pytest.approx(body["current"]["w_sd"], rel=1e-12)


# --- the forecast origin --------------------------------------------------


def test_forecasting_from_the_last_observation_gives_no_lead(client: TestClient):
    forecast = analyse(client, daily_series(30), forecast_from="last_observation")["forecast"]
    assert forecast["lead_days"] == 0.0
    assert forecast["origin_timestamp"] == forecast["last_observation_timestamp"]


def test_forecasting_from_now_is_the_default(client: TestClient):
    default = analyse(client, daily_series(30))["forecast"]
    explicit = analyse(client, daily_series(30), forecast_from="now")["forecast"]
    assert default == explicit


def test_forecasting_from_now_anchors_the_origin_to_the_clock(client: TestClient):
    forecast = analyse(client, daily_series(30))["forecast"]
    assert forecast["origin_timestamp"] == FROZEN_NOW.isoformat().replace("+00:00", "Z")


def test_a_stale_series_reports_the_lead_and_pays_for_it(client: TestClient):
    """The days since the last weigh-in are real elapsed time, so they must cost something.

    This is the whole point of ADR-0005. A '30-day forecast' anchored to a three-week-old
    reading would be a three-week-old view of the future wearing today's label.
    """
    series = daily_series(30)
    from_last = analyse(client, series, forecast_from="last_observation")["forecast"]
    from_now = analyse(client, series, forecast_from="now")["forecast"]

    assert from_last["lead_days"] == 0.0
    assert from_now["lead_days"] == pytest.approx(SERIES_LEAD_DAYS)

    def width(forecast: dict, index: int) -> float:
        point = forecast["horizons"][index]
        return point["w_upper95"] - point["w_lower95"]

    for index in range(len(FORECAST_HORIZONS_DAYS)):
        assert width(from_now, index) > width(from_last, index)


def test_the_lead_is_the_gap_between_the_two_published_timestamps(client: TestClient):
    forecast = analyse(client, daily_series(30))["forecast"]
    origin = datetime.fromisoformat(forecast["origin_timestamp"])
    last = datetime.fromisoformat(forecast["last_observation_timestamp"])
    assert forecast["lead_days"] == pytest.approx((origin - last).total_seconds() / 86400.0)


def test_shifting_the_origin_matches_extending_the_horizon(client: TestClient):
    """A five-day lead plus a 30-day horizon must equal a 35-day horizon from the series.

    Checked through HTTP because it is the property that makes the lead handling correct
    rather than merely present.
    """
    series = daily_series(30)
    last = datetime.fromisoformat(
        analyse(client, series, forecast_from="last_observation")["forecast"][
            "last_observation_timestamp"
        ]
    )
    shifted = TestClient(build_app(last + timedelta(days=5)), raise_server_exceptions=False)
    from_now = analyse(shifted, series, forecast_from="now")["forecast"]
    from_last = analyse(shifted, series, forecast_from="last_observation")["forecast"]

    at_30_from_now = next(p for p in from_now["horizons"] if p["horizon_days"] == 30.0)
    at_35_from_last = next(p for p in from_last["path"] if p["horizon_days"] == 35.0)
    assert at_30_from_now["w_kg"] == pytest.approx(at_35_from_last["w_kg"], rel=1e-12)
    assert at_30_from_now["w_sd"] == pytest.approx(at_35_from_last["w_sd"], rel=1e-12)
    assert at_30_from_now["timestamp"] == at_35_from_last["timestamp"]


def test_an_observation_in_the_future_is_rejected_when_forecasting_from_now(client: TestClient):
    response = client.post(
        "/api/analyse",
        json={
            "observations": [
                {
                    "timestamp": (FROZEN_NOW + timedelta(days=1)).isoformat(),
                    "weight": 72.0,
                    "unit": "kg",
                }
            ]
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "observation_in_the_future"


def test_only_the_latest_observation_has_to_precede_now(client: TestClient):
    """A future reading buried mid-series still sorts to the end, so it is still rejected."""
    response = client.post(
        "/api/analyse",
        json={
            "observations": [
                {"timestamp": (FROZEN_NOW + timedelta(days=2)).isoformat(), "weight": 72.0},
                {"timestamp": SERIES_START.isoformat(), "weight": 73.0},
            ]
        },
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "observation_in_the_future"


def test_a_future_observation_is_allowed_when_forecasting_from_the_last_observation(
    client: TestClient,
):
    """Then no lead is involved, so nothing is ill-defined and there is nothing to reject."""
    body = analyse(
        client,
        [
            {
                "timestamp": (FROZEN_NOW + timedelta(days=1)).isoformat(),
                "weight": 72.0,
                "unit": "kg",
            }
        ],
        forecast_from="last_observation",
    )
    assert body["forecast"]["lead_days"] == 0.0


def test_an_observation_exactly_at_now_is_accepted(client: TestClient):
    body = analyse(
        client,
        [{"timestamp": FROZEN_NOW.isoformat(), "weight": 72.0, "unit": "kg"}],
    )
    assert body["forecast"]["lead_days"] == 0.0


# --- the representable-timestamp bound ------------------------------------


@pytest.mark.parametrize("forecast_from", ["now", "last_observation"])
def test_a_timestamp_too_late_to_forecast_from_is_a_validation_error_not_a_500(
    client: TestClient, forecast_from: str
):
    """Regression: Python datetimes end at 9999-12-31, and a forecast propagates 90 days.

    Before the bound existed, `forecast_from="last_observation"` with a year-9999 reading
    reached the core's timestamp arithmetic and overflowed into a 500 -- a server error
    manufactured from a syntactically valid request. It must be rejected in validation,
    naming the field, before any arithmetic runs.
    """
    response = client.post(
        "/api/analyse",
        json={
            "observations": [{"timestamp": "9999-12-31T23:00:00+00:00", "weight": 72.0}],
            "forecast_from": forecast_from,
        },
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "invalid_request"
    detail = body["error"]["details"][0]
    assert detail["code"] == "less_than_equal"
    assert detail["location"] == "body.observations.0.timestamp"


def test_the_latest_acceptable_timestamp_still_forecasts_without_overflow(client: TestClient):
    """The bound itself must be usable: exactly at the limit, the full 90-day path fits."""
    body = analyse(
        client,
        [{"timestamp": MAX_OBSERVATION_TIMESTAMP.isoformat(), "weight": 72.0, "unit": "kg"}],
        forecast_from="last_observation",
    )
    assert body["forecast"]["horizons"][-1]["horizon_days"] == MAX_HORIZON_DAYS


# --- minimal data ---------------------------------------------------------


def test_a_single_observation_reports_a_weight_and_declines_to_invent_a_trend(
    client: TestClient,
):
    """ADR-0003: one reading carries no velocity information at all."""
    body = analyse(
        client,
        [{"timestamp": FROZEN_NOW.isoformat(), "weight": 72.4, "unit": "kg"}],
    )
    assert body["n_obs"] == 1
    assert body["span_days"] == 0.0
    assert body["current"]["w_kg"] == 72.4
    assert body["current"]["weekly_rate_kg"] == 0.0
    assert len(body["trajectory"]) == 1


def test_a_single_observation_produces_a_forecast_wide_enough_to_say_nothing(
    client: TestClient,
):
    body = analyse(
        client,
        [{"timestamp": FROZEN_NOW.isoformat(), "weight": 72.4, "unit": "kg"}],
    )
    at_30 = next(p for p in body["forecast"]["horizons"] if p["horizon_days"] == 30.0)
    assert at_30["w_upper95"] - at_30["w_lower95"] > 10.0


def test_two_observations_give_a_direction_with_very_low_confidence(client: TestClient):
    """The velocity posterior is still prior-dominated here, and the interval shows it."""
    body = analyse(client, daily_series(2, rate_kg_per_day=-0.1))
    rate = body["current"]["weekly_rate_kg"]
    assert rate < 0.0
    assert abs(rate) < 1.96 * body["current"]["weekly_rate_sd_kg"]


def test_more_data_reduces_the_uncertainty_in_the_current_estimate(client: TestClient):
    few = analyse(client, daily_series(3))["current"]["w_sd"]
    many = analyse(client, daily_series(60))["current"]["w_sd"]
    assert many < few
