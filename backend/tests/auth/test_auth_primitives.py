"""Sign-in primitives: code generation and HMAC, session tokens, and code delivery."""

from __future__ import annotations

import hashlib
import hmac
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from typing import Any, ClassVar

import pytest

from app.auth import mailer as mailer_module
from app.auth.codes import code_mac, code_matches, generate_code, normalise_email
from app.auth.mailer import ConsoleMailer, SmtpMailer, login_code_message
from app.auth.sessions import (
    SESSION_REFRESH_AFTER,
    SESSION_TTL,
    hash_session_token,
    is_due_for_refresh,
    new_session_token,
    session_expiry,
)

SECRET = b"primitive-test-secret-0123456789-abcdef"
NOW = datetime(2026, 6, 12, 9, 0, tzinfo=UTC)


# --- codes ------------------------------------------------------------------------------


def test_a_code_is_six_digits_and_varies():
    codes = {generate_code() for _ in range(200)}
    assert all(len(code) == 6 and code.isdigit() for code in codes)
    assert len(codes) > 150


def test_the_code_mac_is_hmac_sha256_of_email_colon_code():
    expected = hmac.new(SECRET, b"alice@example.com:012345", hashlib.sha256).hexdigest()
    assert code_mac(SECRET, "alice@example.com", "012345") == expected


def test_the_code_mac_normalises_the_email():
    assert code_mac(SECRET, " Alice@Example.COM ", "012345") == code_mac(
        SECRET, "alice@example.com", "012345"
    )


def test_the_code_mac_depends_on_the_secret_the_email_and_the_code():
    base = code_mac(SECRET, "alice@example.com", "012345")
    assert code_mac(b"another-secret-0123456789-abcdefghij", "alice@example.com", "012345") != base
    assert code_mac(SECRET, "bob@example.com", "012345") != base
    assert code_mac(SECRET, "alice@example.com", "012346") != base


def test_the_code_mac_is_not_a_bare_hash_of_the_code():
    assert code_mac(SECRET, "alice@example.com", "012345") != (
        hashlib.sha256(b"012345").hexdigest()
    )


def test_code_matches_accepts_only_the_right_code():
    stored = code_mac(SECRET, "alice@example.com", "012345")
    assert code_matches(SECRET, "alice@example.com", "012345", stored)
    assert not code_matches(SECRET, "alice@example.com", "543210", stored)
    assert not code_matches(SECRET, "bob@example.com", "012345", stored)


def test_normalise_email():
    assert normalise_email("  Alice@Example.COM\t") == "alice@example.com"


# --- sessions ---------------------------------------------------------------------------


def test_a_session_token_carries_256_bits_and_varies():
    tokens = {new_session_token() for _ in range(50)}
    assert len(tokens) == 50
    assert all(len(token) >= 43 for token in tokens)


def test_a_session_token_is_stored_as_its_sha256():
    assert hash_session_token("token") == hashlib.sha256(b"token").hexdigest()


def test_session_expiry_and_refresh_policy():
    assert session_expiry(NOW) == NOW + SESSION_TTL
    assert not is_due_for_refresh(NOW, NOW + SESSION_REFRESH_AFTER - timedelta(seconds=1))
    assert is_due_for_refresh(NOW, NOW + SESSION_REFRESH_AFTER)


# --- mailers ----------------------------------------------------------------------------


def test_the_login_email_contains_the_code_and_its_lifetime():
    message = login_code_message(
        sender="from@example.invalid", recipient="to@example.invalid", code="012345"
    )
    assert message["To"] == "to@example.invalid"
    body = message.get_content()
    assert "012345" in body
    assert "10 minutes" in body


def test_the_console_mailer_prints_the_code_and_not_the_address(capsys: pytest.CaptureFixture[str]):
    ConsoleMailer().send_login_code("alice@example.com", "012345")
    output = capsys.readouterr().out
    assert "012345" in output
    assert "alice" not in output


class FakeSmtp:
    """Records what an SMTP session was asked to do."""

    instances: ClassVar[list[FakeSmtp]] = []

    def __init__(self, host: str, port: int, **kwargs: Any) -> None:
        self.host = host
        self.port = port
        self.kwargs = kwargs
        self.calls: list[str] = []
        self.sent: list[EmailMessage] = []
        FakeSmtp.instances.append(self)

    def __enter__(self) -> FakeSmtp:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.calls.append("quit")

    def starttls(self, **_kwargs: Any) -> None:
        self.calls.append("starttls")

    def login(self, username: str, password: str) -> None:
        self.calls.append(f"login:{username}")

    def send_message(self, message: EmailMessage) -> None:
        self.calls.append("send")
        self.sent.append(message)


@pytest.fixture
def fake_smtp(monkeypatch: pytest.MonkeyPatch) -> type[FakeSmtp]:
    FakeSmtp.instances = []
    monkeypatch.setattr(mailer_module.smtplib, "SMTP", FakeSmtp)
    monkeypatch.setattr(mailer_module.smtplib, "SMTP_SSL", FakeSmtp)
    return FakeSmtp


def test_smtp_on_the_submission_port_always_upgrades_to_tls_before_logging_in(
    fake_smtp: type[FakeSmtp],
):
    SmtpMailer(
        host="smtp.example.invalid",
        port=587,
        sender="from@example.invalid",
        username="user",
        password="pass",
    ).send_login_code("to@example.invalid", "012345")
    [session] = fake_smtp.instances
    assert session.calls == ["starttls", "login:user", "send", "quit"]
    assert "012345" in session.sent[0].get_content()


def test_smtp_on_port_465_uses_implicit_tls(fake_smtp: type[FakeSmtp]):
    SmtpMailer(
        host="smtp.example.invalid", port=465, sender="from@example.invalid"
    ).send_login_code("to@example.invalid", "012345")
    [session] = fake_smtp.instances
    assert "context" in session.kwargs
    assert session.calls == ["send", "quit"]


def test_the_smtp_password_is_not_in_the_mailer_repr():
    mailer = SmtpMailer(
        host="smtp.example.invalid", port=587, sender="a@b.invalid", password="sentinel-pass"
    )
    assert "sentinel-pass" not in repr(mailer)
