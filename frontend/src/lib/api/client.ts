/**
 * The two calls this frontend makes. Plain `fetch`, no client, no instance, no caching
 * layer: one request per page load is not a problem a data-fetching library needs to solve.
 *
 * Every call runs from a Next.js server component, never from the browser -- so the backend
 * URL never reaches the client bundle, and `cache: "no-store"` is not optional: demo series
 * are generated relative to the current instant (ADR-0007), so the same URL legitimately
 * returns different data from one request to the next.
 */

import { apiBaseUrl } from "@/lib/config";
import { ApiError, NetworkError, NotFoundError } from "./errors";
import type { DemoAnalysis, DemoCatalogue, ErrorBody } from "./types";

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { cache: "no-store" });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.ok) {
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new NetworkError(cause);
    }
  }

  const body = await parseErrorBody(response);
  if (response.status === 404) {
    throw new NotFoundError(body);
  }
  throw new ApiError(response.status, body);
}

/**
 * Read the M2 error envelope (`{"error": {code, message, details}}`) if the body has that
 * shape. A response that fails to parse, or parses into something else, degrades to
 * `undefined` rather than throwing -- the caller still gets a usable error with a generic
 * message, which is preferable to losing the original HTTP status to a parsing exception.
 */
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

/** List the five synthetic demo scenarios. */
export function fetchDemoCatalogue(): Promise<DemoCatalogue> {
  return getJson<DemoCatalogue>("/api/demo");
}

/**
 * Fetch and analyse one named demo scenario.
 *
 * @throws {NotFoundError} if `scenarioId` is not a registered scenario.
 * @throws {ApiError} for any other non-2xx response.
 * @throws {NetworkError} if the backend cannot be reached, or its response is unparsable.
 */
export function fetchDemoAnalysis(scenarioId: string): Promise<DemoAnalysis> {
  return getJson<DemoAnalysis>(`/api/demo/${encodeURIComponent(scenarioId)}`);
}
