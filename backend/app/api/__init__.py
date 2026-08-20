"""The HTTP layer: routing, error shaping and request logging.

This is the only package that imports FastAPI. Everything below it -- services, ingestion,
demo, schemas, core -- is callable from a script or a test with no web framework present,
which is what keeps the numerical work testable without HTTP in the way.

The layer is intentionally thin. A route validates, resolves the clock, calls one service
function, and returns its result. No route contains a decision about the model, the
mathematics or what a trend means.
"""

from typing import Final

APP_VERSION: Final = "0.1.0"
"""The published API version.

Mirrors ``version`` in ``pyproject.toml``; ``tests/api/test_health.py`` asserts they agree,
because the project is not installed as a distribution and so cannot read its own metadata.
"""
