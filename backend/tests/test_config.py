"""Settings are read once, validated on construction, and fail closed without leaking a value."""

from __future__ import annotations

import pytest

from app.config import MIN_AUTH_SECRET_LENGTH, load_settings
from app.errors import ConfigurationError

SECRET = "s" * MIN_AUTH_SECRET_LENGTH

MINIMAL_ENV = {
    "HEALTHTREND_DATABASE_URL": "sqlite+pysqlite:///:memory:",
    "HEALTHTREND_AUTH_SECRET": SECRET,
    "HEALTHTREND_SMTP_HOST": "smtp.example.invalid",
    "HEALTHTREND_SMTP_FROM": "sign-in@example.invalid",
}


def env(**overrides: str | None) -> dict[str, str]:
    merged = {**MINIMAL_ENV, **overrides}
    return {name: value for name, value in merged.items() if value is not None}


def test_a_minimal_production_environment_loads_with_fail_closed_defaults():
    settings = load_settings(env())
    assert settings.cookie_secure is True
    assert settings.mailer == "smtp"
    assert settings.smtp_port == 587
    assert settings.beta_allowed_emails == frozenset()
    assert settings.auth_secret_bytes == SECRET.encode()


@pytest.mark.parametrize(
    ("overrides", "named"),
    [
        ({"HEALTHTREND_DATABASE_URL": None}, "HEALTHTREND_DATABASE_URL"),
        ({"HEALTHTREND_DATABASE_URL": "   "}, "HEALTHTREND_DATABASE_URL"),
        ({"HEALTHTREND_AUTH_SECRET": None}, "HEALTHTREND_AUTH_SECRET"),
        ({"HEALTHTREND_AUTH_SECRET": "short-secret"}, "HEALTHTREND_AUTH_SECRET"),
        ({"HEALTHTREND_COOKIE_SECURE": "yes"}, "HEALTHTREND_COOKIE_SECURE"),
        ({"HEALTHTREND_MAILER": "carrier-pigeon"}, "HEALTHTREND_MAILER"),
        ({"HEALTHTREND_MAILER": "console"}, "HEALTHTREND_MAILER"),
        ({"HEALTHTREND_SMTP_HOST": None}, "HEALTHTREND_SMTP_HOST"),
        ({"HEALTHTREND_SMTP_FROM": None}, "HEALTHTREND_SMTP_FROM"),
        ({"HEALTHTREND_SMTP_PORT": "smtp"}, "HEALTHTREND_SMTP_PORT"),
        ({"HEALTHTREND_SMTP_PORT": "70000"}, "HEALTHTREND_SMTP_PORT"),
    ],
)
def test_an_unsafe_or_incomplete_environment_is_refused(
    overrides: dict[str, str | None], named: str
):
    with pytest.raises(ConfigurationError) as raised:
        load_settings(env(**overrides))
    assert named in str(raised.value)


def test_the_console_mailer_is_accepted_only_over_plain_http():
    settings = load_settings(env(HEALTHTREND_MAILER="console", HEALTHTREND_COOKIE_SECURE="false"))
    assert settings.mailer == "console"
    assert settings.cookie_secure is False


def test_an_error_names_the_setting_and_never_its_value():
    with pytest.raises(ConfigurationError) as raised:
        load_settings(env(HEALTHTREND_AUTH_SECRET="sentinel-too-short"))
    assert "sentinel-too-short" not in str(raised.value)


def test_the_allow_list_is_normalised():
    settings = load_settings(
        env(HEALTHTREND_BETA_ALLOWED_EMAILS=" Alice@Example.com, ,bob@example.com ")
    )
    assert settings.beta_allowed_emails == frozenset({"alice@example.com", "bob@example.com"})


def test_implicit_tls_port_is_accepted():
    assert load_settings(env(HEALTHTREND_SMTP_PORT="465")).smtp_port == 465
