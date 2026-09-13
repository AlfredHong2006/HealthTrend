"""``GET /api/me/analysis`` must be the same estimator call ``POST /api/analyse`` is.

Two properties are load-bearing here, both regression-tested directly rather than trusted:

1. **Equivalence.** The same observations, submitted once and stored-then-analysed the other
   time, under the same clock, produce byte-identical statistical output -- everything except
   ``meta.source``, which is the one field this endpoint is allowed to differ on.
2. **Goal neutrality.** Setting, changing or deleting a goal must not move a single number in
   the account's own analysis. The estimator has no goal parameter to feed one to; this proves
   the account layer built on top of it does not smuggle one in some other way.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from tests.api.conftest import FROZEN_NOW, RecordingMailer, sign_in_as

ANALYSE = "/api/analyse"
ACCOUNT_ANALYSIS = "/api/me/analysis"
MEASUREMENTS = "/api/me/measurements"
GOAL = "/api/me/goal"

EMAIL = "alice@example.com"

SERIES = [
    {"timestamp": (FROZEN_NOW - timedelta(days=days)).isoformat(), "weight": weight, "unit": unit}
    for days, weight, unit in (
        (10, 82.4, "kg"),
        (7, 82.1, "kg"),
        (5, 181.0, "lb"),
        (2, 81.6, "kg"),
    )
]


def store_series(client: TestClient) -> None:
    for observation in SERIES:
        response = client.post(MEASUREMENTS, json=observation)
        assert response.status_code == 201, response.text


# --- equivalence --------------------------------------------------------------------------


def test_account_analysis_is_equivalent_to_submitted_analysis(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)

    submitted = client.post(ANALYSE, json={"observations": SERIES, "forecast_from": "now"})
    account = client.get(ACCOUNT_ANALYSIS)
    assert submitted.status_code == account.status_code == 200

    submitted_body = submitted.json()
    account_body = account.json()

    assert account_body["meta"]["source"] == "account"
    assert submitted_body["meta"]["source"] == "submitted"

    # Everything else is byte-identical: strip the one field that is allowed to differ and
    # compare the rest of the envelope directly, rather than field by field.
    submitted_body["meta"]["source"] = "account"
    assert account_body == submitted_body


def test_account_analysis_reflects_edits_and_deletions(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    created = client.post(
        MEASUREMENTS,
        json={
            "timestamp": (FROZEN_NOW - timedelta(days=1)).isoformat(),
            "weight": 999.0,
            "unit": "kg",
        },
    ).json()
    client.delete(f"{MEASUREMENTS}/{created['id']}")

    submitted = client.post(ANALYSE, json={"observations": SERIES, "forecast_from": "now"})
    account = client.get(ACCOUNT_ANALYSIS)
    submitted_body = submitted.json()
    submitted_body["meta"]["source"] = "account"
    assert account.json() == submitted_body


def test_account_analysis_requires_a_session(client: TestClient):
    assert client.get(ACCOUNT_ANALYSIS).status_code == 401


def test_account_analysis_on_an_empty_account_is_insufficient_data(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    response = client.get(ACCOUNT_ANALYSIS)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "insufficient_data"


def test_a_future_dated_stored_measurement_is_rejected_the_same_way_a_submitted_one_is(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    future = (FROZEN_NOW + timedelta(days=1)).isoformat()
    created = client.post(MEASUREMENTS, json={"timestamp": future, "weight": 80.0})
    assert created.status_code == 201, "storing does not itself reject a future timestamp"

    response = client.get(ACCOUNT_ANALYSIS)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "observation_in_the_future"


def test_account_analysis_carries_no_new_statistical_field(
    client: TestClient, mailer: RecordingMailer
):
    """M7A exclusion, re-asserted on this new route: no probability, verdict or plan field."""
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    body = client.get(ACCOUNT_ANALYSIS).json()
    forbidden = (
        "plan",
        "verdict",
        "probability",
        "departure",
        "plateau",
        "adjust",
        "hold",
        "on_plan",
    )
    rendered = str(body).lower()
    for word in forbidden:
        assert word not in rendered, word
    assert set(body["meta"]) == {"source", "filtered_not_smoothed", "interval_describes"}


# --- goal neutrality ------------------------------------------------------------------------


def test_setting_a_goal_does_not_change_the_account_analysis(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    before = client.get(ACCOUNT_ANALYSIS).json()

    put = client.put(GOAL, json={"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4})
    assert put.status_code == 200

    after = client.get(ACCOUNT_ANALYSIS).json()
    assert after == before


def test_changing_a_goal_does_not_change_the_account_analysis(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    client.put(GOAL, json={"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4})
    before = client.get(ACCOUNT_ANALYSIS).json()

    client.put(GOAL, json={"target_weight_kg": 90.0, "target_weekly_rate_kg": 0.5})

    after = client.get(ACCOUNT_ANALYSIS).json()
    assert after == before


def test_deleting_a_goal_does_not_change_the_account_analysis(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    client.put(GOAL, json={"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4})
    before = client.get(ACCOUNT_ANALYSIS).json()

    client.delete(GOAL)

    after = client.get(ACCOUNT_ANALYSIS).json()
    assert after == before


@pytest.mark.parametrize(
    "goal",
    [
        {"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4},
        {"target_weight_kg": None, "target_weekly_rate_kg": -5.0},
        {"target_weight_kg": 400.0, "target_weekly_rate_kg": 5.0},
        {},
    ],
)
def test_account_analysis_is_identical_across_every_goal_state(
    client: TestClient, mailer: RecordingMailer, goal: dict[str, float | None]
):
    """A single parametrised sweep, as a second, independent proof beside the three above."""
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    baseline = client.get(ACCOUNT_ANALYSIS).json()
    client.put(GOAL, json=goal)
    assert client.get(ACCOUNT_ANALYSIS).json() == baseline
