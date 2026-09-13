"""The sign-in request contract.

Validation is structural only, and every constraint is declarative so that a failure is
reported through the sanitised validation path in :mod:`app.api.errors` -- which never echoes
a submitted email address or code back to the caller.

The email check is deliberately shallow: one ``@`` with something on either side, no
whitespace, at most 254 characters. Whether an address really receives mail is established by
the only test that matters, delivering a code to it. The address is trimmed and lower-cased
here, and normalised again by :mod:`app.services.auth`, which is the authority.
"""

from __future__ import annotations

from typing import Annotated, Final

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

EMAIL_MAX_LENGTH: Final = 254
"""Longest accepted email address; the practical limit of an SMTP forward path."""

EmailAddress = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        to_lower=True,
        min_length=3,
        max_length=EMAIL_MAX_LENGTH,
        pattern=r"^[^@\s]+@[^@\s]+$",
    ),
]
"""A trimmed, lower-cased, shallowly validated email address."""

LoginCode = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[0-9]{6}$")]
"""Exactly six ASCII digits."""


class CodeRequestIn(BaseModel):
    """Ask for a sign-in code to be emailed."""

    model_config = ConfigDict(extra="forbid")

    email: EmailAddress = Field(description="The address to send a sign-in code to.")


class CodeRequestAcceptedOut(BaseModel):
    """Acknowledgement that a code request was received.

    Deliberately empty. The response is identical whether or not the address may sign in and
    whether or not an account exists, so it tells the caller nothing about either.
    """

    model_config = ConfigDict(extra="forbid")


class CodeVerifyIn(BaseModel):
    """Exchange an emailed sign-in code for a session."""

    model_config = ConfigDict(extra="forbid")

    email: EmailAddress = Field(description="The address the code was sent to.")
    code: LoginCode = Field(description="The six-digit code from the email.")
