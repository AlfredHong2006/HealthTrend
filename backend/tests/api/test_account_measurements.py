"""Measurement CRUD and batch import: ownership scoping, the cap, and idempotent re-import.

Every route under test requires a signed-in session (:func:`sign_in_as`); a second signed-in
client (``bob``) exists specifically to prove that another account's measurement id is
rejected exactly like one that never existed.
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.schemas.analysis import MAX_OBSERVATIONS
from tests.api.conftest import FROZEN_NOW, MutableClock, RecordingMailer, build_app, sign_in_as

MEASUREMENTS = "/api/me/measurements"
BATCH = "/api/me/measurements/batch"

ALICE = "alice@example.com"
BOB = "bob@example.com"


def observation(days_ago: float = 1.0, weight: float = 70.0, unit: str = "kg") -> dict[str, object]:
    timestamp = (FROZEN_NOW - timedelta(days=days_ago)).isoformat()
    return {"timestamp": timestamp, "weight": weight, "unit": unit}


# --- create -----------------------------------------------------------------------------


def test_creating_a_measurement_returns_it_with_manual_source(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, ALICE)
    response = client.post(MEASUREMENTS, json=observation())
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["weight"] == 70.0
    assert body["unit"] == "kg"
    assert body["source"] == "manual"
    assert body["created_at"] == body["updated_at"]
    assert isinstance(body["id"], str) and body["id"]


def test_create_is_rejected_without_a_session(client: TestClient):
    response = client.post(MEASUREMENTS, json=observation())
    assert response.status_code == 401


@pytest.mark.parametrize(
    "body",
    [
        {"timestamp": "not-a-timestamp", "weight": 70.0},
        {"timestamp": FROZEN_NOW.isoformat(), "weight": -1.0},
        {"timestamp": FROZEN_NOW.isoformat(), "weight": 70.0, "unit": "stone"},
        {"weight": 70.0},
        {"timestamp": FROZEN_NOW.isoformat(), "weight": 70.0, "extra": True},
    ],
)
def test_create_validates_the_observation(
    client: TestClient, mailer: RecordingMailer, body: dict[str, object]
):
    sign_in_as(client, mailer, ALICE)
    response = client.post(MEASUREMENTS, json=body)
    assert response.status_code == 422


def test_responses_are_never_cached(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, ALICE)
    created = client.post(MEASUREMENTS, json=observation())
    listed = client.get(MEASUREMENTS)
    for response in (created, listed):
        assert response.headers["cache-control"] == "no-store"


# --- list ---------------------------------------------------------------------------------


def test_listing_returns_every_measurement_most_recent_first(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, ALICE)
    for days_ago in (3, 1, 2):
        client.post(MEASUREMENTS, json=observation(days_ago=days_ago, weight=70.0 + days_ago))
    response = client.get(MEASUREMENTS)
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    assert [item["weight"] for item in body["measurements"]] == [71.0, 72.0, 73.0]


def test_listing_is_empty_for_a_new_account(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, ALICE)
    assert client.get(MEASUREMENTS).json() == {"measurements": [], "count": 0}


# --- update and delete: ownership is structural -----------------------------------------


def test_owner_can_update_and_delete_their_own_measurement(mailer: RecordingMailer):
    clock = MutableClock(FROZEN_NOW)
    client = TestClient(build_app(mailer=mailer, clock=clock), raise_server_exceptions=False)
    sign_in_as(client, mailer, ALICE)
    created = client.post(MEASUREMENTS, json=observation(weight=70.0)).json()

    clock.instant = FROZEN_NOW + timedelta(hours=1)
    updated = client.put(
        f"{MEASUREMENTS}/{created['id']}", json=observation(days_ago=2, weight=71.5, unit="lb")
    )
    assert updated.status_code == 200
    body = updated.json()
    assert (body["weight"], body["unit"]) == (71.5, "lb")
    assert body["source"] == "manual", "the source is not changed by an update"
    assert body["created_at"] == created["created_at"]
    assert body["updated_at"] != created["updated_at"]

    deleted = client.delete(f"{MEASUREMENTS}/{created['id']}")
    assert deleted.status_code == 204
    assert client.get(MEASUREMENTS).json()["count"] == 0


def test_deleting_twice_is_a_404_the_second_time(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, ALICE)
    created = client.post(MEASUREMENTS, json=observation()).json()
    assert client.delete(f"{MEASUREMENTS}/{created['id']}").status_code == 204
    again = client.delete(f"{MEASUREMENTS}/{created['id']}")
    assert again.status_code == 404
    assert again.json()["error"]["code"] == "measurement_not_found"


def test_a_nonexistent_measurement_id_is_measurement_not_found(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, ALICE)
    response = client.get(MEASUREMENTS)  # establish a session first
    assert response.status_code == 200
    update = client.put(f"{MEASUREMENTS}/no-such-id", json=observation())
    delete = client.delete(f"{MEASUREMENTS}/no-such-id")
    for response in (update, delete):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "measurement_not_found"


def test_another_account_cannot_read_update_or_delete_a_measurement(
    client: TestClient, mailer: RecordingMailer
):
    """One app, two independently signed-in clients sharing its database."""
    sign_in_as(client, mailer, ALICE)
    created = client.post(MEASUREMENTS, json=observation()).json()
    measurement_id = created["id"]

    bobs_client = TestClient(client.app, raise_server_exceptions=False)
    sign_in_as(bobs_client, mailer, BOB)  # the app's mailer is shared; bob's code is the last sent

    update = bobs_client.put(f"{MEASUREMENTS}/{measurement_id}", json=observation(weight=1.0))
    delete = bobs_client.delete(f"{MEASUREMENTS}/{measurement_id}")
    not_found = bobs_client.put(f"{MEASUREMENTS}/not-a-real-id", json=observation())
    assert update.status_code == not_found.status_code == 404
    assert update.json() == not_found.json()
    assert delete.status_code == 404
    assert delete.json()["error"]["code"] == "measurement_not_found"

    # Alice's measurement is untouched.
    still_there = client.get(MEASUREMENTS).json()
    assert still_there["count"] == 1
    assert still_there["measurements"][0]["id"] == measurement_id

    # Bob's own history is unaffected and still empty.
    assert bobs_client.get(MEASUREMENTS).json()["count"] == 0


# --- the measurement cap ------------------------------------------------------------------


def test_the_single_create_route_enforces_the_cap(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, ALICE)
    app = client.app
    with app.state.database.store() as store:  # type: ignore[attr-defined]
        user_id = store.users.get_by_email(ALICE).id  # type: ignore[union-attr]
        for i in range(MAX_OBSERVATIONS):
            store.measurements.add(
                user_id,
                timestamp=FROZEN_NOW - timedelta(days=i + 10),
                weight=70.0,
                unit="kg",
                source="manual",
                now=FROZEN_NOW,
            )
        store.commit()

    response = client.post(MEASUREMENTS, json=observation())
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "measurement_limit_exceeded"


# --- batch import: idempotence and the cap -------------------------------------------------


def test_batch_import_stores_every_row(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, ALICE)
    batch = {
        "observations": [observation(days_ago=1), observation(days_ago=2), observation(days_ago=3)],
        "source": "csv",
    }
    response = client.post(BATCH, json=batch)
    assert response.status_code == 200
    assert response.json() == {"inserted_count": 3, "skipped_existing_count": 0}
    listed = client.get(MEASUREMENTS).json()
    assert listed["count"] == 3
    assert {item["source"] for item in listed["measurements"]} == {"csv"}


def test_reimporting_the_same_batch_is_idempotent(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, ALICE)
    batch = {
        "observations": [observation(days_ago=1), observation(days_ago=2)],
        "source": "csv",
    }
    first = client.post(BATCH, json=batch)
    second = client.post(BATCH, json=batch)
    assert first.json() == {"inserted_count": 2, "skipped_existing_count": 0}
    assert second.json() == {"inserted_count": 0, "skipped_existing_count": 2}
    assert client.get(MEASUREMENTS).json()["count"] == 2


def test_a_duplicate_across_units_is_still_recognised(client: TestClient, mailer: RecordingMailer):
    """The same instant, entered once in kg and once in the equivalent lb, is one measurement."""
    sign_in_as(client, mailer, ALICE)
    kg_row = observation(days_ago=1, weight=70.0, unit="kg")
    lb_row = observation(days_ago=1, weight=70.0 / 0.45359237, unit="lb")
    client.post(BATCH, json={"observations": [kg_row]})
    again = client.post(BATCH, json={"observations": [lb_row]})
    assert again.json()["skipped_existing_count"] == 1
    assert client.get(MEASUREMENTS).json()["count"] == 1


def test_a_duplicate_within_one_batch_is_only_inserted_once(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, ALICE)
    row = observation(days_ago=1)
    response = client.post(BATCH, json={"observations": [row, row, row]})
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 2}
    assert client.get(MEASUREMENTS).json()["count"] == 1


def test_a_manually_created_measurement_is_recognised_by_a_later_batch_import(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, ALICE)
    row = observation(days_ago=1, weight=70.0)
    client.post(MEASUREMENTS, json=row)
    imported = client.post(BATCH, json={"observations": [row], "source": "csv"})
    assert imported.json() == {"inserted_count": 0, "skipped_existing_count": 1}
    assert client.get(MEASUREMENTS).json()["count"] == 1


def test_batch_import_enforces_the_cap_and_writes_nothing_when_it_would_be_exceeded(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, ALICE)
    app = client.app
    with app.state.database.store() as store:  # type: ignore[attr-defined]
        user_id = store.users.get_by_email(ALICE).id  # type: ignore[union-attr]
        for i in range(MAX_OBSERVATIONS - 1):
            store.measurements.add(
                user_id,
                timestamp=FROZEN_NOW - timedelta(days=i + 10),
                weight=70.0,
                unit="kg",
                source="manual",
                now=FROZEN_NOW,
            )
        store.commit()

    response = client.post(
        BATCH, json={"observations": [observation(days_ago=1), observation(days_ago=2)]}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "measurement_limit_exceeded"
    assert client.get(MEASUREMENTS).json()["count"] == MAX_OBSERVATIONS - 1


@pytest.mark.parametrize(
    "body",
    [
        {"observations": []},
        {"observations": [observation()] * (MAX_OBSERVATIONS + 1)},
        {"observations": [observation()], "source": "not-a-source"},
        {"observations": [observation()], "extra": True},
    ],
)
def test_batch_validates_its_body(
    client: TestClient, mailer: RecordingMailer, body: dict[str, object]
):
    sign_in_as(client, mailer, ALICE)
    response = client.post(BATCH, json=body)
    assert response.status_code == 422
