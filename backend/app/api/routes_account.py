"""Measurement history, account-backed analysis, preferences, goal, export and deletion.

Every route in this module requires :data:`app.api.deps.CurrentUserDep`: the ``user_id`` a
route acts on comes only from the resolved session, never from a request body or a path
parameter (``docs/architecture.md``, ownership scoping). Every response carries
``Cache-Control: no-store``, the same as the auth routes: each one either describes or changes
one specific account.

``GET /api/me/analysis`` is the one route that produces numbers, and it produces them by
calling the unchanged :func:`app.services.analysis.analyse_submitted` through
:func:`app.services.account.analyse_account` -- no estimator logic is duplicated here or
anywhere in this module.
"""

from __future__ import annotations

from typing import Any, Final

from fastapi import APIRouter, Request, Response

from app.api.deps import ClockDep, CurrentUserDep, SettingsDep, StoreDep
from app.api.logging import record_observation_count
from app.api.session_cookie import clear_session_cookie
from app.errors import ConfirmationMismatchError
from app.schemas.account import DeleteAccountIn, GoalIn, GoalOut, PreferencesIn, PreferencesOut
from app.schemas.analysis import AnalysisResponse, ObservationIn
from app.schemas.errors import ErrorResponse
from app.schemas.export import AccountExportOut
from app.schemas.measurements import (
    MeasurementBatchIn,
    MeasurementBatchOut,
    MeasurementListOut,
    MeasurementOut,
)
from app.services.account import (
    analyse_account,
    clear_goal,
    delete_account,
    set_goal,
    set_preferences,
)
from app.services.export import build_account_export, export_measurements_csv
from app.services.measurements import (
    create_measurement,
    delete_measurement,
    import_batch,
    list_measurements,
    update_measurement,
)

router = APIRouter(tags=["account"])

_NO_STORE: Final = "no-store"
_MEASUREMENTS_CSV_FILENAME: Final = "healthtrend-measurements.csv"

_MEASUREMENT_NOT_FOUND_RESPONSES: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorResponse, "description": "No measurement exists under that id."},
}
_MEASUREMENT_LIMIT_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "The account's measurement cap was reached."},
}
_ANALYSIS_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "No measurements are stored, or one is invalid."},
}
_DELETE_ACCOUNT_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "confirm_email did not match the account."},
}


def _no_store(response: Response) -> None:
    response.headers["Cache-Control"] = _NO_STORE


# --- measurements -----------------------------------------------------------------------


@router.get(
    "/api/me/measurements",
    response_model=MeasurementListOut,
    summary="List every stored measurement",
)
def list_my_measurements(
    user: CurrentUserDep, response: Response, store: StoreDep
) -> MeasurementListOut:
    """Return every measurement the account holds, most recent first."""
    _no_store(response)
    measurements = list_measurements(user.id, store=store)
    return MeasurementListOut(measurements=measurements, count=len(measurements))


@router.post(
    "/api/me/measurements",
    response_model=MeasurementOut,
    status_code=201,
    summary="Store one measurement",
    responses=_MEASUREMENT_LIMIT_RESPONSES,
)
def create_my_measurement(
    payload: ObservationIn,
    user: CurrentUserDep,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
) -> MeasurementOut:
    """Store one manually entered measurement."""
    _no_store(response)
    return create_measurement(user.id, payload, source="manual", now=clock.now(), store=store)


@router.put(
    "/api/me/measurements/{measurement_id}",
    response_model=MeasurementOut,
    summary="Replace a stored measurement",
    responses=_MEASUREMENT_NOT_FOUND_RESPONSES,
)
def update_my_measurement(
    measurement_id: str,
    payload: ObservationIn,
    user: CurrentUserDep,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
) -> MeasurementOut:
    """Replace a stored measurement's timestamp, weight and unit.

    ``measurement_id`` belonging to another account is rejected identically to one that does
    not exist: both raise ``measurement_not_found``.
    """
    _no_store(response)
    return update_measurement(user.id, measurement_id, payload, now=clock.now(), store=store)


@router.delete(
    "/api/me/measurements/{measurement_id}",
    status_code=204,
    response_class=Response,
    summary="Delete a stored measurement",
    responses=_MEASUREMENT_NOT_FOUND_RESPONSES,
)
def delete_my_measurement(measurement_id: str, user: CurrentUserDep, store: StoreDep) -> Response:
    """Delete a stored measurement."""
    delete_measurement(user.id, measurement_id, store=store)
    return Response(status_code=204, headers={"Cache-Control": _NO_STORE})


@router.post(
    "/api/me/measurements/batch",
    response_model=MeasurementBatchOut,
    summary="Store several measurements at once, such as a CSV import's accepted rows",
    responses=_MEASUREMENT_LIMIT_RESPONSES,
)
def batch_create_my_measurements(
    payload: MeasurementBatchIn,
    user: CurrentUserDep,
    request: Request,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
) -> MeasurementBatchOut:
    """Store a batch of measurements. Re-submitting the same batch inserts nothing new."""
    _no_store(response)
    record_observation_count(request, len(payload.observations))
    inserted, skipped = import_batch(
        user.id, payload.observations, source=payload.source, now=clock.now(), store=store
    )
    return MeasurementBatchOut(inserted_count=inserted, skipped_existing_count=skipped)


# --- analysis -----------------------------------------------------------------------------


@router.get(
    "/api/me/analysis",
    response_model=AnalysisResponse,
    summary="Analyse the account's own stored measurement history",
    responses=_ANALYSIS_RESPONSES,
)
def analyse_my_account(
    user: CurrentUserDep, request: Request, response: Response, clock: ClockDep, store: StoreDep
) -> AnalysisResponse:
    """Analyse every measurement the account holds, forecasting from the current instant.

    Calls the same :func:`app.services.analysis.analyse_submitted` a submitted series does;
    ``meta.source`` reads ``"account"`` in place of ``"submitted"`` and nothing else differs.
    """
    _no_store(response)
    analysis = analyse_account(user.id, now=clock.now(), store=store)
    record_observation_count(request, analysis.n_obs)
    return analysis


# --- preferences --------------------------------------------------------------------------


@router.put(
    "/api/me/preferences",
    response_model=PreferencesOut,
    summary="Replace the account's display preferences",
)
def update_my_preferences(
    payload: PreferencesIn,
    user: CurrentUserDep,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
) -> PreferencesOut:
    """Replace the account's display preferences."""
    _no_store(response)
    set_preferences(user.id, display_unit=payload.display_unit, now=clock.now(), store=store)
    return PreferencesOut(display_unit=payload.display_unit)


# --- goal ---------------------------------------------------------------------------------


@router.put(
    "/api/me/goal",
    response_model=GoalOut,
    summary="Replace the account's goal",
)
def update_my_goal(
    payload: GoalIn, user: CurrentUserDep, response: Response, clock: ClockDep, store: StoreDep
) -> GoalOut:
    """Replace the account's goal. Never read by any analysis (goal neutrality)."""
    _no_store(response)
    set_goal(
        user.id,
        target_weight_kg=payload.target_weight_kg,
        target_weekly_rate_kg=payload.target_weekly_rate_kg,
        now=clock.now(),
        store=store,
    )
    return GoalOut(
        target_weight_kg=payload.target_weight_kg,
        target_weekly_rate_kg=payload.target_weekly_rate_kg,
    )


@router.delete(
    "/api/me/goal",
    status_code=204,
    response_class=Response,
    summary="Remove the account's goal",
)
def delete_my_goal(user: CurrentUserDep, store: StoreDep) -> Response:
    """Remove the account's goal, if one is set. Not an error if none is."""
    clear_goal(user.id, store=store)
    return Response(status_code=204, headers={"Cache-Control": _NO_STORE})


# --- export -------------------------------------------------------------------------------


@router.get(
    "/api/me/export",
    response_model=AccountExportOut,
    summary="Export everything HealthTrend stores about this account, as JSON",
)
def export_my_account(
    user: CurrentUserDep, response: Response, clock: ClockDep, store: StoreDep
) -> AccountExportOut:
    """Return a complete, versioned snapshot of the account.

    Metadata, preferences, the goal (or none), and every measurement -- everything
    HealthTrend stores, and nothing it does not: not a copy of any hosting provider's
    backups.
    """
    _no_store(response)
    return build_account_export(user, now=clock.now(), store=store)


@router.get(
    "/api/me/export/measurements.csv",
    summary="Export stored measurements as re-importable CSV",
    response_class=Response,
    responses={200: {"content": {"text/csv": {"schema": {"type": "string"}}}}},
)
def export_my_measurements_csv(user: CurrentUserDep, store: StoreDep) -> Response:
    """Return every stored measurement as CSV: ``timestamp,weight,unit``.

    The exact shape :func:`app.ingestion.csv.parse_csv` already accepts, so the file can be
    re-imported through ``POST /api/ingest/csv`` unchanged.
    """
    csv_text = export_measurements_csv(user.id, store=store)
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={
            "Cache-Control": _NO_STORE,
            "Content-Disposition": f'attachment; filename="{_MEASUREMENTS_CSV_FILENAME}"',
        },
    )


# --- account deletion ----------------------------------------------------------------------


@router.delete(
    "/api/me",
    status_code=204,
    response_class=Response,
    summary="Permanently delete the account and everything it owns",
    responses=_DELETE_ACCOUNT_RESPONSES,
)
def delete_my_account(
    payload: DeleteAccountIn,
    user: CurrentUserDep,
    store: StoreDep,
    settings: SettingsDep,
) -> Response:
    """Hard-delete the account and everything it owns.

    Its sessions, measurements, preferences, goal and issued sign-in codes. Requires
    retyping the account's own email address as confirmation.
    """
    if payload.confirm_email != user.email:
        raise ConfirmationMismatchError("confirm_email did not match")
    delete_account(user, store=store)
    response = Response(status_code=204, headers={"Cache-Control": _NO_STORE})
    clear_session_cookie(response, secure=settings.cookie_secure)
    return response
