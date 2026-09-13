"""Email sign-in codes: generation, authentication and the policy numbers around them.

A code is shown to a person once, in an email, and stored only as an HMAC (see
:mod:`app.auth`). Nothing in this module logs, and no function here returns a code together
with an email address in any form a caller could accidentally log as a pair.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Final

CODE_DIGITS: Final = 6
"""Length of a sign-in code."""

CODE_TTL: Final = timedelta(minutes=10)
"""How long an issued code remains usable."""

MAX_VERIFY_ATTEMPTS: Final = 5
"""Verification attempts allowed against one code. The next attempt fails even if correct."""

MAX_CODES_PER_WINDOW: Final = 3
"""Codes that may be issued for one email within :data:`CODE_REQUEST_WINDOW`."""

CODE_REQUEST_WINDOW: Final = timedelta(minutes=15)
"""The rate-limit window for issuing codes."""


def normalise_email(email: str) -> str:
    """Return the canonical form of an email address: trimmed and lower-cased.

    Lower-casing the local part is technically lossy, but no mainstream provider treats it as
    case-sensitive, and two accounts differing only in case would be a worse failure.
    """
    return email.strip().lower()


def generate_code() -> str:
    """Return a uniformly random, zero-padded six-digit code."""
    return f"{secrets.randbelow(10**CODE_DIGITS):0{CODE_DIGITS}d}"


def code_mac(secret: bytes, email: str, code: str) -> str:
    """Return the hex ``HMAC-SHA256(secret, normalised_email + ":" + code)``.

    The email is normalised here as well as by the caller, so the stored value can never
    depend on how the address happened to be typed.
    """
    message = f"{normalise_email(email)}:{code}".encode()
    return hmac.new(secret, message, hashlib.sha256).hexdigest()


def code_matches(secret: bytes, email: str, code: str, expected_mac: str) -> bool:
    """Return whether ``code`` for ``email`` authenticates to ``expected_mac``, in constant time."""
    return hmac.compare_digest(code_mac(secret, email, code), expected_mac)
