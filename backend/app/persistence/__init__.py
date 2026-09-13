"""Account storage: the database schema, the engine and the repositories.

This is the only package in the application that imports SQLAlchemy
(``tests/test_layering.py``). Everything above it -- the services and the API -- talks to a
:class:`app.persistence.repositories.Store`, whose repositories accept and return plain frozen
records. No ORM object, session or query escapes this package, so nothing above it can
accidentally lazy-load, mutate a row outside a transaction, or couple itself to the driver.

The numerical core never sees this package and cannot: the core's import allowlist forbids
SQLAlchemy (``tests/core/test_architecture_purity.py``), and the analysis of stored rows goes
through the same service entry point as a submitted series.

Every repository method that touches user-owned data takes the owning ``user_id`` as an
argument and filters on it. There is no query here that reads another user's rows.

The schema itself is created in production by Alembic (``backend/alembic/``), never by the
application at startup. :meth:`app.persistence.engine.Database.create_schema` exists for
tests and local experiments only; ``tests/persistence/test_migrations.py`` asserts the
migration and these models describe the same schema.
"""

from app.persistence.engine import Database, make_engine
from app.persistence.repositories import Store

__all__ = ["Database", "Store", "make_engine"]
