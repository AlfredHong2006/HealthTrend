"""The time coordinate system used by the numerical core.

The state-space model is defined in continuous time, so every interval between two
weigh-ins is a real number of days rather than a step index. This module is the single
place where ``datetime`` values become floating-point days.

Two rules are enforced here:

1. **Timestamps must be timezone-aware.** A naive ``datetime`` does not identify an
   instant, so it is rejected rather than guessed at. Normalising timezones is the
   ingestion layer's job (master plan section 39); the core only accepts instants.
2. **Elapsed time is epoch-independent.** :meth:`TimeAxis.elapsed_days` subtracts the
   two datetimes directly, so results never depend on the choice of epoch. The epoch
   exists only to provide an absolute numeric coordinate for plotting and export.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Final

SECONDS_PER_DAY: Final = 86_400.0

DEFAULT_EPOCH: Final = datetime(2000, 1, 1, tzinfo=UTC)
"""Arbitrary fixed reference instant. Results do not depend on it (see rule 2 above)."""


def require_utc_aware(value: datetime, *, field_name: str = "timestamp") -> datetime:
    """Return ``value`` converted to UTC, rejecting naive datetimes.

    Raises:
        ValueError: if ``value`` carries no usable timezone information. Note that
            :class:`app.core.types.CoreError` also derives from ``ValueError``, so
            callers can catch every core input error uniformly.
    """
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        raise ValueError(
            f"{field_name} must be timezone-aware: a naive datetime does not identify "
            f"an instant, and the core will not guess a timezone"
        )
    return value.astimezone(UTC)


@dataclass(frozen=True, slots=True)
class TimeAxis:
    """Maps instants to fractional days and back.

    Attributes:
        epoch: the instant that corresponds to day zero.
    """

    epoch: datetime = DEFAULT_EPOCH

    def __post_init__(self) -> None:
        """Normalise the epoch to UTC, rejecting a naive value."""
        object.__setattr__(self, "epoch", require_utc_aware(self.epoch, field_name="epoch"))

    def to_days(self, value: datetime) -> float:
        """Return ``value`` as fractional days since :attr:`epoch`."""
        return self.elapsed_days(self.epoch, value)

    def to_datetime(self, days: float) -> datetime:
        """Return the instant ``days`` fractional days after :attr:`epoch`."""
        return self.epoch + timedelta(days=days)

    def elapsed_days(self, start: datetime, end: datetime) -> float:
        """Return ``end - start`` in fractional days.

        Computed by direct datetime subtraction, so the result is exactly independent
        of :attr:`epoch`. Negative results are allowed here; callers that require
        non-decreasing time check for that themselves.
        """
        delta = require_utc_aware(end, field_name="end") - require_utc_aware(
            start, field_name="start"
        )
        return delta.total_seconds() / SECONDS_PER_DAY

    def shift(self, value: datetime, days: float) -> datetime:
        """Return the instant ``days`` fractional days after ``value``."""
        return require_utc_aware(value) + timedelta(days=days)


DEFAULT_TIME_AXIS: Final = TimeAxis()
"""Shared axis used by default throughout the core."""
