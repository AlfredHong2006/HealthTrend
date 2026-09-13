"""Session tokens and the expiry policy.

The token is the only credential a signed-in browser holds. It is generated here, handed to
the API layer exactly once to be written into an HttpOnly cookie, and from then on the server
only ever sees and stores its SHA-256.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Final

SESSION_TOKEN_BYTES: Final = 32
"""Random bytes in a session token: 256 bits."""

SESSION_TTL: Final = timedelta(days=90)
"""A session expires this long after it was last refreshed."""

SESSION_REFRESH_AFTER: Final = timedelta(days=1)
"""A session's expiry slides forward at most once in this interval.

Refreshing on every request would write to the database on every read; once a day keeps the
90-day sliding window accurate to within a day at a fraction of the writes.
"""


def new_session_token() -> str:
    """Return a fresh URL-safe session token carrying 256 random bits."""
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_session_token(token: str) -> str:
    """Return the hex SHA-256 of ``token``, the only form in which it is stored."""
    return hashlib.sha256(token.encode()).hexdigest()


def session_expiry(now: datetime) -> datetime:
    """Return when a session created or refreshed at ``now`` expires."""
    return now + SESSION_TTL


def is_due_for_refresh(last_seen_at: datetime, now: datetime) -> bool:
    """Return whether a session last refreshed at ``last_seen_at`` should slide forward."""
    return now - last_seen_at >= SESSION_REFRESH_AFTER
