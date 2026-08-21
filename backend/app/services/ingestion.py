"""The CSV-ingestion service call: parse, normalise, count duplicates, report.

Mirrors :mod:`app.services.analysis`'s role -- the thin layer between the HTTP boundary and
the lower-level ingestion/core code. It owns the one thing that needs the whole series at
once: counting exact duplicates. That does not belong in :mod:`app.ingestion.csv`, which
must not duplicate :func:`app.ingestion.observations.normalise_observations`'s unit
conversion just to compare weights, and it does not belong in the route, which stays a thin
dispatcher like every other route in this API.
"""

from __future__ import annotations

from collections import Counter
from typing import Literal

from app.core.types import Observation
from app.errors import CsvUndecodableTextError
from app.ingestion import normalise_observations
from app.ingestion.csv import parse_csv
from app.schemas.analysis import ObservationIn
from app.schemas.ingestion import CsvIngestResponse


def ingest_csv(
    raw_bytes: bytes, *, assumed_timezone: str, default_unit: Literal["kg", "lb"]
) -> CsvIngestResponse:
    """Parse a CSV upload into observations ready for ``POST /api/analyse``.

    Raises:
        CsvUndecodableTextError: the bytes are not valid UTF-8 text.
        (See :func:`app.ingestion.csv.parse_csv` for every other failure this can raise.)
    """
    text = _decode(raw_bytes)
    parsed = parse_csv(text, assumed_timezone=assumed_timezone, default_unit=default_unit)

    # normalise_observations([]) is already safe (an empty list sorts to an empty tuple),
    # but an explicit guard means this call never depends on that being true.
    canonical = normalise_observations(parsed.accepted) if parsed.accepted else ()
    duplicate_count = _count_duplicate_occurrences(canonical)
    accepted = [
        ObservationIn(timestamp=observation.timestamp, weight=observation.weight_kg, unit="kg")
        for observation in canonical
    ]

    return CsvIngestResponse(
        accepted=accepted,
        rejected=parsed.issues,
        issues_truncated=parsed.issues_truncated,
        accepted_count=len(accepted),
        rejected_count=parsed.rejected_count,
        duplicate_count=duplicate_count,
        blank_rows_skipped=parsed.blank_rows_skipped,
        naive_timestamp_count=parsed.naive_timestamp_count,
        date_only_count=parsed.date_only_count,
    )


def _decode(raw_bytes: bytes) -> str:
    """Decode as UTF-8, tolerating (and stripping) a byte-order mark."""
    try:
        return raw_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise CsvUndecodableTextError("the file is not valid UTF-8 text") from exc


def _count_duplicate_occurrences(observations: tuple[Observation, ...]) -> int:
    """Duplicate occurrences beyond the first in each (timestamp, weight_kg) group.

    Three identical canonical observations contribute 2, not 3 or 1. This never removes
    anything -- every observation, duplicates included, is still in ``accepted``; it only
    counts them, the same way the filter treats a repeated measurement as a real update
    rather than a no-op (ADR-0004, ADR-0010).
    """
    counts = Counter((observation.timestamp, observation.weight_kg) for observation in observations)
    return sum(count - 1 for count in counts.values() if count > 1)
