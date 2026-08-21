"""Regenerate the committed OpenAPI contract.

Run from ``backend/``::

    uv run python -m tests.api.regenerate_openapi

The frontend milestone generates its TypeScript types from the committed file rather than
from a running server, so a cold clone with no Python installed can still typecheck. A diff
in the generated file means the public HTTP contract changed -- review it as such, the same
way ``tests/core/regenerate_golden.py`` and ``tests/api/regenerate_golden_api.py`` are
reviewed. ``test_openapi_contract.py`` fails the build if this file is out of date.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.main import create_app

OPENAPI_PATH = Path(__file__).parents[2] / "openapi.json"


def build_openapi_schema() -> dict[str, object]:
    """Return the application's OpenAPI schema as a plain dict."""
    schema: dict[str, object] = create_app().openapi()
    return schema


def main() -> None:
    """Write the schema to disk."""
    payload = build_openapi_schema()
    OPENAPI_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OPENAPI_PATH} ({OPENAPI_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
