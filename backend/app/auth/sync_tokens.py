"""Sync tokens: the bearer credential a sync client holds.

A sync client -- today, an Apple Shortcut posting Apple Health weights -- cannot hold the
browser's ``ht_session`` cookie and must not: that cookie can do everything the signed-in
person can. A sync token is a separate, narrower credential. It is generated here, shown to
its owner exactly once when a sync connection is created, and from then on the server only
ever sees it in an ``Authorization: Bearer`` header and only ever stores its SHA-256.

Like a session token it carries 256 bits from :mod:`secrets`, so the same reasoning applies
(:mod:`app.auth`): no search covers that space, a plain unkeyed SHA-256 is enough to make a
copied table unusable, and the stored hash is found by equality on an indexed column rather
than by comparing candidates -- there is no secret-dependent comparison to time.

The fixed prefix carries no entropy. It makes a leaked token recognisable for what it is, and
lets a value that is plainly not a sync token -- a session token pasted into the wrong place,
a truncated copy -- be refused before any database lookup.
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Final

SYNC_TOKEN_BYTES: Final = 32
"""Random bytes in a sync token: 256 bits."""

SYNC_TOKEN_PREFIX: Final = "hts_"
"""What every sync token starts with. Identifies the credential; adds no entropy."""

SYNC_TOKEN_LENGTH: Final = len(SYNC_TOKEN_PREFIX) + 43
"""Length of a sync token: the prefix plus 32 bytes in unpadded URL-safe base64."""


def new_sync_token() -> str:
    """Return a fresh sync token carrying 256 random bits."""
    return SYNC_TOKEN_PREFIX + secrets.token_urlsafe(SYNC_TOKEN_BYTES)


def hash_sync_token(token: str) -> str:
    """Return the hex SHA-256 of ``token``, the only form in which it is stored."""
    return hashlib.sha256(token.encode()).hexdigest()


def is_well_formed_sync_token(token: str) -> bool:
    """Return whether ``token`` has the shape of a sync token, without consulting storage."""
    return len(token) == SYNC_TOKEN_LENGTH and token.startswith(SYNC_TOKEN_PREFIX)
