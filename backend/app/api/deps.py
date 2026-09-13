"""Shared route dependencies.

**The clock** is the one everything else rests on. Reading the current instant through a
dependency rather than calling ``datetime.now`` inside a route is what makes the whole HTTP
surface reproducible -- a test overrides :func:`get_clock` with a fixed clock and every
timestamp, forecast origin, demo series, code expiry and session expiry becomes deterministic.

**Settings, the database and the mailer** are built once, when the application starts
(:func:`app.main.create_app`), and kept on ``app.state``. These dependencies hand them to a
route; tests override :func:`get_mailer` the same way they override the clock.

**The current user** comes only from the ``ht_session`` cookie, resolved against the
database. No route ever takes a user id from the request body, the query or the path.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request, Response

from app.api.session_cookie import SESSION_COOKIE_NAME, set_session_cookie
from app.auth.mailer import Mailer
from app.config import Settings
from app.errors import UnauthenticatedError
from app.persistence import Database, Store
from app.persistence.repositories import UserRecord
from app.services.auth import resolve_session
from app.services.clock import Clock, SystemClock


def get_clock() -> Clock:
    """Return the clock the application uses. Overridden in tests."""
    return SystemClock()


ClockDep = Annotated[Clock, Depends(get_clock)]
"""The injected clock.

Declared with ``Annotated`` rather than a ``Depends()`` default so that a route signature
stays a plain annotated parameter list.
"""


def get_settings(request: Request) -> Settings:
    """Return the settings the application was started with."""
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_settings)]
"""The application's settings."""


def get_store(request: Request) -> Iterator[Store]:
    """Open one unit of work for the request; anything uncommitted is rolled back after it."""
    database: Database = request.app.state.database
    with database.store() as store:
        yield store


StoreDep = Annotated[Store, Depends(get_store)]
"""The request's unit of work over the account database."""


def get_mailer(request: Request) -> Mailer:
    """Return the mailer that delivers sign-in codes. Overridden in tests."""
    mailer: Mailer = request.app.state.mailer
    return mailer


MailerDep = Annotated[Mailer, Depends(get_mailer)]
"""The injected mailer."""


def get_current_user(
    request: Request,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
    settings: SettingsDep,
) -> UserRecord:
    """Return the signed-in user, re-issuing the cookie when the session's expiry slides.

    Raises:
        UnauthenticatedError: no cookie, an unknown token, or an expired session.
    """
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        raise UnauthenticatedError("no session cookie")
    resolved = resolve_session(token, now=clock.now(), store=store)
    if resolved.refreshed:
        set_session_cookie(response, token, secure=settings.cookie_secure)
    return resolved.user


CurrentUserDep = Annotated[UserRecord, Depends(get_current_user)]
"""The signed-in user. A route that declares this rejects anonymous requests with a 401."""
