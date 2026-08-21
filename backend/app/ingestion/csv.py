"""Parsing an uploaded CSV into the observations the existing boundary already accepts.

This module produces :class:`app.schemas.analysis.ObservationIn` objects -- the exact
request-side type -- and nothing else. It does not convert units to kilograms and does not
sort: both are :func:`app.ingestion.observations.normalise_observations`'s job already, and
duplicating either here would be a second implementation of logic that is already tested
(ADR-0004, ADR-0010).

Two passes over the file, in order:

1. **Structural** (:func:`_resolve_header`, the row-reading loop's own checks): can the
   rows even be interpreted? A missing/ambiguous/duplicated recognised column, malformed
   CSV syntax, or too many data rows fails the *whole file* -- there is no reasonable
   partial guess to make. Blank rows and rows with the wrong number of columns are
   identified here too, since both require knowing the header's width.
2. **Semantic**, per surviving row: resolve a timestamp and a unit, then let
   :class:`app.schemas.analysis.ObservationIn` do the same validation a manually entered
   measurement gets. A row that fails this pass is *reported*, not fatal to the file.

Timestamps with no UTC offset are localised against a caller-supplied IANA zone, using that
specific date's rule (so a summer row and a winter row in the same zone can and should get
different UTC offsets) -- never a single offset captured once. A naive local time that is
ambiguous (occurs twice, autumn "fall back") or nonexistent (never occurs, spring "forward"
gap) is rejected rather than guessed: neither the CSV nor the caller told us which instant,
or that instant at all, was meant (see :func:`_localise`, ADR-0010).
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, time
from typing import Final, Literal, Protocol
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import ValidationError

from app.errors import (
    CsvAmbiguousTimestampColumnsError,
    CsvAmbiguousWeightColumnsError,
    CsvDuplicateHeaderColumnError,
    CsvEmptyFileError,
    CsvInvalidTimezoneError,
    CsvMalformedStructureError,
    CsvMissingTimestampColumnError,
    CsvMissingWeightColumnError,
    CsvTooManyRowsError,
)
from app.schemas.analysis import MAX_OBSERVATIONS, ObservationIn
from app.schemas.ingestion import MAX_ISSUES, CsvRowIssue, CsvRowReasonCode

_TIMESTAMP_ALIASES: Final = frozenset({"timestamp", "date", "datetime"})
_WEIGHT_NEUTRAL_ALIASES: Final = frozenset({"weight"})
_WEIGHT_KG_ALIASES: Final = frozenset({"weight_kg", "weight (kg)"})
_WEIGHT_LB_ALIASES: Final = frozenset({"weight_lb", "weight (lb)", "weight (lbs)"})
_UNIT_ALIASES: Final = frozenset({"unit"})
_UNIT_TOKENS: Final[dict[str, Literal["kg", "lb"]]] = {
    "kg": "kg",
    "kgs": "kg",
    "lb": "lb",
    "lbs": "lb",
}

_DATE_ONLY_LOCAL_TIME: Final = time(12, 0, 0)
"""Date-only rows are assigned this local time as a deterministic convention -- chosen
because it falls away from the early-morning clock times where DST transitions typically
occur, not because it represents an inferred or claimed measurement time."""

_ROW_MESSAGES: Final[dict[CsvRowReasonCode, str]] = {
    "missing_timestamp": "This row is missing a timestamp.",
    "missing_weight": "This row is missing a weight.",
    "unparseable_timestamp": (
        "The timestamp could not be parsed. Use an ISO-8601 date or datetime."
    ),
    "ambiguous_local_time": (
        "This local time occurs twice during a clock change in the selected timezone and "
        "cannot be resolved automatically."
    ),
    "nonexistent_local_time": (
        "This local time does not exist in the selected timezone because of a clock change."
    ),
    "non_numeric_weight": "The weight is not a number.",
    "non_positive_weight": "The weight must be greater than zero.",
    "non_finite_weight": "The weight must be a finite number.",
    "timestamp_out_of_range": "The timestamp is too far in the future to be analysed.",
    "invalid_unit": "The unit must be kg or lb.",
    "conflicting_unit": "The unit column conflicts with the weight column's unit.",
    "column_count_mismatch": "This row does not have the same number of columns as the header.",
    "invalid_row": "This row could not be validated.",
}

_PYDANTIC_REASON_CODES: Final[dict[str, CsvRowReasonCode]] = {
    "greater_than": "non_positive_weight",
    "finite_number": "non_finite_weight",
    "less_than_equal": "timestamp_out_of_range",
}


class _CsvReader(Protocol):
    """The subset of ``csv.reader``'s interface this module relies on.

    ``csv.reader`` is implemented in C and typeshed does not expose its return type as a
    nameable class, so this structural protocol stands in for it.
    """

    line_num: int

    def __next__(self) -> list[str]: ...


@dataclass(frozen=True, slots=True)
class _Header:
    timestamp_index: int
    weight_index: int
    weight_implied_unit: Literal["kg", "lb"] | None
    unit_index: int | None
    width: int


@dataclass(frozen=True, slots=True)
class _TimestampOutcome:
    timestamp: datetime | None
    reason_code: CsvRowReasonCode | None = None
    naive: bool = False
    date_only: bool = False


@dataclass(frozen=True, slots=True)
class _RowOutcome:
    observation: ObservationIn | None
    reason_code: CsvRowReasonCode | None = None
    naive_timestamp: bool = False
    date_only: bool = False


@dataclass(slots=True)
class ParsedCsv:
    """Everything one CSV parse produced, before duplicate-counting or normalisation."""

    accepted: list[ObservationIn] = field(default_factory=list)
    issues: list[CsvRowIssue] = field(default_factory=list)
    issues_truncated: bool = False
    rejected_count: int = 0
    blank_rows_skipped: int = 0
    naive_timestamp_count: int = 0
    date_only_count: int = 0


class _IssueSink:
    """Collects row issues up to :data:`app.schemas.ingestion.MAX_ISSUES`.

    ``rejected_count`` is always exact; the issues list itself is capped so a file with
    thousands of bad rows cannot produce an unbounded response.
    """

    def __init__(self) -> None:
        self.issues: list[CsvRowIssue] = []
        self.rejected_count = 0
        self.truncated = False

    def add(self, line: int, reason_code: CsvRowReasonCode) -> None:
        self.rejected_count += 1
        if len(self.issues) < MAX_ISSUES:
            self.issues.append(
                CsvRowIssue(line=line, reason_code=reason_code, message=_ROW_MESSAGES[reason_code])
            )
        else:
            self.truncated = True


def parse_csv(text: str, *, assumed_timezone: str, default_unit: Literal["kg", "lb"]) -> ParsedCsv:
    """Parse CSV text into accepted observations and per-row issues.

    Args:
        text: the decoded CSV file.
        assumed_timezone: an IANA zone name, used only for timestamps with no UTC offset.
        default_unit: "kg" or "lb", used only for a plain (not unit-implying) weight column
            with no per-row unit value.

    Raises:
        CsvInvalidTimezoneError: ``assumed_timezone`` is not a real IANA zone.
        CsvEmptyFileError: no header row, or no non-blank data rows.
        CsvMalformedStructureError: the file is not well-formed CSV.
        CsvMissingTimestampColumnError, CsvMissingWeightColumnError: a required column is
            absent.
        CsvAmbiguousTimestampColumnsError, CsvAmbiguousWeightColumnsError,
            CsvDuplicateHeaderColumnError: more than one column matches a recognised role.
        CsvTooManyRowsError: more than ``MAX_OBSERVATIONS`` non-blank data rows.
    """
    zone = _resolve_zone(assumed_timezone)
    reader = csv.reader(io.StringIO(text), strict=True)

    try:
        header_row = next(reader)
    except StopIteration as exc:
        raise CsvEmptyFileError("the file has no header row") from exc
    except csv.Error as exc:
        raise CsvMalformedStructureError("the file could not be parsed as CSV") from exc
    header = _resolve_header(header_row)

    parsed = ParsedCsv()
    sink = _IssueSink()
    data_row_count = 0

    for start_line, row in _numbered_rows(reader):
        if _is_blank(row):
            parsed.blank_rows_skipped += 1
            continue

        data_row_count += 1
        if data_row_count > MAX_OBSERVATIONS:
            raise CsvTooManyRowsError(f"the file has more than {MAX_OBSERVATIONS} data rows")

        if len(row) != header.width:
            sink.add(start_line, "column_count_mismatch")
            continue

        outcome = _process_row(row, header=header, zone=zone, default_unit=default_unit)
        if outcome.observation is None:
            sink.add(start_line, outcome.reason_code or "invalid_row")
            continue

        parsed.accepted.append(outcome.observation)
        if outcome.naive_timestamp:
            parsed.naive_timestamp_count += 1
        if outcome.date_only:
            parsed.date_only_count += 1

    if data_row_count == 0:
        raise CsvEmptyFileError("the file has no data rows")

    parsed.issues = sink.issues
    parsed.issues_truncated = sink.truncated
    parsed.rejected_count = sink.rejected_count
    return parsed


def _resolve_zone(assumed_timezone: str) -> ZoneInfo:
    try:
        return ZoneInfo(assumed_timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise CsvInvalidTimezoneError("assumed_timezone is not a recognised IANA timezone") from exc


def _numbered_rows(reader: _CsvReader) -> Iterator[tuple[int, list[str]]]:
    """Yield ``(starting_physical_line, row)`` for every remaining record.

    ``reader.line_num`` reports physical lines consumed *so far*, which after a record with
    an embedded newline (a quoted cell spanning lines) is that record's *ending* line, not
    its start. Capturing it immediately before each ``next()`` call instead gives the count
    of lines already consumed by every *prior* record, so the record about to be read starts
    one line after that.
    """
    line_num = reader.line_num
    while True:
        try:
            row = next(reader)
        except StopIteration:
            return
        except csv.Error as exc:
            raise CsvMalformedStructureError("the file could not be parsed as CSV") from exc
        start_line = line_num + 1
        line_num = reader.line_num
        yield start_line, row


def _is_blank(row: list[str]) -> bool:
    """Return whether every field ``row`` has is empty or whitespace, regardless of width."""
    return all(cell.strip() == "" for cell in row)


def _normalise_header_cell(cell: str) -> str:
    return cell.strip().lower()


def _resolve_header(header_row: list[str]) -> _Header:
    normalised = [_normalise_header_cell(cell) for cell in header_row]

    timestamp_indices = [i for i, cell in enumerate(normalised) if cell in _TIMESTAMP_ALIASES]
    if not timestamp_indices:
        raise CsvMissingTimestampColumnError("no recognised timestamp column was found")
    if len(timestamp_indices) > 1:
        raise CsvAmbiguousTimestampColumnsError(
            "more than one recognised timestamp column was found"
        )

    weight_kg_indices = [i for i, cell in enumerate(normalised) if cell in _WEIGHT_KG_ALIASES]
    weight_lb_indices = [i for i, cell in enumerate(normalised) if cell in _WEIGHT_LB_ALIASES]
    weight_neutral_indices = [
        i for i, cell in enumerate(normalised) if cell in _WEIGHT_NEUTRAL_ALIASES
    ]
    weight_indices = weight_kg_indices + weight_lb_indices + weight_neutral_indices
    if not weight_indices:
        raise CsvMissingWeightColumnError("no recognised weight column was found")
    if len(weight_indices) > 1:
        raise CsvAmbiguousWeightColumnsError("more than one recognised weight column was found")

    unit_indices = [i for i, cell in enumerate(normalised) if cell in _UNIT_ALIASES]
    if len(unit_indices) > 1:
        raise CsvDuplicateHeaderColumnError("the unit column appears more than once")

    weight_implied_unit: Literal["kg", "lb"] | None
    weight_implied_unit = "kg" if weight_kg_indices else ("lb" if weight_lb_indices else None)

    return _Header(
        timestamp_index=timestamp_indices[0],
        weight_index=weight_indices[0],
        weight_implied_unit=weight_implied_unit,
        unit_index=unit_indices[0] if unit_indices else None,
        width=len(header_row),
    )


def _process_row(
    row: list[str], *, header: _Header, zone: ZoneInfo, default_unit: Literal["kg", "lb"]
) -> _RowOutcome:
    ts_outcome = _resolve_timestamp(row[header.timestamp_index], zone)
    timestamp = ts_outcome.timestamp
    if timestamp is None:
        return _RowOutcome(None, ts_outcome.reason_code)

    weight_raw = row[header.weight_index].strip()
    if weight_raw == "":
        return _RowOutcome(None, "missing_weight")
    weight_value = _parse_weight(weight_raw)
    if weight_value is None:
        return _RowOutcome(None, "non_numeric_weight")

    unit_raw = row[header.unit_index] if header.unit_index is not None else None
    unit, unit_reason = _resolve_unit(unit_raw, header=header, default_unit=default_unit)
    if unit is None:
        return _RowOutcome(None, unit_reason or "invalid_row")

    observation, build_reason = _build_observation(timestamp, weight_value, unit)
    if build_reason is not None:
        return _RowOutcome(None, build_reason)

    return _RowOutcome(
        observation, naive_timestamp=ts_outcome.naive, date_only=ts_outcome.date_only
    )


def _resolve_timestamp(raw: str, zone: ZoneInfo) -> _TimestampOutcome:
    raw = raw.strip()
    if raw == "":
        return _TimestampOutcome(None, "missing_timestamp")

    try:
        parsed_date = date.fromisoformat(raw)
    except ValueError:
        parsed_date = None

    if parsed_date is not None:
        naive_dt = datetime.combine(parsed_date, _DATE_ONLY_LOCAL_TIME)
        resolved, reason = _localise(naive_dt, zone)
        if resolved is None:
            return _TimestampOutcome(None, reason)
        return _TimestampOutcome(resolved, naive=True, date_only=True)

    try:
        candidate = datetime.fromisoformat(raw)
    except ValueError:
        return _TimestampOutcome(None, "unparseable_timestamp")

    if candidate.tzinfo is not None:
        return _TimestampOutcome(candidate)

    resolved, reason = _localise(candidate, zone)
    if resolved is None:
        return _TimestampOutcome(None, reason)
    return _TimestampOutcome(resolved, naive=True)


def _localise(
    naive_dt: datetime, zone: ZoneInfo
) -> tuple[datetime | None, CsvRowReasonCode | None]:
    """Classify and resolve a naive local wall-clock time against ``zone``.

    Comparing only the UTC offset at ``fold=0`` vs ``fold=1`` is not enough to tell a
    nonexistent (spring-forward) time from an ambiguous (fall-back) one -- a nonexistent
    time can also show two different offsets between folds. Instead, each fold candidate is
    validated by converting it to UTC and back: a candidate that does not round-trip to the
    original wall time never really occurred under that fold.

    - Neither candidate round-trips -> the wall time never occurred here: nonexistent.
    - Both round-trip, to two different UTC instants -> the wall time occurred twice:
      ambiguous. Neither occurrence is guessed.
    - Otherwise (one valid candidate, or both agree) -> ordinary, unambiguous time.
    """
    valid_instants: list[datetime] = []
    for fold in (0, 1):
        candidate = naive_dt.replace(tzinfo=zone, fold=fold)
        utc_instant = candidate.astimezone(UTC)
        roundtripped = utc_instant.astimezone(zone).replace(tzinfo=None)
        if roundtripped == naive_dt:
            valid_instants.append(utc_instant)

    if not valid_instants:
        return None, "nonexistent_local_time"
    if len(valid_instants) == 2 and valid_instants[0] != valid_instants[1]:
        return None, "ambiguous_local_time"
    return valid_instants[0], None


def _parse_weight(raw: str) -> float | None:
    try:
        return float(raw)
    except ValueError:
        return None


def _resolve_unit(
    raw: str | None, *, header: _Header, default_unit: Literal["kg", "lb"]
) -> tuple[Literal["kg", "lb"] | None, CsvRowReasonCode | None]:
    cell = (raw or "").strip().lower()
    row_unit = _UNIT_TOKENS.get(cell) if cell else None
    if cell and row_unit is None:
        return None, "invalid_unit"

    if header.weight_implied_unit is not None:
        if row_unit is None or row_unit == header.weight_implied_unit:
            return header.weight_implied_unit, None
        return None, "conflicting_unit"

    return (row_unit if row_unit is not None else default_unit), None


def _build_observation(
    timestamp: datetime, weight: float, unit: Literal["kg", "lb"]
) -> tuple[ObservationIn | None, CsvRowReasonCode | None]:
    try:
        return ObservationIn(timestamp=timestamp, weight=weight, unit=unit), None
    except ValidationError as exc:
        errors = exc.errors()
        error_type = str(errors[0]["type"]) if errors else ""
        return None, _PYDANTIC_REASON_CODES.get(error_type, "invalid_row")
