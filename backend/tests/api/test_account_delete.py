"""``DELETE /api/me``: hard deletion, its confirmation, and what must not survive it.

Deleting the user row cascades to sessions, measurements, preferences and goal (the foreign
keys in ``app/persistence/models.py``); ``login_codes`` carries no such key, so the service
purges it by email explicitly (Stage 3 brief §7). Both are asserted directly against the
database, not inferred from the HTTP responses alone.
"""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.persistence.models import (
    GoalRow,
    LoginCodeRow,
    MeasurementRow,
    PreferenceRow,
    SessionRow,
    UserRow,
)
from tests.api.conftest import RecordingMailer, sign_in_as

ME = "/api/me"
MEASUREMENTS = "/api/me/measurements"
DELETE = "/api/me"

EMAIL = "alice@example.com"


def test_deletion_requires_the_correct_confirmation_email(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    response = client.request("DELETE", DELETE, json={"confirm_email": "someone-else@example.com"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "confirmation_mismatch"
    assert client.get(ME).status_code == 200, "the account must still exist"


def test_deletion_requires_a_session(client: TestClient):
    response = client.request("DELETE", DELETE, json={"confirm_email": EMAIL})
    assert response.status_code == 401


def test_deletion_accepts_the_confirmation_case_insensitively(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    response = client.request("DELETE", DELETE, json={"confirm_email": "  ALICE@Example.com "})
    assert response.status_code == 204


def test_a_successful_deletion_clears_the_session_cookie_and_ends_the_session(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    token = client.cookies["ht_session"]
    response = client.request("DELETE", DELETE, json={"confirm_email": EMAIL})
    assert response.status_code == 204
    assert "ht_session" not in client.cookies

    replay = TestClient(client.app, raise_server_exceptions=False)
    replay.cookies.set("ht_session", token)
    assert replay.get(ME).status_code == 401


def test_deletion_is_hard_and_cascades_every_owned_table(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    user_id = client.get(ME).json()["user"]["id"]
    client.post(MEASUREMENTS, json={"timestamp": "2026-06-01T09:00:00Z", "weight": 70.0})
    client.put("/api/me/preferences", json={"display_unit": "lb"})
    client.put("/api/me/goal", json={"target_weight_kg": 75.0})

    app = client.app
    with app.state.database.engine.connect() as connection:
        assert connection.scalar(select(UserRow).where(UserRow.id == user_id)) is not None
        assert (
            connection.scalar(select(MeasurementRow).where(MeasurementRow.user_id == user_id))
            is not None
        )
        assert (
            connection.scalar(select(PreferenceRow).where(PreferenceRow.user_id == user_id))
            is not None
        )
        assert connection.scalar(select(GoalRow).where(GoalRow.user_id == user_id)) is not None
        assert (
            connection.scalar(select(SessionRow).where(SessionRow.user_id == user_id)) is not None
        )
        assert (
            connection.scalar(select(LoginCodeRow).where(LoginCodeRow.email == EMAIL)) is not None
        )

    response = client.request("DELETE", DELETE, json={"confirm_email": EMAIL})
    assert response.status_code == 204

    with app.state.database.engine.connect() as connection:
        assert connection.scalar(select(UserRow).where(UserRow.id == user_id)) is None
        assert (
            connection.scalar(select(MeasurementRow).where(MeasurementRow.user_id == user_id))
            is None
        )
        assert (
            connection.scalar(select(PreferenceRow).where(PreferenceRow.user_id == user_id)) is None
        )
        assert connection.scalar(select(GoalRow).where(GoalRow.user_id == user_id)) is None
        assert connection.scalar(select(SessionRow).where(SessionRow.user_id == user_id)) is None
        assert connection.scalar(select(LoginCodeRow).where(LoginCodeRow.email == EMAIL)) is None


def test_a_login_code_issued_moments_before_deletion_is_also_purged(
    client: TestClient, mailer: RecordingMailer
):
    """The email requesting a fresh code just before deleting must not outlive the account."""
    sign_in_as(client, mailer, EMAIL)
    client.post("/api/auth/code/request", json={"email": EMAIL})  # an unconsumed extra code
    response = client.request("DELETE", DELETE, json={"confirm_email": EMAIL})
    assert response.status_code == 204

    app = client.app
    with app.state.database.engine.connect() as connection:
        assert connection.scalar(select(LoginCodeRow).where(LoginCodeRow.email == EMAIL)) is None


def test_deleting_one_account_does_not_touch_another(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    client.post(MEASUREMENTS, json={"timestamp": "2026-06-01T09:00:00Z", "weight": 70.0})

    bobs_client = TestClient(client.app, raise_server_exceptions=False)
    sign_in_as(bobs_client, mailer, "bob@example.com")
    bobs_client.post(MEASUREMENTS, json={"timestamp": "2026-06-01T09:00:00Z", "weight": 80.0})

    client.request("DELETE", DELETE, json={"confirm_email": EMAIL})

    assert bobs_client.get(ME).status_code == 200
    assert bobs_client.get(MEASUREMENTS).json()["count"] == 1


def test_a_re_signup_after_deletion_starts_a_fresh_empty_account(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    original_user_id = client.get(ME).json()["user"]["id"]
    client.post(MEASUREMENTS, json={"timestamp": "2026-06-01T09:00:00Z", "weight": 70.0})
    client.put("/api/me/goal", json={"target_weight_kg": 75.0})
    client.request("DELETE", DELETE, json={"confirm_email": EMAIL})

    fresh_client = TestClient(client.app, raise_server_exceptions=False)
    fresh = sign_in_as(fresh_client, mailer, EMAIL)
    assert fresh["user"]["id"] != original_user_id
    assert fresh["goal"] is None
    assert fresh["measurement_count"] == 0


def test_deletion_validates_its_body(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    missing_field = client.request("DELETE", DELETE, json={})
    extra_field = client.request("DELETE", DELETE, json={"confirm_email": EMAIL, "extra": True})
    for response in (missing_field, extra_field):
        assert response.status_code == 422
