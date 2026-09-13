"""The signed-in account: its summary, its analysis, its preferences, its goal, deletion.

:func:`describe_account` reads only; nothing in it changes an account. The summary
deliberately carries a measurement *count* and no measurement values.

:func:`analyse_account` is the one function here that produces numbers. It builds the same
:class:`app.schemas.analysis.AnalysisRequest` a submitted series would produce and calls the
unchanged :func:`app.services.analysis.analyse_submitted` -- no estimator logic is duplicated,
and no goal is ever read: the request is built from measurements alone, so there is no
parameter through which a goal could reach the estimator even by accident (goal neutrality,
``docs/architecture.md``). The only difference from a submitted analysis is presentational:
the response's ``meta.source`` is relabelled from ``"submitted"`` to ``"account"`` after the
fact, over an otherwise-untouched :class:`app.schemas.analysis.AnalysisResponse`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Final

from app.core.types import InsufficientDataError
from app.persistence.models import Unit
from app.persistence.repositories import Store, UserRecord
from app.schemas.account import GoalOut, MeOut, PreferencesOut, UserOut
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, ObservationIn
from app.services.analysis import analyse_submitted

DEFAULT_DISPLAY_UNIT: Final[Unit] = "kg"
"""The display unit of an account that has not chosen one."""

ACCOUNT_ANALYSIS_SOURCE: Final = "account"
"""The value :func:`analyse_account` relabels ``meta.source`` to."""


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


def analyse_account(user_id: str, *, now: datetime, store: Store) -> AnalysisResponse:
    """Analyse the account's own stored measurement history.

    Raises:
        InsufficientDataError: the account holds no measurements. The same error, and the
            same response, a submitted series with zero observations would raise.
        FutureObservationError: the most recent stored measurement is dated after ``now``.
            Storing a measurement does not itself reject a future timestamp, so this is
            reachable here; it is the same named error a submitted series with the same
            problem would raise, rather than a generic core failure.
    """
    observations = [
        ObservationIn(timestamp=record.timestamp, weight=record.weight, unit=record.unit)
        for record in store.measurements.list_for_user(user_id)
    ]
    if not observations:
        # AnalysisRequest.observations requires at least one item, so a request-schema
        # validation error would otherwise surface as an opaque 500 rather than this named,
        # already-published error -- the same one a submitted series with zero observations
        # raises (app.services.analysis._analyse).
        raise InsufficientDataError(
            "at least one observation is required to estimate a latent weight"
        )
    request = AnalysisRequest(observations=observations, forecast_from="now")
    response = analyse_submitted(request, now=now)
    return response.model_copy(
        update={"meta": response.meta.model_copy(update={"source": ACCOUNT_ANALYSIS_SOURCE})}
    )


def set_preferences(user_id: str, *, display_unit: Unit, now: datetime, store: Store) -> None:
    """Replace the account's display preferences."""
    store.preferences.upsert(user_id, display_unit=display_unit, now=now)
    store.commit()


def set_goal(
    user_id: str,
    *,
    target_weight_kg: float | None,
    target_weekly_rate_kg: float | None,
    now: datetime,
    store: Store,
) -> None:
    """Replace the account's goal. Never read by any analysis."""
    store.goals.upsert(
        user_id,
        target_weight_kg=target_weight_kg,
        target_weekly_rate_kg=target_weekly_rate_kg,
        now=now,
    )
    store.commit()


def clear_goal(user_id: str, *, store: Store) -> None:
    """Remove the account's goal, if one is set. Not an error if none is."""
    store.goals.delete(user_id)
    store.commit()


def delete_account(user: UserRecord, *, store: Store) -> None:
    """Hard-delete the account and everything it owns.

    Deleting the user row cascades to their sessions, measurements, preferences and goal
    (``ON DELETE CASCADE``, :mod:`app.persistence.models`). ``login_codes`` carries no
    foreign key to ``users`` -- a code can exist before an account does -- so it is purged by
    email explicitly; otherwise a code issued moments before deletion would outlive the
    account it was issued for.
    """
    store.login_codes.delete_for_email(user.email)
    store.users.delete(user.id)
    store.commit()
