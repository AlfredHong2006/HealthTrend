import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestCsv, submitAnalysis } from "../browserClient";
import { ApiError, NetworkError } from "../errors";
import type { AnalysisRequest, CsvIngestResponse } from "../types";

/**
 * `submitAnalysis` and `ingestCsv` are the two calls this frontend makes directly from the
 * browser, so unlike `client.ts` (server-side, exercised in `client.test.ts`), this is the
 * boundary a real browser actually crosses. Covers what is specific to each: the request
 * shape, the base-URL resolution from `NEXT_PUBLIC_HEALTHTREND_API_URL` (including a
 * trailing slash, since that variable is deployment-supplied and easy to get wrong), and
 * that nothing either throws exposes the configured URL or a raw exception.
 */

const REQUEST: AnalysisRequest = {
  observations: [{ timestamp: "2026-08-21T07:30:00Z", weight: 72.4, unit: "kg" }],
  forecast_from: "now",
};

function mockFetchOnce(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

function withPublicApiUrl(url: string) {
  vi.stubEnv("NEXT_PUBLIC_HEALTHTREND_API_URL", url);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("submitAnalysis", () => {
  it("POSTs JSON to /api/analyse, with the request body round-tripped exactly", async () => {
    withPublicApiUrl("http://localhost:8000");
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ n_obs: 1 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await submitAnalysis(REQUEST);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("http://localhost:8000/api/analyse");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(init!.body as string)).toEqual(REQUEST);
  });

  it("strips a trailing slash from the configured base URL", async () => {
    withPublicApiUrl("http://localhost:8000/");
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ n_obs: 1 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await submitAnalysis(REQUEST);

    expect(String(fetchSpy.mock.calls[0]![0])).toBe("http://localhost:8000/api/analyse");
  });

  it("falls back to localhost:8000 when the public URL is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_HEALTHTREND_API_URL", undefined);
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ n_obs: 1 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await submitAnalysis(REQUEST);

    expect(String(fetchSpy.mock.calls[0]![0])).toBe("http://localhost:8000/api/analyse");
  });

  it("resolves with the parsed response on 200", async () => {
    withPublicApiUrl("http://localhost:8000");
    mockFetchOnce(new Response(JSON.stringify({ n_obs: 1, span_days: 0 }), { status: 200 }));

    const result = await submitAnalysis(REQUEST);

    expect(result).toMatchObject({ n_obs: 1, span_days: 0 });
  });

  it("raises ApiError carrying the backend's curated code and message on a 422", async () => {
    withPublicApiUrl("http://localhost:8000");
    const body = {
      error: {
        code: "observation_in_the_future",
        message: "The most recent observation is dated after the current time.",
        details: [],
      },
    };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 422 }));

    const error = await submitAnalysis(REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect((error as ApiError).code).toBe("observation_in_the_future");
    expect((error as ApiError).message).toBe(
      "The most recent observation is dated after the current time.",
    );
  });

  it("degrades to a generic ApiError when a non-2xx body does not match the error envelope", async () => {
    withPublicApiUrl("http://localhost:8000");
    mockFetchOnce(new Response("internal error", { status: 500 }));

    const error = await submitAnalysis(REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBeUndefined();
  });

  it("raises NetworkError, not the raw fetch failure, when fetch itself rejects", async () => {
    withPublicApiUrl("http://localhost:8000:9999"); // a deliberately odd URL to try to leak
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("connect ECONNREFUSED 127.0.0.1:9999");
      }),
    );

    const error = await submitAnalysis(REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as Error).message).toBe("Could not reach the analysis service.");
    expect((error as Error).message).not.toMatch(/9999|ECONNREFUSED|localhost/);
  });

  it("raises NetworkError, not a raw parsing exception, when a 200 body is not valid JSON", async () => {
    withPublicApiUrl("http://localhost:8000");
    mockFetchOnce(new Response("<html>not json</html>", { status: 200 }));

    const error = await submitAnalysis(REQUEST).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect((error as Error).message).toBe("Could not reach the analysis service.");
  });

  it("never lets the configured base URL or port reach a thrown message", async () => {
    withPublicApiUrl("http://internal-backend.example:8123");
    mockFetchOnce(new Response("not json", { status: 502 }));

    const error = await submitAnalysis(REQUEST).catch((e: unknown) => e);

    expect((error as Error).message).not.toMatch(/internal-backend\.example|8123/);
  });
});

const CSV_RESPONSE: CsvIngestResponse = {
  accepted: [{ timestamp: "2026-05-01T07:00:00Z", weight: 72.4, unit: "kg" }],
  rejected: [],
  issues_truncated: false,
  accepted_count: 1,
  rejected_count: 0,
  duplicate_count: 0,
  blank_rows_skipped: 0,
  naive_timestamp_count: 0,
  date_only_count: 0,
};

function csvFile(contents = "timestamp,weight\n2026-05-01T07:00:00Z,72.4\n"): File {
  return new File([contents], "history.csv", { type: "text/csv" });
}

describe("ingestCsv", () => {
  it("posts the file as a raw body, with the options in the query string", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(CSV_RESPONSE), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await ingestCsv(csvFile(), {
      assumedTimezone: "Europe/London",
      defaultUnit: "kg",
    });

    expect(result).toEqual(CSV_RESPONSE);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain("/api/ingest/csv");
    expect(url.searchParams.get("assumed_timezone")).toBe("Europe/London");
    expect(url.searchParams.get("default_unit")).toBe("kg");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("text/csv");
    expect(init.body).toBeInstanceOf(File);
  });

  it("throws ApiError for a non-2xx response, carrying the sanitised code and message", async () => {
    const errorBody = {
      error: { code: "csv_too_large", message: "The file exceeds the limit.", details: [] },
    };
    mockFetchOnce(new Response(JSON.stringify(errorBody), { status: 413 }));

    await expect(
      ingestCsv(csvFile(), { assumedTimezone: "UTC", defaultUnit: "kg" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 413,
      code: "csv_too_large",
      message: "The file exceeds the limit.",
    });
  });

  it("throws NetworkError when fetch itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

    await expect(
      ingestCsv(csvFile(), { assumedTimezone: "UTC", defaultUnit: "kg" }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it("throws NetworkError when the successful response body cannot be parsed", async () => {
    mockFetchOnce(new Response("not json", { status: 200 }));

    await expect(
      ingestCsv(csvFile(), { assumedTimezone: "UTC", defaultUnit: "kg" }),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
