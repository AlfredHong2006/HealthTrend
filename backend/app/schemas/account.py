"""The signed-in account: its summary, its preferences, its goal, and account deletion.

The summary (``MeOut``, returned by ``GET /api/me`` and by a successful sign-in) describes the
account and carries no measurement values: the measurement count only, and no analysis. A goal
is echoed back exactly as the user set it; it is presentation state and never an input to any
estimate -- ``PUT /api/me/goal`` and ``DELETE /api/me/goal`` change what is stored and nothing
else, and ``app.services.account.analyse_account`` never reads a goal (``docs/architecture.md``,
goal neutrality; ``tests/api/test_account_analysis.py`` is the regression test for that).

The goal bounds mirror ``frontend/src/lib/v2/goal.ts`` exactly, so a value the frontend would
accept is never rejected by the API and vice versa.
"""

from __future__ import annotations

from datetime import datetime
from typing import Final, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.auth import EmailAddress

GOAL_MIN_KG: Final = 20.0
"""Lower bound for a target weight. Input validation, not a claim about anybody's weight."""

GOAL_MAX_KG: Final = 400.0
"""Upper bound for a target weight."""

TARGET_RATE_LIMIT_KG_PER_WEEK: Final = 5.0
"""Bound for a target weekly rate, either direction."""


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


class PreferencesIn(BaseModel):
    """Replace the account's display preferences."""

    model_config = ConfigDict(extra="forbid")

    display_unit: Literal["kg", "lb"] = Field(description="Unit weights should be displayed in.")


class GoalOut(BaseModel):
    """The user's goal, in kilograms."""

    target_weight_kg: float | None = Field(description="Target weight, if set.")
    target_weekly_rate_kg: float | None = Field(
        description="Target rate of change per week, if set. Negative means losing."
    )


class GoalIn(BaseModel):
    """Replace the account's goal.

    A full replacement, not a merge: an omitted field is stored as ``null``, the same as an
    explicit one. Never read by any analysis (goal neutrality).
    """

    model_config = ConfigDict(extra="forbid")

    target_weight_kg: float | None = Field(
        default=None,
        ge=GOAL_MIN_KG,
        le=GOAL_MAX_KG,
        description="Target weight in kilograms, or null for none.",
    )
    target_weekly_rate_kg: float | None = Field(
        default=None,
        ge=-TARGET_RATE_LIMIT_KG_PER_WEEK,
        le=TARGET_RATE_LIMIT_KG_PER_WEEK,
        description="Target rate of change per week in kilograms, or null for none.",
    )


class MeOut(BaseModel):
    """Everything the app needs to know about the signed-in account on load."""

    user: UserOut
    preferences: PreferencesOut
    goal: GoalOut | None = Field(description="The user's goal, or null if none is set.")
    measurement_count: int = Field(ge=0, description="How many measurements are stored.")


class DeleteAccountIn(BaseModel):
    """Confirm irreversible account deletion by retyping the account's email address."""

    model_config = ConfigDict(extra="forbid")

    confirm_email: EmailAddress = Field(
        description="Must equal the signed-in account's email address, or the request is rejected."
    )
