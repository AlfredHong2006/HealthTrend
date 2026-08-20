"""Normalise submitted weigh-ins into core observations.

Four jobs, each of which the numerical core explicitly refuses to do:

1. **Unit conversion.** Pounds become kilograms through
   :func:`app.core.units.lb_to_kg`, the one place in the project that knows the
   conversion factor. The core accepts kilograms and nothing else, so that no downstream
   computation has to check a unit tag (ADR-0001).
2. **UTC normalisation.** Offsets are collapsed to UTC by
   :class:`app.core.types.Observation` itself, which routes through
   :func:`app.core.time_axis.require_utc_aware`. Naive timestamps never reach here: the
   request schema types the field as ``AwareDatetime``, so a missing offset is a validation
   failure with a sanitised message rather than a guess about somebody's timezone.
3. **Chronological ordering.** :func:`app.core.filter.run_filter` raises
   :class:`app.core.types.UnsortedObservationsError` rather than reordering, precisely so
   that an upstream bug surfaces instead of hiding. Sorting is therefore ingestion's
   responsibility, and it is done with a stable sort so that readings recorded at the same
   instant keep the order they were submitted in.
4. **Keeping everything.** No de-duplication, no daily median, no preferred-morning
   selection. ADR-0004 decided to keep every observation: ``dt = 0`` makes simultaneous
   readings exact rather than a special case, and the daily-median alternative is a
   deliberately separate experiment with its own evaluation. Nothing in this milestone
   pre-empts that.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.core.types import Observation
from app.core.units import lb_to_kg
from app.schemas.analysis import ObservationIn


def normalise_observations(submitted: Sequence[ObservationIn]) -> tuple[Observation, ...]:
    """Convert submitted weigh-ins into chronological core observations.

    Args:
        submitted: validated request observations, in any order.

    Returns:
        Observations in kilograms and UTC, sorted by timestamp, with duplicates and
        same-instant readings retained.

    Raises:
        CoreError: if a weight is not a finite positive number of kilograms. The request
            schema already rejects those, so this is a backstop rather than the primary
            check.
    """
    observations = [
        Observation(timestamp=item.timestamp, weight_kg=_weight_kg(item)) for item in submitted
    ]
    observations.sort(key=lambda observation: observation.timestamp)
    return tuple(observations)


def _weight_kg(item: ObservationIn) -> float:
    """Return the submitted weight in kilograms."""
    return item.weight if item.unit == "kg" else lb_to_kg(item.weight)
