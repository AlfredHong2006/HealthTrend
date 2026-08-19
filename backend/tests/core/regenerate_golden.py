"""Regenerate the golden analysis fixture.

Run from ``backend/``::

    uv run python -m tests.core.regenerate_golden

The scenario definition and the analysis are imported from
``tests.core.test_analyse_golden``, so the fixture and the test that reads it can never
end up describing different computations.

A diff in the generated file means the model changed. Review it as such -- that is the
whole point of committing it.
"""

from __future__ import annotations

import json

from testing.synthetic import gradual_loss_series
from tests.core.test_analyse_golden import (
    GOLDEN_PATH,
    GOLDEN_SCENARIO,
    GOLDEN_SEED,
    build_golden_result,
)


def main() -> None:
    """Write the fixture to disk."""
    series = gradual_loss_series(seed=GOLDEN_SEED, **GOLDEN_SCENARIO)
    payload = build_golden_result().to_dict()
    payload["_scenario"] = {
        "label": series.label,
        "generator": "testing.synthetic.gradual_loss_series",
        "seed": GOLDEN_SEED,
        **GOLDEN_SCENARIO,
    }

    GOLDEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    GOLDEN_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {GOLDEN_PATH} ({GOLDEN_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
