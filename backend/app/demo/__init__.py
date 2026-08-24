"""Synthetic product-demo scenarios.

ADR-0007: a visitor should not need an iPhone, an Apple Health export or an
account to see what this product does. So the API ships believable generated series that
exercise the shapes the estimator is supposed to handle.

This package is deliberately *not* ``backend/testing/synthetic.py``. That module is
test-support code, it is frozen as part of Milestone 1, and it holds fixtures chosen to pin
mathematical properties -- noise-free linear ramps, model-consistent draws for calibration.
A demo needs different things: plausible weights, a plateau, a reversal, and a last
measurement near today. Those are product requirements, so they live in the application and
are tested as application behaviour. Production code never imports the ``testing`` package;
``tests/test_layering.py`` enforces that rather than trusting it.

Nothing here imports FastAPI or the HTTP schemas. A scenario is a plain
:class:`app.demo.scenarios.DemoSeries` of :class:`app.core.types.Observation`, so the demo
is usable from a script or a test without an HTTP layer.
"""

from app.demo.scenarios import (
    SCENARIO_IDS,
    DemoSeries,
    ScenarioSpec,
    catalogue,
    generate,
)

__all__ = [
    "SCENARIO_IDS",
    "DemoSeries",
    "ScenarioSpec",
    "catalogue",
    "generate",
]
