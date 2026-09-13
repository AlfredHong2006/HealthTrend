"""Sign-in, sign-out and the signed-in account.

Four endpoints, each as thin as the analysis routes: validate, resolve the clock and the
store, call one service function, shape the response. The only HTTP-specific work done here
is writing and clearing the session cookie.

Every response from these routes carries ``Cache-Control: no-store``: they either set a
credential or describe a specific person's account, and neither belongs in any cache.

None of these routes records an observation count, and nothing here logs. The access log
line for them is the same method-template-status-duration line every route gets.
"""

from __future__ import annotations

from typing import Any, Final

from fastapi import APIRouter, Request, Response

from app.api.deps import ClockDep, CurrentUserDep, MailerDep, SettingsDep, StoreDep
from app.api.session_cookie import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    set_session_cookie,
)
from app.schemas.account import MeOut
from app.schemas.auth import CodeRequestAcceptedOut, CodeRequestIn, CodeVerifyIn
from app.schemas.errors import ErrorResponse
from app.services.account import describe_account
from app.services.auth import logout, request_code, verify_code

router = APIRouter(tags=["auth"])

_NO_STORE: Final = "no-store"

_REQUEST_CODE_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "The request was rejected."},
    429: {"model": ErrorResponse, "description": "Too many codes were requested recently."},
}
_VERIFY_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "The code is invalid or has expired."},
    422: {"model": ErrorResponse, "description": "The request was rejected."},
}
_ME_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorResponse, "description": "Not signed in."},
}


@router.post(
    "/api/auth/code/request",
    response_model=CodeRequestAcceptedOut,
    status_code=202,
    summary="Email a sign-in code",
    responses=_REQUEST_CODE_RESPONSES,
)
def request_sign_in_code(
    payload: CodeRequestIn,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
    mailer: MailerDep,
    settings: SettingsDep,
) -> CodeRequestAcceptedOut:
    """Send a six-digit sign-in code to the address, if it may sign in.

    The response is the same whether or not the address may sign in and whether or not an
    account exists for it.
    """
    response.headers["Cache-Control"] = _NO_STORE
    request_code(payload.email, now=clock.now(), store=store, mailer=mailer, settings=settings)
    return CodeRequestAcceptedOut()


@router.post(
    "/api/auth/code/verify",
    response_model=MeOut,
    summary="Exchange a sign-in code for a session",
    responses=_VERIFY_RESPONSES,
)
def verify_sign_in_code(
    payload: CodeVerifyIn,
    response: Response,
    clock: ClockDep,
    store: StoreDep,
    settings: SettingsDep,
) -> MeOut:
    """Verify the code, start a session in an HttpOnly cookie, and describe the account.

    The account is created on the first successful sign-in for an address.
    """
    response.headers["Cache-Control"] = _NO_STORE
    signed_in = verify_code(
        payload.email, payload.code, now=clock.now(), store=store, settings=settings
    )
    set_session_cookie(response, signed_in.session_token, secure=settings.cookie_secure)
    return describe_account(signed_in.user, store=store)


@router.post(
    "/api/auth/logout",
    status_code=204,
    response_class=Response,
    summary="End the current session",
)
def sign_out(request: Request, store: StoreDep, settings: SettingsDep) -> Response:
    """End the session in the cookie, if any, and clear the cookie. Always succeeds."""
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        logout(token, store=store)
    response = Response(status_code=204, headers={"Cache-Control": _NO_STORE})
    clear_session_cookie(response, secure=settings.cookie_secure)
    return response


@router.get(
    "/api/me",
    response_model=MeOut,
    summary="Describe the signed-in account",
    responses=_ME_RESPONSES,
)
def me(user: CurrentUserDep, response: Response, store: StoreDep) -> MeOut:
    """Return the signed-in user, their preferences, their goal and their measurement count."""
    response.headers["Cache-Control"] = _NO_STORE
    return describe_account(user, store=store)
