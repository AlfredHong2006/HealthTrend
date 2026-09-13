"""The Alembic migration environment.

Reads the database URL from ``HEALTHTREND_DATABASE_URL`` -- never from ``alembic.ini``, because
it is a credential -- and deliberately does not load :class:`app.config.Settings`: running a
migration needs the database and nothing else, not the sign-in secret or the mailer.

A caller that already holds a connection (the migration tests) passes it in
``config.attributes["connection"]`` and this environment runs on that connection instead.

``target_metadata`` is the application's model metadata, which is what lets
``alembic check`` and ``tests/persistence/test_migrations.py`` detect a model change that has
no migration.
"""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy.engine import Connection

from app.config import DATABASE_URL_ENV_VAR
from app.errors import ConfigurationError
from app.persistence.engine import make_engine
from app.persistence.models import Base

config = context.config
target_metadata = Base.metadata


def _database_url() -> str:
    """Return the configured database URL, or fail naming the variable."""
    url = os.environ.get(DATABASE_URL_ENV_VAR, "").strip()
    if not url:
        raise ConfigurationError(f"{DATABASE_URL_ENV_VAR} must be set to run migrations")
    return url


def _run_on(connection: Connection) -> None:
    """Run the pending migrations on ``connection``."""
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_offline() -> None:
    """Emit the migration SQL without connecting."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Connect and run the pending migrations."""
    supplied = config.attributes.get("connection")
    if isinstance(supplied, Connection):
        _run_on(supplied)
        return
    engine = make_engine(_database_url())
    try:
        with engine.begin() as connection:
            _run_on(connection)
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
