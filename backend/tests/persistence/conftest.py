"""Fixtures for the persistence tests.

These run against an in-memory SQLite database by default. Set
``HEALTHTREND_TEST_DATABASE_URL`` (the CI Postgres job does) to run the same tests against a
real server; each test then starts from an empty schema, so point it at a disposable database
and never at one holding anything worth keeping.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from sqlalchemy import text

from app.persistence import Database, Store

TEST_DATABASE_URL_ENV_VAR = "HEALTHTREND_TEST_DATABASE_URL"
SQLITE_MEMORY_URL = "sqlite+pysqlite:///:memory:"

NOW = datetime(2026, 6, 12, 9, 0, tzinfo=UTC)


def persistence_database_url() -> str:
    """Return the database the persistence tests run against."""
    return os.environ.get(TEST_DATABASE_URL_ENV_VAR, "").strip() or SQLITE_MEMORY_URL


def reset(database: Database) -> None:
    """Drop every table the models and Alembic know about."""
    database.drop_schema()
    with database.engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))


@pytest.fixture
def database() -> Iterator[Database]:
    """An empty database with the schema created from the models."""
    handle = Database(persistence_database_url())
    reset(handle)
    handle.create_schema()
    try:
        yield handle
    finally:
        reset(handle)
        handle.dispose()


@pytest.fixture
def store(database: Database) -> Iterator[Store]:
    """One open unit of work on :func:`database`."""
    with database.store() as unit_of_work:
        yield unit_of_work
