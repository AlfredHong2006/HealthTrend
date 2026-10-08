"""Sync connections, sync-token authentication, and the Apple Health sync itself.

Three jobs::

    create / list / revoke      a signed-in browser manages its own connections
    authenticate_sync_token     hash  →  connection row  →  source  →  owner  →  allow-listed?
                                →  stamp last_used_at
    sync_apple_health           the unchanged batch import, with source "apple_health"

Decisions that live here rather than in a route:

* **The sync is insert-only.** :func:`sync_apple_health` calls
  :func:`app.services.measurements.import_batch` and nothing else. It has no branch that
  updates or deletes a measurement, and it is never handed the request's window, so there is
  no value through which "the client saw nothing in this span" could come to mean "remove
  what is stored in this span". A weigh-in edited or deleted in Apple Health is not edited or
  deleted here.
* **De-duplication is the batch import's own.** A synced observation is skipped exactly when a
  CSV row would be: an existing measurement at the same instant with the same weight in
  kilograms, whatever its source or entered unit. There is one definition of "the same
  measurement" in this project and this module does not add a second.
* **A sync token is not a session.** It resolves to a user only through
  :func:`authenticate_sync_token`, which no browser-authenticated route calls, and
  :func:`app.services.auth.resolve_session` never looks at the ``sync_connections`` table. A
  token is also bound to one source: an Apple Health token authenticates the Apple Health
  route and nothing else.
* **Every way a token can fail is the same error.** Unknown, revoked, malformed, wrong source,
  or an account that has left the beta allow-list all raise
  :class:`app.errors.InvalidSyncTokenError` with one fixed response.
* **The allow-list is re-checked on every sync**, as it is on every resolved session, so
  removing an address from ``HEALTHTREND_BETA_ALLOWED_EMAILS`` ends its syncing too.
* **Revoking deletes the row.** There is no revoked state to forget to check.
* **Nothing here logs**, and no exception message carries a token.

The clock is not read here; ``now`` arrives from the injected clock, as for every service.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.auth.sync_tokens import hash_sync_token, is_well_formed_sync_token, new_sync_token
from app.config import Settings
from app.errors import (
    InvalidSyncTokenError,
    SyncConnectionLimitExceededError,
    SyncConnectionNotFoundError,
)
from app.persistence.models import SyncSource
from app.persistence.repositories import Store, SyncConnectionRecord, UserRecord
from app.schemas.analysis import ObservationIn
from app.schemas.sync import MAX_SYNC_CONNECTIONS, SyncConnectionOut
from app.services.auth import is_allowed_to_sign_in
from app.services.measurements import import_batch


@dataclass(frozen=True, slots=True)
class CreatedSyncConnection:
    """A newly created connection and its token. The token is excluded from ``repr``."""

    connection: SyncConnectionOut
    token: str = field(repr=False)


def sync_connection_out(record: SyncConnectionRecord) -> SyncConnectionOut:
    """Adapt a stored connection for the wire, leaving its token hash behind."""
    return SyncConnectionOut(
        id=record.id,
        source=record.source,
        label=record.label,
        created_at=record.created_at,
        last_used_at=record.last_used_at,
    )


def list_sync_connections(user_id: str, *, store: Store) -> list[SyncConnectionOut]:
    """Return every sync connection the account holds, most recently created first."""
    return [sync_connection_out(record) for record in store.sync_connections.list_for_user(user_id)]


def create_sync_connection(
    user_id: str, *, source: SyncSource, label: str, now: datetime, store: Store
) -> CreatedSyncConnection:
    """Create a sync connection for the account and return it with its one-time token.

    Raises:
        SyncConnectionLimitExceededError: the account already holds
            :data:`app.schemas.sync.MAX_SYNC_CONNECTIONS` connections.
    """
    if store.sync_connections.count_for_user(user_id) >= MAX_SYNC_CONNECTIONS:
        raise SyncConnectionLimitExceededError("sync connection cap reached")
    token = new_sync_token()
    record = store.sync_connections.add(
        user_id, source=source, label=label, token_hash=hash_sync_token(token), now=now
    )
    store.commit()
    return CreatedSyncConnection(connection=sync_connection_out(record), token=token)


def revoke_sync_connection(user_id: str, connection_id: str, *, store: Store) -> None:
    """Revoke a sync connection by deleting it. Its token stops working at once.

    Raises:
        SyncConnectionNotFoundError: no such connection is owned by ``user_id``.
    """
    if not store.sync_connections.delete_owned(user_id, connection_id):
        raise SyncConnectionNotFoundError("sync connection not found")
    store.commit()


def authenticate_sync_token(
    token: str, *, source: SyncSource, now: datetime, store: Store, settings: Settings
) -> UserRecord:
    """Return the user a sync token for ``source`` belongs to, stamping the connection's use.

    Raises:
        InvalidSyncTokenError: the token is malformed, unknown or revoked, belongs to a
            connection for a different source, or its account may no longer sign in.
    """
    if not is_well_formed_sync_token(token):
        raise InvalidSyncTokenError("no valid sync token")
    connection = store.sync_connections.get_by_token_hash(hash_sync_token(token))
    if connection is None or connection.source != source:
        raise InvalidSyncTokenError("no valid sync token")
    user = store.users.get(connection.user_id)
    if user is None or not is_allowed_to_sign_in(user.email, settings):
        raise InvalidSyncTokenError("no valid sync token")
    # Committed here, before the request body is acted on, so the stamp records that the token
    # authenticated -- which is what "last used" means to someone deciding whether a
    # connection is still alive -- whether or not the sync that follows stores anything.
    store.sync_connections.touch(connection.id, now=now)
    store.commit()
    return user


def sync_apple_health(
    user_id: str, observations: list[ObservationIn], *, now: datetime, store: Store
) -> tuple[int, int]:
    """Add Apple Health observations the account does not already hold. Insert-only.

    Returns:
        ``(inserted_count, skipped_existing_count)``.

    Raises:
        MeasurementLimitExceededError: storing every new observation would exceed the
            per-account cap. Nothing in the request is stored when this is raised.
    """
    return import_batch(user_id, observations, source="apple_health", now=now, store=store)
