"""Environment configuration.

Two kinds of setting are read from the process environment, at two different moments.

**The CORS allow-list** (:func:`allowed_origins`) is read when the application is constructed.
A browser origin is inherently a deploy-time fact this code cannot know in advance (ADR-0006
rejected guessing at one; this reads it instead of guessing). It fails closed: an unset or
empty variable yields no allowed origins, not "allow everything". A silently permissive
default is exactly the kind of configuration ADR-0006 already rejected once, and CORS is
access control, so its failure mode must be "nothing is allowed" rather than "anything is".

**The account settings** (:class:`Settings`, via :func:`load_settings`) are read once, when the
server starts. They configure the database, the sign-in secret, the session cookie and the
mailer that delivers sign-in codes. They fail closed too, and loudly: a missing database URL,
a missing or short auth secret, or an incomplete mailer configuration stops the server from
starting rather than letting it serve requests it cannot handle safely. Tests never read these
from the environment; they construct :class:`Settings` explicitly with a fixed test secret.

No setting value is ever logged or placed in an exception message. The database URL, the auth
secret and the SMTP password are credentials, so they are also excluded from ``repr``; a
:class:`app.errors.ConfigurationError` names the variable at fault and never its value.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Final, Literal

from app.errors import ConfigurationError

ALLOWED_ORIGINS_ENV_VAR = "HEALTHTREND_ALLOWED_ORIGINS"
"""Comma-separated browser origins permitted to call this API directly, e.g.
``http://localhost:3000,https://app.example.com``. No wildcard support: each origin must be
named explicitly."""

DATABASE_URL_ENV_VAR: Final = "HEALTHTREND_DATABASE_URL"
"""SQLAlchemy database URL, e.g. ``postgresql+psycopg://user:password@host/db``. Required."""

AUTH_SECRET_ENV_VAR: Final = "HEALTHTREND_AUTH_SECRET"
"""Server-side key that authenticates stored sign-in codes. Required, at least
:data:`MIN_AUTH_SECRET_LENGTH` characters. Generate one with
``python -c "import secrets; print(secrets.token_urlsafe(48))"``."""

COOKIE_SECURE_ENV_VAR: Final = "HEALTHTREND_COOKIE_SECURE"
"""``true`` (the default) or ``false``. Only a local plain-HTTP setup should set ``false``."""

MAILER_ENV_VAR: Final = "HEALTHTREND_MAILER"
"""``smtp`` (the default) or ``console``. ``console`` is refused while cookies are Secure."""

SMTP_HOST_ENV_VAR: Final = "HEALTHTREND_SMTP_HOST"
SMTP_PORT_ENV_VAR: Final = "HEALTHTREND_SMTP_PORT"
SMTP_USER_ENV_VAR: Final = "HEALTHTREND_SMTP_USER"
SMTP_PASSWORD_ENV_VAR: Final = "HEALTHTREND_SMTP_PASSWORD"
SMTP_FROM_ENV_VAR: Final = "HEALTHTREND_SMTP_FROM"

BETA_ALLOWED_EMAILS_ENV_VAR: Final = "HEALTHTREND_BETA_ALLOWED_EMAILS"
"""Comma-separated email addresses allowed to sign in. Unset or empty means open sign-up."""

MIN_AUTH_SECRET_LENGTH: Final = 32
"""Shortest auth secret accepted.

The secret is what makes a stored six-digit code useless to someone holding a copy of the
database: without it, the million possible codes cannot be tested offline. A short secret
would reintroduce exactly that search.
"""

DEFAULT_SMTP_PORT: Final = 587

MailerKind = Literal["smtp", "console"]
"""How sign-in codes are delivered."""


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


@dataclass(frozen=True, slots=True)
class Settings:
    """Account, session and mailer configuration, validated on construction.

    Attributes:
        database_url: SQLAlchemy URL of the account database.
        auth_secret: key for the sign-in code HMAC. Never logged, never in ``repr``.
        cookie_secure: whether the session cookie carries the ``Secure`` attribute.
        mailer: how sign-in codes are delivered.
        smtp_host: SMTP server host; required when ``mailer`` is ``smtp``.
        smtp_port: SMTP server port. 465 means implicit TLS; any other port uses STARTTLS.
        smtp_user: SMTP login name, if the server requires one.
        smtp_password: SMTP password. Never logged, never in ``repr``.
        smtp_from: sender address; required when ``mailer`` is ``smtp``.
        beta_allowed_emails: normalised addresses allowed to sign in; empty means anyone.
    """

    database_url: str = field(repr=False)
    auth_secret: str = field(repr=False)
    cookie_secure: bool
    mailer: MailerKind
    smtp_host: str | None
    smtp_port: int
    smtp_user: str | None
    smtp_password: str | None = field(repr=False)
    smtp_from: str | None
    beta_allowed_emails: frozenset[str]

    def __post_init__(self) -> None:
        """Reject a configuration the application cannot run safely with.

        Raises:
            ConfigurationError: naming the setting at fault, never its value.
        """
        if not self.database_url:
            raise ConfigurationError(f"{DATABASE_URL_ENV_VAR} must be set")
        if len(self.auth_secret) < MIN_AUTH_SECRET_LENGTH:
            raise ConfigurationError(
                f"{AUTH_SECRET_ENV_VAR} must be set to at least {MIN_AUTH_SECRET_LENGTH} characters"
            )
        if self.mailer == "console" and self.cookie_secure:
            raise ConfigurationError(
                f"{MAILER_ENV_VAR}=console prints sign-in codes and is refused while "
                f"{COOKIE_SECURE_ENV_VAR} is true"
            )
        if self.mailer == "smtp" and not (self.smtp_host and self.smtp_from):
            raise ConfigurationError(
                f"{MAILER_ENV_VAR}=smtp requires {SMTP_HOST_ENV_VAR} and {SMTP_FROM_ENV_VAR}"
            )
        if not 0 < self.smtp_port < 65536:
            raise ConfigurationError(f"{SMTP_PORT_ENV_VAR} must be a valid port number")

    @property
    def auth_secret_bytes(self) -> bytes:
        """The auth secret as the key bytes the HMAC takes."""
        return self.auth_secret.encode("utf-8")


def load_settings(environ: Mapping[str, str] | None = None) -> Settings:
    """Read and validate :class:`Settings` from the environment.

    Args:
        environ: the variables to read; defaults to :data:`os.environ`.

    Raises:
        ConfigurationError: if a required variable is missing or a value is malformed.
    """
    env = os.environ if environ is None else environ
    return Settings(
        database_url=_optional(env, DATABASE_URL_ENV_VAR) or "",
        auth_secret=_optional(env, AUTH_SECRET_ENV_VAR) or "",
        cookie_secure=_boolean(env, COOKIE_SECURE_ENV_VAR, default=True),
        mailer=_mailer_kind(env),
        smtp_host=_optional(env, SMTP_HOST_ENV_VAR),
        smtp_port=_port(env),
        smtp_user=_optional(env, SMTP_USER_ENV_VAR),
        smtp_password=_optional(env, SMTP_PASSWORD_ENV_VAR),
        smtp_from=_optional(env, SMTP_FROM_ENV_VAR),
        beta_allowed_emails=frozenset(
            address.strip().lower()
            for address in env.get(BETA_ALLOWED_EMAILS_ENV_VAR, "").split(",")
            if address.strip()
        ),
    )


def _optional(env: Mapping[str, str], name: str) -> str | None:
    """Return a stripped variable, treating unset and blank alike as absent."""
    value = env.get(name, "").strip()
    return value or None


def _boolean(env: Mapping[str, str], name: str, *, default: bool) -> bool:
    """Parse ``true``/``false``; anything else is a configuration error, not a guess."""
    value = _optional(env, name)
    if value is None:
        return default
    lowered = value.lower()
    if lowered not in {"true", "false"}:
        raise ConfigurationError(f"{name} must be true or false")
    return lowered == "true"


def _mailer_kind(env: Mapping[str, str]) -> MailerKind:
    """Parse the mailer kind, defaulting to SMTP."""
    value = (_optional(env, MAILER_ENV_VAR) or "smtp").lower()
    if value == "smtp":
        return "smtp"
    if value == "console":
        return "console"
    raise ConfigurationError(f"{MAILER_ENV_VAR} must be smtp or console")


def _port(env: Mapping[str, str]) -> int:
    """Parse the SMTP port, defaulting to the submission port."""
    value = _optional(env, SMTP_PORT_ENV_VAR)
    if value is None:
        return DEFAULT_SMTP_PORT
    if not value.isdigit():
        raise ConfigurationError(f"{SMTP_PORT_ENV_VAR} must be a whole number")
    return int(value)
