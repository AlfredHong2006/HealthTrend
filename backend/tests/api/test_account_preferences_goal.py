"""Preferences and goal: what is stored, its bounds, and that a goal is presentation-only.

Goal neutrality itself -- that setting, changing or deleting a goal never moves a single
number in the account's own analysis -- is tested in ``tests/api/test_account_analysis.py``,
where it belongs beside the analysis it must not affect. This file covers the CRUD contract:
persistence, replacement semantics, and the bounds mirrored from
``frontend/src/lib/v2/goal.ts``.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tests.api.conftest import RecordingMailer, sign_in_as

ME = "/api/me"
PREFERENCES = "/api/me/preferences"
GOAL = "/api/me/goal"

EMAIL = "alice@example.com"


# --- preferences --------------------------------------------------------------------------


def test_preferences_default_to_kg(client: TestClient, mailer: RecordingMailer):
    body = sign_in_as(client, mailer, EMAIL)
    assert body["preferences"] == {"display_unit": "kg"}


def test_preferences_persist_across_requests(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    response = client.put(PREFERENCES, json={"display_unit": "lb"})
    assert response.status_code == 200
    assert response.json() == {"display_unit": "lb"}
    assert client.get(ME).json()["preferences"] == {"display_unit": "lb"}


def test_preferences_can_be_changed_back(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    client.put(PREFERENCES, json={"display_unit": "lb"})
    client.put(PREFERENCES, json={"display_unit": "kg"})
    assert client.get(ME).json()["preferences"] == {"display_unit": "kg"}


def test_preferences_require_a_session(client: TestClient):
    assert client.put(PREFERENCES, json={"display_unit": "kg"}).status_code == 401


@pytest.mark.parametrize(
    "body", [{"display_unit": "stone"}, {}, {"display_unit": "kg", "extra": True}]
)
def test_preferences_validate_their_body(client: TestClient, mailer: RecordingMailer, body: dict):
    sign_in_as(client, mailer, EMAIL)
    response = client.put(PREFERENCES, json=body)
    assert response.status_code == 422


# --- goal ---------------------------------------------------------------------------------


def test_a_new_account_has_no_goal(client: TestClient, mailer: RecordingMailer):
    body = sign_in_as(client, mailer, EMAIL)
    assert body["goal"] is None


def test_setting_a_goal_persists_it(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    response = client.put(GOAL, json={"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4})
    assert response.status_code == 200
    assert response.json() == {"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4}
    assert client.get(ME).json()["goal"] == {
        "target_weight_kg": 75.0,
        "target_weekly_rate_kg": -0.4,
    }


def test_putting_a_goal_again_fully_replaces_it(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    client.put(GOAL, json={"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4})
    replaced = client.put(GOAL, json={"target_weight_kg": 90.0})
    assert replaced.status_code == 200
    assert replaced.json() == {"target_weight_kg": 90.0, "target_weekly_rate_kg": None}
    assert client.get(ME).json()["goal"] == {
        "target_weight_kg": 90.0,
        "target_weekly_rate_kg": None,
    }


def test_deleting_a_goal_removes_it(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    client.put(GOAL, json={"target_weight_kg": 75.0})
    response = client.delete(GOAL)
    assert response.status_code == 204
    assert client.get(ME).json()["goal"] is None


def test_deleting_a_goal_that_does_not_exist_still_succeeds(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    assert client.delete(GOAL).status_code == 204


def test_goal_requires_a_session(client: TestClient):
    assert client.put(GOAL, json={}).status_code == 401
    assert client.delete(GOAL).status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        {"target_weight_kg": 19.9},
        {"target_weight_kg": 400.1},
        {"target_weekly_rate_kg": 5.1},
        {"target_weekly_rate_kg": -5.1},
        {"target_weight_kg": 75.0, "extra": True},
    ],
)
def test_goal_bounds_are_enforced(client: TestClient, mailer: RecordingMailer, body: dict):
    """Bounds mirror GOAL_MIN_KG/GOAL_MAX_KG/TARGET_RATE_LIMIT_KG_PER_WEEK in goal.ts exactly."""
    sign_in_as(client, mailer, EMAIL)
    response = client.put(GOAL, json=body)
    assert response.status_code == 422


@pytest.mark.parametrize(
    "body",
    [
        {"target_weight_kg": 20.0},
        {"target_weight_kg": 400.0},
        {"target_weekly_rate_kg": 5.0},
        {"target_weekly_rate_kg": -5.0},
        {},
    ],
)
def test_goal_bounds_are_inclusive(client: TestClient, mailer: RecordingMailer, body: dict):
    sign_in_as(client, mailer, EMAIL)
    response = client.put(GOAL, json=body)
    assert response.status_code == 200


def test_a_goal_belongs_to_one_account(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    client.put(GOAL, json={"target_weight_kg": 75.0})

    bobs_client = TestClient(client.app, raise_server_exceptions=False)
    sign_in_as(bobs_client, mailer, "bob@example.com")
    assert bobs_client.get(ME).json()["goal"] is None
