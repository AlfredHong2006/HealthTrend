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
import type { AnalysisRequest, AnalysisResponse, CsvIngestResponse, ErrorBody } from "./types";

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

interface IngestCsvOptions {
  /** IANA timezone (e.g. "Europe/London") for timestamps with no UTC offset. */
  assumedTimezone: string;
  /** Unit assumed for a weight column with no per-row or header-implied unit. */
  defaultUnit: "kg" | "lb";
}

/**
 * Parse an uploaded CSV file into observations ready for {@link submitAnalysis}.
 *
 * The file is sent as the raw request body (not `multipart/form-data`): the backend reads
 * it as a capped stream and never invokes a multipart parser, which is what lets it promise
 * the upload is never written to disk (ADR-0010). `fetch` accepts a `File` directly as
 * `body`, so no `FormData` wrapping is needed either.
 *
 * @throws {ApiError} for a non-2xx response, e.g. a file that is too large (413), the wrong
 *   Content-Type (415), or a structural problem with the CSV itself (422).
 * @throws {NetworkError} if the backend cannot be reached, or its response is unparsable.
 */
export async function ingestCsv(
  file: File,
  { assumedTimezone, defaultUnit }: IngestCsvOptions,
): Promise<CsvIngestResponse> {
  const url = new URL(`${publicApiBaseUrl()}/api/ingest/csv`);
  url.searchParams.set("assumed_timezone", assumedTimezone);
  url.searchParams.set("default_unit", defaultUnit);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: file,
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (response.ok) {
    try {
      return (await response.json()) as CsvIngestResponse;
    } catch (cause) {
      throw new NetworkError(cause);
    }
  }

  throw new ApiError(response.status, await parseErrorBody(response));
}
