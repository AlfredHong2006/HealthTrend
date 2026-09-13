import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMeasurement,
  deleteAccount,
  deleteGoal,
  deleteMeasurement,
  getAccountAnalysis,
  getAccountJsonExport,
  getCurrentAccount,
  getMeasurements,
  getMeasurementsCsvExport,
  importMeasurementsBatch,
  logout,
  requestSignInCode,
  updateGoal,
  updateMeasurement,
  updatePreferences,
  verifySignInCode,
} from "../accountClient";
import { ApiError, NetworkError, UnauthorizedError } from "../errors";
import type { MeasurementOut, MeOut, ObservationIn } from "../types";

/**
 * Covers what is specific to the account/auth client: every call is credentialed, hits the
 * right URL and method, and the 401 -> `UnauthorizedError` distinction the `/app` boundary
 * relies on to tell "signed out" apart from every other failure. Request-shape, error-envelope
 * and network-failure coverage mirrors `browserClient.test.ts`, since both share the same
 * `parseErrorBody`/`publicApiBaseUrl` implementation.
 */

const ME: MeOut = {
  user: { id: "u1", email: "reader@example.com", created_at: "2026-01-01T00:00:00Z" },
  preferences: { display_unit: "kg" },
  goal: null,
  measurement_count: 3,
};

function mockFetchOnce(response: Response) {
  const fetchMock = vi.fn<typeof fetch>(async () => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("requestSignInCode", () => {
  it("POSTs the email and includes credentials, resolving to nothing on success", async () => {
    const fetchMock = mockFetchOnce(new Response(JSON.stringify({}), { status: 202 }));

    await expect(requestSignInCode("reader@example.com")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/auth/code/request");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init!.body as string)).toEqual({ email: "reader@example.com" });
  });

  it("throws ApiError for a rejected request", async () => {
    const body = { error: { code: "email_invalid", message: "That address is not valid." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 422 }));

    await expect(requestSignInCode("not-an-email")).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "email_invalid",
    });
  });

  it("throws NetworkError when the backend cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );

    await expect(requestSignInCode("reader@example.com")).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("verifySignInCode", () => {
  it("POSTs the email and code with credentials, resolving to the account on success", async () => {
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(ME), { status: 200 }));

    const result = await verifySignInCode("reader@example.com", "123456");

    expect(result).toEqual(ME);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/auth/code/verify");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
    expect(JSON.parse(init!.body as string)).toEqual({
      email: "reader@example.com",
      code: "123456",
    });
  });

  it("throws UnauthorizedError for an invalid or expired code", async () => {
    const body = { error: { code: "code_invalid", message: "That code is invalid or has expired." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 401 }));

    const error = await verifySignInCode("reader@example.com", "000000").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(UnauthorizedError);
    expect((error as UnauthorizedError).status).toBe(401);
    expect((error as UnauthorizedError).code).toBe("code_invalid");
  });
});

describe("getCurrentAccount", () => {
  it("GETs /api/me with credentials, resolving to the typed account on success", async () => {
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(ME), { status: 200 }));

    const result = await getCurrentAccount();

    expect(result).toEqual(ME);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me");
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("throws UnauthorizedError, not a generic ApiError, when there is no session", async () => {
    const body = { error: { code: "not_signed_in", message: "Not signed in." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 401 }));

    await expect(getCurrentAccount()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws NetworkError, not the raw fetch failure, when fetch itself rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("connect ECONNREFUSED");
      }),
    );

    const error = await getCurrentAccount().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as Error).message).toBe("Could not reach the analysis service.");
  });

  it("throws NetworkError when a 200 body is not valid JSON", async () => {
    mockFetchOnce(new Response("not json", { status: 200 }));

    await expect(getCurrentAccount()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("logout", () => {
  it("POSTs to /api/auth/logout with credentials and resolves on a 204", async () => {
    const fetchMock = mockFetchOnce(new Response(null, { status: 204 }));

    await expect(logout()).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/auth/logout");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
  });
});

describe("getAccountAnalysis", () => {
  it("GETs /api/me/analysis with credentials, resolving to the parsed analysis", async () => {
    const analysis = { n_obs: 1, span_days: 0 };
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(analysis), { status: 200 }));

    const result = await getAccountAnalysis();

    expect(result).toMatchObject(analysis);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/analysis");
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("throws ApiError when no measurements are stored", async () => {
    const body = { error: { code: "no_measurements", message: "No measurements are stored." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 422 }));

    await expect(getAccountAnalysis()).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "no_measurements",
    });
  });
});

const MEASUREMENT: MeasurementOut = {
  id: "m1",
  timestamp: "2026-08-21T07:30:00Z",
  weight: 72.4,
  unit: "kg",
  source: "manual",
  created_at: "2026-08-21T07:31:00Z",
  updated_at: "2026-08-21T07:31:00Z",
};

const OBSERVATION: ObservationIn = {
  timestamp: "2026-08-21T07:30:00Z",
  weight: 72.4,
  unit: "kg",
};

describe("getMeasurements", () => {
  it("GETs /api/me/measurements with credentials, resolving to the stored list", async () => {
    const list = { count: 1, measurements: [MEASUREMENT] };
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(list), { status: 200 }));

    const result = await getMeasurements();

    expect(result).toEqual(list);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/measurements");
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("throws NetworkError when the backend cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );

    await expect(getMeasurements()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("createMeasurement", () => {
  it("POSTs the bare observation with credentials, resolving to the stored row", async () => {
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(MEASUREMENT), { status: 201 }));

    const result = await createMeasurement(OBSERVATION);

    expect(result).toEqual(MEASUREMENT);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/measurements");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init!.body as string)).toEqual(OBSERVATION);
  });

  it("throws ApiError when the account's measurement cap was reached", async () => {
    const body = { error: { code: "measurement_cap_reached", message: "You have reached the limit." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 422 }));

    await expect(createMeasurement(OBSERVATION)).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "measurement_cap_reached",
    });
  });
});

describe("updateMeasurement", () => {
  it("PUTs the observation to the measurement's own URL, resolving to the updated row", async () => {
    const updated = { ...MEASUREMENT, weight: 73.1 };
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(updated), { status: 200 }));

    const result = await updateMeasurement("m1", OBSERVATION);

    expect(result).toEqual(updated);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/measurements/m1");
    expect(init).toMatchObject({
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init!.body as string)).toEqual(OBSERVATION);
  });

  it("URL-encodes the measurement id", async () => {
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(MEASUREMENT), { status: 200 }));

    await updateMeasurement("weird/id", OBSERVATION);

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "http://localhost:8000/api/me/measurements/weird%2Fid",
    );
  });

  it("throws ApiError when no measurement exists under that id", async () => {
    const body = { error: { code: "measurement_not_found", message: "No measurement exists under that id." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 404 }));

    const error = await updateMeasurement("missing", OBSERVATION).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });
});

describe("deleteMeasurement", () => {
  it("DELETEs the measurement's own URL with credentials and resolves on a 204", async () => {
    const fetchMock = mockFetchOnce(new Response(null, { status: 204 }));

    await expect(deleteMeasurement("m1")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/measurements/m1");
    expect(init).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("throws ApiError with status 404 when the measurement is already gone", async () => {
    const body = { error: { code: "measurement_not_found", message: "No measurement exists under that id." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 404 }));

    const error = await deleteMeasurement("m1").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
  });

  it("throws NetworkError when the backend cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("offline");
      }),
    );

    await expect(deleteMeasurement("m1")).rejects.toBeInstanceOf(NetworkError);
  });
});

function offline() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("offline");
    }),
  );
}

describe("importMeasurementsBatch", () => {
  it("POSTs the accepted observations with source csv, resolving to the real counts", async () => {
    const counts = { inserted_count: 1, skipped_existing_count: 2 };
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(counts), { status: 200 }));

    const result = await importMeasurementsBatch([OBSERVATION]);

    expect(result).toEqual(counts);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/measurements/batch");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init!.body as string)).toEqual({
      observations: [OBSERVATION],
      source: "csv",
    });
  });

  it("throws ApiError when the batch would exceed the measurement cap", async () => {
    const body = { error: { code: "measurement_limit_exceeded", message: "Too many measurements." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 422 }));

    await expect(importMeasurementsBatch([OBSERVATION])).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      code: "measurement_limit_exceeded",
    });
  });

  it("throws NetworkError when the backend cannot be reached", async () => {
    offline();
    await expect(importMeasurementsBatch([OBSERVATION])).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("updatePreferences", () => {
  it("PUTs the display unit with credentials, resolving to the stored preference", async () => {
    const fetchMock = mockFetchOnce(
      new Response(JSON.stringify({ display_unit: "lb" }), { status: 200 }),
    );

    await expect(updatePreferences({ display_unit: "lb" })).resolves.toEqual({
      display_unit: "lb",
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/preferences");
    expect(init).toMatchObject({ method: "PUT", credentials: "include" });
    expect(JSON.parse(init!.body as string)).toEqual({ display_unit: "lb" });
  });

  it("throws UnauthorizedError when the session has lapsed", async () => {
    mockFetchOnce(new Response(JSON.stringify({ error: { code: "x", message: "y" } }), { status: 401 }));
    await expect(updatePreferences({ display_unit: "kg" })).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("updateGoal / deleteGoal", () => {
  it("PUTs the full goal replacement in kilograms", async () => {
    const goal = { target_weight_kg: 78.5, target_weekly_rate_kg: null };
    const fetchMock = mockFetchOnce(new Response(JSON.stringify(goal), { status: 200 }));

    await expect(updateGoal(goal)).resolves.toEqual(goal);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/goal");
    expect(init).toMatchObject({ method: "PUT", credentials: "include" });
    expect(JSON.parse(init!.body as string)).toEqual(goal);
  });

  it("throws ApiError for an out-of-bounds goal", async () => {
    mockFetchOnce(new Response(JSON.stringify({ error: { code: "validation_error", message: "Invalid." } }), { status: 422 }));
    await expect(updateGoal({ target_weight_kg: 900 })).rejects.toMatchObject({ status: 422 });
  });

  it("DELETEs the goal and resolves on a 204", async () => {
    const fetchMock = mockFetchOnce(new Response(null, { status: 204 }));

    await expect(deleteGoal()).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/goal");
    expect(init).toMatchObject({ method: "DELETE", credentials: "include" });
  });

  it("throws NetworkError when the backend cannot be reached", async () => {
    offline();
    await expect(deleteGoal()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("exports", () => {
  it("fetches the measurement CSV from its own endpoint as a file body", async () => {
    const fetchMock = mockFetchOnce(
      new Response("timestamp,weight,unit\n", { status: 200, headers: { "Content-Type": "text/csv" } }),
    );

    const blob = await getMeasurementsCsvExport();

    expect(await blob.text()).toBe("timestamp,weight,unit\n");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/export/measurements.csv");
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("fetches the JSON account export from a distinct endpoint as a file body", async () => {
    const fetchMock = mockFetchOnce(new Response('{"export_version":1}', { status: 200 }));

    const blob = await getAccountJsonExport();

    expect(await blob.text()).toBe('{"export_version":1}');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me/export");
    expect(init).toMatchObject({ method: "GET", credentials: "include" });
  });

  it("throws UnauthorizedError rather than returning an error body as a file", async () => {
    mockFetchOnce(new Response(JSON.stringify({ error: { code: "x", message: "y" } }), { status: 401 }));
    await expect(getAccountJsonExport()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("deleteAccount", () => {
  it("DELETEs /api/me with the confirm_email body and resolves on a 204", async () => {
    const fetchMock = mockFetchOnce(new Response(null, { status: 204 }));

    await expect(deleteAccount("reader@example.com")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/me");
    expect(init).toMatchObject({
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init!.body as string)).toEqual({ confirm_email: "reader@example.com" });
  });

  it("throws ApiError when the confirmation does not match", async () => {
    const body = { error: { code: "confirmation_mismatch", message: "That email does not match." } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 422 }));

    const error = await deleteAccount("other@example.com").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("confirmation_mismatch");
  });

  it("throws NetworkError when the backend cannot be reached", async () => {
    offline();
    await expect(deleteAccount("reader@example.com")).rejects.toBeInstanceOf(NetworkError);
  });
});

// No dedicated "no browser persistence" case here: the repo-wide static guard
// (`src/lib/privacy/__tests__/no-persistence.test.ts`) already scans every source file,
// this one included, for those mechanisms -- a redundant runtime check here would only
// duplicate it, and could not name what it is checking for without tripping that same guard.
