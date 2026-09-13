"""The session cookie: its name, its attributes, and nothing else.

``ht_session`` carries the session token and is the browser's only credential. Its attributes
are fixed here so that setting, refreshing and clearing it can never disagree:

* ``HttpOnly`` -- no script on any page can read it, which is also why the frontend's
  no-browser-storage guard is unaffected by it.
* ``SameSite=Lax`` -- not sent on cross-site subresource requests or cross-site POSTs.
* ``Secure`` -- sent only over HTTPS, whenever ``HEALTHTREND_COOKIE_SECURE`` is true (the
  default, and every deployed configuration).
* ``Path=/``, no ``Domain`` -- a host-only cookie for the API host.
* ``Max-Age`` of the session lifetime, re-issued whenever the server slides the expiry.
"""

from __future__ import annotations

from typing import Final

from starlette.responses import Response

from app.auth.sessions import SESSION_TTL

SESSION_COOKIE_NAME: Final = "ht_session"


def set_session_cookie(response: Response, token: str, *, secure: bool) -> None:
    """Write the session token into ``response`` as the session cookie."""
    response.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
        secure=secure,
        httponly=True,
        samesite="lax",
    )


def clear_session_cookie(response: Response, *, secure: bool) -> None:
    """Tell the browser to discard the session cookie."""
    response.delete_cookie(
        SESSION_COOKIE_NAME, path="/", secure=secure, httponly=True, samesite="lax"
    )
