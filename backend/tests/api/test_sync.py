"""Sync connections and the insert-only Apple Health sync.

Three things are load-bearing here and each is tested directly rather than inferred:

1. **The credential.** A sync token is shown once, stored only as a hash, never listed,
   revocable, bound to its own account, and a separate security domain from the browser
   session in both directions.
2. **Insert-only.** No sync request -- whatever its window, however little it carries, however
   many times it is repeated -- can remove or change a stored measurement. Every such test
   compares the full stored history before and after, not just a count.
3. **Nothing statistical changed.** A synced history analyses to exactly what the same
   observations analyse to when submitted directly.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth.sync_tokens import SYNC_TOKEN_LENGTH, SYNC_TOKEN_PREFIX, new_sync_token
from app.persistence.models import SYNC_LABEL_MAX_LENGTH, MeasurementRow, SyncConnectionRow
from app.schemas import sync as sync_schema
from app.schemas.analysis import MAX_OBSERVATIONS
from tests.api.conftest import (
    FROZEN_NOW,
    MutableClock,
    RecordingMailer,
    build_app,
    make_test_settings,
    sign_in_as,
)

CONNECTIONS = "/api/me/sync/connections"
SYNC = "/api/me/sync/apple_health"
MEASUREMENTS = "/api/me/measurements"
BATCH = "/api/me/measurements/batch"
ME = "/api/me"

ALICE = "alice@example.com"
BOB = "bob@example.com"

WINDOW_START = (FROZEN_NOW - timedelta(days=30)).isoformat()
WINDOW_END = FROZEN_NOW.isoformat()


def observation(days_ago: float = 1.0, weight: float = 66.1, unit: str = "kg") -> dict[str, Any]:
    timestamp = (FROZEN_NOW - timedelta(days=days_ago)).isoformat()
    return {"timestamp": timestamp, "weight": weight, "unit": unit}


def sync_body(*observations: dict[str, Any], **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "window_start": WINDOW_START,
        "window_end": WINDOW_END,
        "observations": list(observations),
    }
    body.update(overrides)
    return body


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_connection(client: TestClient, **body: Any) -> dict[str, Any]:
    response = client.post(CONNECTIONS, json=body)
    assert response.status_code == 201, response.text
    created: dict[str, Any] = response.json()
    return created


def device(client: TestClient) -> TestClient:
    """A client with no cookies at all, as a Shortcut is: it holds a bearer token or nothing."""
    return TestClient(client.app, raise_server_exceptions=False)


def stored(client: TestClient) -> list[dict[str, Any]]:
    """The signed-in account's full stored history, for before/after comparison."""
    measurements: list[dict[str, Any]] = client.get(MEASUREMENTS).json()["measurements"]
    return measurements


@pytest.fixture
def alice(client: TestClient, mailer: RecordingMailer) -> TestClient:
    sign_in_as(client, mailer, ALICE)
    return client


@pytest.fixture
def bob(client: TestClient, mailer: RecordingMailer) -> TestClient:
    bobs_client = TestClient(client.app, raise_server_exceptions=False)
    sign_in_as(bobs_client, mailer, BOB)
    return bobs_client


@pytest.fixture
def token(alice: TestClient) -> str:
    created: str = create_connection(alice)["token"]
    return created


# --- credential lifecycle -----------------------------------------------------------------


def test_creating_a_connection_returns_its_metadata_and_a_plaintext_token(alice: TestClient):
    created = create_connection(alice, label="Alice's iPhone")
    assert set(created) == {"connection", "token"}
    assert created["connection"] == {
        "id": created["connection"]["id"],
        "source": "apple_health",
        "label": "Alice's iPhone",
        "created_at": "2026-06-12T09:00:00Z",
        "last_used_at": None,
    }
    assert created["token"].startswith(SYNC_TOKEN_PREFIX)
    assert len(created["token"]) == SYNC_TOKEN_LENGTH


def test_a_connection_created_without_a_label_gets_the_default(alice: TestClient):
    assert create_connection(alice)["connection"]["label"] == "Apple Health"


def test_every_token_is_different_and_carries_256_random_bits():
    tokens = {new_sync_token() for _ in range(50)}
    assert len(tokens) == 50
    for candidate in tokens:
        # 43 URL-safe base64 characters encode 32 bytes.
        assert len(candidate.removeprefix(SYNC_TOKEN_PREFIX)) == 43


def test_only_the_sha256_of_the_token_is_stored(alice: TestClient):
    created = create_connection(alice)
    with alice.app.state.database.engine.connect() as connection:  # type: ignore[attr-defined]
        rows = connection.execute(select(SyncConnectionRow.__table__)).mappings().all()
    assert len(rows) == 1
    assert rows[0]["token_hash"] == hashlib.sha256(created["token"].encode()).hexdigest()
    for value in rows[0].values():
        assert created["token"] not in str(value), "the plaintext token reached the database"


def test_listing_never_exposes_a_token_or_a_hash(alice: TestClient):
    created = create_connection(alice, label="Phone")
    response = alice.get(CONNECTIONS)
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["connections"] == [created["connection"]]
    assert set(body["connections"][0]) == {"id", "source", "label", "created_at", "last_used_at"}
    assert created["token"] not in response.text
    assert hashlib.sha256(created["token"].encode()).hexdigest() not in response.text


def test_connections_are_listed_most_recently_created_first(mailer: RecordingMailer):
    clock = MutableClock(FROZEN_NOW)
    client = TestClient(build_app(mailer=mailer, clock=clock), raise_server_exceptions=False)
    sign_in_as(client, mailer, ALICE)
    create_connection(client, label="first")
    clock.instant = FROZEN_NOW + timedelta(minutes=1)
    create_connection(client, label="second")
    labels = [connection["label"] for connection in client.get(CONNECTIONS).json()["connections"]]
    assert labels == ["second", "first"]


@pytest.mark.parametrize("method", ["get", "post"])
def test_managing_connections_requires_a_browser_session(client: TestClient, method: str):
    response = client.request(method, CONNECTIONS, json={})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


@pytest.mark.parametrize(
    "body",
    [{"label": ""}, {"label": "x" * 65}, {"label": 7}, {"source": "apple_health"}, {"extra": 1}],
)
def test_create_validates_its_body(alice: TestClient, body: dict[str, Any]):
    assert alice.post(CONNECTIONS, json=body).status_code == 422
    assert alice.get(CONNECTIONS).json()["count"] == 0


def test_the_label_bound_matches_the_column_that_stores_it():
    assert sync_schema.SYNC_LABEL_MAX_LENGTH == SYNC_LABEL_MAX_LENGTH


def test_an_account_cannot_hold_more_than_the_connection_cap(alice: TestClient):
    for _ in range(sync_schema.MAX_SYNC_CONNECTIONS):
        create_connection(alice)
    response = alice.post(CONNECTIONS, json={})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "sync_connection_limit_exceeded"
    assert alice.get(CONNECTIONS).json()["count"] == sync_schema.MAX_SYNC_CONNECTIONS


def test_connection_responses_are_never_cached(alice: TestClient):
    created = alice.post(CONNECTIONS, json={})
    listed = alice.get(CONNECTIONS)
    synced = device(alice).put(
        SYNC, json=sync_body(observation()), headers=bearer(created.json()["token"])
    )
    revoked = alice.delete(f"{CONNECTIONS}/{created.json()['connection']['id']}")
    for response in (created, listed, synced, revoked):
        assert response.headers["cache-control"] == "no-store"


# --- bearer authentication ----------------------------------------------------------------


def test_a_bearer_token_authenticates_a_sync(alice: TestClient, token: str):
    response = device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(token))
    assert response.status_code == 200, response.text
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}


def test_the_bearer_scheme_is_case_insensitive(alice: TestClient, token: str):
    response = device(alice).put(
        SYNC, json=sync_body(observation()), headers={"Authorization": f"bearer {token}"}
    )
    assert response.status_code == 200


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": ""},
        {"Authorization": "Bearer"},
        {"Authorization": "Bearer "},
        {"Authorization": "Basic dXNlcjpwYXNz"},
        {"Authorization": "Bearer not-a-sync-token"},
        {"Authorization": f"Bearer {SYNC_TOKEN_PREFIX}{'A' * 43}"},
        {"Authorization": f"Bearer {'A' * 20_000}"},
    ],
    ids=[
        "no header",
        "empty",
        "scheme only",
        "blank credential",
        "wrong scheme",
        "malformed",
        "well-formed but unknown",
        "oversized",
    ],
)
def test_a_missing_or_invalid_token_is_rejected(alice: TestClient, headers: dict[str, str]):
    create_connection(alice)
    response = device(alice).put(SYNC, json=sync_body(observation()), headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_sync_token"
    assert stored(alice) == []


def test_a_token_that_differs_by_one_character_is_rejected(alice: TestClient, token: str):
    flipped = token[:-1] + ("A" if token[-1] != "A" else "B")
    response = device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(flipped))
    assert response.status_code == 401


def test_authentication_is_checked_before_the_body(alice: TestClient):
    """An unauthenticated caller learns nothing about what a valid request looks like."""
    response = device(alice).put(SYNC, json={"nonsense": True})
    assert response.status_code == 401
    assert response.json()["error"]["details"] == []


def test_a_revoked_token_is_rejected(alice: TestClient):
    created = create_connection(alice)
    headers = bearer(created["token"])
    assert (
        device(alice).put(SYNC, json=sync_body(observation(1)), headers=headers).status_code == 200
    )

    revoked = alice.delete(f"{CONNECTIONS}/{created['connection']['id']}")
    assert revoked.status_code == 204
    assert alice.get(CONNECTIONS).json() == {"connections": [], "count": 0}

    response = device(alice).put(SYNC, json=sync_body(observation(2)), headers=headers)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_sync_token"


def test_revoking_a_connection_deletes_no_measurement(alice: TestClient):
    created = create_connection(alice)
    device(alice).put(
        SYNC, json=sync_body(observation(1), observation(2)), headers=bearer(created["token"])
    )
    before = stored(alice)
    assert len(before) == 2
    alice.delete(f"{CONNECTIONS}/{created['connection']['id']}")
    assert stored(alice) == before


def test_revoking_one_connection_leaves_the_others_working(alice: TestClient):
    first = create_connection(alice, label="old phone")
    second = create_connection(alice, label="new phone")
    alice.delete(f"{CONNECTIONS}/{first['connection']['id']}")
    response = device(alice).put(
        SYNC, json=sync_body(observation()), headers=bearer(second["token"])
    )
    assert response.status_code == 200
    assert [c["label"] for c in alice.get(CONNECTIONS).json()["connections"]] == ["new phone"]


def test_revoking_an_unknown_connection_is_a_404(alice: TestClient):
    response = alice.delete(f"{CONNECTIONS}/no-such-connection")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "sync_connection_not_found"
    assert "no-such-connection" not in response.text


def test_last_used_at_is_null_until_the_token_is_used_then_tracks_each_use(
    mailer: RecordingMailer,
):
    clock = MutableClock(FROZEN_NOW)
    client = TestClient(build_app(mailer=mailer, clock=clock), raise_server_exceptions=False)
    sign_in_as(client, mailer, ALICE)
    created = create_connection(client)
    assert client.get(CONNECTIONS).json()["connections"][0]["last_used_at"] is None

    clock.instant = FROZEN_NOW + timedelta(hours=3)
    device(client).put(SYNC, json=sync_body(observation()), headers=bearer(created["token"]))
    listed = client.get(CONNECTIONS).json()["connections"][0]
    assert listed["last_used_at"] == "2026-06-12T12:00:00Z"
    assert listed["created_at"] == "2026-06-12T09:00:00Z"

    clock.instant = FROZEN_NOW + timedelta(days=2)
    device(client).put(SYNC, json=sync_body(observation()), headers=bearer(created["token"]))
    assert (
        client.get(CONNECTIONS).json()["connections"][0]["last_used_at"] == "2026-06-14T09:00:00Z"
    )


def test_a_rejected_token_does_not_stamp_any_connection(alice: TestClient):
    create_connection(alice)
    device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(new_sync_token()))
    assert alice.get(CONNECTIONS).json()["connections"][0]["last_used_at"] is None


def test_only_the_connection_that_was_used_is_stamped(alice: TestClient):
    used = create_connection(alice, label="used")
    create_connection(alice, label="idle")
    device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(used["token"]))
    by_label = {c["label"]: c for c in alice.get(CONNECTIONS).json()["connections"]}
    assert by_label["used"]["last_used_at"] is not None
    assert by_label["idle"]["last_used_at"] is None


# --- two security domains -----------------------------------------------------------------


def test_a_browser_session_cannot_stand_in_for_a_sync_token(alice: TestClient):
    """The prototype this replaces: a request carrying only ``ht_session`` must not sync."""
    create_connection(alice)
    assert "ht_session" in alice.cookies
    response = alice.put(SYNC, json=sync_body(observation()))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_sync_token"
    assert stored(alice) == []


def test_a_session_token_sent_as_a_bearer_token_is_rejected(alice: TestClient):
    session_token = alice.cookies["ht_session"]
    response = device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(session_token))
    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", ME),
        ("get", MEASUREMENTS),
        ("post", MEASUREMENTS),
        ("post", BATCH),
        ("get", "/api/me/analysis"),
        ("get", "/api/me/export"),
        ("get", "/api/me/export/measurements.csv"),
        ("put", "/api/me/preferences"),
        ("put", "/api/me/goal"),
        ("delete", "/api/me/goal"),
        ("delete", ME),
        ("get", CONNECTIONS),
        ("post", CONNECTIONS),
        ("delete", f"{CONNECTIONS}/anything"),
    ],
)
def test_a_sync_token_authenticates_nothing_but_the_sync_route(
    alice: TestClient, token: str, method: str, path: str
):
    """Bearer and cookie forms both: the token is not a session under either name."""
    as_bearer = device(alice).request(method, path, json={}, headers=bearer(token))
    assert as_bearer.status_code == 401
    assert as_bearer.json()["error"]["code"] == "unauthenticated"

    as_cookie = device(alice)
    as_cookie.cookies.set("ht_session", token)
    assert as_cookie.request(method, path, json={}).status_code == 401


def test_the_sync_token_itself_cannot_revoke_or_mint_connections(alice: TestClient, token: str):
    connection_id = alice.get(CONNECTIONS).json()["connections"][0]["id"]
    holder = device(alice)
    assert holder.delete(f"{CONNECTIONS}/{connection_id}", headers=bearer(token)).status_code == 401
    assert holder.post(CONNECTIONS, json={}, headers=bearer(token)).status_code == 401
    assert alice.get(CONNECTIONS).json()["count"] == 1


# --- user isolation -----------------------------------------------------------------------


def test_a_token_writes_only_to_its_own_account(alice: TestClient, bob: TestClient):
    alices_token = create_connection(alice)["token"]
    bobs_token = create_connection(bob)["token"]
    bob.post(MEASUREMENTS, json=observation(5, 90.0))
    bobs_history = stored(bob)

    response = device(alice).put(
        SYNC, json=sync_body(observation(1, 66.1)), headers=bearer(alices_token)
    )
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}
    assert [m["weight"] for m in stored(alice)] == [66.1]
    assert stored(bob) == bobs_history

    device(bob).put(SYNC, json=sync_body(observation(2, 91.0)), headers=bearer(bobs_token))
    assert [m["weight"] for m in stored(alice)] == [66.1]
    assert sorted(m["weight"] for m in stored(bob)) == [90.0, 91.0]


def test_duplicates_are_judged_within_one_account_only(alice: TestClient, bob: TestClient):
    """Bob already holding the same reading must not make Alice's sync skip it."""
    bob.post(MEASUREMENTS, json=observation(1, 66.1))
    alices_token = create_connection(alice)["token"]
    response = device(alice).put(
        SYNC, json=sync_body(observation(1, 66.1)), headers=bearer(alices_token)
    )
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}


def test_another_accounts_connections_are_invisible_and_cannot_be_revoked(
    alice: TestClient, bob: TestClient
):
    alices = create_connection(alice, label="alice's")
    assert bob.get(CONNECTIONS).json() == {"connections": [], "count": 0}

    response = bob.delete(f"{CONNECTIONS}/{alices['connection']['id']}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "sync_connection_not_found"

    assert alice.get(CONNECTIONS).json()["count"] == 1
    still_works = device(alice).put(
        SYNC, json=sync_body(observation()), headers=bearer(alices["token"])
    )
    assert still_works.status_code == 200


def test_the_connection_cap_is_per_account(alice: TestClient, bob: TestClient):
    for _ in range(sync_schema.MAX_SYNC_CONNECTIONS):
        create_connection(alice)
    assert bob.post(CONNECTIONS, json={}).status_code == 201


def test_leaving_the_beta_allow_list_ends_syncing(mailer: RecordingMailer):
    """The allow-list is re-checked on every sync, as it is on every resolved session."""
    app = build_app(
        mailer=mailer, settings=make_test_settings(beta_allowed_emails=frozenset({ALICE}))
    )
    client = TestClient(app, raise_server_exceptions=False)
    sign_in_as(client, mailer, ALICE)
    token = create_connection(client)["token"]
    assert (
        device(client).put(SYNC, json=sync_body(observation(1)), headers=bearer(token)).status_code
        == 200
    )

    app.state.settings = make_test_settings(beta_allowed_emails=frozenset({BOB}))
    response = device(client).put(SYNC, json=sync_body(observation(2)), headers=bearer(token))
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_sync_token"


# --- account deletion ---------------------------------------------------------------------


def test_deleting_the_account_removes_its_connections_and_kills_its_tokens(
    alice: TestClient, bob: TestClient
):
    alices_token = create_connection(alice)["token"]
    bobs_token = create_connection(bob)["token"]
    alice_id = alice.get(ME).json()["user"]["id"]

    assert alice.request("DELETE", ME, json={"confirm_email": ALICE}).status_code == 204

    with alice.app.state.database.engine.connect() as connection:  # type: ignore[attr-defined]
        owners = connection.scalars(select(SyncConnectionRow.user_id)).all()
    assert alice_id not in owners
    assert len(owners) == 1, "bob's connection must survive"

    dead = device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(alices_token))
    assert dead.status_code == 401
    alive = device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(bobs_token))
    assert alive.status_code == 200


def test_a_recreated_account_does_not_inherit_the_old_accounts_token(
    alice: TestClient, mailer: RecordingMailer
):
    old_token = create_connection(alice)["token"]
    alice.request("DELETE", ME, json={"confirm_email": ALICE})
    sign_in_as(alice, mailer, ALICE)
    response = device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(old_token))
    assert response.status_code == 401
    assert stored(alice) == []


# --- sync behaviour: inserting ------------------------------------------------------------


def test_one_observation_inserts_with_the_apple_health_source(alice: TestClient, token: str):
    response = device(alice).put(SYNC, json=sync_body(observation(1, 66.1)), headers=bearer(token))
    assert response.status_code == 200
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}
    (measurement,) = stored(alice)
    assert measurement["weight"] == 66.1
    assert measurement["unit"] == "kg"
    assert measurement["source"] == "apple_health"
    assert measurement["timestamp"] == "2026-06-11T09:00:00Z"


def test_the_source_is_persisted_as_apple_health(alice: TestClient, token: str):
    device(alice).put(SYNC, json=sync_body(observation(1), observation(2)), headers=bearer(token))
    with alice.app.state.database.engine.connect() as connection:  # type: ignore[attr-defined]
        sources = connection.scalars(select(MeasurementRow.source)).all()
    assert sources == ["apple_health", "apple_health"]


def test_multiple_observations_insert(alice: TestClient, token: str):
    observations = [observation(days, 66.0 + days / 10) for days in range(1, 8)]
    response = device(alice).put(SYNC, json=sync_body(*observations), headers=bearer(token))
    assert response.json() == {"inserted_count": 7, "skipped_existing_count": 0}
    assert len(stored(alice)) == 7
    assert {m["source"] for m in stored(alice)} == {"apple_health"}


def test_pounds_are_stored_as_entered(alice: TestClient, token: str):
    response = device(alice).put(
        SYNC, json=sync_body(observation(1, 145.7, "lb")), headers=bearer(token)
    )
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}
    (measurement,) = stored(alice)
    assert (measurement["weight"], measurement["unit"]) == (145.7, "lb")


def test_the_unit_defaults_to_kilograms(alice: TestClient, token: str):
    body = sync_body({"timestamp": WINDOW_END, "weight": 66.1})
    assert device(alice).put(SYNC, json=body, headers=bearer(token)).status_code == 200
    assert stored(alice)[0]["unit"] == "kg"


def test_a_non_utc_offset_is_stored_as_the_same_instant(alice: TestClient, token: str):
    body = sync_body({"timestamp": "2026-06-10T07:30:00+10:00", "weight": 66.1, "unit": "kg"})
    assert device(alice).put(SYNC, json=body, headers=bearer(token)).status_code == 200
    assert stored(alice)[0]["timestamp"] == "2026-06-09T21:30:00Z"


# --- sync behaviour: de-duplication -------------------------------------------------------


def test_rerunning_the_same_sync_skips_everything(alice: TestClient, token: str):
    body = sync_body(observation(1, 66.1), observation(2, 66.4), observation(3, 66.0))
    first = device(alice).put(SYNC, json=body, headers=bearer(token))
    assert first.json() == {"inserted_count": 3, "skipped_existing_count": 0}
    after_first = stored(alice)

    for _ in range(3):
        again = device(alice).put(SYNC, json=body, headers=bearer(token))
        assert again.json() == {"inserted_count": 0, "skipped_existing_count": 3}
    assert stored(alice) == after_first


def test_a_mixed_payload_inserts_the_new_and_skips_the_known(alice: TestClient, token: str):
    device(alice).put(
        SYNC, json=sync_body(observation(1, 66.1), observation(2, 66.4)), headers=bearer(token)
    )
    response = device(alice).put(
        SYNC,
        json=sync_body(
            observation(1, 66.1), observation(2, 66.4), observation(3, 66.0), observation(4, 65.8)
        ),
        headers=bearer(token),
    )
    assert response.json() == {"inserted_count": 2, "skipped_existing_count": 2}
    assert sorted(m["weight"] for m in stored(alice)) == [65.8, 66.0, 66.1, 66.4]


def test_a_duplicate_within_one_request_is_stored_once(alice: TestClient, token: str):
    response = device(alice).put(
        SYNC, json=sync_body(observation(1, 66.1), observation(1, 66.1)), headers=bearer(token)
    )
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 1}
    assert len(stored(alice)) == 1


def test_an_existing_manual_measurement_is_not_duplicated_and_keeps_its_source(
    alice: TestClient, token: str
):
    alice.post(MEASUREMENTS, json=observation(1, 66.1))
    before = stored(alice)
    response = device(alice).put(SYNC, json=sync_body(observation(1, 66.1)), headers=bearer(token))
    assert response.json() == {"inserted_count": 0, "skipped_existing_count": 1}
    assert stored(alice) == before
    assert stored(alice)[0]["source"] == "manual"


def test_an_existing_csv_measurement_is_not_duplicated(alice: TestClient, token: str):
    alice.post(BATCH, json={"observations": [observation(1, 66.1)], "source": "csv"})
    response = device(alice).put(SYNC, json=sync_body(observation(1, 66.1)), headers=bearer(token))
    assert response.json() == {"inserted_count": 0, "skipped_existing_count": 1}
    assert [m["source"] for m in stored(alice)] == ["csv"]


def test_dedupe_is_the_batch_imports_own_across_units_and_offsets(alice: TestClient, token: str):
    """Same instant under another offset, same weight under another unit: one measurement."""
    alice.post(
        MEASUREMENTS, json={"timestamp": "2026-06-10T08:00:00+00:00", "weight": 100.0, "unit": "lb"}
    )
    same_in_kg = {"timestamp": "2026-06-10T10:00:00+02:00", "weight": 45.359237, "unit": "kg"}
    response = device(alice).put(SYNC, json=sync_body(same_in_kg), headers=bearer(token))
    assert response.json() == {"inserted_count": 0, "skipped_existing_count": 1}


def test_the_same_instant_with_a_different_weight_is_a_new_measurement(
    alice: TestClient, token: str
):
    """Insert-only means an Apple-side edit arrives as a second row, never as an overwrite."""
    alice.post(MEASUREMENTS, json=observation(1, 66.1))
    response = device(alice).put(SYNC, json=sync_body(observation(1, 66.3)), headers=bearer(token))
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}
    assert sorted(m["weight"] for m in stored(alice)) == [66.1, 66.3]


def test_a_later_browser_import_skips_what_a_sync_already_stored(alice: TestClient, token: str):
    device(alice).put(SYNC, json=sync_body(observation(1, 66.1)), headers=bearer(token))
    response = alice.post(BATCH, json={"observations": [observation(1, 66.1)], "source": "csv"})
    assert response.json() == {"inserted_count": 0, "skipped_existing_count": 1}
    assert [m["source"] for m in stored(alice)] == ["apple_health"]


# --- sync behaviour: nothing is ever removed ----------------------------------------------


@pytest.fixture
def history(alice: TestClient, token: str) -> list[dict[str, Any]]:
    """A mixed stored history -- manual, CSV and synced -- inside and outside the usual window."""
    alice.post(MEASUREMENTS, json=observation(400, 71.0))
    alice.post(MEASUREMENTS, json=observation(10, 67.0))
    alice.post(BATCH, json={"observations": [observation(9, 148.0, "lb")], "source": "csv"})
    device(alice).put(
        SYNC, json=sync_body(observation(8, 66.8), observation(3, 66.2)), headers=bearer(token)
    )
    snapshot = stored(alice)
    assert len(snapshot) == 5
    return snapshot


def test_an_empty_observation_list_is_rejected_and_changes_nothing(
    alice: TestClient, token: str, history: list[dict[str, Any]]
):
    response = device(alice).put(SYNC, json=sync_body(), headers=bearer(token))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert stored(alice) == history


def test_a_window_covering_stored_measurements_the_request_omits_deletes_none(
    alice: TestClient, token: str, history: list[dict[str, Any]]
):
    """The whole history lies inside the window and the request mentions one new reading."""
    body = sync_body(
        observation(1, 66.0),
        window_start=(FROZEN_NOW - timedelta(days=3650)).isoformat(),
        window_end=(FROZEN_NOW + timedelta(days=1)).isoformat(),
    )
    response = device(alice).put(SYNC, json=body, headers=bearer(token))
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}
    after = stored(alice)
    assert len(after) == len(history) + 1
    for measurement in history:
        assert measurement in after, "a stored measurement changed or disappeared"


@pytest.mark.parametrize(
    ("start_days_ago", "end_days_ago"),
    [(30, 0), (9, 8), (0, 0), (5000, 4000), (-10, -20)],
    ids=["usual", "narrow", "instant", "long past", "future"],
)
def test_no_window_ever_removes_or_changes_a_stored_measurement(
    alice: TestClient,
    token: str,
    history: list[dict[str, Any]],
    start_days_ago: int,
    end_days_ago: int,
):
    body = sync_body(
        observation(8, 66.8),  # already stored: the request adds nothing
        window_start=(FROZEN_NOW - timedelta(days=start_days_ago)).isoformat(),
        window_end=(FROZEN_NOW - timedelta(days=end_days_ago)).isoformat(),
    )
    response = device(alice).put(SYNC, json=body, headers=bearer(token))
    assert response.json() == {"inserted_count": 0, "skipped_existing_count": 1}
    assert stored(alice) == history


def test_an_observation_outside_the_window_is_still_only_ever_inserted(
    alice: TestClient, token: str, history: list[dict[str, Any]]
):
    body = sync_body(
        observation(200, 69.0),
        window_start=(FROZEN_NOW - timedelta(days=2)).isoformat(),
        window_end=FROZEN_NOW.isoformat(),
    )
    response = device(alice).put(SYNC, json=body, headers=bearer(token))
    assert response.json() == {"inserted_count": 1, "skipped_existing_count": 0}
    for measurement in history:
        assert measurement in stored(alice)


def test_a_rejected_sync_changes_nothing(
    alice: TestClient, token: str, history: list[dict[str, Any]]
):
    """One bad observation rejects the whole request: no partial write, no removal."""
    body = sync_body(observation(1, 66.0), {"timestamp": WINDOW_END, "weight": -1.0})
    assert device(alice).put(SYNC, json=body, headers=bearer(token)).status_code == 422
    assert stored(alice) == history


def test_a_sync_over_the_measurement_cap_stores_nothing_and_removes_nothing(
    alice: TestClient, token: str
):
    alice.post(MEASUREMENTS, json=observation(1, 66.1))
    before = stored(alice)
    observations = [observation(2 + i * 0.01, 66.0) for i in range(MAX_OBSERVATIONS)]
    response = device(alice).put(SYNC, json=sync_body(*observations), headers=bearer(token))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "measurement_limit_exceeded"
    assert stored(alice) == before


# --- validation ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "bad_observation",
    [
        {"timestamp": "2026-06-10T08:00:00", "weight": 66.1, "unit": "kg"},
        {"timestamp": "2026-06-10", "weight": 66.1, "unit": "kg"},
        {"timestamp": "yesterday", "weight": 66.1, "unit": "kg"},
        {"weight": 66.1, "unit": "kg"},
        {"timestamp": WINDOW_END, "unit": "kg"},
        {"timestamp": WINDOW_END, "weight": 0, "unit": "kg"},
        {"timestamp": WINDOW_END, "weight": -66.1, "unit": "kg"},
        {"timestamp": WINDOW_END, "weight": "heavy", "unit": "kg"},
        {"timestamp": WINDOW_END, "weight": 66.1, "unit": "stone"},
        {"timestamp": WINDOW_END, "weight": 66.1, "unit": "kg", "source": "manual"},
        {"timestamp": "9999-06-01T00:00:00Z", "weight": 66.1, "unit": "kg"},
    ],
    ids=[
        "naive timestamp",
        "date only",
        "not a timestamp",
        "no timestamp",
        "no weight",
        "zero weight",
        "negative weight",
        "non-numeric weight",
        "unknown unit",
        "extra field",
        "unrepresentably late",
    ],
)
def test_an_invalid_observation_rejects_the_request(
    alice: TestClient, token: str, bad_observation: dict[str, Any]
):
    body = sync_body(observation(1, 66.1), bad_observation)
    response = device(alice).put(SYNC, json=body, headers=bearer(token))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"
    assert stored(alice) == []


def test_a_naive_observation_timestamp_is_named_as_such(alice: TestClient, token: str):
    body = sync_body({"timestamp": "2026-06-10T08:00:00", "weight": 66.1, "unit": "kg"})
    response = device(alice).put(SYNC, json=body, headers=bearer(token))
    (detail,) = response.json()["error"]["details"]
    assert detail["location"] == "body.observations.0.timestamp"
    assert detail["code"] == "timezone_aware"


@pytest.mark.parametrize(
    "overrides",
    [
        {"window_start": "2026-05-01T00:00:00"},
        {"window_end": "2026-06-12T00:00:00"},
        {"window_start": "not-a-time"},
        {"window_start": WINDOW_END, "window_end": WINDOW_START},
        {"mode": "replace"},
        {"delete_missing": True},
    ],
    ids=[
        "naive start",
        "naive end",
        "unparseable",
        "end before start",
        "mode field",
        "delete flag",
    ],
)
def test_an_invalid_envelope_rejects_the_request(
    alice: TestClient, token: str, overrides: dict[str, Any]
):
    response = device(alice).put(
        SYNC, json=sync_body(observation(), **overrides), headers=bearer(token)
    )
    assert response.status_code == 422
    assert stored(alice) == []


@pytest.mark.parametrize("missing", ["window_start", "window_end", "observations"])
def test_every_envelope_field_is_required(alice: TestClient, token: str, missing: str):
    body = sync_body(observation())
    del body[missing]
    assert device(alice).put(SYNC, json=body, headers=bearer(token)).status_code == 422


def test_a_request_over_the_batch_bound_is_rejected(alice: TestClient, token: str):
    observations = [observation(1 + i * 0.001, 66.0) for i in range(MAX_OBSERVATIONS + 1)]
    response = device(alice).put(SYNC, json=sync_body(*observations), headers=bearer(token))
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["code"] == "too_long"
    assert stored(alice) == []


@pytest.mark.parametrize("method", ["get", "post", "delete", "patch"])
def test_the_sync_route_has_no_other_method(alice: TestClient, token: str, method: str):
    """In particular there is no DELETE: nothing on this path can remove a measurement."""
    response = device(alice).request(method, SYNC, headers=bearer(token))
    assert response.status_code == 405


# --- analysis is unchanged ----------------------------------------------------------------

SERIES = [
    observation(10, 82.4),
    observation(7, 82.1),
    observation(5, 181.0, "lb"),
    observation(2, 81.6),
]


def test_a_synced_history_analyses_exactly_as_the_same_series_submitted(
    alice: TestClient, token: str
):
    assert (
        device(alice).put(SYNC, json=sync_body(*SERIES), headers=bearer(token)).status_code == 200
    )
    account = alice.get("/api/me/analysis")
    assert account.status_code == 200, account.text
    submitted = alice.post("/api/analyse", json={"observations": SERIES})
    assert submitted.status_code == 200

    account_body, submitted_body = account.json(), submitted.json()
    assert account_body["meta"].pop("source") == "account"
    assert submitted_body["meta"].pop("source") == "submitted"
    assert account_body == submitted_body


def test_the_source_of_a_measurement_does_not_move_a_single_number(
    alice: TestClient, bob: TestClient
):
    """The same series stored by hand and stored by sync: byte-identical analysis."""
    for item in SERIES:
        assert alice.post(MEASUREMENTS, json=item).status_code == 201
    bobs_token = create_connection(bob)["token"]
    device(bob).put(SYNC, json=sync_body(*SERIES), headers=bearer(bobs_token))

    assert {m["source"] for m in stored(alice)} == {"manual"}
    assert {m["source"] for m in stored(bob)} == {"apple_health"}
    assert alice.get("/api/me/analysis").json() == bob.get("/api/me/analysis").json()


def test_synced_measurements_appear_in_both_exports(alice: TestClient, token: str):
    device(alice).put(SYNC, json=sync_body(observation(1, 66.1)), headers=bearer(token))
    exported = alice.get("/api/me/export").json()
    assert [m["source"] for m in exported["measurements"]] == ["apple_health"]
    assert "66.1" in alice.get("/api/me/export/measurements.csv").text


def test_the_account_export_carries_no_sync_credential(alice: TestClient, token: str):
    response = alice.get("/api/me/export")
    assert token not in response.text
    assert hashlib.sha256(token.encode()).hexdigest() not in response.text


def test_a_browser_batch_cannot_claim_the_apple_health_source(alice: TestClient):
    response = alice.post(BATCH, json={"observations": [observation()], "source": "apple_health"})
    assert response.status_code == 422
    assert stored(alice) == []


# --- nothing leaks ------------------------------------------------------------------------


def captured(caplog: pytest.LogCaptureFixture) -> str:
    return "\n".join(f"{record.getMessage()} {record.__dict__!r}" for record in caplog.records)


def test_no_token_or_hash_reaches_a_log(caplog: pytest.LogCaptureFixture):
    mailer = RecordingMailer()
    client = TestClient(build_app(mailer=mailer), raise_server_exceptions=False)
    wrong = new_sync_token()
    with caplog.at_level(logging.DEBUG):
        sign_in_as(client, mailer, ALICE)
        created = create_connection(client)
        token = created["token"]
        client.get(CONNECTIONS)
        device(client).put(SYNC, json=sync_body(observation()), headers=bearer(token))
        device(client).put(SYNC, json=sync_body(), headers=bearer(token))
        device(client).put(SYNC, json=sync_body(observation()), headers=bearer(wrong))
        client.delete(f"{CONNECTIONS}/{created['connection']['id']}")
        device(client).put(SYNC, json=sync_body(observation()), headers=bearer(token))

    text = captured(caplog)
    assert "PUT /api/me/sync/apple_health -> 200" in text, "the access log must have run"
    for secret in (token, wrong, hashlib.sha256(token.encode()).hexdigest()):
        assert secret not in text
        assert secret.removeprefix(SYNC_TOKEN_PREFIX)[:16] not in text


def test_a_rejected_token_is_not_echoed_in_the_response(alice: TestClient):
    wrong = new_sync_token()
    response = device(alice).put(SYNC, json=sync_body(observation()), headers=bearer(wrong))
    assert response.status_code == 401
    assert wrong not in response.text
    assert wrong not in str(response.headers)


def test_a_synced_weight_never_reaches_the_access_log(caplog: pytest.LogCaptureFixture):
    mailer = RecordingMailer()
    client = TestClient(build_app(mailer=mailer), raise_server_exceptions=False)
    sign_in_as(client, mailer, ALICE)
    token = create_connection(client)["token"]
    with caplog.at_level(logging.DEBUG):
        device(client).put(SYNC, json=sync_body(observation(1, 987.654321)), headers=bearer(token))
        device(client).put(
            SYNC,
            json=sync_body({"timestamp": WINDOW_END, "weight": -987.654321}),
            headers=bearer(token),
        )
    text = captured(caplog)
    assert "n_obs=1" in text
    assert "987.654321" not in text


def test_the_created_connection_does_not_print_its_token():
    from app.services.sync import CreatedSyncConnection

    created = CreatedSyncConnection(
        connection=sync_schema.SyncConnectionOut(
            id="c", source="apple_health", label="l", created_at=FROZEN_NOW, last_used_at=None
        ),
        token="hts_secret-value",
    )
    assert "hts_secret-value" not in repr(created)
