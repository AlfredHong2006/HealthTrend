"""Passwordless sign-in over HTTP: request a code, verify it, hold a session, sign out.

Every test runs against a fresh in-memory database and a recording mailer, so the code a
person would have received by email is read straight from the mailer. Time is moved with a
:class:`MutableClock` wherever expiry matters; nothing here sleeps.
"""

from __future__ import annotations

import hashlib
import hmac
from datetime import timedelta
from http.cookies import SimpleCookie

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth.sessions import SESSION_TTL
from app.errors import ConfigurationError
from app.main import create_app
from app.persistence.models import LoginCodeRow, SessionRow
from tests.api.conftest import (
    FROZEN_NOW,
    TEST_AUTH_SECRET,
    MutableClock,
    RecordingMailer,
    build_app,
    make_test_settings,
)

EMAIL = "alice@example.com"
REQUEST = "/api/auth/code/request"
VERIFY = "/api/auth/code/verify"
LOGOUT = "/api/auth/logout"
ME = "/api/me"


@pytest.fixture
def clock() -> MutableClock:
    return MutableClock(FROZEN_NOW)


@pytest.fixture
def timed_app(mailer: RecordingMailer, clock: MutableClock) -> FastAPI:
    return build_app(mailer=mailer, clock=clock)


@pytest.fixture
def timed_client(timed_app: FastAPI) -> TestClient:
    return TestClient(timed_app, raise_server_exceptions=False)


def request_code(client: TestClient, email: str = EMAIL) -> None:
    response = client.post(REQUEST, json={"email": email})
    assert response.status_code == 202, response.text


def sign_in(client: TestClient, mailer: RecordingMailer, email: str = EMAIL) -> dict[str, object]:
    request_code(client, email)
    response = client.post(VERIFY, json={"email": email, "code": mailer.last_code})
    assert response.status_code == 200, response.text
    body: dict[str, object] = response.json()
    return body


def session_cookie(set_cookie_header: str) -> SimpleCookie:
    cookie: SimpleCookie = SimpleCookie()
    cookie.load(set_cookie_header)
    return cookie


def wrong_code(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


# --- the happy path ---------------------------------------------------------------


def test_the_full_sign_in_flow(client: TestClient, mailer: RecordingMailer):
    request_code(client)
    assert [sent.email for sent in mailer.sent] == [EMAIL]
    assert len(mailer.last_code) == 6 and mailer.last_code.isdigit()

    verified = client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    assert verified.status_code == 200
    body = verified.json()
    assert body["user"]["email"] == EMAIL
    assert body["preferences"] == {"display_unit": "kg"}
    assert body["goal"] is None
    assert body["measurement_count"] == 0

    me = client.get(ME)
    assert me.status_code == 200
    assert me.json() == body

    logout = client.post(LOGOUT)
    assert logout.status_code == 204
    assert client.get(ME).status_code == 401


def test_the_request_response_is_an_empty_acknowledgement(client: TestClient):
    response = client.post(REQUEST, json={"email": EMAIL})
    assert response.status_code == 202
    assert response.json() == {}


def test_the_email_is_normalised_before_anything_else(client: TestClient, mailer: RecordingMailer):
    request_code(client, "  Alice@Example.COM ")
    assert mailer.sent[-1].email == EMAIL
    response = client.post(VERIFY, json={"email": "ALICE@example.com", "code": mailer.last_code})
    assert response.status_code == 200
    assert response.json()["user"]["email"] == EMAIL


def test_a_second_sign_in_returns_the_same_account(client: TestClient, mailer: RecordingMailer):
    first = sign_in(client, mailer)
    client.post(LOGOUT)
    second = sign_in(client, mailer)
    assert first["user"] == second["user"]


def test_the_summary_reflects_stored_preferences_goal_and_measurements(
    app: FastAPI, client: TestClient, mailer: RecordingMailer
):
    body = sign_in(client, mailer)
    user_id = str(body["user"]["id"])  # type: ignore[index]
    with app.state.database.store() as store:
        store.preferences.upsert(user_id, display_unit="lb", now=FROZEN_NOW)
        store.goals.upsert(
            user_id, target_weight_kg=70.0, target_weekly_rate_kg=-0.5, now=FROZEN_NOW
        )
        store.measurements.add(
            user_id,
            timestamp=FROZEN_NOW - timedelta(days=1),
            weight=160.0,
            unit="lb",
            source="manual",
            now=FROZEN_NOW,
        )
        store.commit()

    me = client.get(ME).json()
    assert me["preferences"] == {"display_unit": "lb"}
    assert me["goal"] == {"target_weight_kg": 70.0, "target_weekly_rate_kg": -0.5}
    assert me["measurement_count"] == 1
    assert "160" not in client.get(ME).text


def test_auth_responses_are_never_cached(client: TestClient, mailer: RecordingMailer):
    request = client.post(REQUEST, json={"email": EMAIL})
    verify = client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    me = client.get(ME)
    logout = client.post(LOGOUT)
    for response in (request, verify, me, logout):
        assert response.headers["cache-control"] == "no-store"


# --- the session cookie -------------------------------------------------------------


def test_the_session_cookie_attributes(client: TestClient, mailer: RecordingMailer):
    request_code(client)
    response = client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    [header] = response.headers.get_list("set-cookie")
    morsel = session_cookie(header)["ht_session"]
    assert len(morsel.value) >= 43
    assert morsel["httponly"] is True
    assert morsel["samesite"].lower() == "lax"
    assert morsel["path"] == "/"
    assert morsel["max-age"] == str(int(SESSION_TTL.total_seconds()))
    assert not morsel["domain"]
    assert not morsel["secure"], "the test settings run over plain HTTP"


def test_the_session_cookie_is_secure_when_configured():
    mailer = RecordingMailer()
    client = TestClient(
        build_app(
            settings=make_test_settings(
                cookie_secure=True, mailer="smtp", smtp_host="smtp.invalid", smtp_from="a@b.invalid"
            ),
            mailer=mailer,
        ),
        base_url="https://testserver",
    )
    request_code(client)
    response = client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    [header] = response.headers.get_list("set-cookie")
    assert session_cookie(header)["ht_session"]["secure"] is True
    assert client.get(ME).status_code == 200


def test_logout_clears_the_cookie(client: TestClient, mailer: RecordingMailer):
    sign_in(client, mailer)
    response = client.post(LOGOUT)
    [header] = response.headers.get_list("set-cookie")
    morsel = session_cookie(header)["ht_session"]
    assert morsel.value in ("", '""')
    assert morsel["max-age"] == "0"
    assert "ht_session" not in client.cookies


def test_logout_without_a_session_still_succeeds(client: TestClient):
    assert client.post(LOGOUT).status_code == 204


def test_logout_ends_the_session_server_side(client: TestClient, mailer: RecordingMailer):
    """A copy of the cookie taken before sign-out must stop working after it."""
    sign_in(client, mailer)
    token = client.cookies["ht_session"]
    client.post(LOGOUT)
    replay = TestClient(client.app, raise_server_exceptions=False)
    replay.cookies.set("ht_session", token)
    assert replay.get(ME).status_code == 401


# --- /api/me without a valid session ------------------------------------------------


@pytest.mark.parametrize("cookie", [None, "", "not-a-real-token", "x" * 43])
def test_me_rejects_a_missing_or_unknown_session(app: FastAPI, cookie: str | None):
    client = TestClient(app, raise_server_exceptions=False)
    if cookie is not None:
        client.cookies.set("ht_session", cookie)
    response = client.get(ME)
    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "unauthenticated",
            "message": "You are not signed in, or your session has ended.",
            "details": [],
        }
    }


def test_a_session_expires_after_its_lifetime_without_activity(
    timed_client: TestClient, mailer: RecordingMailer, clock: MutableClock
):
    sign_in(timed_client, mailer)
    clock.instant = FROZEN_NOW + SESSION_TTL
    assert timed_client.get(ME).status_code == 401


def test_a_session_slides_forward_when_used(
    timed_client: TestClient, mailer: RecordingMailer, clock: MutableClock
):
    sign_in(timed_client, mailer)

    clock.instant = FROZEN_NOW + timedelta(days=2)
    refreshed = timed_client.get(ME)
    assert refreshed.status_code == 200
    [header] = refreshed.headers.get_list("set-cookie")
    assert session_cookie(header)["ht_session"]["max-age"] == str(int(SESSION_TTL.total_seconds()))

    clock.instant = FROZEN_NOW + timedelta(days=2) + SESSION_TTL - timedelta(minutes=1)
    assert timed_client.get(ME).status_code == 200


def test_a_session_is_not_refreshed_more_than_once_a_day(
    timed_client: TestClient, mailer: RecordingMailer, clock: MutableClock
):
    sign_in(timed_client, mailer)
    clock.instant = FROZEN_NOW + timedelta(hours=23)
    response = timed_client.get(ME)
    assert response.status_code == 200
    assert "set-cookie" not in response.headers


# --- code failures --------------------------------------------------------------------


def test_a_wrong_code_is_rejected(client: TestClient, mailer: RecordingMailer):
    request_code(client)
    response = client.post(VERIFY, json={"email": EMAIL, "code": wrong_code(mailer.last_code)})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_code"
    assert "set-cookie" not in response.headers


def test_an_unknown_email_and_a_wrong_code_are_indistinguishable(
    client: TestClient, mailer: RecordingMailer
):
    request_code(client)
    wrong = client.post(VERIFY, json={"email": EMAIL, "code": wrong_code(mailer.last_code)})
    unknown = client.post(VERIFY, json={"email": "nobody@example.com", "code": "123456"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_a_code_is_single_use(client: TestClient, mailer: RecordingMailer):
    request_code(client)
    code = mailer.last_code
    assert client.post(VERIFY, json={"email": EMAIL, "code": code}).status_code == 200
    again = client.post(VERIFY, json={"email": EMAIL, "code": code})
    assert again.status_code == 401
    assert again.json()["error"]["code"] == "invalid_code"


def fixed_codes(monkeypatch: pytest.MonkeyPatch, *codes: str) -> None:
    """Make the service issue ``codes`` in order, so two codes are guaranteed to differ."""
    issued = iter(codes)
    monkeypatch.setattr("app.services.auth.generate_code", lambda: next(issued))


def test_a_code_is_bound_to_the_email_it_was_sent_to(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    fixed_codes(monkeypatch, "111111", "222222")
    request_code(client, EMAIL)
    request_code(client, "bob@example.com")
    response = client.post(VERIFY, json={"email": "bob@example.com", "code": "111111"})
    assert response.status_code == 401


def test_a_newer_code_supersedes_an_older_one(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    fixed_codes(monkeypatch, "111111", "222222")
    request_code(client)
    request_code(client)
    assert client.post(VERIFY, json={"email": EMAIL, "code": "111111"}).status_code == 401
    assert client.post(VERIFY, json={"email": EMAIL, "code": "222222"}).status_code == 200


def test_an_expired_code_is_rejected_as_expired(
    timed_client: TestClient, mailer: RecordingMailer, clock: MutableClock
):
    request_code(timed_client)
    clock.instant = FROZEN_NOW + timedelta(minutes=10)
    response = timed_client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "code_expired"


def test_a_code_just_inside_its_lifetime_is_accepted(
    timed_client: TestClient, mailer: RecordingMailer, clock: MutableClock
):
    request_code(timed_client)
    clock.instant = FROZEN_NOW + timedelta(minutes=9, seconds=59)
    response = timed_client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    assert response.status_code == 200


def test_the_fifth_attempt_can_still_succeed(client: TestClient, mailer: RecordingMailer):
    request_code(client)
    code = mailer.last_code
    for _ in range(4):
        client.post(VERIFY, json={"email": EMAIL, "code": wrong_code(code)})
    assert client.post(VERIFY, json={"email": EMAIL, "code": code}).status_code == 200


def test_the_sixth_attempt_fails_even_with_the_right_code(
    client: TestClient, mailer: RecordingMailer
):
    """Five wrong guesses exhaust the code; the attempts must survive the error rollback."""
    request_code(client)
    code = mailer.last_code
    for _ in range(5):
        response = client.post(VERIFY, json={"email": EMAIL, "code": wrong_code(code)})
        assert response.status_code == 401
    exhausted = client.post(VERIFY, json={"email": EMAIL, "code": code})
    assert exhausted.status_code == 401
    assert exhausted.json()["error"]["code"] == "invalid_code"
    assert "set-cookie" not in exhausted.headers


@pytest.mark.parametrize(
    "body",
    [
        {"email": EMAIL, "code": "12345"},
        {"email": EMAIL, "code": "1234567"},
        {"email": EMAIL, "code": "12a456"},
        {"email": "not-an-email", "code": "123456"},
        {"email": "a@" + "b" * 260, "code": "123456"},
        {"email": EMAIL},
        {"email": EMAIL, "code": "123456", "extra": True},
    ],
)
def test_a_malformed_verify_request_is_a_validation_error(client: TestClient, body: dict):
    response = client.post(VERIFY, json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


@pytest.mark.parametrize("email", ["", "no-at-sign", "two@@example.com", "a b@example.com"])
def test_a_malformed_email_is_rejected_before_any_code_is_sent(
    client: TestClient, mailer: RecordingMailer, email: str
):
    response = client.post(REQUEST, json={"email": email})
    assert response.status_code == 422
    assert mailer.sent == []


# --- rate limit and allow-list -------------------------------------------------------


def test_codes_are_rate_limited_per_email(
    timed_client: TestClient, mailer: RecordingMailer, clock: MutableClock
):
    for _ in range(3):
        request_code(timed_client)
    limited = timed_client.post(REQUEST, json={"email": EMAIL})
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "too_many_requests"
    assert len(mailer.sent) == 3

    other = timed_client.post(REQUEST, json={"email": "bob@example.com"})
    assert other.status_code == 202, "the limit is per address"

    clock.instant = FROZEN_NOW + timedelta(minutes=15, seconds=1)
    request_code(timed_client)
    assert len(mailer.sent) == 5


def test_an_address_off_the_allow_list_gets_the_same_response_and_nothing_else():
    mailer = RecordingMailer()
    app = build_app(
        settings=make_test_settings(beta_allowed_emails=frozenset({EMAIL})), mailer=mailer
    )
    client = TestClient(app, raise_server_exceptions=False)

    allowed = client.post(REQUEST, json={"email": EMAIL})
    refused = client.post(REQUEST, json={"email": "mallory@example.com"})
    assert allowed.status_code == refused.status_code == 202
    assert allowed.json() == refused.json()
    assert [sent.email for sent in mailer.sent] == [EMAIL]

    with app.state.database.engine.connect() as connection:
        emails = connection.scalars(select(LoginCodeRow.email)).all()
    assert emails == [EMAIL], "nothing is stored for an address that may not sign in"

    for _ in range(5):
        assert client.post(REQUEST, json={"email": "mallory@example.com"}).status_code == 202


def test_an_address_removed_from_the_allow_list_cannot_use_an_issued_code():
    mailer = RecordingMailer()
    app = build_app(mailer=mailer)
    client = TestClient(app, raise_server_exceptions=False)
    request_code(client)
    app.state.settings = make_test_settings(beta_allowed_emails=frozenset({"x@y.z"}))
    response = client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "invalid_code"


# --- what is stored -------------------------------------------------------------------


def test_a_code_is_stored_only_as_an_hmac_keyed_with_the_auth_secret(
    app: FastAPI, client: TestClient, mailer: RecordingMailer
):
    request_code(client)
    code = mailer.last_code
    with app.state.database.engine.connect() as connection:
        [stored] = connection.scalars(select(LoginCodeRow.code_hash)).all()

    expected = hmac.new(
        TEST_AUTH_SECRET.encode(), f"{EMAIL}:{code}".encode(), hashlib.sha256
    ).hexdigest()
    assert stored == expected
    assert stored != hashlib.sha256(code.encode()).hexdigest(), "never a bare hash of the code"
    assert code not in stored


def test_a_different_auth_secret_cannot_verify_a_stored_code(mailer: RecordingMailer):
    """The secret is what makes a stored code useless: another deployment's key rejects it."""
    app = build_app(mailer=mailer)
    client = TestClient(app, raise_server_exceptions=False)
    request_code(client)
    app.state.settings = make_test_settings(auth_secret="another-secret-" + "z" * 40)
    response = client.post(VERIFY, json={"email": EMAIL, "code": mailer.last_code})
    assert response.status_code == 401


def test_a_session_token_is_stored_only_as_its_sha256(
    app: FastAPI, client: TestClient, mailer: RecordingMailer
):
    sign_in(client, mailer)
    token = client.cookies["ht_session"]
    with app.state.database.engine.connect() as connection:
        [stored] = connection.scalars(select(SessionRow.token_hash)).all()
    assert stored == hashlib.sha256(token.encode()).hexdigest()
    assert token not in stored


# --- startup ---------------------------------------------------------------------------


REQUIRED_ENV = {
    "HEALTHTREND_DATABASE_URL": "sqlite+pysqlite:///:memory:",
    "HEALTHTREND_AUTH_SECRET": TEST_AUTH_SECRET,
    "HEALTHTREND_COOKIE_SECURE": "false",
    "HEALTHTREND_MAILER": "console",
}


@pytest.mark.parametrize("missing", ["HEALTHTREND_DATABASE_URL", "HEALTHTREND_AUTH_SECRET"])
def test_the_server_refuses_to_start_without_a_required_setting(
    monkeypatch: pytest.MonkeyPatch, missing: str
):
    for name, value in REQUIRED_ENV.items():
        monkeypatch.setenv(name, value)
    monkeypatch.delenv(missing)
    with pytest.raises(ConfigurationError) as raised, TestClient(create_app()):
        pass
    assert missing in str(raised.value)


def test_the_server_starts_from_the_environment_when_configured(monkeypatch: pytest.MonkeyPatch):
    for name, value in REQUIRED_ENV.items():
        monkeypatch.setenv(name, value)
    with TestClient(create_app()) as client:
        assert client.get("/health").status_code == 200
        assert client.app.state.settings.cookie_secure is False  # type: ignore[attr-defined]


def test_importing_the_application_needs_no_credentials(monkeypatch: pytest.MonkeyPatch):
    """The OpenAPI regeneration script builds the app with no settings at all."""
    for name in REQUIRED_ENV:
        monkeypatch.delenv(name, raising=False)
    assert "/api/me" in create_app().openapi()["paths"]
