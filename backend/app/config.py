"""Environment configuration for the HTTP boundary.

The one setting the backend reads from its process environment: which browser origins may
call this API directly. Every other behaviour in this application is either a fixed default
or a per-request parameter -- this is the first (and, for now, only) exception, and it exists
because a browser origin is inherently a deploy-time fact this code cannot know in advance
(ADR-0006 rejected guessing at one; this reads it instead of guessing).

Fails closed: an unset or empty variable yields no allowed origins, not "allow everything".
A silently permissive default is exactly the kind of configuration ADR-0006 already rejected
once, and CORS is access control, so its failure mode must be "nothing is allowed" rather
than "anything is".
"""

from __future__ import annotations

import os

ALLOWED_ORIGINS_ENV_VAR = "HEALTHTREND_ALLOWED_ORIGINS"
"""Comma-separated browser origins permitted to call this API directly, e.g.
``http://localhost:3000,https://app.example.com``. No wildcard support: each origin must be
named explicitly."""


def allowed_origins() -> list[str]:
    """Return the browser origins this API accepts direct requests from.

    Unset or empty input yields an empty list, and CORS then permits no browser origin to
    read a response from this API -- server-to-server calls (this API's own tests, and the
    Next.js server components used by the demo path) are entirely unaffected, since CORS is
    a browser-enforced check on responses to browser-issued requests, never a request-time
    firewall.
    """
    raw = os.environ.get(ALLOWED_ORIGINS_ENV_VAR, "")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
