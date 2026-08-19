"""The time coordinate system. Test IDs T1-T5."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.core.time_axis import (
    DEFAULT_EPOCH,
    DEFAULT_TIME_AXIS,
    SECONDS_PER_DAY,
    TimeAxis,
    require_utc_aware,
)

# --- T1: absolute conversion ----------------------------------------------


def test_t1_known_instant_maps_to_the_expected_fractional_day():
    axis = TimeAxis(epoch=datetime(2000, 1, 1, tzinfo=UTC))
    assert axis.to_days(datetime(2000, 1, 1, tzinfo=UTC)) == 0.0
    assert axis.to_days(datetime(2000, 1, 2, 12, 0, tzinfo=UTC)) == 1.5
    assert axis.to_days(datetime(2000, 1, 1, 6, 0, tzinfo=UTC)) == 0.25


def test_t1_conversion_round_trips_to_the_microsecond():
    axis = DEFAULT_TIME_AXIS
    instant = datetime(2025, 6, 17, 7, 31, 42, 123456, tzinfo=UTC)
    recovered = axis.to_datetime(axis.to_days(instant))
    assert abs((recovered - instant).total_seconds()) < 1e-6


def test_t1_default_epoch_is_fixed_and_utc():
    assert datetime(2000, 1, 1, tzinfo=UTC) == DEFAULT_EPOCH
    assert DEFAULT_TIME_AXIS.epoch == DEFAULT_EPOCH


# --- T2: timezone normalisation -------------------------------------------


def test_t2_the_same_instant_in_different_offsets_maps_to_one_coordinate():
    tokyo = datetime(2024, 3, 1, 8, 0, tzinfo=timezone(timedelta(hours=9)))
    utc = datetime(2024, 2, 29, 23, 0, tzinfo=UTC)
    new_york = datetime(2024, 2, 29, 18, 0, tzinfo=timezone(timedelta(hours=-5)))
    assert DEFAULT_TIME_AXIS.to_days(tokyo) == DEFAULT_TIME_AXIS.to_days(utc)
    assert DEFAULT_TIME_AXIS.to_days(new_york) == DEFAULT_TIME_AXIS.to_days(utc)


def test_t2_require_utc_aware_normalises_to_utc():
    tokyo = datetime(2024, 3, 1, 8, 0, tzinfo=timezone(timedelta(hours=9)))
    normalised = require_utc_aware(tokyo)
    assert normalised.tzinfo == UTC
    assert normalised == tokyo


# --- T3: naive datetimes are rejected -------------------------------------


def test_t3_naive_datetime_is_rejected():
    with pytest.raises(ValueError, match="timezone-aware"):
        require_utc_aware(datetime(2024, 1, 1, 8, 0))


def test_t3_naive_epoch_is_rejected():
    with pytest.raises(ValueError, match="epoch"):
        TimeAxis(epoch=datetime(2000, 1, 1))


def test_t3_naive_datetime_is_rejected_by_elapsed_days():
    aware = datetime(2024, 1, 1, tzinfo=UTC)
    with pytest.raises(ValueError, match="timezone-aware"):
        DEFAULT_TIME_AXIS.elapsed_days(aware, datetime(2024, 1, 2))


# --- T4: precision over long spans ----------------------------------------


def test_t4_five_year_span_keeps_sub_second_resolution():
    start = datetime(2020, 1, 1, tzinfo=UTC)
    end = start + timedelta(days=1826, milliseconds=1)
    span = DEFAULT_TIME_AXIS.elapsed_days(start, end)
    assert span == pytest.approx(1826.0 + 1e-3 / SECONDS_PER_DAY, rel=1e-15)
    # The millisecond is still distinguishable from an exact 1826-day span.
    assert span != 1826.0


def test_t4_a_single_second_is_representable():
    start = datetime(2020, 1, 1, tzinfo=UTC)
    span = DEFAULT_TIME_AXIS.elapsed_days(start, start + timedelta(seconds=1))
    assert span == pytest.approx(1.0 / SECONDS_PER_DAY, rel=1e-15)


# --- T5: elapsed time is epoch-independent --------------------------------


def test_t5_elapsed_days_does_not_depend_on_the_epoch():
    start = datetime(2025, 4, 5, 6, 7, 8, tzinfo=UTC)
    end = datetime(2027, 11, 30, 21, 15, 3, tzinfo=UTC)
    spans = {
        TimeAxis(epoch=epoch).elapsed_days(start, end)
        for epoch in (
            datetime(1970, 1, 1, tzinfo=UTC),
            datetime(2000, 1, 1, tzinfo=UTC),
            datetime(2200, 6, 15, 3, 0, tzinfo=UTC),
        )
    }
    assert len(spans) == 1


def test_t5_elapsed_days_is_signed():
    early = datetime(2025, 1, 1, tzinfo=UTC)
    late = datetime(2025, 1, 3, tzinfo=UTC)
    assert DEFAULT_TIME_AXIS.elapsed_days(early, late) == 2.0
    assert DEFAULT_TIME_AXIS.elapsed_days(late, early) == -2.0


def test_shift_is_the_inverse_of_elapsed_days():
    start = datetime(2025, 1, 1, 7, 30, tzinfo=UTC)
    shifted = DEFAULT_TIME_AXIS.shift(start, 30.0)
    assert DEFAULT_TIME_AXIS.elapsed_days(start, shifted) == 30.0
