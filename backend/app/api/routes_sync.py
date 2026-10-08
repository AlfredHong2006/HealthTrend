"""Sync connections and the Apple Health sync.

Two security domains share this module and never overlap:

* **Managing connections** -- list, create, revoke -- requires
  :data:`app.api.deps.CurrentUserDep`, the browser session. A sync token cannot list, create
  or revoke anything, including itself.
* **Syncing** -- ``PUT /api/me/sync/apple_health`` -- requires
  :data:`app.api.deps.AppleHealthSyncUserDep`, a bearer sync token. The session cookie is not
  read on this route at all.

Creating a connection is the only response that carries a token; nothing here ever returns a
token hash. Every response carries ``Cache-Control: no-store``.

The sync is **insert-only**. The route validates ``window_start`` and ``window_end`` and then
passes the service the observations alone, so nothing downstream of this function can act on
the window (:mod:`app.services.sync`).

Nothing here logs. The access log line for these routes is the same
method-template-status-duration line every route gets, plus the observation count for a sync;
it never includes a header, so a token cannot reach it.
"""

from __future__ import annotations

from typing import Any, Final

from fastapi import APIRouter, Request, Response

from app.api.deps import AppleHealthSyncUserDep, ClockDep, CurrentUserDep, StoreDep
from app.api.logging import record_observation_count
from app.schemas.errors import ErrorResponse
from app.schemas.sync import (
    AppleHealthSyncIn,
    AppleHealthSyncOut,
    SyncConnectionCreatedOut,
    SyncConnectionIn,
    SyncConnectionListOut,
)
from app.services.sync import (
    create_sync_connection,
    list_sync_connections,
    revoke_sync_connection,
    sync_apple_health,
)

router = APIRouter(tags=["sync"])

_NO_STORE: Final = "no-store"

_CREATE_CONNECTION_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "The account's sync connection cap was reached."},
}
_CONNECTION_NOT_FOUND_RESPONSES: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse, "description": "No sync connection exists under that id."},
}
_SYNC_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "The sync token is missing, invalid or revoked."},
    422: {
        "model": ErrorResponse,
        "description": "The request was rejected, or the account's measurement cap was reached.",
    },
}


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = _NO_STORE


# --- connection management: browser session ---------------------------------------------


@router.get(
    "/api/me/sync/connections",
    response_model=SyncConnectionListOut,
    summary="List the account's sync connections",
)
def list_my_sync_connections(
    user: CurrentUserDep, response: Response, store: StoreDep
) -> SyncConnectionListOut:
    """Return every sync connection the account holds. Never a token or a token hash."""
    _no_store(response)
    connections = list_sync_connections(user.id, store=store)
    return SyncConnectionListOut(connections=connections, count=len(connections))


@router.post(
    "/api/me/sync/connections",
    response_model=SyncConnectionCreatedOut,
    status_code=201,
    summary="Create an Apple Health sync connection and return its token once",
    responses=_CREATE_CONNECTION_RESPONSES,
)
def create_my_sync_connection(
    payload: SyncConnectionIn,
    user: CurrentUserDep,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
) -> SyncConnectionCreatedOut:
    """Create an Apple Health sync connection.

    The response carries the connection's bearer token. It is not stored in a recoverable
    form and no later request can return it.
    """
    _no_store(response)
    created = create_sync_connection(
        user.id, source="apple_health", label=payload.label, now=clock.now(), store=store
    )
    return SyncConnectionCreatedOut(connection=created.connection, token=created.token)


@router.delete(
    "/api/me/sync/connections/{connection_id}",
    status_code=204,
    response_class=Response,
    summary="Revoke a sync connection",
    responses=_CONNECTION_NOT_FOUND_RESPONSES,
)
def revoke_my_sync_connection(
    connection_id: str, user: CurrentUserDep, store: StoreDep
) -> Response:
    """Revoke a sync connection. Its token stops authenticating immediately.

    ``connection_id`` belonging to another account is rejected identically to one that does
    not exist: both raise ``sync_connection_not_found``. No measurement is touched.
    """
    revoke_sync_connection(user.id, connection_id, store=store)
    return Response(status_code=204, headers={"Cache-Control": _NO_STORE})


# --- the sync itself: bearer sync token ---------------------------------------------------


@router.put(
    "/api/me/sync/apple_health",
    response_model=AppleHealthSyncOut,
    summary="Add recent Apple Health weight observations to the account (insert-only)",
    responses=_SYNC_RESPONSES,
)
def sync_my_apple_health(
    user: AppleHealthSyncUserDep,
    payload: AppleHealthSyncIn,
    request: Request,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
) -> AppleHealthSyncOut:
    """Store the observations the account does not already hold, as ``apple_health``.

    Authenticated by ``Authorization: Bearer <sync token>``. An observation matching a stored
    measurement (same instant, same weight in kilograms) is skipped, so re-running a sync
    inserts nothing new. Nothing is ever updated or deleted: ``window_start`` and
    ``window_end`` are validated and otherwise unused.
    """
    _no_store(response)
    record_observation_count(request, len(payload.observations))
    inserted, skipped = sync_apple_health(
        user.id, payload.observations, now=clock.now(), store=store
    )
    return AppleHealthSyncOut(inserted_count=inserted, skipped_existing_count=skipped)
