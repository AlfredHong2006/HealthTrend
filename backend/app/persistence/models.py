"""The account database schema.

Six tables, each row owned by exactly one user except ``login_codes``, which exist before a
user does::

    users          id · email (unique, normalised) · created_at · last_login_at
    login_codes    id · email · code_hash · created_at · expires_at · consumed_at · attempts
    sessions       token_hash · user_id → users · created_at · expires_at · last_seen_at
    measurements   id · user_id → users · timestamp · weight · unit · source · created_at ·
                   updated_at
    preferences    user_id → users · display_unit · updated_at
    goals          user_id → users · target_weight_kg · target_weekly_rate_kg · updated_at

Decisions worth knowing before editing:

* **Identifiers are 36-character text UUIDs**, not a native UUID type, so SQLite and Postgres
  store and compare them identically.
* **Every foreign key cascades on delete.** Deleting a user removes everything they own in one
  statement; nothing depends on the application remembering to clean up.
* **A measurement is stored as entered** -- its weight in the unit it was given in -- mirroring
  :class:`app.schemas.analysis.ObservationIn`. Conversion to kilograms stays where it already
  lives, in :func:`app.ingestion.normalise_observations`.
* **``code_hash`` is an HMAC, ``token_hash`` is a plain SHA-256.** A sign-in code has only a
  million possible values, so a bare hash of one could be reversed by trying them all; the
  HMAC is keyed with a server secret held outside the database. A session token carries 256
  bits of randomness, which no search can cover, so a plain hash is sufficient
  (:mod:`app.auth`).
* **All datetimes are UTC**, enforced by :class:`UtcDateTime` in both directions.

Constraint names follow :data:`NAMING_CONVENTION` so that the Alembic migration can refer to
them by a stable name on every database.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Final, Literal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
)
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

ID_LENGTH: Final = 36
"""Length of a text UUID."""

EMAIL_MAX_LENGTH: Final = 254
"""Longest email address stored; the practical limit of an SMTP forward path."""

DIGEST_HEX_LENGTH: Final = 64
"""Length of a hex-encoded SHA-256 or HMAC-SHA256 digest."""

Unit = Literal["kg", "lb"]
"""The units a measurement or a display preference may use."""

MeasurementSource = Literal["manual", "csv"]
"""How a stored measurement arrived."""

NAMING_CONVENTION: Final = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class UtcDateTime(TypeDecorator[datetime]):
    """A datetime column that only ever holds, and only ever returns, aware UTC instants.

    Postgres stores ``timestamptz`` natively. SQLite has no timezone type: it would silently
    drop an offset and hand back a naive value. So on the way in every value must be aware and
    is converted to UTC (and, on SQLite only, stored without the offset); on the way out a
    naive value is UTC by construction and gets its timezone re-attached. This is the single
    adapter for that difference -- repositories never handle it themselves.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Convert an aware datetime to the UTC form this dialect stores.

        Raises:
            ValueError: if ``value`` is naive. The message carries no value.
        """
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("naive datetimes cannot be stored; supply a timezone-aware value")
        utc = value.astimezone(UTC)
        return utc.replace(tzinfo=None) if dialect.name == "sqlite" else utc

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        """Return the stored instant as an aware UTC datetime."""
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class Base(DeclarativeBase):
    """Declarative base carrying the shared metadata and naming convention."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UserRow(Base):
    """One account, identified by a normalised email address."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH), unique=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime())
    last_login_at: Mapped[datetime] = mapped_column(UtcDateTime())


class LoginCodeRow(Base):
    """One issued sign-in code, stored only as an HMAC."""

    __tablename__ = "login_codes"
    __table_args__ = (Index(None, "email", "created_at"),)

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    email: Mapped[str] = mapped_column(String(EMAIL_MAX_LENGTH))
    code_hash: Mapped[str] = mapped_column(String(DIGEST_HEX_LENGTH))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime())
    expires_at: Mapped[datetime] = mapped_column(UtcDateTime())
    consumed_at: Mapped[datetime | None] = mapped_column(UtcDateTime(), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)


class SessionRow(Base):
    """One signed-in session, keyed by the SHA-256 of its token."""

    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(DIGEST_HEX_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(UtcDateTime())
    expires_at: Mapped[datetime] = mapped_column(UtcDateTime())
    last_seen_at: Mapped[datetime] = mapped_column(UtcDateTime())


class MeasurementRow(Base):
    """One stored weigh-in, exactly as entered."""

    __tablename__ = "measurements"
    __table_args__ = (
        CheckConstraint("unit IN ('kg', 'lb')", name="unit"),
        CheckConstraint("source IN ('manual', 'csv')", name="source"),
        Index(None, "user_id", "timestamp"),
    )

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE")
    )
    timestamp: Mapped[datetime] = mapped_column(UtcDateTime())
    weight: Mapped[float] = mapped_column(Float)
    unit: Mapped[Unit] = mapped_column(String(2))
    source: Mapped[MeasurementSource] = mapped_column(String(6))
    created_at: Mapped[datetime] = mapped_column(UtcDateTime())
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime())


class PreferenceRow(Base):
    """A user's display preferences. At most one row per user."""

    __tablename__ = "preferences"
    __table_args__ = (CheckConstraint("display_unit IN ('kg', 'lb')", name="display_unit"),)

    user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_unit: Mapped[Unit] = mapped_column(String(2))
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime())


class GoalRow(Base):
    """A user's goal, in kilograms. At most one row per user, no history."""

    __tablename__ = "goals"

    user_id: Mapped[str] = mapped_column(
        String(ID_LENGTH), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    target_weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    target_weekly_rate_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime())
