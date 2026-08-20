"""Regenerate the golden HTTP response fixture.

Run from ``backend/``::

    uv run python -m tests.api.regenerate_golden_api

The request, the frozen instant and the call are all imported from
``tests.api.test_golden_api``, so the fixture and the test that reads it can never end up
describing different computations. Mirrors ``tests/core/regenerate_golden.py``.

A diff in the generated file means the API contract or the model changed. Review it as such.
"""

from __future__ import annotations

import json

from tests.api.test_golden_api import (
    GOLDEN_NOW,
    GOLDEN_PATH,
    build_golden_response,
    golden_request,
)


def main() -> None:
    """Write the fixture to disk."""
    payload = build_golden_response()
    payload["_request"] = golden_request()
    payload["_frozen_now"] = GOLDEN_NOW.isoformat()
    payload["_note"] = (
        "Synthetic request built by tests.api.test_golden_api.golden_request. No real "
        "health data. Regenerate with: uv run python -m tests.api.regenerate_golden_api"
    )

    GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    GOLDEN_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {GOLDEN_PATH} ({GOLDEN_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
