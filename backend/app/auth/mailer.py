"""Delivering sign-in codes.

A :class:`Mailer` has one job: put a code in front of the person who owns an address. Two
implementations ship:

* :class:`SmtpMailer` -- the real one, over the standard library's :mod:`smtplib`, always
  encrypted: implicit TLS on port 465, STARTTLS on any other port. No third-party SDK.
* :class:`ConsoleMailer` -- for a local plain-HTTP setup only. It prints the code, and nothing
  else, to standard output. :class:`app.config.Settings` refuses it whenever cookies are
  ``Secure``, which is every deployed configuration.

Tests use a recording mailer that lives in the test suite, not here.

A delivery failure raises whatever :mod:`smtplib` raises. That exception reaches the API's
catch-all, which logs its class name only -- an SMTP error message can quote the recipient.
"""

from __future__ import annotations

import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from typing import Final, Protocol

from app.auth.codes import CODE_TTL

SMTPS_PORT: Final = 465
"""The port on which SMTP runs inside TLS from the first byte."""

SMTP_TIMEOUT_SECONDS: Final = 10.0
"""How long to wait on the SMTP server before failing the request."""

LOGIN_CODE_SUBJECT: Final = "Your HealthTrend sign-in code"


class Mailer(Protocol):
    """Something that can deliver a sign-in code to an email address."""

    def send_login_code(self, email: str, code: str) -> None:
        """Deliver ``code`` to ``email``, or raise."""
        ...


def login_code_message(*, sender: str, recipient: str, code: str) -> EmailMessage:
    """Build the plain-text sign-in email."""
    minutes = int(CODE_TTL.total_seconds() // 60)
    message = EmailMessage()
    message["Subject"] = LOGIN_CODE_SUBJECT
    message["From"] = sender
    message["To"] = recipient
    message.set_content(
        f"Your HealthTrend sign-in code is {code}.\n\n"
        f"It expires in {minutes} minutes and can be used once. If you did not try to sign "
        f"in, you can ignore this email.\n"
    )
    return message


@dataclass(frozen=True, slots=True)
class SmtpMailer:
    """Send sign-in codes through an SMTP server, always over TLS."""

    host: str
    port: int
    sender: str
    username: str | None = None
    password: str | None = field(default=None, repr=False)

    def send_login_code(self, email: str, code: str) -> None:
        """Deliver ``code`` to ``email``."""
        message = login_code_message(sender=self.sender, recipient=email, code=code)
        context = ssl.create_default_context()
        if self.port == SMTPS_PORT:
            with smtplib.SMTP_SSL(
                self.host, self.port, timeout=SMTP_TIMEOUT_SECONDS, context=context
            ) as smtp:
                self._deliver(smtp, message)
        else:
            with smtplib.SMTP(self.host, self.port, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
                smtp.starttls(context=context)
                self._deliver(smtp, message)

    def _deliver(self, smtp: smtplib.SMTP, message: EmailMessage) -> None:
        if self.username is not None and self.password is not None:
            smtp.login(self.username, self.password)
        smtp.send_message(message)


class ConsoleMailer:
    """Print sign-in codes to standard output. Local development over plain HTTP only."""

    def send_login_code(self, email: str, code: str) -> None:
        """Print the code, and not the address it was meant for."""
        print(f"HealthTrend sign-in code: {code}", flush=True)
