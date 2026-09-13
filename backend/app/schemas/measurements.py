"""The stored-measurement contract: one weigh-in as the account keeps it.

A stored measurement mirrors :class:`app.schemas.analysis.ObservationIn` exactly -- the same
timestamp, the same entered weight, the same entered unit -- plus the bookkeeping an account
needs: a stable id, where it came from, and when it was created and last changed. Nothing here
converts a unit or reorders anything; that stays :func:`app.ingestion.normalise_observations`'s
job, run only at analysis time, exactly as for a submitted series (ADR-0001, ADR-0004).

Create and update reuse :class:`app.schemas.analysis.ObservationIn` as the request body, so a
stored measurement is validated by precisely the same rules a submitted one is.

Like every schema, this module depends only on :mod:`app.core` and :mod:`app.schemas`: it
knows nothing of :mod:`app.persistence`. Adapting a stored
:class:`app.persistence.repositories.MeasurementRecord` into :class:`MeasurementOut` is
:func:`app.services.measurements.measurement_out`'s job, one layer up.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analysis import MAX_OBSERVATIONS, ObservationIn

MeasurementUnit = Literal["kg", "lb"]
"""The unit a stored measurement was entered in."""

MeasurementSourceIn = Literal["manual", "csv"]
"""How a measurement being stored arrived. Echoed back unchanged; never inferred."""


class MeasurementBatchIn(BaseModel):
    """A batch of measurements to store at once, such as a CSV import's accepted rows."""

    model_config = ConfigDict(extra="forbid")

    observations: list[ObservationIn] = Field(
        min_length=1,
        max_length=MAX_OBSERVATIONS,
        description="Weigh-ins to store, in any order.",
    )
    source: MeasurementSourceIn = Field(
        default="manual", description="Recorded against every measurement created by this batch."
    )


class MeasurementOut(BaseModel):
    """One stored weigh-in."""

    id: str = Field(description="Stable identifier for this measurement.")
    timestamp: datetime = Field(description="When the weigh-in happened, in UTC.")
    weight: float = Field(description="The weight as entered, in the unit field.")
    unit: MeasurementUnit = Field(description="The unit the weight was entered in.")
    source: MeasurementSourceIn = Field(description="How this measurement was added.")
    created_at: datetime = Field(description="When this row was first stored (UTC).")
    updated_at: datetime = Field(description="When this row was last changed (UTC).")


class MeasurementListOut(BaseModel):
    """Every measurement the account holds, most recent first."""

    measurements: list[MeasurementOut]
    count: int = Field(ge=0, description="How many measurements are in this list.")


class MeasurementBatchOut(BaseModel):
    """The outcome of storing a batch.

    Carries counts only, not the rows themselves: a caller that wants the resulting history
    calls ``GET /api/me/measurements`` next, rather than this response duplicating it.
    """

    inserted_count: int = Field(ge=0, description="Measurements newly stored by this batch.")
    skipped_existing_count: int = Field(
        ge=0,
        description=(
            "Measurements in this batch that matched one already stored for this account "
            "(same instant, same weight once converted to kilograms) and were not "
            "duplicated. Re-submitting the same import is therefore idempotent."
        ),
    )
