"""Creating the engine, and the one handle the rest of the application holds.

Three details are here so that no caller has to remember them:

* **A malformed URL never reaches a log.** SQLAlchemy's own error for an unparseable URL
  quotes the URL, and a database URL usually contains a password. The error is replaced with
  a :class:`app.errors.ConfigurationError` that names the setting and nothing else, raised
  ``from None`` so the original message is not chained into a startup traceback either.
* **SQLAlchemy does not copy bound values into its errors.** By default a failing statement's
  parameters -- a weight, an email address -- are rendered into the exception message. Every
  engine is created with ``hide_parameters=True`` to stop that. It is defence in depth, not the
  control: the database server's own error text can still quote a row (Postgres reports
  "Failing row contains (...)"), so a database exception message is treated like any other
  untrusted message and is never logged or returned -- the API's catch-all logs the exception
  class name only (:mod:`app.api.logging`).
* **SQLite enforces foreign keys only when asked**, per connection. Without the pragma the
  ``ON DELETE CASCADE`` clauses in :mod:`app.persistence.models` would be silently ignored in
  tests, and account deletion would appear to work while leaving rows behind.

An in-memory SQLite database exists per connection, so it is given a single shared
connection (``StaticPool``); otherwise every pooled connection would see an empty database.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import URL, make_url
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.exc import ArgumentError, NoSuchModuleError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import DATABASE_URL_ENV_VAR
from app.errors import ConfigurationError
from app.persistence.models import Base
from app.persistence.repositories import Store


def make_engine(url: str) -> Engine:
    """Create an engine for ``url`` without connecting to it.

    Raises:
        ConfigurationError: if the URL cannot be parsed or names an unavailable driver.
    """
    try:
        parsed = make_url(url)
        if parsed.get_backend_name() == "sqlite":
            return _sqlite_engine(parsed)
        return create_engine(parsed, pool_pre_ping=True, hide_parameters=True)
    except (ArgumentError, NoSuchModuleError):
        raise ConfigurationError(f"{DATABASE_URL_ENV_VAR} is not a usable database URL") from None


def _sqlite_engine(url: URL) -> Engine:
    """Create a SQLite engine with foreign keys enforced on every connection."""
    if url.database in (None, "", ":memory:"):
        engine = create_engine(
            url,
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
            hide_parameters=True,
        )
    else:
        engine = create_engine(url, hide_parameters=True)
    event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    return engine


def _enable_sqlite_foreign_keys(
    dbapi_connection: DBAPIConnection, _connection_record: object
) -> None:
    """Turn on SQLite's foreign-key enforcement for one new DBAPI connection."""
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


class Database:
    """The application's handle on the account database."""

    def __init__(self, url: str) -> None:
        """Create the engine for ``url``. Does not connect.

        Raises:
            ConfigurationError: if the URL is unusable.
        """
        self._engine = make_engine(url)
        self._sessions = sessionmaker(self._engine, expire_on_commit=False)

    @property
    def engine(self) -> Engine:
        """The underlying engine, for migrations and tests."""
        return self._engine

    @contextmanager
    def store(self) -> Iterator[Store]:
        """Open a unit of work. Anything not committed is rolled back when it closes."""
        with self._sessions() as session:
            yield Store(session)

    def create_schema(self) -> None:
        """Create every table directly from the models. Tests and local experiments only.

        Production schemas are created and changed by Alembic, never by this method.
        """
        Base.metadata.create_all(self._engine)

    def drop_schema(self) -> None:
        """Drop every table. Tests only."""
        Base.metadata.drop_all(self._engine)

    def dispose(self) -> None:
        """Close every pooled connection."""
        self._engine.dispose()
