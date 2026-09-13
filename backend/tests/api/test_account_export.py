"""The two exports: a complete JSON snapshot, and a re-importable measurement CSV.

Deliberately two different files with two different jobs (Stage 3 brief §6): the JSON export
states everything HealthTrend stores about the account, and only that; the CSV export carries
measurement values alone, in the exact three-column shape ``POST /api/ingest/csv`` already
accepts, proven by round-tripping an export through it.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.core.units import lb_to_kg
from tests.api.conftest import FROZEN_NOW, RecordingMailer, sign_in_as

EXPORT = "/api/me/export"
EXPORT_CSV = "/api/me/export/measurements.csv"
MEASUREMENTS = "/api/me/measurements"

EMAIL = "alice@example.com"

SERIES = [
    {"timestamp": (FROZEN_NOW - timedelta(days=days)).isoformat(), "weight": weight, "unit": unit}
    for days, weight, unit in ((10, 82.4, "kg"), (5, 181.0, "lb"), (2, 81.6, "kg"))
]


def store_series(client: TestClient) -> None:
    for observation in SERIES:
        assert client.post(MEASUREMENTS, json=observation).status_code == 201


# --- JSON export --------------------------------------------------------------------------


def test_the_json_export_requires_a_session(client: TestClient):
    assert client.get(EXPORT).status_code == 401


def test_the_json_export_contains_exactly_what_is_stored(
    client: TestClient, mailer: RecordingMailer
):
    signed_in = sign_in_as(client, mailer, EMAIL)
    store_series(client)
    client.put("/api/me/preferences", json={"display_unit": "lb"})
    client.put("/api/me/goal", json={"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4})

    response = client.get(EXPORT)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()

    assert set(body) == {
        "export_version",
        "exported_at",
        "account",
        "preferences",
        "goal",
        "measurements",
    }
    assert body["export_version"] == 1
    assert body["account"] == signed_in["user"]
    assert body["preferences"] == {"display_unit": "lb"}
    assert body["goal"] == {"target_weight_kg": 75.0, "target_weekly_rate_kg": -0.4}
    assert len(body["measurements"]) == len(SERIES)
    assert {measurement["weight"] for measurement in body["measurements"]} == {
        item["weight"] for item in SERIES
    }
    for measurement in body["measurements"]:
        assert set(measurement) == {
            "id",
            "timestamp",
            "weight",
            "unit",
            "source",
            "created_at",
            "updated_at",
        }


def test_the_json_export_reflects_no_goal_and_default_preferences(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    body = client.get(EXPORT).json()
    assert body["goal"] is None
    assert body["preferences"] == {"display_unit": "kg"}
    assert body["measurements"] == []


def test_the_json_export_does_not_claim_provider_backups_or_unstored_data(
    client: TestClient, mailer: RecordingMailer
):
    """A cheap, durable guard against the export's own field set drifting into overclaiming."""
    sign_in_as(client, mailer, EMAIL)
    body = client.get(EXPORT).json()
    rendered = str(body).lower()
    for forbidden in ("backup", "provider", "everything you have ever"):
        assert forbidden not in rendered


def test_json_export_is_scoped_to_the_account(client: TestClient, mailer: RecordingMailer):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)

    bobs_client = TestClient(client.app, raise_server_exceptions=False)
    sign_in_as(bobs_client, mailer, "bob@example.com")
    assert bobs_client.get(EXPORT).json()["measurements"] == []


# --- CSV export and its round-trip through the existing importer ---------------------------


def test_the_csv_export_requires_a_session(client: TestClient):
    assert client.get(EXPORT_CSV).status_code == 401


def test_the_csv_export_has_the_exact_three_column_header(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    response = client.get(EXPORT_CSV)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["cache-control"] == "no-store"
    assert "attachment" in response.headers["content-disposition"]
    lines = response.text.strip("\r\n").splitlines()
    assert lines[0] == "timestamp,weight,unit"
    assert len(lines) == 1 + len(SERIES)


def test_an_empty_account_still_exports_a_header_only_csv(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    response = client.get(EXPORT_CSV)
    assert response.text.strip("\r\n") == "timestamp,weight,unit"


def test_the_csv_export_round_trips_through_the_existing_importer(
    client: TestClient, mailer: RecordingMailer
):
    """``accepted`` carries the same instants and the same kg-equivalent weights as stored.

    The importer itself converts every accepted row to kilograms (ADR-0010) and its
    timestamps serialise with a ``Z`` suffix rather than ``+00:00`` -- neither is a
    round-trip defect, so the comparison is by instant and by weight-in-kilograms, not by
    the exact original strings.
    """
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    csv_text = client.get(EXPORT_CSV).text

    ingested = client.post(
        "/api/ingest/csv",
        params={"assumed_timezone": "UTC", "default_unit": "kg"},
        content=csv_text.encode("utf-8"),
        headers={"content-type": "text/csv"},
    )
    assert ingested.status_code == 200
    body = ingested.json()
    assert body["rejected_count"] == 0
    accepted = body["accepted"]
    assert len(accepted) == len(SERIES)
    assert {item["unit"] for item in accepted} == {"kg"}

    def weight_kg(item: dict[str, object]) -> float:
        weight = float(item["weight"])  # type: ignore[arg-type]
        return weight if item["unit"] == "kg" else lb_to_kg(weight)

    stored = sorted(
        (datetime.fromisoformat(str(item["timestamp"])), round(weight_kg(item), 9))
        for item in SERIES
    )
    reimported = sorted(
        (datetime.fromisoformat(str(item["timestamp"])), round(weight_kg(item), 9))
        for item in accepted
    )
    assert reimported == stored


def test_reimporting_the_csv_export_into_the_same_account_is_idempotent(
    client: TestClient, mailer: RecordingMailer
):
    sign_in_as(client, mailer, EMAIL)
    store_series(client)
    csv_text = client.get(EXPORT_CSV).text
    ingested = client.post(
        "/api/ingest/csv",
        params={"assumed_timezone": "UTC", "default_unit": "kg"},
        content=csv_text.encode("utf-8"),
        headers={"content-type": "text/csv"},
    ).json()

    batch = client.post(
        "/api/me/measurements/batch",
        json={"observations": ingested["accepted"], "source": "csv"},
    )
    assert batch.json() == {"inserted_count": 0, "skipped_existing_count": len(SERIES)}
    assert client.get(MEASUREMENTS).json()["count"] == len(SERIES)
