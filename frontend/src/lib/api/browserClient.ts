/**
 * The one call this frontend makes directly from the browser: submitting manually-entered
 * measurements for analysis. Every other fetch runs from a Next.js server component
 * (`src/lib/api/client.ts`), which is why this is a separate module rather than an addition
 * to that one -- mixing the server-only base-URL resolver with a browser-safe one in a single
 * function is the kind of thing that fails silently (an unset variable reaching the browser
 * bundle as `undefined`) rather than loudly, and the two are read from genuinely different
 * environment variables for exactly that reason.
 *
 * `NEXT_PUBLIC_HEALTHTREND_API_URL` is a Next.js **build-time** value: it is baked into the
 * client bundle when the frontend is built, not read per request the way `HEALTHTREND_API_URL`
 * is on the server. A deployment must supply it to the frontend build, not only to whatever
 * runs the server (docs/privacy.md).
 */

import { ApiError, NetworkError } from "./errors";
import type { AnalysisRequest, AnalysisResponse, ErrorBody } from "./types";

function publicApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_HEALTHTREND_API_URL ?? "http://localhost:8000";
  return url.replace(/\/+$/, "");
}

/** Mirrors `src/lib/api/client.ts`'s `parseErrorBody`, duplicated rather than shared: see the
 * module docstring for why this file does not import from that one. */
async function parseErrorBody(response: Response): Promise<ErrorBody | undefined> {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "object" &&
      (payload as { error: unknown }).error !== null
    ) {
      return (payload as { error: ErrorBody }).error;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Submit measurements for analysis, straight from the browser to FastAPI.
 *
 * @throws {ApiError} for a non-2xx response, e.g. a future-dated observation (422).
 * @throws {NetworkError} if the backend cannot be reached, or its response is unparsable.
 */
export async function submitAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
  let response: Response;
  try {
    response = await fetch(`${publicApiBaseUrl()}/api/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.ok) {
    try {
      return (await response.json()) as AnalysisResponse;
    } catch (cause) {
      throw new NetworkError(cause);
    }
  }

  throw new ApiError(response.status, await parseErrorBody(response));
}
