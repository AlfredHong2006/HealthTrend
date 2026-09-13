"""The repositories: UTC round-trips, ownership scoping, cascades and single-use codes."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError, StatementError

from app.errors import ConfigurationError
from app.persistence import Database, Store, make_engine
from tests.persistence.conftest import NOW

LATER = NOW + timedelta(hours=1)


def make_user(store: Store, email: str = "alice@example.com") -> str:
    user = store.users.create(email, now=NOW)
    store.commit()
    return user.id


# --- datetimes ----------------------------------------------------------------------------


def test_an_aware_non_utc_datetime_round_trips_as_the_same_utc_instant(store: Store):
    user_id = make_user(store)
    plus_five = datetime(2026, 6, 12, 14, 0, tzinfo=timezone(timedelta(hours=5)))
    created = store.measurements.add(
        user_id, timestamp=plus_five, weight=72.5, unit="kg", source="manual", now=NOW
    )
    store.commit()

    [stored] = store.measurements.list_for_user(user_id)
    assert stored.id == created.id
    assert stored.timestamp == plus_five
    assert stored.timestamp.tzinfo == UTC
    assert stored.timestamp.hour == 9


def test_a_naive_datetime_is_refused(store: Store):
    with pytest.raises(StatementError):
        store.users.create("naive@example.com", now=datetime(2026, 6, 12, 9, 0))


def test_datetimes_compare_correctly_in_sql(store: Store):
    """Rate limiting depends on a created_at >= since comparison being right in the database."""
    store.login_codes.add("a@example.com", "h" * 64, now=NOW, expires_at=NOW)
    store.login_codes.add("a@example.com", "h" * 64, now=LATER, expires_at=LATER)
    store.commit()
    assert store.login_codes.count_created_since("a@example.com", NOW) == 2
    assert store.login_codes.count_created_since("a@example.com", NOW + timedelta(seconds=1)) == 1
    store.login_codes.delete_created_before("a@example.com", LATER)
    store.commit()
    assert store.login_codes.count_created_since("a@example.com", NOW - timedelta(days=1)) == 1


# --- users ----------------------------------------------------------------------------------


def test_users_are_found_by_id_and_email(store: Store):
    user_id = make_user(store)
    by_id = store.users.get(user_id)
    assert by_id is not None
    assert by_id.email == "alice@example.com"
    assert store.users.get_by_email("alice@example.com") == by_id
    assert store.users.get_by_email("bob@example.com") is None


def test_an_email_can_belong_to_only_one_user(store: Store):
    make_user(store)
    with pytest.raises(IntegrityError):
        store.users.create("alice@example.com", now=NOW)


def test_record_login(store: Store):
    user_id = make_user(store)
    store.users.record_login(user_id, now=LATER)
    store.commit()
    user = store.users.get(user_id)
    assert user is not None
    assert user.last_login_at == LATER
    assert user.created_at == NOW


def test_deleting_a_user_cascades_to_everything_they_own(store: Store):
    alice = make_user(store)
    bob = make_user(store, "bob@example.com")
    for owner in (alice, bob):
        store.sessions.add(f"{owner[:8]}".ljust(64, "0"), owner, now=NOW, expires_at=LATER)
        store.measurements.add(owner, timestamp=NOW, weight=70.0, unit="kg", source="csv", now=NOW)
        store.preferences.upsert(owner, display_unit="lb", now=NOW)
        store.goals.upsert(owner, target_weight_kg=65.0, target_weekly_rate_kg=None, now=NOW)
    store.commit()

    assert store.users.delete(alice) is True
    store.commit()

    assert store.users.get(alice) is None
    assert store.sessions.get(alice[:8].ljust(64, "0")) is None
    assert store.measurements.count_for_user(alice) == 0
    assert store.preferences.get(alice) is None
    assert store.goals.get(alice) is None

    assert store.sessions.get(bob[:8].ljust(64, "0")) is not None
    assert store.measurements.count_for_user(bob) == 1
    assert store.preferences.get(bob) is not None
    assert store.goals.get(bob) is not None
    assert store.users.delete(alice) is False


# --- login codes ----------------------------------------------------------------------------


def test_the_newest_unconsumed_code_is_returned(store: Store):
    store.login_codes.add("a@example.com", "1" * 64, now=NOW, expires_at=LATER)
    newer = store.login_codes.add("a@example.com", "2" * 64, now=LATER, expires_at=LATER)
    store.login_codes.add("b@example.com", "3" * 64, now=LATER, expires_at=LATER)
    store.commit()
    found = store.login_codes.newest_unconsumed("a@example.com")
    assert found is not None
    assert found.id == newer.id
    assert found.attempts == 0
    assert found.consumed_at is None


def test_attempts_accumulate(store: Store):
    code = store.login_codes.add("a@example.com", "1" * 64, now=NOW, expires_at=LATER)
    assert [store.login_codes.record_attempt(code.id) for _ in range(3)] == [1, 2, 3]


def test_a_code_can_be_consumed_only_once(store: Store):
    code = store.login_codes.add("a@example.com", "1" * 64, now=NOW, expires_at=LATER)
    store.commit()
    assert store.login_codes.consume(code.id, now=LATER) is True
    assert store.login_codes.consume(code.id, now=LATER) is False
    store.commit()
    assert store.login_codes.newest_unconsumed("a@example.com") is None


def test_delete_by_id_removes_only_that_code(store: Store):
    kept = store.login_codes.add("a@example.com", "1" * 64, now=NOW, expires_at=LATER)
    doomed = store.login_codes.add("a@example.com", "2" * 64, now=NOW, expires_at=LATER)
    store.commit()
    store.login_codes.delete_by_id(doomed.id)
    store.commit()
    assert store.login_codes.newest_unconsumed("a@example.com") == kept
    assert store.login_codes.count_created_since("a@example.com", NOW) == 1


def test_delete_for_email_removes_every_code_for_that_address_only(store: Store):
    store.login_codes.add("a@example.com", "1" * 64, now=NOW, expires_at=LATER)
    store.login_codes.add("a@example.com", "2" * 64, now=LATER, expires_at=LATER)
    store.login_codes.add("b@example.com", "3" * 64, now=NOW, expires_at=LATER)
    store.commit()

    store.login_codes.delete_for_email("a@example.com")
    store.commit()

    assert store.login_codes.newest_unconsumed("a@example.com") is None
    assert store.login_codes.count_created_since("a@example.com", NOW - timedelta(days=1)) == 0
    assert store.login_codes.newest_unconsumed("b@example.com") is not None


# --- sessions -------------------------------------------------------------------------------


def test_a_session_can_be_touched_and_deleted(store: Store):
    user_id = make_user(store)
    token_hash = "a" * 64
    store.sessions.add(token_hash, user_id, now=NOW, expires_at=LATER)
    store.commit()
    store.sessions.touch(token_hash, now=LATER, expires_at=LATER + timedelta(days=90))
    store.commit()
    session = store.sessions.get(token_hash)
    assert session is not None
    assert session.last_seen_at == LATER
    assert session.expires_at == LATER + timedelta(days=90)
    store.sessions.delete(token_hash)
    store.commit()
    assert store.sessions.get(token_hash) is None


def test_a_session_requires_an_existing_user(store: Store):
    with pytest.raises(IntegrityError):
        store.sessions.add("b" * 64, "no-such-user", now=NOW, expires_at=LATER)


# --- measurements: ownership is structural ----------------------------------------------------


def test_measurements_are_listed_most_recent_first(store: Store):
    user_id = make_user(store)
    for days in (3, 1, 2):
        store.measurements.add(
            user_id,
            timestamp=NOW - timedelta(days=days),
            weight=70.0 + days,
            unit="kg",
            source="manual",
            now=NOW,
        )
    store.commit()
    listed = store.measurements.list_for_user(user_id)
    assert [record.weight for record in listed] == [71.0, 72.0, 73.0]
    assert store.measurements.count_for_user(user_id) == 3


def test_another_users_measurement_is_indistinguishable_from_a_missing_one(store: Store):
    alice = make_user(store)
    bob = make_user(store, "bob@example.com")
    record = store.measurements.add(
        alice, timestamp=NOW, weight=70.0, unit="kg", source="manual", now=NOW
    )
    store.commit()

    assert store.measurements.list_for_user(bob) == []
    assert store.measurements.get_owned(bob, record.id) is None
    assert store.measurements.get_owned(bob, "no-such-id") is None
    assert (
        store.measurements.update_owned(
            bob, record.id, timestamp=NOW, weight=1.0, unit="lb", now=LATER
        )
        is None
    )
    assert store.measurements.delete_owned(bob, record.id) is False
    store.commit()

    assert store.measurements.get_owned(alice, record.id) == record


def test_an_owned_measurement_can_be_updated_and_deleted(store: Store):
    user_id = make_user(store)
    record = store.measurements.add(
        user_id, timestamp=NOW, weight=70.0, unit="kg", source="manual", now=NOW
    )
    store.commit()
    updated = store.measurements.update_owned(
        user_id, record.id, timestamp=LATER, weight=155.0, unit="lb", now=LATER
    )
    store.commit()
    assert updated is not None
    assert (updated.timestamp, updated.weight, updated.unit) == (LATER, 155.0, "lb")
    assert updated.created_at == NOW
    assert updated.updated_at == LATER
    assert updated.source == "manual"

    assert store.measurements.delete_owned(user_id, record.id) is True
    store.commit()
    assert store.measurements.count_for_user(user_id) == 0


def test_the_schema_refuses_an_unknown_unit(store: Store):
    user_id = make_user(store)
    with pytest.raises(IntegrityError):
        store.measurements.add(
            user_id,
            timestamp=NOW,
            weight=70.0,
            unit="st",  # type: ignore[arg-type]
            source="manual",
            now=NOW,
        )


def test_sqlalchemy_does_not_render_bound_values_into_a_database_error(store: Store):
    """``hide_parameters`` is on for every engine.

    Only SQLAlchemy's own rendering is asserted here. The database server's error text can
    still quote a row (Postgres: "Failing row contains ..."), which is why no layer ever logs or
    returns a database exception message -- see ``tests/api/test_privacy.py``.
    """
    user_id = make_user(store)
    with pytest.raises(IntegrityError) as raised:
        store.measurements.add(
            user_id,
            timestamp=NOW,
            weight=70.0,
            unit="st",  # type: ignore[arg-type]
            source="manual",
            now=NOW,
        )
    message = str(raised.value)
    assert "SQL parameters hidden due to hide_parameters=True" in message
    assert "[parameters:" not in message


# --- preferences and goals ----------------------------------------------------------------------


def test_preferences_upsert(store: Store):
    user_id = make_user(store)
    assert store.preferences.get(user_id) is None
    store.preferences.upsert(user_id, display_unit="lb", now=NOW)
    store.preferences.upsert(user_id, display_unit="kg", now=LATER)
    store.commit()
    preferences = store.preferences.get(user_id)
    assert preferences is not None
    assert (preferences.display_unit, preferences.updated_at) == ("kg", LATER)


def test_goal_upsert_and_delete(store: Store):
    user_id = make_user(store)
    store.goals.upsert(user_id, target_weight_kg=68.0, target_weekly_rate_kg=-0.4, now=NOW)
    store.goals.upsert(user_id, target_weight_kg=None, target_weekly_rate_kg=-0.25, now=LATER)
    store.commit()
    goal = store.goals.get(user_id)
    assert goal is not None
    assert (goal.target_weight_kg, goal.target_weekly_rate_kg) == (None, -0.25)
    assert store.goals.delete(user_id) is True
    assert store.goals.delete(user_id) is False
    store.commit()
    assert store.goals.get(user_id) is None


# --- the store and the engine ---------------------------------------------------------------------


def test_uncommitted_work_is_discarded_when_the_store_closes(database: Database):
    with database.store() as store:
        store.users.create("ghost@example.com", now=NOW)
    with database.store() as store:
        assert store.users.get_by_email("ghost@example.com") is None


def test_rollback_discards_work(store: Store):
    store.users.create("ghost@example.com", now=NOW)
    store.rollback()
    assert store.users.get_by_email("ghost@example.com") is None


@pytest.mark.parametrize(
    "url",
    [
        "not a url at all",
        "nosuchdialect://user:sentinel-db-password@host/db",
        "postgresql+nosuchdriver://user:sentinel-db-password@host/db",
    ],
)
def test_an_unusable_url_is_a_configuration_error_that_does_not_quote_it(url: str):
    with pytest.raises(ConfigurationError) as raised:
        make_engine(url)
    message = str(raised.value)
    assert "sentinel-db-password" not in message
    assert url not in message
    assert raised.value.__suppress_context__
