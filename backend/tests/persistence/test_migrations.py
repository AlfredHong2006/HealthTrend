"""The Alembic migrations and the models must describe the same schema.

A model change without a migration would pass every repository test -- those create tables
straight from the models -- and then fail in production the first time the missing column is
touched. Comparing a freshly migrated database with the model metadata closes that gap.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.exc import DataError, IntegrityError

from app.persistence import Database
from app.persistence.models import Base
from tests.persistence.conftest import persistence_database_url, reset

BACKEND_DIR = Path(__file__).parents[2]

EXPECTED_TABLES = {
    "users",
    "login_codes",
    "sessions",
    "measurements",
    "preferences",
    "goals",
    "sync_connections",
}


@pytest.fixture
def empty_database() -> Iterator[Database]:
    handle = Database(persistence_database_url())
    reset(handle)
    try:
        yield handle
    finally:
        reset(handle)
        handle.dispose()


def alembic_config() -> Config:
    return Config(str(BACKEND_DIR / "alembic.ini"))


def test_there_is_a_single_linear_history():
    heads = ScriptDirectory.from_config(alembic_config()).get_heads()
    assert heads == ["0002_sync_connections"]


def test_upgrading_to_head_produces_exactly_the_model_schema(empty_database: Database):
    config = alembic_config()
    with empty_database.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")

    with empty_database.engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
        assert EXPECTED_TABLES | {"alembic_version"} == tables
        differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
    assert differences == []


def test_downgrading_to_base_removes_every_table(empty_database: Database):
    config = alembic_config()
    with empty_database.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        command.downgrade(config, "base")

    with empty_database.engine.connect() as connection:
        assert set(inspect(connection).get_table_names()) <= {"alembic_version"}


# --- 0002: sync connections and the apple_health source -----------------------------------

INSERT_USER = text(
    "INSERT INTO users (id, email, created_at, last_login_at) "
    "VALUES (:id, :email, '2026-06-01 09:00:00', '2026-06-01 09:00:00')"
)
INSERT_MEASUREMENT = text(
    "INSERT INTO measurements (id, user_id, timestamp, weight, unit, source, created_at, "
    "updated_at) VALUES (:id, 'user-1', :timestamp, :weight, :unit, :source, "
    "'2026-06-01 09:00:00', '2026-06-01 09:00:00')"
)
SELECT_MEASUREMENTS = text("SELECT id, weight, unit, source FROM measurements ORDER BY id")

EXISTING_ROWS = [
    {
        "id": "m-1",
        "timestamp": "2026-05-01 07:00:00",
        "weight": 82.4,
        "unit": "kg",
        "source": "manual",
    },
    {
        "id": "m-2",
        "timestamp": "2026-05-02 07:00:00",
        "weight": 181.0,
        "unit": "lb",
        "source": "csv",
    },
]
APPLE_ROW = {
    "id": "m-3",
    "timestamp": "2026-05-03 07:00:00",
    "weight": 82.0,
    "unit": "kg",
    "source": "apple_health",
}


def test_the_initial_schema_refuses_an_apple_health_measurement(empty_database: Database):
    """The reason 0002 exists: without it the source this feature writes cannot be stored."""
    config = alembic_config()
    with empty_database.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "0001_initial")
        connection.execute(INSERT_USER, {"id": "user-1", "email": "alice@example.com"})

    # Which error is the database's business: SQLite fails the source check (IntegrityError),
    # PostgreSQL fails 0001's VARCHAR(6) first (DataError). Either way the row is refused.
    with (
        pytest.raises((IntegrityError, DataError)),
        empty_database.engine.begin() as connection,
    ):
        connection.execute(INSERT_MEASUREMENT, APPLE_ROW)


def test_upgrading_to_0002_preserves_every_existing_row_and_admits_apple_health(
    empty_database: Database,
):
    config = alembic_config()
    with empty_database.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "0001_initial")
        connection.execute(INSERT_USER, {"id": "user-1", "email": "alice@example.com"})
        connection.execute(INSERT_MEASUREMENT, EXISTING_ROWS)

    with empty_database.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")

    with empty_database.engine.begin() as connection:
        assert [tuple(row) for row in connection.execute(SELECT_MEASUREMENTS)] == [
            ("m-1", 82.4, "kg", "manual"),
            ("m-2", 181.0, "lb", "csv"),
        ]
        connection.execute(INSERT_MEASUREMENT, APPLE_ROW)
        assert connection.scalar(text("SELECT count(*) FROM measurements")) == 3
        assert connection.scalar(text("SELECT count(*) FROM sync_connections")) == 0

    # The widened constraint is still a constraint, and the cascade survived the rebuild.
    with pytest.raises(IntegrityError), empty_database.engine.begin() as connection:
        connection.execute(INSERT_MEASUREMENT, {**APPLE_ROW, "id": "m-4", "source": "fitbit"})
    with empty_database.engine.begin() as connection:
        connection.execute(text("DELETE FROM users WHERE id = 'user-1'"))
        assert connection.scalar(text("SELECT count(*) FROM measurements")) == 0


def test_downgrading_from_0002_keeps_synced_measurements_as_manual(empty_database: Database):
    """A downgrade loses the provenance of a synced weigh-in, never the weigh-in."""
    config = alembic_config()
    with empty_database.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
        connection.execute(INSERT_USER, {"id": "user-1", "email": "alice@example.com"})
        connection.execute(INSERT_MEASUREMENT, [*EXISTING_ROWS, APPLE_ROW])

    with empty_database.engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "0001_initial")

    with empty_database.engine.connect() as connection:
        assert "sync_connections" not in inspect(connection).get_table_names()
        assert [tuple(row) for row in connection.execute(SELECT_MEASUREMENTS)] == [
            ("m-1", 82.4, "kg", "manual"),
            ("m-2", 181.0, "lb", "csv"),
            ("m-3", 82.0, "kg", "manual"),
        ]
