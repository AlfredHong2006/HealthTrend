/**
 * The two failure shapes an API call can produce, collapsed into one hierarchy so callers
 * have exactly one thing to catch.
 */

import type { ErrorBody } from "./types";

/** A response the server returned, but not a successful one. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, body: ErrorBody | undefined) {
    super(body?.message ?? `The analysis service responded with status ${status}.`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code;
  }
}

/** The requested demo scenario does not exist (HTTP 404). */
export class NotFoundError extends ApiError {
  constructor(body: ErrorBody | undefined) {
    super(404, body);
    this.name = "NotFoundError";
  }
}

/** The request never reached the server, or the response could not be parsed at all. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Could not reach the analysis service.");
    this.name = "NetworkError";
    this.cause = cause;
  }
}
