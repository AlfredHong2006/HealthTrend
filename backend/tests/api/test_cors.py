"""CORS: the browser access-control boundary the real-data and sign-in routes need.

Three properties matter more than "it returns the header": the allow-list is fail-closed (an
unconfigured or non-matching origin gets nothing, never a wildcard); credentials -- the session
cookie -- are allowed only together with an exact configured origin, and a wildcard allow-list
is refused outright; and the header survives
every response shape this API can produce -- success, a validation 422, and the logging
middleware's own fixed 500 for an unhandled exception. That last one is the regression this
suite exists to prevent: CORSMiddleware is only useful if it wraps everything else, and it
is registered after the logging middleware specifically so that it does.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.errors import ConfigurationError
from tests.api.conftest import FROZEN_NOW, build_app

ALLOWED_ORIGIN = "http://localhost:3000"
DISALLOWED_ORIGIN = "http://evil.example"

ANALYSE_BODY = {"observations": [{"timestamp": "2026-05-01T07:00:00Z", "weight": 72.0}]}


def cors_client(origins_csv: str, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """A client whose app was built with ``HEALTHTREND_ALLOWED_ORIGINS`` set to ``origins_csv``.

    The env var must be set *before* ``create_app()`` runs, because
    :func:`app.config.allowed_origins` is read once, at app-construction time, into
    ``CORSMiddleware``'s own configuration -- not re-read per request.
    """
    monkeypatch.setenv("HEALTHTREND_ALLOWED_ORIGINS", origins_csv)
    return TestClient(build_app(), raise_server_exceptions=False)


# --- the allow-list ---------------------------------------------------------


def test_the_allowed_origin_receives_the_header(monkeypatch: pytest.MonkeyPatch):
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.get("/health", headers={"Origin": ALLOWED_ORIGIN})
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_a_disallowed_origin_receives_no_header(monkeypatch: pytest.MonkeyPatch):
    """The request still succeeds server-side -- CORS restricts what a browser may *read*,
    never what this API accepts -- but nothing tells the browser it may expose the response."""
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.get("/health", headers={"Origin": DISALLOWED_ORIGIN})
    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers


def test_an_unconfigured_allow_list_permits_no_origin(monkeypatch: pytest.MonkeyPatch):
    """Fail closed: an unset/empty env var is 'allow nothing', not 'allow everything'."""
    client = cors_client("", monkeypatch)
    response = client.get("/health", headers={"Origin": ALLOWED_ORIGIN})
    assert "access-control-allow-origin" not in response.headers


def test_credentials_are_allowed_for_the_configured_origin(monkeypatch: pytest.MonkeyPatch):
    """The session cookie only reaches a browser page if credentials are allowed for it."""
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.get("/health", headers={"Origin": ALLOWED_ORIGIN})
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_credentials_are_never_usable_by_a_disallowed_origin(monkeypatch: pytest.MonkeyPatch):
    """A browser exposes a credentialed response only when the allow-origin header names the
    requesting origin exactly. A disallowed origin never receives that header, so credentials
    are unusable from it whatever else the response carries."""
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.get(
        "/api/me", headers={"Origin": DISALLOWED_ORIGIN, "Cookie": "ht_session=anything"}
    )
    assert "access-control-allow-origin" not in response.headers


def test_credentials_are_never_combined_with_a_wildcard(monkeypatch: pytest.MonkeyPatch):
    """With a cookie present, the exact origin is echoed, never '*'."""
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.get(
        "/health", headers={"Origin": ALLOWED_ORIGIN, "Cookie": "ht_session=anything"}
    )
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.headers["access-control-allow-credentials"] == "true"


def test_a_wildcard_allow_list_is_refused_at_construction(monkeypatch: pytest.MonkeyPatch):
    """Starlette would answer a credentialed request from *any* origin under a '*' allow-list,
    which would let any website act as the signed-in user. So the configuration is refused."""
    monkeypatch.setenv("HEALTHTREND_ALLOWED_ORIGINS", f"{ALLOWED_ORIGIN},*")
    with pytest.raises(ConfigurationError):
        build_app()


def test_preflight_permits_the_methods_the_account_routes_use(monkeypatch: pytest.MonkeyPatch):
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.options(
        "/api/me",
        headers={"Origin": ALLOWED_ORIGIN, "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    allowed = response.headers["access-control-allow-methods"]
    for method in ("GET", "POST", "PUT", "DELETE"):
        assert method in allowed
    assert response.headers["access-control-allow-credentials"] == "true"


def test_no_wildcard_is_ever_echoed(monkeypatch: pytest.MonkeyPatch):
    """The header names the exact configured origin, never '*'."""
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.get("/health", headers={"Origin": ALLOWED_ORIGIN})
    assert response.headers["access-control-allow-origin"] != "*"


def test_multiple_configured_origins_are_each_honoured(monkeypatch: pytest.MonkeyPatch):
    other_origin = "https://app.example.com"
    client = cors_client(f"{ALLOWED_ORIGIN},{other_origin}", monkeypatch)
    for origin in (ALLOWED_ORIGIN, other_origin):
        response = client.get("/health", headers={"Origin": origin})
        assert response.headers["access-control-allow-origin"] == origin


# --- preflight ---------------------------------------------------------


def test_preflight_permits_a_post_from_the_allowed_origin(monkeypatch: pytest.MonkeyPatch):
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.options(
        "/api/analyse",
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "POST" in response.headers["access-control-allow-methods"]


def test_preflight_from_a_disallowed_origin_is_rejected(monkeypatch: pytest.MonkeyPatch):
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.options(
        "/api/analyse",
        headers={
            "Origin": DISALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert "access-control-allow-origin" not in response.headers


# --- the header must survive every response shape --------------------------


def test_the_header_survives_a_successful_analysis(monkeypatch: pytest.MonkeyPatch):
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.post("/api/analyse", json=ANALYSE_BODY, headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_the_header_survives_a_validation_error(monkeypatch: pytest.MonkeyPatch):
    """A 422 the browser cannot read is indistinguishable, to the user, from a hang."""
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    response = client.post(
        "/api/analyse", json={"observations": []}, headers={"Origin": ALLOWED_ORIGIN}
    )
    assert response.status_code == 422
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_the_header_survives_a_domain_error(monkeypatch: pytest.MonkeyPatch):
    """The future-observation rejection: the one domain error this form can realistically hit."""
    client = cors_client(ALLOWED_ORIGIN, monkeypatch)
    future = (FROZEN_NOW + timedelta(days=1)).isoformat()
    response = client.post(
        "/api/analyse",
        json={"observations": [{"timestamp": future, "weight": 72.0}]},
        headers={"Origin": ALLOWED_ORIGIN},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "observation_in_the_future"
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_the_header_survives_the_unhandled_exception_backstop(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
):
    """The regression this suite exists for.

    ``log_request`` (registered before CORS) catches an unhandled exception and returns the
    fixed 500 *itself*, without re-raising. If CORS were registered before -- and therefore
    wrapped by -- that middleware, this exact response would leave the process with no CORS
    header, and the browser would report an opaque network failure instead of a real 500.
    """
    monkeypatch.setenv("HEALTHTREND_ALLOWED_ORIGINS", ALLOWED_ORIGIN)

    def explode(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr("app.api.routes.analyse_submitted", explode)
    with caplog.at_level(logging.DEBUG):
        response = TestClient(build_app(), raise_server_exceptions=False).post(
            "/api/analyse", json=ANALYSE_BODY, headers={"Origin": ALLOWED_ORIGIN}
        )
    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
