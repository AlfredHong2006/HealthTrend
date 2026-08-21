"""``POST /api/ingest/csv``: the HTTP boundary around :func:`app.ingestion.csv.parse_csv`.

Parser behaviour (header aliases, DST, unit conflicts, row rejections) is covered directly
in ``test_csv_parser.py``. This file covers what only exists at the HTTP layer: the raw-body
transport, Content-Type enforcement, the byte-size cap, CORS, privacy, and -- the one thing
that proves the whole design -- that the ingest response's ``accepted`` list can be posted
straight into ``POST /api/analyse`` with no conversion.
"""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from app.schemas.ingestion import MAX_CSV_BYTES
from tests.api.conftest import FROZEN_NOW

SENTINEL_WEIGHT_TEXT = "77.7777"
SENTINEL_TIMESTAMP_FRAGMENT = "2029-03-03"
APPLICATION_LOGGER_PREFIX = "healthtrend"


def post_csv(
    client: TestClient,
    text: str,
    *,
    assumed_timezone: str = "UTC",
    default_unit: str = "kg",
    content_type: str | None = "text/csv",
):
    headers = {"content-type": content_type} if content_type is not None else {}
    return client.post(
        "/api/ingest/csv",
        params={"assumed_timezone": assumed_timezone, "default_unit": default_unit},
        content=text.encode("utf-8"),
        headers=headers,
    )


def captured_log_text(caplog: pytest.LogCaptureFixture) -> str:
    return "\n".join(
        f"{record.name} {record.levelname} {record.getMessage()}"
        for record in caplog.records
        if record.name.startswith(APPLICATION_LOGGER_PREFIX)
    )


WELL_FORMED_CSV = "timestamp,weight\n2026-05-01T07:00:00Z,72.4\n2026-05-08T07:00:00Z,71.9\n"


# --- happy path and the ingest -> analyse contract --------------------------


def test_a_well_formed_csv_is_accepted(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 2
    assert body["rejected_count"] == 0
    assert body["duplicate_count"] == 0
    assert [obs["weight"] for obs in body["accepted"]] == [72.4, 71.9]
    assert all(obs["unit"] == "kg" for obs in body["accepted"])


def test_the_accepted_observations_can_be_posted_directly_to_analyse(client: TestClient):
    """The contract §12a exists to prove: no browser-side conversion is needed or possible."""
    ingested = post_csv(client, WELL_FORMED_CSV).json()

    response = client.post(
        "/api/analyse",
        json={"observations": ingested["accepted"], "forecast_from": "now"},
    )
    assert response.status_code == 200
    assert response.json()["n_obs"] == 2


def test_mixed_units_are_converted_before_reaching_accepted(client: TestClient):
    text = "timestamp,weight,unit\n2026-05-01T07:00:00Z,160.0,lb\n2026-05-02T07:00:00Z,72.4,kg\n"
    response = post_csv(client, text)
    weights = [obs["weight"] for obs in response.json()["accepted"]]
    assert weights[0] == pytest.approx(160.0 * 0.45359237)
    assert weights[1] == 72.4


def test_duplicate_rows_are_retained_and_counted(client: TestClient):
    text = (
        "timestamp,weight\n"
        "2026-05-01T07:00:00Z,72.0\n"
        "2026-05-01T07:00:00Z,72.0\n"
        "2026-05-01T07:00:00Z,72.0\n"
        "2026-05-02T07:00:00Z,71.9\n"
    )
    body = post_csv(client, text).json()
    assert body["accepted_count"] == 4
    assert body["duplicate_count"] == 2  # three identical readings -> 2 beyond the first


def test_a_file_with_no_valid_rows_returns_a_200_report_not_an_error(client: TestClient):
    text = "timestamp,weight\nnot a date,abc\n"
    response = post_csv(client, text)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 0
    assert body["rejected_count"] == 1
    assert body["accepted"] == []


# --- Content-Type ------------------------------------------------------------


def test_a_missing_content_type_is_rejected(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV, content_type=None)
    assert response.status_code == 415
    assert response.json()["error"]["code"] == "unsupported_media_type"


def test_a_wrong_content_type_is_rejected(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV, content_type="application/json")
    assert response.status_code == 415


def test_content_type_parameters_are_tolerated(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV, content_type="text/csv; charset=utf-8")
    assert response.status_code == 200


def test_content_type_matching_is_case_insensitive(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV, content_type="Text/CSV")
    assert response.status_code == 200


# --- size cap ------------------------------------------------------------


def test_an_oversized_body_is_rejected(client: TestClient):
    padding = "x" * (MAX_CSV_BYTES + 1)
    text = f"timestamp,weight,notes\n2026-05-01T07:00:00Z,72.0,{padding}\n"
    assert len(text.encode()) > MAX_CSV_BYTES
    response = post_csv(client, text)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "csv_too_large"


def test_a_body_at_the_cap_is_accepted(client: TestClient):
    """Padding is spread across many rows, not one giant field: a single CSV field is
    capped by Python's own ``csv.field_size_limit`` (128 KiB by default) well below
    ``MAX_CSV_BYTES``, and a real file at this size would naturally be many rows anyway."""
    header = "timestamp,weight,notes\n"
    row_count = 9000
    prefix, suffix = "2026-01-01T00:00:00Z,72.0,", "\n"
    fixed_bytes = len(header.encode()) + row_count * len((prefix + suffix).encode())
    total_padding = MAX_CSV_BYTES - fixed_bytes
    base_padding, remainder = divmod(total_padding, row_count)
    rows = [
        prefix + ("x" * (base_padding + (1 if i < remainder else 0))) + suffix
        for i in range(row_count)
    ]
    text = header + "".join(rows)
    assert len(text.encode()) == MAX_CSV_BYTES
    response = post_csv(client, text)
    assert response.status_code == 200
    assert response.json()["accepted_count"] == row_count


# --- query-parameter validation ---------------------------------------------


def test_an_invalid_default_unit_is_rejected(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV, default_unit="stone")
    assert response.status_code == 422


def test_an_invalid_assumed_timezone_is_rejected(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV, assumed_timezone="Not/A_Real_Zone")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_timezone"


def test_an_invalid_default_unit_value_is_not_echoed_back(client: TestClient):
    response = post_csv(client, WELL_FORMED_CSV, default_unit=SENTINEL_WEIGHT_TEXT)
    assert response.status_code == 422
    assert SENTINEL_WEIGHT_TEXT not in response.text


def test_an_invalid_assumed_timezone_value_is_not_echoed_back(client: TestClient):
    response = post_csv(
        client, WELL_FORMED_CSV, assumed_timezone=f"Not/{SENTINEL_TIMESTAMP_FRAGMENT}"
    )
    assert response.status_code == 422
    assert SENTINEL_TIMESTAMP_FRAGMENT not in response.text


# --- privacy -------------------------------------------------------------


def test_a_bad_row_containing_a_sentinel_is_not_echoed(
    client: TestClient, caplog: pytest.LogCaptureFixture
):
    text = f"timestamp,weight\n{SENTINEL_TIMESTAMP_FRAGMENT}T03:33:33,{SENTINEL_WEIGHT_TEXT}x\n"
    with caplog.at_level(logging.DEBUG):
        response = post_csv(client, text)
    assert response.status_code == 200
    body = response.json()
    assert body["rejected"][0]["reason_code"] == "non_numeric_weight"
    assert SENTINEL_WEIGHT_TEXT not in response.text
    assert SENTINEL_TIMESTAMP_FRAGMENT not in response.text
    text_log = captured_log_text(caplog)
    assert SENTINEL_WEIGHT_TEXT not in text_log
    assert SENTINEL_TIMESTAMP_FRAGMENT not in text_log


def test_no_row_counts_are_logged(client: TestClient, caplog: pytest.LogCaptureFixture):
    """The access line still fires (route/status/elapsed), but n_obs stays unset ("-"):
    this route never calls record_observation_count, unlike /api/analyse and /api/demo."""
    with caplog.at_level(logging.DEBUG):
        post_csv(client, WELL_FORMED_CSV)
    text = captured_log_text(caplog)
    assert "/api/ingest/csv" in text
    assert "n_obs=-" in text
    assert "72.4" not in text
    assert "71.9" not in text


# --- CORS ------------------------------------------------------------------


def test_cors_preflight_permits_the_ingest_endpoint(monkeypatch: pytest.MonkeyPatch):
    from tests.api.conftest import build_app

    monkeypatch.setenv("HEALTHTREND_ALLOWED_ORIGINS", "http://localhost:3000")
    client = TestClient(build_app(), raise_server_exceptions=False)
    response = client.options(
        "/api/ingest/csv",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


# --- zero-span, end to end ---------------------------------------------------


def test_a_single_ingested_observation_shows_zero_span_when_analysed(client: TestClient):
    text = f"timestamp,weight\n{FROZEN_NOW.isoformat()},72.0\n"
    ingested = post_csv(client, text).json()
    response = client.post(
        "/api/analyse", json={"observations": ingested["accepted"], "forecast_from": "now"}
    )
    assert response.status_code == 200
    assert response.json()["span_days"] == 0
