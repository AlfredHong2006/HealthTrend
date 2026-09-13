"""The signed-in account summary.

Returned by ``GET /api/me`` and by a successful sign-in. It describes the account and carries
no measurement values: the measurement count only, and no analysis. A goal is echoed back as
the user set it; it is presentation state and never an input to any estimate
(``docs/architecture.md``, goal neutrality).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserOut(BaseModel):
    """The signed-in user."""

    id: str = Field(description="Stable account identifier.")
    email: str = Field(description="The normalised email address used to sign in.")
    created_at: datetime = Field(description="When the account was created (UTC).")


class PreferencesOut(BaseModel):
    """Display preferences."""

    display_unit: Literal["kg", "lb"] = Field(
        description="Unit weights are displayed in. kg until the user chooses otherwise."
    )


class GoalOut(BaseModel):
    """The user's goal, in kilograms."""

    target_weight_kg: float | None = Field(description="Target weight, if set.")
    target_weekly_rate_kg: float | None = Field(
        description="Target rate of change per week, if set. Negative means losing."
    )


class MeOut(BaseModel):
    """Everything the app needs to know about the signed-in account on load."""

    user: UserOut
    preferences: PreferencesOut
    goal: GoalOut | None = Field(description="The user's goal, or null if none is set.")
    measurement_count: int = Field(ge=0, description="How many measurements are stored.")
