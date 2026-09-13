"""Signing in with an emailed code, and resolving a session on later requests.

The flow::

    request_code(email)         allow-listed?  rate limit  →  store HMAC  →  email the code
    verify_code(email, code)    newest unused code  →  expiry  →  attempt count  →  compare
                                →  consume  →  get or create the user  →  new session
    resolve_session(token)      hash  →  session row  →  expiry  →  allow-listed?  →  slide
    logout(token)               delete the session row

Decisions that live here rather than in a route:

* **The request step never reveals anything.** An address that is not allowed to sign in gets
  the same silent success as one that is; no row is written and no email is sent for it.
* **A failed attempt is committed before the error is raised.** Otherwise the rollback that
  follows an exception would erase the attempt, and the five-attempt limit would never bind.
* **Only the newest unused code for an address can succeed.** Requesting a new code quietly
  supersedes older ones.
* **A code that could not be delivered is deleted, not merely left aside.** Otherwise a
  transient mail failure would silently spend one of the address's three-per-window request
  slots on a code its owner never received, and would leave a code sitting in the database
  that nobody read out of an email but that would still verify if guessed.
* **The allow-list is re-checked on every resolved session, not only at sign-in.** Removing
  an address from ``HEALTHTREND_BETA_ALLOWED_EMAILS`` must end that person's access, not just
  block a future sign-in -- so a session belonging to a now-disallowed address is deleted the
  moment it is next presented, the same way an expired one is.
* **Nothing here logs**, and no exception message carries an email, a code or a token.

The clock is not read here; ``now`` arrives from the injected clock, as for every service.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.auth.codes import (
    CODE_REQUEST_WINDOW,
    CODE_TTL,
    MAX_CODES_PER_WINDOW,
    MAX_VERIFY_ATTEMPTS,
    code_mac,
    code_matches,
    generate_code,
    normalise_email,
)
from app.auth.mailer import Mailer
from app.auth.sessions import (
    hash_session_token,
    is_due_for_refresh,
    new_session_token,
    session_expiry,
)
from app.config import Settings
from app.errors import (
    CodeExpiredError,
    InvalidCodeError,
    TooManyCodeRequestsError,
    UnauthenticatedError,
)
from app.persistence.repositories import Store, UserRecord


@dataclass(frozen=True, slots=True)
class SignedIn:
    """The outcome of a successful sign-in. The token is excluded from ``repr``."""

    user: UserRecord
    session_token: str = field(repr=False)
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ResolvedSession:
    """A valid session on an incoming request."""

    user: UserRecord
    expires_at: datetime
    refreshed: bool
    """Whether this request slid the expiry forward, so the cookie should be re-issued."""


def is_allowed_to_sign_in(email: str, settings: Settings) -> bool:
    """Return whether a normalised address may sign in. An empty allow-list admits anyone."""
    return not settings.beta_allowed_emails or email in settings.beta_allowed_emails


def request_code(
    email: str, *, now: datetime, store: Store, mailer: Mailer, settings: Settings
) -> None:
    """Issue and send a sign-in code, if the address may sign in.

    Raises:
        TooManyCodeRequestsError: if the address has had :data:`MAX_CODES_PER_WINDOW` codes
            issued within :data:`CODE_REQUEST_WINDOW`.
    """
    address = normalise_email(email)
    if not is_allowed_to_sign_in(address, settings):
        return
    window_start = now - CODE_REQUEST_WINDOW
    # Codes older than the window can neither be verified (they outlive CODE_TTL) nor count
    # towards the rate limit, so there is no reason to keep them.
    store.login_codes.delete_created_before(address, window_start)
    if store.login_codes.count_created_since(address, window_start) >= MAX_CODES_PER_WINDOW:
        store.commit()
        raise TooManyCodeRequestsError("sign-in code rate limit reached")
    code = generate_code()
    issued = store.login_codes.add(
        address,
        code_mac(settings.auth_secret_bytes, address, code),
        now=now,
        expires_at=now + CODE_TTL,
    )
    # Committed before sending, so the row and the rate-limit count it contributes to are
    # real regardless of what the mailer does next.
    store.commit()
    try:
        mailer.send_login_code(address, code)
    except Exception:
        # Delivery failed: the code was never seen by its owner, so it must not remain
        # usable, and this attempt must not count against the rate limit that is meant to
        # bound successful sends. Deleting the row undoes both at once. The original
        # exception still propagates -- it reaches the API's catch-all, which logs only its
        # class name (docs/privacy.md) -- so a real delivery failure is still visible.
        store.login_codes.delete_by_id(issued.id)
        store.commit()
        raise


def verify_code(
    email: str, code: str, *, now: datetime, store: Store, settings: Settings
) -> SignedIn:
    """Exchange a sign-in code for a new session, creating the user on first sign-in.

    Raises:
        InvalidCodeError: no usable code exists for the address, the code is wrong, or the
            attempt limit has been reached.
        CodeExpiredError: the newest unused code for the address has expired.
    """
    address = normalise_email(email)
    if not is_allowed_to_sign_in(address, settings):
        raise InvalidCodeError("sign-in code rejected")
    issued = store.login_codes.newest_unconsumed(address)
    if issued is None:
        raise InvalidCodeError("sign-in code rejected")
    if issued.expires_at <= now:
        raise CodeExpiredError("sign-in code expired")

    attempts = store.login_codes.record_attempt(issued.id)
    store.commit()
    if attempts > MAX_VERIFY_ATTEMPTS:
        raise InvalidCodeError("sign-in code rejected")
    if not code_matches(settings.auth_secret_bytes, address, code, issued.code_hash):
        raise InvalidCodeError("sign-in code rejected")
    if not store.login_codes.consume(issued.id, now=now):
        store.rollback()
        raise InvalidCodeError("sign-in code rejected")

    user = store.users.get_by_email(address)
    if user is None:
        user = store.users.create(address, now=now)
    else:
        store.users.record_login(user.id, now=now)
    token = new_session_token()
    expires_at = session_expiry(now)
    store.sessions.add(hash_session_token(token), user.id, now=now, expires_at=expires_at)
    store.commit()
    return SignedIn(user=user, session_token=token, expires_at=expires_at)


def resolve_session(
    token: str, *, now: datetime, store: Store, settings: Settings
) -> ResolvedSession:
    """Return the user a session token belongs to, sliding its expiry once a day.

    Raises:
        UnauthenticatedError: the token is unknown, its session has expired, or the
            account's email is no longer on the allow-list.
    """
    token_hash = hash_session_token(token)
    session = store.sessions.get(token_hash)
    if session is None:
        raise UnauthenticatedError("no valid session")
    if session.expires_at <= now:
        store.sessions.delete(token_hash)
        store.commit()
        raise UnauthenticatedError("no valid session")
    user = store.users.get(session.user_id)
    if user is None:
        raise UnauthenticatedError("no valid session")
    if not is_allowed_to_sign_in(user.email, settings):
        # A closed beta narrowed after this session began: access ends now, not merely at
        # the next sign-in, and the session is removed so this is not re-checked forever.
        store.sessions.delete(token_hash)
        store.commit()
        raise UnauthenticatedError("no valid session")
    if not is_due_for_refresh(session.last_seen_at, now):
        return ResolvedSession(user=user, expires_at=session.expires_at, refreshed=False)
    expires_at = session_expiry(now)
    store.sessions.touch(token_hash, now=now, expires_at=expires_at)
    store.commit()
    return ResolvedSession(user=user, expires_at=expires_at, refreshed=True)


def logout(token: str, *, store: Store) -> None:
    """End the session a token belongs to. A token with no session is not an error."""
    store.sessions.delete(hash_session_token(token))
    store.commit()
