"""The current instant, as an injected dependency rather than a global.

The numerical core may not read the clock: ``tests/core/test_architecture_purity.py``
forbids it, because a core that consulted the current time would not be deterministically
testable and the golden regression fixture would quietly stop meaning anything.

But "what is my 30-day forecast?" is a question about now. ADR-0005 resolved that by
making the forecast origin an explicit parameter, leaving the API layer to supply it. This
module is the one place in production code that reads the system clock, which is what
makes the whole HTTP surface testable: a test overrides the dependency with a fixed clock
and every response becomes reproducible.

Test doubles deliberately live in the test suite, not here. Production code has no use for
a settable clock, and shipping one invites it to be used.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol, runtime_checkable


@runtime_checkable
class Clock(Protocol):
    """A source of the current instant."""

    def now(self) -> datetime:
        """Return the current instant as a timezone-aware UTC datetime."""
        ...


class SystemClock:
    """The real clock, reading UTC from the operating system."""

    def now(self) -> datetime:
        """Return the current instant in UTC."""
        return datetime.now(UTC)
