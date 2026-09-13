"""Repositories: the only way the application reads or writes the account database.

Each repository wraps one table, takes the SQLAlchemy session it works in, and returns frozen
records rather than ORM objects. None of them commits; a service decides where a unit of work
ends and calls :meth:`Store.commit`, so a service can make several changes atomically or --
where it must, as when a failed sign-in attempt has to be counted before the error is raised
-- commit early on purpose.

Ownership is structural. Every method that reads or changes user-owned rows takes the
``user_id`` and filters on it, so asking for a measurement id that belongs to someone else is
indistinguishable from asking for one that does not exist.

Nothing here validates domain rules (weight bounds, allow-lists, rate limits). Those belong
to the services and the request schemas; this layer stores what it is given, and refuses only
what the schema itself cannot hold, such as a naive datetime.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.persistence.models import (
    GoalRow,
    LoginCodeRow,
    MeasurementRow,
    MeasurementSource,
    PreferenceRow,
    SessionRow,
    Unit,
    UserRow,
)


def _new_id() -> str:
    """Return a fresh text UUID."""
    return str(uuid.uuid4())


# --- records ------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class UserRecord:
    """An account."""

    id: str
    email: str
    created_at: datetime
    last_login_at: datetime


@dataclass(frozen=True, slots=True)
class LoginCodeRecord:
    """An issued sign-in code. ``code_hash`` is an HMAC, never the code."""

    id: str
    email: str
    code_hash: str
    created_at: datetime
    expires_at: datetime
    consumed_at: datetime | None
    attempts: int


@dataclass(frozen=True, slots=True)
class SessionRecord:
    """A signed-in session. ``token_hash`` is the SHA-256 of the token, never the token."""

    token_hash: str
    user_id: str
    created_at: datetime
    expires_at: datetime
    last_seen_at: datetime


@dataclass(frozen=True, slots=True)
class MeasurementRecord:
    """A stored weigh-in, in the unit it was entered in."""

    id: str
    user_id: str
    timestamp: datetime
    weight: float
    unit: Unit
    source: MeasurementSource
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class PreferencesRecord:
    """A user's display preferences."""

    user_id: str
    display_unit: Unit
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class GoalRecord:
    """A user's goal, in kilograms."""

    user_id: str
    target_weight_kg: float | None
    target_weekly_rate_kg: float | None
    updated_at: datetime


def _user(row: UserRow) -> UserRecord:
    return UserRecord(
        id=row.id, email=row.email, created_at=row.created_at, last_login_at=row.last_login_at
    )


def _login_code(row: LoginCodeRow) -> LoginCodeRecord:
    return LoginCodeRecord(
        id=row.id,
        email=row.email,
        code_hash=row.code_hash,
        created_at=row.created_at,
        expires_at=row.expires_at,
        consumed_at=row.consumed_at,
        attempts=row.attempts,
    )


def _session(row: SessionRow) -> SessionRecord:
    return SessionRecord(
        token_hash=row.token_hash,
        user_id=row.user_id,
        created_at=row.created_at,
        expires_at=row.expires_at,
        last_seen_at=row.last_seen_at,
    )


def _measurement(row: MeasurementRow) -> MeasurementRecord:
    return MeasurementRecord(
        id=row.id,
        user_id=row.user_id,
        timestamp=row.timestamp,
        weight=row.weight,
        unit=row.unit,
        source=row.source,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _preferences(row: PreferenceRow) -> PreferencesRecord:
    return PreferencesRecord(
        user_id=row.user_id, display_unit=row.display_unit, updated_at=row.updated_at
    )


def _goal(row: GoalRow) -> GoalRecord:
    return GoalRecord(
        user_id=row.user_id,
        target_weight_kg=row.target_weight_kg,
        target_weekly_rate_kg=row.target_weekly_rate_kg,
        updated_at=row.updated_at,
    )


# --- repositories -------------------------------------------------------------


class UserRepo:
    """Accounts."""

    def __init__(self, session: Session) -> None:
        """Bind to ``session``."""
        self._session = session

    def get(self, user_id: str) -> UserRecord | None:
        """Return the user with ``user_id``, if any."""
        row = self._session.get(UserRow, user_id)
        return None if row is None else _user(row)

    def get_by_email(self, email: str) -> UserRecord | None:
        """Return the user with this already-normalised email, if any."""
        row = self._session.scalar(select(UserRow).where(UserRow.email == email))
        return None if row is None else _user(row)

    def create(self, email: str, *, now: datetime) -> UserRecord:
        """Create a user for an already-normalised email."""
        row = UserRow(id=_new_id(), email=email, created_at=now, last_login_at=now)
        self._session.add(row)
        self._session.flush()
        return _user(row)

    def record_login(self, user_id: str, *, now: datetime) -> None:
        """Stamp the user's most recent sign-in."""
        self._session.execute(
            update(UserRow).where(UserRow.id == user_id).values(last_login_at=now)
        )

    def delete(self, user_id: str) -> bool:
        """Delete the user and, by cascade, everything they own. Return whether one existed."""
        result = self._session.execute(delete(UserRow).where(UserRow.id == user_id))
        return bool(result.rowcount)  # type: ignore[attr-defined]


class LoginCodeRepo:
    """Issued sign-in codes."""

    def __init__(self, session: Session) -> None:
        """Bind to ``session``."""
        self._session = session

    def add(
        self, email: str, code_hash: str, *, now: datetime, expires_at: datetime
    ) -> LoginCodeRecord:
        """Record a newly issued code by its HMAC."""
        row = LoginCodeRow(
            id=_new_id(),
            email=email,
            code_hash=code_hash,
            created_at=now,
            expires_at=expires_at,
            consumed_at=None,
            attempts=0,
        )
        self._session.add(row)
        self._session.flush()
        return _login_code(row)

    def count_created_since(self, email: str, since: datetime) -> int:
        """Count codes issued for ``email`` at or after ``since``."""
        count = self._session.scalar(
            select(func.count())
            .select_from(LoginCodeRow)
            .where(LoginCodeRow.email == email, LoginCodeRow.created_at >= since)
        )
        return int(count or 0)

    def newest_unconsumed(self, email: str) -> LoginCodeRecord | None:
        """Return the most recently issued code for ``email`` that has not been used."""
        row = self._session.scalars(
            select(LoginCodeRow)
            .where(LoginCodeRow.email == email, LoginCodeRow.consumed_at.is_(None))
            .order_by(LoginCodeRow.created_at.desc(), LoginCodeRow.id.desc())
            .limit(1)
        ).first()
        return None if row is None else _login_code(row)

    def record_attempt(self, code_id: str) -> int:
        """Count one verification attempt against a code, and return the new total.

        Incremented in SQL rather than read-modify-write, so concurrent attempts cannot
        overwrite each other's count.
        """
        self._session.execute(
            update(LoginCodeRow)
            .where(LoginCodeRow.id == code_id)
            .values(attempts=LoginCodeRow.attempts + 1)
        )
        attempts = self._session.scalar(
            select(LoginCodeRow.attempts).where(LoginCodeRow.id == code_id)
        )
        return int(attempts or 0)

    def consume(self, code_id: str, *, now: datetime) -> bool:
        """Mark a code used. Return ``False`` if it had already been used.

        The ``consumed_at IS NULL`` condition makes this the single-use guarantee: of two
        concurrent verifications of the same code, only one updates a row.
        """
        result = self._session.execute(
            update(LoginCodeRow)
            .where(LoginCodeRow.id == code_id, LoginCodeRow.consumed_at.is_(None))
            .values(consumed_at=now)
        )
        return bool(result.rowcount)  # type: ignore[attr-defined]

    def delete_created_before(self, email: str, before: datetime) -> None:
        """Delete codes for ``email`` issued before ``before``."""
        self._session.execute(
            delete(LoginCodeRow).where(
                LoginCodeRow.email == email, LoginCodeRow.created_at < before
            )
        )

    def delete_by_id(self, code_id: str) -> None:
        """Delete one issued code by its own id.

        Used when a code could not be delivered: the row must not remain usable, and must
        not go on counting towards the request rate limit, so it is removed outright rather
        than merely marked consumed.
        """
        self._session.execute(delete(LoginCodeRow).where(LoginCodeRow.id == code_id))

    def delete_for_email(self, email: str) -> None:
        """Delete every code ever issued for ``email``.

        ``login_codes`` has no foreign key to ``users`` -- a code can exist before an
        account does -- so deleting a user does not cascade here. Account deletion calls
        this explicitly instead.
        """
        self._session.execute(delete(LoginCodeRow).where(LoginCodeRow.email == email))


class SessionRepo:
    """Signed-in sessions."""

    def __init__(self, session: Session) -> None:
        """Bind to ``session``."""
        self._session = session

    def add(
        self, token_hash: str, user_id: str, *, now: datetime, expires_at: datetime
    ) -> SessionRecord:
        """Record a new session by the hash of its token."""
        row = SessionRow(
            token_hash=token_hash,
            user_id=user_id,
            created_at=now,
            expires_at=expires_at,
            last_seen_at=now,
        )
        self._session.add(row)
        self._session.flush()
        return _session(row)

    def get(self, token_hash: str) -> SessionRecord | None:
        """Return the session with this token hash, if any."""
        row = self._session.get(SessionRow, token_hash)
        return None if row is None else _session(row)

    def touch(self, token_hash: str, *, now: datetime, expires_at: datetime) -> None:
        """Record activity on a session and move its expiry."""
        self._session.execute(
            update(SessionRow)
            .where(SessionRow.token_hash == token_hash)
            .values(last_seen_at=now, expires_at=expires_at)
        )

    def delete(self, token_hash: str) -> None:
        """Delete the session with this token hash, if it exists."""
        self._session.execute(delete(SessionRow).where(SessionRow.token_hash == token_hash))


class MeasurementRepo:
    """Stored weigh-ins, always scoped to their owner."""

    def __init__(self, session: Session) -> None:
        """Bind to ``session``."""
        self._session = session

    def add(
        self,
        user_id: str,
        *,
        timestamp: datetime,
        weight: float,
        unit: Unit,
        source: MeasurementSource,
        now: datetime,
    ) -> MeasurementRecord:
        """Store one weigh-in for ``user_id``."""
        row = MeasurementRow(
            id=_new_id(),
            user_id=user_id,
            timestamp=timestamp,
            weight=weight,
            unit=unit,
            source=source,
            created_at=now,
            updated_at=now,
        )
        self._session.add(row)
        self._session.flush()
        return _measurement(row)

    def list_for_user(self, user_id: str) -> list[MeasurementRecord]:
        """Return every weigh-in owned by ``user_id``, most recent first."""
        rows = self._session.scalars(
            select(MeasurementRow)
            .where(MeasurementRow.user_id == user_id)
            .order_by(
                MeasurementRow.timestamp.desc(),
                MeasurementRow.created_at.desc(),
                MeasurementRow.id.desc(),
            )
        )
        return [_measurement(row) for row in rows]

    def get_owned(self, user_id: str, measurement_id: str) -> MeasurementRecord | None:
        """Return the weigh-in if it exists and belongs to ``user_id``."""
        row = self._owned_row(user_id, measurement_id)
        return None if row is None else _measurement(row)

    def update_owned(
        self,
        user_id: str,
        measurement_id: str,
        *,
        timestamp: datetime,
        weight: float,
        unit: Unit,
        now: datetime,
    ) -> MeasurementRecord | None:
        """Replace a weigh-in's values if it belongs to ``user_id``; ``None`` otherwise."""
        row = self._owned_row(user_id, measurement_id)
        if row is None:
            return None
        row.timestamp = timestamp
        row.weight = weight
        row.unit = unit
        row.updated_at = now
        self._session.flush()
        return _measurement(row)

    def delete_owned(self, user_id: str, measurement_id: str) -> bool:
        """Delete a weigh-in if it belongs to ``user_id``. Return whether one was deleted."""
        result = self._session.execute(
            delete(MeasurementRow).where(
                MeasurementRow.id == measurement_id, MeasurementRow.user_id == user_id
            )
        )
        return bool(result.rowcount)  # type: ignore[attr-defined]

    def count_for_user(self, user_id: str) -> int:
        """Count the weigh-ins owned by ``user_id``."""
        count = self._session.scalar(
            select(func.count())
            .select_from(MeasurementRow)
            .where(MeasurementRow.user_id == user_id)
        )
        return int(count or 0)

    def _owned_row(self, user_id: str, measurement_id: str) -> MeasurementRow | None:
        return self._session.scalar(
            select(MeasurementRow).where(
                MeasurementRow.id == measurement_id, MeasurementRow.user_id == user_id
            )
        )


class PreferenceRepo:
    """Display preferences, one row per user at most."""

    def __init__(self, session: Session) -> None:
        """Bind to ``session``."""
        self._session = session

    def get(self, user_id: str) -> PreferencesRecord | None:
        """Return the user's stored preferences, if they have saved any."""
        row = self._session.get(PreferenceRow, user_id)
        return None if row is None else _preferences(row)

    def upsert(self, user_id: str, *, display_unit: Unit, now: datetime) -> PreferencesRecord:
        """Create or replace the user's preferences."""
        row = self._session.get(PreferenceRow, user_id)
        if row is None:
            row = PreferenceRow(user_id=user_id, display_unit=display_unit, updated_at=now)
            self._session.add(row)
        else:
            row.display_unit = display_unit
            row.updated_at = now
        self._session.flush()
        return _preferences(row)


class GoalRepo:
    """Goals, one row per user at most."""

    def __init__(self, session: Session) -> None:
        """Bind to ``session``."""
        self._session = session

    def get(self, user_id: str) -> GoalRecord | None:
        """Return the user's goal, if they have set one."""
        row = self._session.get(GoalRow, user_id)
        return None if row is None else _goal(row)

    def upsert(
        self,
        user_id: str,
        *,
        target_weight_kg: float | None,
        target_weekly_rate_kg: float | None,
        now: datetime,
    ) -> GoalRecord:
        """Create or replace the user's goal."""
        row = self._session.get(GoalRow, user_id)
        if row is None:
            row = GoalRow(
                user_id=user_id,
                target_weight_kg=target_weight_kg,
                target_weekly_rate_kg=target_weekly_rate_kg,
                updated_at=now,
            )
            self._session.add(row)
        else:
            row.target_weight_kg = target_weight_kg
            row.target_weekly_rate_kg = target_weekly_rate_kg
            row.updated_at = now
        self._session.flush()
        return _goal(row)

    def delete(self, user_id: str) -> bool:
        """Remove the user's goal. Return whether one existed."""
        result = self._session.execute(delete(GoalRow).where(GoalRow.user_id == user_id))
        return bool(result.rowcount)  # type: ignore[attr-defined]


class Store:
    """One unit of work over every repository, sharing a single transaction."""

    def __init__(self, session: Session) -> None:
        """Bind every repository to ``session``."""
        self._session = session
        self.users = UserRepo(session)
        self.login_codes = LoginCodeRepo(session)
        self.sessions = SessionRepo(session)
        self.measurements = MeasurementRepo(session)
        self.preferences = PreferenceRepo(session)
        self.goals = GoalRepo(session)

    def commit(self) -> None:
        """Commit everything done through this store so far."""
        self._session.commit()

    def rollback(self) -> None:
        """Discard everything done through this store since the last commit."""
        self._session.rollback()
