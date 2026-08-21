import { afterEach, describe, expect, it, vi } from "vitest";
import gradualLossCapture from "../__fixtures__/gradual-loss.json";
import { fetchDemoAnalysis, fetchDemoCatalogue } from "../client";
import { ApiError, NetworkError, NotFoundError } from "../errors";

/**
 * `gradual-loss.json` is a real captured `/api/demo/gradual-loss` response. It exercises the
 * client's actual `(await response.json()) as T` boundary -- the one place in this codebase
 * an HTTP body legitimately becomes a typed value without further validation, exactly as the
 * client module documents. Everything else in this file exercises client behaviour that does
 * not depend on the fixture's contents: status handling, envelope parsing, network failure.
 */

function mockFetchOnce(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDemoAnalysis", () => {
  it("parses a real captured 200 response", async () => {
    mockFetchOnce(new Response(JSON.stringify(gradualLossCapture), { status: 200 }));
    const analysis = await fetchDemoAnalysis("gradual-loss");
    expect(analysis.n_obs).toBe(120);
    expect(analysis.meta.source).toBe("demo");
    expect(analysis.scenario.id).toBe("gradual-loss");
  });

  it("requests the encoded scenario id under /api/demo/{scenario}", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify(gradualLossCapture), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchDemoAnalysis("gradual-loss");
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/demo\/gradual-loss$/);
    expect(init).toMatchObject({ cache: "no-store" });
  });

  it("raises NotFoundError on a 404 with the M2 error envelope", async () => {
    const body = { error: { code: "unknown_scenario", message: "No such demo scenario.", details: [] } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 404 }));
    await expect(fetchDemoAnalysis("nonsense")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("carries the envelope's code and message onto the thrown error", async () => {
    const body = { error: { code: "unknown_scenario", message: "No such demo scenario.", details: [] } };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 404 }));
    try {
      await fetchDemoAnalysis("nonsense");
      expect.unreachable("expected fetchDemoAnalysis to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
      const notFound = error as NotFoundError;
      expect(notFound.code).toBe("unknown_scenario");
      expect(notFound.message).toBe("No such demo scenario.");
    }
  });

  it("raises ApiError, not NotFoundError, on a 500 with no parseable body", async () => {
    mockFetchOnce(new Response("internal error", { status: 500 }));
    const error = await fetchDemoAnalysis("gradual-loss").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect((error as ApiError).status).toBe(500);
  });

  it("degrades to a generic ApiError when the body does not match the error envelope", async () => {
    mockFetchOnce(new Response(JSON.stringify({ unexpected: "shape" }), { status: 500 }));
    const error = await fetchDemoAnalysis("gradual-loss").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBeUndefined();
    expect((error as ApiError).message).toContain("500");
  });

  it("raises NetworkError when fetch itself rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network down");
      }),
    );
    await expect(fetchDemoAnalysis("gradual-loss")).rejects.toBeInstanceOf(NetworkError);
  });

  it("raises NetworkError, not a raw parsing exception, when a 200 body is not valid JSON", async () => {
    mockFetchOnce(new Response("<html>not json</html>", { status: 200 }));
    await expect(fetchDemoAnalysis("gradual-loss")).rejects.toBeInstanceOf(NetworkError);
  });
});

describe("fetchDemoCatalogue", () => {
  it("parses a 200 catalogue response", async () => {
    const body = {
      synthetic: true,
      scenarios: [{ id: "gradual-loss", title: "Gradual loss", description: "d", label: "l", seed: 1, parameters: {} }],
    };
    mockFetchOnce(new Response(JSON.stringify(body), { status: 200 }));
    const catalogue = await fetchDemoCatalogue();
    expect(catalogue.scenarios).toHaveLength(1);
  });

  it("requests /api/demo", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ synthetic: true, scenarios: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    await fetchDemoCatalogue();
    expect(String(fetchSpy.mock.calls[0]![0])).toMatch(/\/api\/demo$/);
  });
});
