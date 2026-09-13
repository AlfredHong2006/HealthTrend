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
from sqlalchemy import inspect

from app.persistence import Database
from app.persistence.models import Base
from tests.persistence.conftest import persistence_database_url, reset

BACKEND_DIR = Path(__file__).parents[2]

EXPECTED_TABLES = {"users", "login_codes", "sessions", "measurements", "preferences", "goals"}


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
    assert heads == ["0001_initial"]


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
