/**
 * The browser-side account and passwordless-auth client against the cookie-authenticated
 * `/api/auth/*` and `/api/me*` routes: Stage 4's sign-in/session calls, Stage 5's measurement
 * CRUD, and Stage 6's batch import, preferences, goal, exports and account deletion.
 *
 * Runs from the browser for the same reason `browserClient.ts` does -- these are calls a
 * signed-in visitor's own browser makes directly, not a Next.js server component acting on
 * their behalf -- so this shares that module's base-URL resolution and error-body parsing
 * rather than duplicating them; the two are the same environment, unlike the server/browser
 * split `browserClient.ts`'s own docstring explains for its relationship to `client.ts`.
 *
 * Every request here carries `credentials: "include"` so the browser attaches and stores the
 * HttpOnly `ht_session` cookie the backend sets on verification. Nothing in this module reads,
 * writes or otherwise inspects that cookie, or any other browser storage, itself -- the session
 * is entirely the backend's concern (docs/privacy.md).
 */

import { parseErrorBody, publicApiBaseUrl } from "./browserClient";
import { ApiError, NetworkError, UnauthorizedError } from "./errors";
import type {
  AnalysisResponse,
  GoalIn,
  GoalOut,
  MeasurementBatchOut,
  MeasurementListOut,
  MeasurementOut,
  MeOut,
  ObservationIn,
  PreferencesIn,
  PreferencesOut,
} from "./types";

/** The credentialed request and the error mapping every call here shares; returns only a
 * successful response, leaving how to read its body to the caller. */
async function send(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${publicApiBaseUrl()}${path}`, { ...init, credentials: "include" });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.ok) {
    return response;
  }

  const body = await parseErrorBody(response);
  if (response.status === 401) {
    throw new UnauthorizedError(body);
  }
  throw new ApiError(response.status, body);
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await send(path, init);
  if (response.status === 204) {
    return undefined as T;
  }
  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new NetworkError(cause);
  }
}

/** A download body, read as bytes rather than parsed: the caller hands it straight to the
 * browser as a file and keeps nothing. */
async function requestBlob(path: string): Promise<Blob> {
  const response = await send(path, { method: "GET" });
  try {
    return await response.blob();
  } catch (cause) {
    throw new NetworkError(cause);
  }
}

/**
 * Ask the backend to email a six-digit sign-in code, if the address may sign in.
 *
 * Resolves to nothing: the backend's response (`CodeRequestAcceptedOut`) is deliberately empty
 * and identical whether or not an account exists or the address may sign in, so there is
 * nothing here for a caller to branch on -- the UI must show the same thing either way.
 *
 * @throws {ApiError} if the request was rejected (422) or too many codes were requested
 *   recently (429).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export async function requestSignInCode(email: string): Promise<void> {
  await requestJson<Record<string, never>>("/api/auth/code/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

/**
 * Exchange an emailed code for a session. The backend sets the `ht_session` cookie itself as
 * part of this response; this only returns the account description it replies with.
 *
 * @throws {UnauthorizedError} if the code is invalid or has expired (401).
 * @throws {ApiError} if the request was rejected (422).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function verifySignInCode(email: string, code: string): Promise<MeOut> {
  return requestJson<MeOut>("/api/auth/code/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
}

/**
 * Describe the signed-in account: its user record, preferences, goal and measurement count.
 *
 * @throws {UnauthorizedError} if there is no session (401) -- the normal way a caller learns
 *   the visitor is signed out, not an exceptional condition.
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function getCurrentAccount(): Promise<MeOut> {
  return requestJson<MeOut>("/api/me", { method: "GET" });
}

/**
 * End the session. The backend clears the `ht_session` cookie in its response; nothing here
 * touches it directly.
 *
 * @throws {ApiError} for a non-2xx, non-401 response.
 * @throws {NetworkError} if the backend cannot be reached.
 */
export async function logout(): Promise<void> {
  await requestJson<undefined>("/api/auth/logout", { method: "POST" });
}

/**
 * Analyse the account's own stored measurement history, forecasting from the current instant.
 *
 * Answers in the same `AnalysisResponse` shape `POST /api/analyse` does (`meta.source` reads
 * `"account"` in place of `"submitted"`), so it needs no renderer of its own.
 *
 * @throws {ApiError} if no measurements are stored, or one is invalid (422). Callers should
 *   check `MeOut.measurement_count` first and skip this call at zero rather than lean on this
 *   error for that case.
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function getAccountAnalysis(): Promise<AnalysisResponse> {
  return requestJson<AnalysisResponse>("/api/me/analysis", { method: "GET" });
}

/**
 * List every measurement the account holds, most recent first -- the backend's own ordering,
 * not one reconstructed here.
 *
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function getMeasurements(): Promise<MeasurementListOut> {
  return requestJson<MeasurementListOut>("/api/me/measurements", { method: "GET" });
}

/**
 * Store one manually entered measurement. The backend implies `source: "manual"` for this
 * route by itself; nothing here sends a source.
 *
 * @throws {ApiError} if the account's measurement cap was reached (422).
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function createMeasurement(observation: ObservationIn): Promise<MeasurementOut> {
  return requestJson<MeasurementOut>("/api/me/measurements", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(observation),
  });
}

/**
 * Replace a stored measurement's timestamp, weight and unit.
 *
 * @throws {ApiError} if no measurement exists under that id (404), or the request was rejected
 *   (422).
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function updateMeasurement(id: string, observation: ObservationIn): Promise<MeasurementOut> {
  return requestJson<MeasurementOut>(`/api/me/measurements/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(observation),
  });
}

/**
 * Delete a stored measurement.
 *
 * @throws {ApiError} if no measurement exists under that id (404) -- including one already
 *   deleted by an earlier request.
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export async function deleteMeasurement(id: string): Promise<void> {
  await requestJson<undefined>(`/api/me/measurements/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * Store a CSV import's accepted rows in the account history, recorded as `source: "csv"`.
 *
 * The backend skips any row matching one already stored for this account and reports how many
 * it inserted and skipped; nothing here detects duplicates itself.
 *
 * @throws {ApiError} if storing the batch would exceed the account's measurement cap (422) --
 *   in which case nothing is written.
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function importMeasurementsBatch(observations: ObservationIn[]): Promise<MeasurementBatchOut> {
  return requestJson<MeasurementBatchOut>("/api/me/measurements/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observations, source: "csv" }),
  });
}

/**
 * Replace the account's display preferences. Presentation only: no stored reading is touched.
 *
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function updatePreferences(preferences: PreferencesIn): Promise<PreferencesOut> {
  return requestJson<PreferencesOut>("/api/me/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });
}

/**
 * Replace the account's goal -- a full replacement, so an omitted field is stored as null. The
 * goal is never read by any analysis.
 *
 * @throws {ApiError} if a value is outside the accepted bounds (422).
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function updateGoal(goal: GoalIn): Promise<GoalOut> {
  return requestJson<GoalOut>("/api/me/goal", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(goal),
  });
}

/**
 * Remove the account's goal. Idempotent: succeeds whether or not one was set.
 *
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export async function deleteGoal(): Promise<void> {
  await requestJson<undefined>("/api/me/goal", { method: "DELETE" });
}

/**
 * Every stored measurement as re-importable CSV (`timestamp,weight,unit`), as a file body.
 *
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function getMeasurementsCsvExport(): Promise<Blob> {
  return requestBlob("/api/me/export/measurements.csv");
}

/**
 * The complete, versioned JSON snapshot of what HealthTrend stores for this account, as a file
 * body. Fetched rather than linked: this endpoint sends no `Content-Disposition`, so a plain
 * link would open raw JSON on the API origin instead of saving a file.
 *
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export function getAccountJsonExport(): Promise<Blob> {
  return requestBlob("/api/me/export");
}

/**
 * Permanently delete the account and everything it owns. The backend clears the session cookie
 * in its response.
 *
 * @throws {ApiError} if `confirmEmail` does not match the signed-in account (422).
 * @throws {UnauthorizedError} if there is no session (401).
 * @throws {NetworkError} if the backend cannot be reached.
 */
export async function deleteAccount(confirmEmail: string): Promise<void> {
  await requestJson<undefined>("/api/me", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm_email: confirmEmail }),
  });
}
