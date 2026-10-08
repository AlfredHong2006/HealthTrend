"""The sync contract: sync connections, and the Apple Health sync request and response.

Two audiences, two shapes:

* **A signed-in browser** manages connections. Creating one returns the plaintext token in
  :class:`SyncConnectionCreatedOut` -- the only response in this API that ever carries it.
  :class:`SyncConnectionOut`, which every other response uses, has no field a token or its
  hash could travel in.
* **A sync client** sends :class:`AppleHealthSyncIn`. Each observation is an unchanged
  :class:`app.schemas.analysis.ObservationIn`, so a synced weigh-in is validated by precisely
  the rules a typed or imported one is.

``window_start`` and ``window_end`` name the span of Apple Health history the client read to
build ``observations``. Version 1 of the sync is **insert-only** and does nothing with them
beyond validating that they are a well-ordered pair of instants. They are required now so
that a later reconciliation mode -- one that could tell "no weigh-in in this span" from "this
span was not looked at" -- can be added without changing what a client sends.
"""

from __future__ import annotations

from datetime import datetime
from typing import Final, Literal, Self

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from app.schemas.analysis import MAX_OBSERVATIONS, ObservationIn

SyncSource = Literal["apple_health"]
"""The external sources a sync connection may write measurements from."""

MAX_SYNC_CONNECTIONS: Final = 10
"""Most sync connections one account may hold at once.

A person has a handful of devices; this bounds the rows a signed-in session can create
without getting in anyone's way.
"""

SYNC_LABEL_MAX_LENGTH: Final = 64
"""Longest label a sync connection may carry."""

DEFAULT_SYNC_LABEL: Final = "Apple Health"
"""The label of a connection created without one."""


class SyncConnectionIn(BaseModel):
    """Create an Apple Health sync connection."""

    model_config = ConfigDict(extra="forbid")

    label: str = Field(
        default=DEFAULT_SYNC_LABEL,
        min_length=1,
        max_length=SYNC_LABEL_MAX_LENGTH,
        description="A name for this connection, such as the device it will run on.",
    )


class SyncConnectionOut(BaseModel):
    """One sync connection, as its owner sees it. Carries neither the token nor its hash."""

    id: str = Field(description="Stable identifier for this connection.")
    source: SyncSource = Field(description="The source this connection may sync from.")
    label: str = Field(description="The name given to this connection.")
    created_at: datetime = Field(description="When this connection was created (UTC).")
    last_used_at: datetime | None = Field(
        description="When this connection's token last authenticated a request, or null if never."
    )


class SyncConnectionListOut(BaseModel):
    """Every sync connection the account holds, most recently created first."""

    connections: list[SyncConnectionOut]
    count: int = Field(ge=0, description="How many connections are in this list.")


class SyncConnectionCreatedOut(BaseModel):
    """A newly created connection, together with its token.

    This is the only time the token is ever returned. The server keeps a hash of it and
    cannot show it again; a lost token is replaced by revoking the connection and creating
    another.
    """

    connection: SyncConnectionOut
    token: str = Field(
        description=(
            "The bearer token for this connection, to be sent as "
            "'Authorization: Bearer <token>'. Shown once and never again."
        )
    )


class AppleHealthSyncIn(BaseModel):
    """Recent Apple Health weight observations to add to the account's history."""

    model_config = ConfigDict(extra="forbid")

    window_start: AwareDatetime = Field(
        description=(
            "Start of the span of Apple Health history the client read. Must carry a "
            "timezone offset. Recorded nowhere and never used to remove anything."
        )
    )
    window_end: AwareDatetime = Field(
        description=(
            "End of the span of Apple Health history the client read; not before "
            "window_start. Must carry a timezone offset. Recorded nowhere and never used to "
            "remove anything."
        )
    )
    observations: list[ObservationIn] = Field(
        min_length=1,
        max_length=MAX_OBSERVATIONS,
        description="Weigh-ins read from Apple Health, in any order.",
    )

    @model_validator(mode="after")
    def _window_is_ordered(self) -> Self:
        """Reject a window that ends before it starts. The message carries no value."""
        if self.window_end < self.window_start:
            raise ValueError("window_end is before window_start")
        return self


class AppleHealthSyncOut(BaseModel):
    """The outcome of one sync. Counts only; nothing is ever removed, so there is no third."""

    inserted_count: int = Field(ge=0, description="Measurements newly stored by this sync.")
    skipped_existing_count: int = Field(
        ge=0,
        description=(
            "Observations in this sync that matched a measurement already stored for this "
            "account (same instant, same weight once converted to kilograms), or an earlier "
            "observation in the same request, and were not duplicated. Re-running the same "
            "sync is therefore idempotent."
        ),
    )
