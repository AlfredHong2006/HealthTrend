"""Shared route dependencies.

Only one so far, and it is the important one: the clock. Reading the current instant through
a dependency rather than calling ``datetime.now`` inside a route is what makes the whole HTTP
surface reproducible -- a test overrides :func:`get_clock` with a fixed clock and every
timestamp, forecast origin and demo series becomes deterministic.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.services.clock import Clock, SystemClock


def get_clock() -> Clock:
    """Return the clock the application uses. Overridden in tests."""
    return SystemClock()


ClockDep = Annotated[Clock, Depends(get_clock)]
"""The injected clock.

Declared with ``Annotated`` rather than a ``Depends()`` default so that a route signature
stays a plain annotated parameter list.
"""
