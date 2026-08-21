"""The committed OpenAPI contract must match what the application actually serves.

``backend/openapi.json`` is committed so the frontend can generate TypeScript types from a
static file -- no running server, no Python, on a cold clone. That is only trustworthy if it
cannot silently drift from the real schema. This test is the guard: change a Pydantic model
or a route without regenerating the file, and the suite fails here rather than the frontend
quietly typechecking against a stale contract.
"""

from __future__ import annotations

import json

from tests.api.regenerate_openapi import OPENAPI_PATH, build_openapi_schema


def test_the_committed_contract_matches_the_live_schema():
    committed = json.loads(OPENAPI_PATH.read_text(encoding="utf-8"))
    live = build_openapi_schema()
    assert committed == live, (
        "backend/openapi.json is out of date. Regenerate it with: "
        "uv run python -m tests.api.regenerate_openapi"
    )


def test_the_committed_contract_is_openapi_3_1():
    committed = json.loads(OPENAPI_PATH.read_text(encoding="utf-8"))
    assert committed["openapi"].startswith("3.1")


def test_the_committed_contract_covers_every_route():
    committed = json.loads(OPENAPI_PATH.read_text(encoding="utf-8"))
    assert set(committed["paths"]) == {
        "/health",
        "/api/analyse",
        "/api/demo",
        "/api/demo/{scenario}",
    }
