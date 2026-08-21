"""The CSV-ingestion response contract.

Parsing a CSV is a separate step from analysing one: this schema describes only what an
import looked like -- what got accepted, what didn't, and why -- never a trend or a
forecast. ``accepted`` is typed as :class:`app.schemas.analysis.ObservationIn`, the exact
class :class:`app.schemas.analysis.AnalysisRequest.observations` already holds, not a new
type, so a caller can pass it straight into ``POST /api/analyse`` with no conversion
(ADR-0010). ``app/schemas/analysis.py`` is not modified to make this work.
"""

from __future__ import annotations

from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analysis import ObservationIn

MAX_CSV_BYTES: Final = 2 * 1024 * 1024
"""Largest CSV upload accepted, enforced by a capped stream read before parsing begins."""

MAX_ISSUES: Final = 500
"""Largest number of row issues returned in one response; ``issues_truncated`` covers the rest."""

CsvRowReasonCode = Literal[
    "missing_timestamp",
    "missing_weight",
    "unparseable_timestamp",
    "ambiguous_local_time",
    "nonexistent_local_time",
    "non_numeric_weight",
    "non_positive_weight",
    "non_finite_weight",
    "timestamp_out_of_range",
    "invalid_unit",
    "conflicting_unit",
    "column_count_mismatch",
    "invalid_row",
]
"""Stable, machine-readable reasons one row was not accepted.

Deliberately exhaustive: :mod:`app.ingestion.csv` maps every possible ``ObservationIn``
validation failure to one of these, falling back to ``invalid_row`` for anything not given
a more specific code, so a row issue can never be built from a message that might carry the
submitted value.
"""


class CsvRowIssue(BaseModel):
    """One row that was not accepted, and why -- never what it contained."""

    model_config = ConfigDict(extra="forbid")

    line: int = Field(
        description=(
            "1-based physical line the record starts on. For a record spanning multiple "
            "physical lines (a quoted cell containing a newline), this is the starting "
            "line, not the line the record happens to end on."
        )
    )
    reason_code: CsvRowReasonCode
    message: str = Field(description="Fixed explanation. Never contains a submitted value.")


class CsvIngestResponse(BaseModel):
    """The result of parsing one CSV upload: what to submit, and what to fix.

    ``accepted`` is ready to pass straight into ``AnalysisRequest.observations``. Nothing
    here is analysed -- ``n_obs``, ``span_days``, a trend or a forecast only exist after
    calling ``POST /api/analyse`` with ``accepted``.
    """

    model_config = ConfigDict(extra="forbid")

    accepted: list[ObservationIn] = Field(
        description="Rows that parsed successfully, normalised to kilograms and UTC."
    )
    rejected: list[CsvRowIssue] = Field(
        description=f"Up to {MAX_ISSUES} rejected rows; see issues_truncated for the rest."
    )
    issues_truncated: bool = Field(
        description="True if more rows were rejected than the rejected list includes."
    )
    accepted_count: int = Field(description="Number of rows in accepted.")
    rejected_count: int = Field(description="Total rejected rows, regardless of truncation.")
    duplicate_count: int = Field(
        description=(
            "Exact-duplicate observations (same resolved timestamp and canonical weight) "
            "beyond the first in each group -- three identical readings contribute 2, not "
            "3 or 1. Duplicates are retained in accepted, not removed; this only counts "
            "them, the same way the underlying filter treats them as repeated measurements "
            "rather than a no-op."
        )
    )
    blank_rows_skipped: int = Field(description="Fully empty rows: skipped, not rejected.")
    naive_timestamp_count: int = Field(
        description=(
            "Accepted rows whose timestamp carried no UTC offset and was therefore "
            "resolved using assumed_timezone. Includes date-only rows -- see "
            "date_only_count for that subset specifically."
        )
    )
    date_only_count: int = Field(
        description=(
            "The subset of naive_timestamp_count that were date-only rows (no time of "
            "day), assigned 12:00 local time in assumed_timezone as a deterministic "
            "convention."
        )
    )
