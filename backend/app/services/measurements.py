"""Storing and retrieving one account's measurement history.

Every function here takes the ``user_id`` from the caller's own resolved session -- never from
a request body or a path parameter -- and every repository call it makes is scoped by that id,
so a measurement id belonging to another account is indistinguishable from one that does not
exist (:class:`app.errors.MeasurementNotFoundError`, mapped to the same
``measurement_not_found`` response either way).

A stored measurement keeps exactly what :class:`app.schemas.analysis.ObservationIn` carries:
the timestamp, the weight as entered, and the unit it was entered in. Nothing here converts a
unit or reorders anything -- that is :func:`app.ingestion.normalise_observations`'s job, run
only when the account is analysed (:func:`app.services.account.analyse_account`), exactly as
for a submitted series.

Two policies live here rather than in a route:

* **The measurement cap** (:data:`app.schemas.analysis.MAX_OBSERVATIONS`, the same bound a
  submitted request is held to) applies per account, counting what is already stored.
* **A batch import is idempotent.** Re-submitting the same CSV, or the same manual entry,
  must not duplicate rows. A candidate is skipped when an existing measurement converts to the
  same UTC instant and the same weight in kilograms -- the same comparison
  :func:`app.ingestion.normalise_observations` would make them equal under, even though the
  two rows might be entered in different units. This is a storage-level de-duplication only;
  once stored, every row is still passed to analysis (ADR-0004 is unchanged).
"""

from __future__ import annotations

from datetime import datetime

from app.core.units import lb_to_kg
from app.errors import MeasurementLimitExceededError, MeasurementNotFoundError
from app.persistence.models import MeasurementSource, Unit
from app.persistence.repositories import MeasurementRecord, Store
from app.schemas.analysis import MAX_OBSERVATIONS, ObservationIn
from app.schemas.measurements import MeasurementOut


def _weight_kg(weight: float, unit: Unit) -> float:
    """Return ``weight`` converted to kilograms, for de-duplication comparison only.

    Mirrors :func:`app.ingestion.observations.normalise_observations`'s own conversion
    (:func:`app.core.units.lb_to_kg`) so that two measurements normalise to the same key
    exactly when analysis would treat them as the same value. It is not itself the
    normalisation analysis uses -- that still runs, unchanged, at analysis time.
    """
    return weight if unit == "kg" else lb_to_kg(weight)


def _dedup_key(timestamp: datetime, weight: float, unit: Unit) -> tuple[datetime, float]:
    """Return the (instant, weight-in-kilograms) pair two equivalent measurements share.

    Two aware datetimes compare equal exactly when they name the same instant, whatever
    offset each carries, so the timestamp itself needs no conversion here.
    """
    return (timestamp, _weight_kg(weight, unit))


def measurement_out(record: MeasurementRecord) -> MeasurementOut:
    """Adapt a stored :class:`app.persistence.repositories.MeasurementRecord` for the wire.

    The single place this project maps a persistence record onto the measurement schema,
    mirroring how :meth:`app.schemas.analysis.ObservationOut.from_core` is the single adapter
    for a core :class:`app.core.types.Observation`.
    """
    return MeasurementOut(
        id=record.id,
        timestamp=record.timestamp,
        weight=record.weight,
        unit=record.unit,
        source=record.source,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_measurements(user_id: str, *, store: Store) -> list[MeasurementOut]:
    """Return every measurement the account holds, most recent first."""
    return [measurement_out(record) for record in store.measurements.list_for_user(user_id)]


def create_measurement(
    user_id: str,
    observation: ObservationIn,
    *,
    source: MeasurementSource,
    now: datetime,
    store: Store,
) -> MeasurementOut:
    """Store one measurement for the account.

    Raises:
        MeasurementLimitExceededError: storing it would exceed the per-account cap.
    """
    if store.measurements.count_for_user(user_id) >= MAX_OBSERVATIONS:
        raise MeasurementLimitExceededError("measurement cap reached")
    record = store.measurements.add(
        user_id,
        timestamp=observation.timestamp,
        weight=observation.weight,
        unit=observation.unit,
        source=source,
        now=now,
    )
    store.commit()
    return measurement_out(record)


def update_measurement(
    user_id: str, measurement_id: str, observation: ObservationIn, *, now: datetime, store: Store
) -> MeasurementOut:
    """Replace a stored measurement's timestamp, weight and unit. The source is unchanged.

    Raises:
        MeasurementNotFoundError: no such measurement is owned by ``user_id``.
    """
    record = store.measurements.update_owned(
        user_id,
        measurement_id,
        timestamp=observation.timestamp,
        weight=observation.weight,
        unit=observation.unit,
        now=now,
    )
    if record is None:
        raise MeasurementNotFoundError("measurement not found")
    store.commit()
    return measurement_out(record)


def delete_measurement(user_id: str, measurement_id: str, *, store: Store) -> None:
    """Delete a stored measurement.

    Raises:
        MeasurementNotFoundError: no such measurement is owned by ``user_id``.
    """
    if not store.measurements.delete_owned(user_id, measurement_id):
        raise MeasurementNotFoundError("measurement not found")
    store.commit()


def import_batch(
    user_id: str,
    observations: list[ObservationIn],
    *,
    source: MeasurementSource,
    now: datetime,
    store: Store,
) -> tuple[int, int]:
    """Store a batch of measurements, skipping any that duplicate one already stored.

    Returns:
        ``(inserted_count, skipped_existing_count)``.

    Raises:
        MeasurementLimitExceededError: storing every non-duplicate row would exceed the
            per-account cap. Nothing in the batch is stored when this is raised.
    """
    existing = {
        _dedup_key(record.timestamp, record.weight, record.unit)
        for record in store.measurements.list_for_user(user_id)
    }
    to_insert: list[ObservationIn] = []
    skipped = 0
    for observation in observations:
        key = _dedup_key(observation.timestamp, observation.weight, observation.unit)
        if key in existing:
            skipped += 1
            continue
        existing.add(key)  # a duplicate within the same batch is also skipped
        to_insert.append(observation)

    if store.measurements.count_for_user(user_id) + len(to_insert) > MAX_OBSERVATIONS:
        raise MeasurementLimitExceededError("measurement cap reached")

    for observation in to_insert:
        store.measurements.add(
            user_id,
            timestamp=observation.timestamp,
            weight=observation.weight,
            unit=observation.unit,
            source=source,
            now=now,
        )
    store.commit()
    return len(to_insert), skipped
