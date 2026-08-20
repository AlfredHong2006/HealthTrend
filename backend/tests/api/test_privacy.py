"""No submitted value may appear in a response body or a log record.

The technique throughout is a **sentinel**: a weight and a timestamp chosen to be unique
enough that finding them anywhere is proof of a leak, and finding them nowhere is meaningful
evidence rather than an accident of formatting. Both are checked, because they leak by
different routes -- a weight through Pydantic's ``input`` echo, a timestamp through a
stringified exception or a URL.

``docs/privacy.md`` is the governing rule. This file is the enforcement.
"""

from __future__ import annotations

import json
import logging
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.schemas.analysis import MAX_OBSERVATIONS
from tests.api.conftest import FROZEN_NOW

SENTINEL_WEIGHT = 77.7777
SENTINEL_WEIGHT_TEXT = "77.7777"
SENTINEL_TIMESTAMP = "2029-03-03T03:33:33"
SENTINEL_TIMESTAMP_FRAGMENTS = ("2029-03-03", "03:33:33", "2029")

JSON_HEADERS = {"content-type": "application/json"}


def assert_no_sentinels(text: str, *, context: str) -> None:
    """Fail if either sentinel, or a recognisable fragment of one, appears in ``text``."""
    assert SENTINEL_WEIGHT_TEXT not in text, f"the submitted weight leaked into {context}"
    assert "77.7777" not in text, f"the submitted weight leaked into {context}"
    for fragment in SENTINEL_TIMESTAMP_FRAGMENTS:
        assert fragment not in text, f"the submitted timestamp leaked into {context}: {fragment}"


APPLICATION_LOGGER_PREFIX = "healthtrend"


def captured_log_text(caplog: pytest.LogCaptureFixture) -> str:
    """Render the application's own log records the way an aggregator would receive them.

    Scoped to the ``healthtrend`` loggers on purpose. ``caplog`` also captures the *test
    client's* records, and ``httpx2`` logs the URL it requested -- but that is the test
    harness talking about its own outbound call, not the server writing a log line. There is
    no HTTP client in the running application.

    Uvicorn's built-in access log is a separate matter: it *does* record raw request paths,
    which is why the documented run command disables it and this middleware exists instead.
    See ``docs/privacy.md``.
    """
    return "\n".join(
        f"{record.name} {record.levelname} {record.getMessage()}"
        for record in caplog.records
        if record.name.startswith(APPLICATION_LOGGER_PREFIX)
    )


def test_the_application_writes_log_records_at_all(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    """Guard against every log assertion below passing because nothing was captured."""
    with caplog.at_level(logging.DEBUG):
        client.get("/health")
    assert captured_log_text(caplog).strip()


# --- validation failures --------------------------------------------------


def test_a_naive_timestamp_failure_echoes_neither_sentinel(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    """The classic leak: Pydantic's default error detail carries the offending input."""
    with caplog.at_level(logging.DEBUG):
        response = client.post(
            "/api/analyse",
            json={
                "observations": [
                    {"timestamp": SENTINEL_TIMESTAMP, "weight": SENTINEL_WEIGHT, "unit": "kg"}
                ]
            },
        )
    assert response.status_code == 422
    assert_no_sentinels(response.text, context="the validation response body")
    assert_no_sentinels(captured_log_text(caplog), context="the log")


def test_a_bad_weight_failure_echoes_neither_sentinel(client: TestClient):
    response = client.post(
        "/api/analyse",
        json={
            "observations": [
                {
                    "timestamp": SENTINEL_TIMESTAMP + "+00:00",
                    "weight": -SENTINEL_WEIGHT,
                    "unit": "kg",
                }
            ]
        },
    )
    assert response.status_code == 422
    assert_no_sentinels(response.text, context="the validation response body")


def test_an_unknown_field_name_is_not_echoed_back(client: TestClient):
    """A caller controls field names too, so a location is filtered to identifiers."""
    response = client.post(
        "/api/analyse",
        json={
            "observations": [
                {
                    "timestamp": SENTINEL_TIMESTAMP + "+00:00",
                    "weight": 72.0,
                    SENTINEL_WEIGHT_TEXT: 1,
                }
            ]
        },
    )
    assert response.status_code == 422
    assert_no_sentinels(response.text, context="the validation response body")
    assert response.json()["error"]["details"][0]["location"].endswith("<field>")


def test_malformed_json_containing_a_sentinel_is_not_echoed(client: TestClient):
    body = f'{{"observations": [{{"weight": {SENTINEL_WEIGHT_TEXT},'
    response = client.post("/api/analyse", content=body.encode(), headers=JSON_HEADERS)
    assert response.status_code == 422
    assert_no_sentinels(response.text, context="the validation response body")


def test_an_over_length_series_is_not_echoed(client: TestClient):
    observations = [{"timestamp": SENTINEL_TIMESTAMP + "+00:00", "weight": SENTINEL_WEIGHT}] * (
        MAX_OBSERVATIONS + 1
    )
    response = client.post("/api/analyse", json={"observations": observations})
    assert response.status_code == 422
    assert_no_sentinels(response.text, context="the validation response body")


# --- domain failures ------------------------------------------------------


def test_a_future_observation_rejection_echoes_neither_sentinel(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    with caplog.at_level(logging.DEBUG):
        response = client.post(
            "/api/analyse",
            json={
                "observations": [
                    {"timestamp": SENTINEL_TIMESTAMP + "+00:00", "weight": SENTINEL_WEIGHT}
                ]
            },
        )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "observation_in_the_future"
    assert_no_sentinels(response.text, context="the domain-error response body")
    assert_no_sentinels(captured_log_text(caplog), context="the log")


def test_the_error_envelope_has_no_room_for_a_value(client: TestClient):
    """Structural check: the envelope's own schema cannot carry an input value."""
    response = client.post(
        "/api/analyse",
        json={"observations": [{"timestamp": SENTINEL_TIMESTAMP, "weight": SENTINEL_WEIGHT}]},
    )
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details"}
    for detail in body["error"]["details"]:
        assert set(detail) == {"location", "code", "message"}


# --- unexpected failures --------------------------------------------------


def test_an_unexpected_exception_leaks_into_neither_the_body_nor_the_logs(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    monkeypatch: pytest.MonkeyPatch,
):
    """The catch-all is a privacy control, and it covers the logs, not just the body.

    An unexpected exception is precisely the case where we have least confidence about
    what its message contains -- a third-party exception can quote a value. So the
    response is a fixed envelope, and the application log records only that an unhandled
    exception of a given class occurred: no message, no traceback. The exception must
    also not propagate to the server (Starlette would re-raise it and uvicorn would
    print the traceback), which is why the logging middleware converts it rather than
    re-raising.
    """

    def explode(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError(f"weight was {SENTINEL_WEIGHT_TEXT} at {SENTINEL_TIMESTAMP}")

    monkeypatch.setattr("app.api.routes.analyse_submitted", explode)
    with caplog.at_level(logging.DEBUG):
        response = client.post(
            "/api/analyse",
            json={"observations": [{"timestamp": "2026-05-01T07:00:00Z", "weight": 72.0}]},
        )

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "internal_error",
            "message": "An unexpected error occurred while processing the request.",
            "details": [],
        }
    }
    assert "Traceback" not in response.text
    assert_no_sentinels(response.text, context="the 500 response body")

    text = captured_log_text(caplog)
    assert "unhandled RuntimeError" in text, "the failure itself must still be recorded"
    assert "Traceback" not in text
    assert_no_sentinels(text, context="the log")


# --- successful requests --------------------------------------------------


def test_a_successful_request_logs_counts_and_nothing_else(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    weight = 73.21
    timestamp = (FROZEN_NOW - timedelta(days=3)).isoformat()
    with caplog.at_level(logging.DEBUG):
        response = client.post(
            "/api/analyse", json={"observations": [{"timestamp": timestamp, "weight": weight}]}
        )
    assert response.status_code == 200

    text = captured_log_text(caplog)
    assert "n_obs=1" in text
    assert "/api/analyse" in text
    assert str(weight) not in text
    assert timestamp[:10] not in text


def test_the_access_log_records_the_route_template_not_the_raw_path(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    with caplog.at_level(logging.DEBUG):
        client.get("/api/demo/gradual-loss")
    text = captured_log_text(caplog)
    assert "/api/demo/{scenario}" in text
    assert "gradual-loss" not in text


def test_an_unmatched_path_is_not_copied_into_the_log(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    """An unrouted path is an arbitrary caller-supplied string. Do not store one."""
    with caplog.at_level(logging.DEBUG):
        client.get(f"/{SENTINEL_WEIGHT_TEXT}/{SENTINEL_TIMESTAMP}")
    text = captured_log_text(caplog)
    assert "<unmatched>" in text
    assert_no_sentinels(text, context="the log")


def test_a_matched_route_with_a_caller_controlled_parameter_is_not_logged_raw(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    """Regression: the raw path of a *matched* parameterised route is caller-controlled too.

    The unmatched-path test above cannot catch this, because an unmatched request never
    reaches the domain-error handler. This one does: the scenario id embeds both sentinels,
    the route matches `/api/demo/{scenario}`, the lookup fails, and the rejection plus the
    access line must both log without reproducing what the caller typed. This exact channel
    leaked before the error handlers stopped logging `request.scope["path"]`.
    """
    with caplog.at_level(logging.DEBUG):
        response = client.get(f"/api/demo/{SENTINEL_WEIGHT_TEXT}-and-{SENTINEL_TIMESTAMP}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "unknown_scenario"

    text = captured_log_text(caplog)
    assert "/api/demo/{scenario}" in text, "the access line should still identify the route"
    assert "unknown_scenario" in text, "the rejection should still be recorded by its code"
    assert_no_sentinels(text, context="the log")
    assert_no_sentinels(response.text, context="the 404 response body")


def test_no_filter_diagnostics_reach_the_response(client: TestClient):
    """The model inspector is a later milestone; its internals stay internal for now."""
    response = client.post(
        "/api/analyse",
        json={"observations": [{"timestamp": "2026-05-01T07:00:00Z", "weight": 72.0}]},
    )
    body = json.dumps(response.json())
    for internal in ("loglik", "innovation", "gain", '"P"', "v_kg_per_day", "v_sd"):
        assert internal not in body
