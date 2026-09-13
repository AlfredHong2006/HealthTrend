"""Two ways to get an account's data out.

``build_account_export`` produces a complete, versioned JSON snapshot: account metadata,
preferences, the goal (or none), and every measurement -- everything HealthTrend stores, and
nothing it does not (this is not a copy of any hosting provider's backups).
``export_measurements_csv`` produces the measurement-only CSV a caller would actually want to
move into another tool or back into this one: three columns, ``timestamp,weight,unit``, in the
exact shape :func:`app.ingestion.csv.parse_csv` already accepts -- there is no second CSV
dialect to keep in sync, because this writer and that reader are proven to agree by
``tests/api/test_account_export.py``'s round-trip test.
"""

from __future__ import annotations

import csv
import io
from datetime import datetime

from app.persistence.repositories import Store, UserRecord
from app.schemas.account import GoalOut, PreferencesOut, UserOut
from app.schemas.export import AccountExportOut
from app.services.account import DEFAULT_DISPLAY_UNIT
from app.services.measurements import measurement_out

MEASUREMENTS_CSV_HEADER: tuple[str, str, str] = ("timestamp", "weight", "unit")


def build_account_export(user: UserRecord, *, now: datetime, store: Store) -> AccountExportOut:
    """Build the complete JSON export of ``user``'s account."""
    preferences = store.preferences.get(user.id)
    goal = store.goals.get(user.id)
    measurements = [measurement_out(record) for record in store.measurements.list_for_user(user.id)]
    return AccountExportOut(
        exported_at=now,
        account=UserOut(id=user.id, email=user.email, created_at=user.created_at),
        preferences=PreferencesOut(
            display_unit=DEFAULT_DISPLAY_UNIT if preferences is None else preferences.display_unit
        ),
        goal=None
        if goal is None
        else GoalOut(
            target_weight_kg=goal.target_weight_kg,
            target_weekly_rate_kg=goal.target_weekly_rate_kg,
        ),
        measurements=measurements,
    )


def export_measurements_csv(user_id: str, *, store: Store) -> str:
    """Return every measurement the account holds as re-importable CSV text.

    The header and column order (``timestamp,weight,unit``) are recognised as-is by
    :func:`app.ingestion.csv.parse_csv`: ``timestamp`` and ``unit`` each match one of its
    header aliases exactly, and ``weight`` matches its neutral (unit-carrying) alias, so a
    re-upload needs no special handling on either side.
    """
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(MEASUREMENTS_CSV_HEADER)
    for record in store.measurements.list_for_user(user_id):
        writer.writerow((record.timestamp.isoformat(), record.weight, record.unit))
    return buffer.getvalue()
