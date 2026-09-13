"""The signed-in account: what the app is told about it on load.

Reads only; nothing here changes an account. The summary deliberately carries a measurement
*count* and no measurement values, and no analysis -- the analysis of stored measurements goes
through :func:`app.services.analysis.analyse_submitted`, exactly as a submitted series does.
"""

from __future__ import annotations

from typing import Final

from app.persistence.models import Unit
from app.persistence.repositories import Store, UserRecord
from app.schemas.account import GoalOut, MeOut, PreferencesOut, UserOut

DEFAULT_DISPLAY_UNIT: Final[Unit] = "kg"
"""The display unit of an account that has not chosen one."""


def describe_account(user: UserRecord, *, store: Store) -> MeOut:
    """Summarise ``user``'s account for the app."""
    preferences = store.preferences.get(user.id)
    goal = store.goals.get(user.id)
    return MeOut(
        user=UserOut(id=user.id, email=user.email, created_at=user.created_at),
        preferences=PreferencesOut(
            display_unit=DEFAULT_DISPLAY_UNIT if preferences is None else preferences.display_unit
        ),
        goal=None
        if goal is None
        else GoalOut(
            target_weight_kg=goal.target_weight_kg,
            target_weekly_rate_kg=goal.target_weekly_rate_kg,
        ),
        measurement_count=store.measurements.count_for_user(user.id),
    )
