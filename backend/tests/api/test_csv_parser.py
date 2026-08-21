"""Direct unit tests of :func:`app.ingestion.csv.parse_csv`.

These exercise the parser without going through HTTP, the same way
``tests/api/test_ingestion.py`` tests ``normalise_observations`` both directly and through
the endpoint. HTTP-level behaviour (the route, Content-Type, size caps, privacy) lives in
``test_csv_ingest.py``.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

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
from app.ingestion.csv import ParsedCsv, parse_csv
from app.schemas.analysis import MAX_OBSERVATIONS

UTC_ZONE = "UTC"
LONDON = "Europe/London"


def parse(text: str, *, zone: str = UTC_ZONE, unit: str = "kg") -> ParsedCsv:
    return parse_csv(text, assumed_timezone=zone, default_unit=unit)  # type: ignore[arg-type]


def only_reason(result: ParsedCsv) -> str:
    assert len(result.issues) == 1, result.issues
    return result.issues[0].reason_code


# --- happy path and header aliases -----------------------------------------


def test_a_well_formed_file_is_accepted():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,72.4\n2026-05-02T07:00:00Z,72.1\n")
    assert len(result.accepted) == 2
    assert [obs.weight for obs in result.accepted] == [72.4, 72.1]
    assert all(obs.unit == "kg" for obs in result.accepted)


@pytest.mark.parametrize("header", ["timestamp", "date", "datetime", "TIMESTAMP", " Date "])
def test_timestamp_column_aliases_are_recognised_case_insensitively(header: str):
    result = parse(f"{header},weight\n2026-05-01T07:00:00Z,72.0\n")
    assert len(result.accepted) == 1


def test_weight_column_alias_is_recognised():
    result = parse("timestamp,weight_kg\n2026-05-01T07:00:00Z,72.0\n")
    assert result.accepted[0].weight == 72.0
    assert result.accepted[0].unit == "kg"


def test_default_unit_applies_to_a_plain_weight_column():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,160.0\n", unit="lb")
    assert result.accepted[0].weight == 160.0
    assert result.accepted[0].unit == "lb"


def test_a_per_row_unit_column_overrides_the_default():
    result = parse(
        "timestamp,weight,unit\n2026-05-01T07:00:00Z,160.0,lb\n2026-05-02T07:00:00Z,72.0,kg\n",
        unit="kg",
    )
    assert [obs.unit for obs in result.accepted] == ["lb", "kg"]


# --- header ambiguity / missing columns -------------------------------------


def test_missing_timestamp_column_is_rejected():
    with pytest.raises(CsvMissingTimestampColumnError):
        parse("weight\n72.0\n")


def test_missing_weight_column_is_rejected():
    with pytest.raises(CsvMissingWeightColumnError):
        parse("timestamp\n2026-05-01T07:00:00Z\n")


def test_two_recognised_timestamp_columns_are_ambiguous():
    with pytest.raises(CsvAmbiguousTimestampColumnsError):
        parse("date,timestamp,weight\n2026-05-01,2026-05-01T07:00:00Z,72.0\n")


def test_two_recognised_weight_columns_are_ambiguous():
    with pytest.raises(CsvAmbiguousWeightColumnsError):
        parse("timestamp,weight,weight_kg\n2026-05-01T07:00:00Z,72.0,72.0\n")


def test_a_duplicated_unit_column_is_rejected():
    with pytest.raises(CsvDuplicateHeaderColumnError):
        parse("timestamp,weight,unit,UNIT\n2026-05-01T07:00:00Z,72.0,kg,kg\n")


# --- unit conflicts ----------------------------------------------------------


def test_a_unit_implying_header_with_a_matching_row_unit_is_accepted():
    result = parse("timestamp,weight_kg,unit\n2026-05-01T07:00:00Z,72.0,kg\n")
    assert result.accepted[0].unit == "kg"


def test_a_unit_implying_header_with_a_blank_row_unit_is_accepted():
    result = parse("timestamp,weight_lb,unit\n2026-05-01T07:00:00Z,160.0,\n")
    assert result.accepted[0].unit == "lb"


def test_a_unit_implying_header_with_a_contradicting_row_unit_is_rejected():
    result = parse("timestamp,weight_kg,unit\n2026-05-01T07:00:00Z,70.0,lb\n")
    assert only_reason(result) == "conflicting_unit"


def test_an_unrecognised_unit_token_is_rejected():
    result = parse("timestamp,weight,unit\n2026-05-01T07:00:00Z,72.0,stone\n")
    assert only_reason(result) == "invalid_unit"


# --- structural CSV -----------------------------------------------------------


def test_malformed_csv_syntax_is_rejected():
    with pytest.raises(CsvMalformedStructureError):
        parse('timestamp,weight\n"2026-05-01T07:00:00Z,72.0\n')


def test_a_header_only_file_is_rejected_as_empty():
    with pytest.raises(CsvEmptyFileError):
        parse("timestamp,weight\n")


def test_a_file_of_only_blank_rows_is_rejected_as_empty():
    with pytest.raises(CsvEmptyFileError):
        parse("timestamp,weight\n\n,\n   ,\t\n")


def test_an_invalid_timezone_is_rejected():
    with pytest.raises(CsvInvalidTimezoneError):
        parse("timestamp,weight\n2026-05-01T07:00:00Z,72.0\n", zone="Not/A_Real_Zone")


# --- blank rows and column-count mismatch -------------------------------------


def test_a_fully_blank_row_is_skipped_and_counted_not_rejected():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,72.0\n,\n2026-05-02T07:00:00Z,72.1\n")
    assert len(result.accepted) == 2
    assert result.blank_rows_skipped == 1
    assert result.issues == []


def test_extra_field_beyond_the_header_is_a_column_count_mismatch():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,72.0,extra\n")
    assert only_reason(result) == "column_count_mismatch"


def test_missing_field_is_a_column_count_mismatch():
    result = parse("timestamp,weight,unit\n2026-05-01T07:00:00Z,72.0\n")
    assert only_reason(result) == "column_count_mismatch"


def test_a_quoted_embedded_comma_does_not_cause_a_false_mismatch():
    result = parse('timestamp,weight,notes\n2026-05-01T07:00:00Z,72.0,"hello, world"\n')
    assert len(result.accepted) == 1
    assert result.issues == []


# --- line numbering ------------------------------------------------------------


def test_a_row_issue_reports_the_physical_line_including_the_header():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,72.0\nnot a date,abc\n")
    assert result.issues[0].line == 3


def test_a_record_following_a_multiline_quoted_field_starts_on_the_correct_line():
    """The multiline record occupies physical lines 2-4 (the quoted field embeds two
    newlines); the next record must be reported as starting on line 5, not appended to
    whatever line the reader's cursor happens to be on after skipping the multiline one."""
    text = (
        "timestamp,weight,notes\n"
        '2026-05-01T07:00:00Z,72.0,"line one\nline two\nline three"\n'
        "not a date,abc,plain\n"
    )
    result = parse(text)
    assert len(result.accepted) == 1
    assert only_reason(result) == "unparseable_timestamp"
    assert result.issues[0].line == 5


def test_an_invalid_value_on_a_multiline_record_reports_its_starting_line_not_its_ending_line():
    """The bad recognised value (`not a date`) sits on the SAME logical record as a quoted
    field that itself spans two physical lines; the reported line must be where the record
    starts (2), never where the multiline field happens to end (3)."""
    text = 'timestamp,weight,notes\nnot a date,72.0,"line one\nline two"\n'
    result = parse(text)
    assert only_reason(result) == "unparseable_timestamp"
    assert result.issues[0].line == 2


# --- row semantic rejections ---------------------------------------------------


def test_missing_timestamp_value_is_rejected():
    result = parse("timestamp,weight\n,72.0\n")
    assert only_reason(result) == "missing_timestamp"


def test_missing_weight_value_is_rejected():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,\n")
    assert only_reason(result) == "missing_weight"


def test_an_unparseable_timestamp_is_rejected():
    result = parse("timestamp,weight\nnot a date,72.0\n")
    assert only_reason(result) == "unparseable_timestamp"


def test_a_non_numeric_weight_is_rejected():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,abc\n")
    assert only_reason(result) == "non_numeric_weight"


def test_a_non_positive_weight_is_rejected():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,0\n")
    assert only_reason(result) == "non_positive_weight"


def test_a_non_finite_weight_is_rejected():
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,Infinity\n")
    assert only_reason(result) == "non_finite_weight"


def test_a_timestamp_beyond_the_maximum_representable_bound_is_rejected():
    result = parse("timestamp,weight\n9999-01-02T00:00:00Z,72.0\n")
    assert only_reason(result) == "timestamp_out_of_range"


def test_an_unmapped_pydantic_error_type_falls_back_to_invalid_row(
    monkeypatch: pytest.MonkeyPatch,
):
    """Proves the fallback is reachable and wired correctly: with the lookup table emptied,
    any `ObservationIn` validation failure -- here a non-positive weight, ordinarily mapped
    to `non_positive_weight` -- must still be reported, never raise or leak, via `invalid_row`."""
    from app.ingestion import csv as csv_module

    monkeypatch.setattr(csv_module, "_PYDANTIC_REASON_CODES", {})
    result = parse("timestamp,weight\n2026-05-01T07:00:00Z,0\n")
    assert only_reason(result) == "invalid_row"


def test_unrelated_valid_rows_still_analyse_when_others_are_rejected():
    result = parse(
        "timestamp,weight\n2026-05-01T07:00:00Z,72.0\n,72.0\n2026-05-02T07:00:00Z,71.9\n"
    )
    assert len(result.accepted) == 2
    assert result.rejected_count == 1


def test_a_file_with_only_invalid_data_rows_returns_a_report_with_no_accepted_rows():
    result = parse("timestamp,weight\nnot a date,abc\n")
    assert result.accepted == []
    assert result.rejected_count == 1


# --- limits --------------------------------------------------------------------


def test_a_file_at_the_row_limit_is_accepted():
    rows = "\n".join(
        f"2026-01-{1 + (i % 27):02d}T0{i % 9}:00:00Z,72.0" for i in range(MAX_OBSERVATIONS)
    )
    text = "timestamp,weight\n" + rows + "\n"
    result = parse(text)
    assert len(result.accepted) + result.rejected_count == MAX_OBSERVATIONS


def test_a_file_over_the_row_limit_aborts_without_finishing_the_scan():
    good_row = "2026-05-01T07:00:00Z,72.0"
    rows = "\n".join([good_row] * (MAX_OBSERVATIONS + 1))
    text = "timestamp,weight\n" + rows + "\nnot a date,abc\n"
    with pytest.raises(CsvTooManyRowsError):
        parse(text)


def test_the_issue_list_is_capped_but_the_count_is_exact():
    bad_row = "not a date,abc\n"
    text = "timestamp,weight\n" + bad_row * 600
    result = parse(text)
    assert result.rejected_count == 600
    assert len(result.issues) < 600
    assert result.issues_truncated is True


# --- timezone / DST --------------------------------------------------------------


def test_an_explicit_offset_is_used_as_is_regardless_of_assumed_timezone():
    result = parse("timestamp,weight\n2026-05-01T07:00:00+02:00,72.0\n", zone=LONDON)
    assert result.accepted[0].timestamp == datetime(2026, 5, 1, 5, 0, tzinfo=UTC)
    assert result.naive_timestamp_count == 0


def test_a_naive_datetime_is_localised_using_the_assumed_timezone_summer():
    result = parse("timestamp,weight\n2026-07-01T07:00:00,72.0\n", zone=LONDON)
    # Europe/London is BST (UTC+1) in July.
    assert result.accepted[0].timestamp == datetime(2026, 7, 1, 6, 0, tzinfo=UTC)
    assert result.naive_timestamp_count == 1
    assert result.date_only_count == 0


def test_a_naive_datetime_is_localised_using_the_assumed_timezone_winter():
    result = parse("timestamp,weight\n2026-01-01T07:00:00,72.0\n", zone=LONDON)
    # Europe/London is GMT (UTC+0) in January.
    assert result.accepted[0].timestamp == datetime(2026, 1, 1, 7, 0, tzinfo=UTC)


def test_a_date_only_row_is_assigned_local_noon():
    result = parse("timestamp,weight\n2026-01-05,72.0\n", zone=LONDON)
    assert result.accepted[0].timestamp == datetime(2026, 1, 5, 12, 0, tzinfo=UTC)
    assert result.naive_timestamp_count == 1
    assert result.date_only_count == 1


def test_a_spring_forward_nonexistent_local_time_is_rejected():
    """UK clocks skip 01:00-02:00 on the last Sunday of March. 2026-03-29 01:30 never occurs."""
    result = parse("timestamp,weight\n2026-03-29T01:30:00,72.0\n", zone=LONDON)
    assert only_reason(result) == "nonexistent_local_time"


def test_an_autumn_fall_back_ambiguous_local_time_is_rejected():
    """UK clocks repeat 01:00-02:00 on the last Sunday of October. 2026-10-25 01:30 occurs twice."""
    result = parse("timestamp,weight\n2026-10-25T01:30:00,72.0\n", zone=LONDON)
    assert only_reason(result) == "ambiguous_local_time"


def test_ordinary_naive_times_either_side_of_the_dst_gap_are_unaffected():
    before = parse("timestamp,weight\n2026-03-29T00:30:00,72.0\n", zone=LONDON)
    after = parse("timestamp,weight\n2026-03-29T03:30:00,72.0\n", zone=LONDON)
    assert before.accepted[0].timestamp == datetime(2026, 3, 29, 0, 30, tzinfo=UTC)
    assert after.accepted[0].timestamp == datetime(2026, 3, 29, 2, 30, tzinfo=UTC)


def test_parsing_is_deterministic():
    text = "timestamp,weight,unit\n2026-05-01T07:00:00,160.0,lb\n2026-05-02,72.0,\n"
    first = parse(text, zone=LONDON)
    second = parse(text, zone=LONDON)
    assert [obs.model_dump(mode="json") for obs in first.accepted] == [
        obs.model_dump(mode="json") for obs in second.accepted
    ]
