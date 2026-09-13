"""The complete account export: everything HealthTrend stores about one account, as JSON.

Deliberately distinct from the measurement-only CSV export
(``GET /api/me/export/measurements.csv``, built in :mod:`app.services.export` from
:class:`app.schemas.measurements.MeasurementOut`): this is a full, versioned snapshot of the
account -- its metadata, its preferences, its goal and its measurements -- for a person who
wants everything HealthTrend holds about them, not a file meant to be re-imported.

It states only what HealthTrend actually stores. It is not, and must never be worded as, a
copy of a hosting provider's backups or of anything HealthTrend does not possess.
"""

from __future__ import annotations

from datetime import datetime
from typing import Final, Literal

from pydantic import BaseModel, Field

from app.schemas.account import GoalOut, PreferencesOut, UserOut
from app.schemas.measurements import MeasurementOut

EXPORT_VERSION: Final = 1
"""The export shape's version. Bumped only when a field's meaning changes, so that a saved
export can always be read against the version it names."""


class AccountExportOut(BaseModel):
    """A complete, versioned snapshot of one account."""

    export_version: Literal[1] = Field(
        default=EXPORT_VERSION, description="The shape of this export. Currently always 1."
    )
    exported_at: datetime = Field(description="When this export was generated (UTC).")
    account: UserOut
    preferences: PreferencesOut
    goal: GoalOut | None = Field(description="The account's goal, or null if none is set.")
    measurements: list[MeasurementOut] = Field(description="Every measurement the account holds.")
