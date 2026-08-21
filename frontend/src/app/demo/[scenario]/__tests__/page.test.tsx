import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { ApiError, NotFoundError } from "@/lib/api/errors";
import type { DemoAnalysis, DemoCatalogue } from "@/lib/api/types";

const { fetchDemoAnalysis, fetchDemoCatalogue } = vi.hoisted(() => ({
  fetchDemoAnalysis: vi.fn(),
  fetchDemoCatalogue: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ fetchDemoAnalysis, fetchDemoCatalogue }));

const CATALOGUE: DemoCatalogue = {
  synthetic: true,
  scenarios: [
    { id: "gradual-loss", title: "Gradual loss", description: "d", label: "l", seed: 1, parameters: {} },
    { id: "plateau", title: "Plateau", description: "d", label: "l", seed: 2, parameters: {} },
  ],
};

/**
 * `DemoScenarioPage` is an async Server Component -- an async function returning JSX -- so
 * it is called and awaited directly, exactly like any other async function. Next requires
 * no test harness for this; the only Next-specific behaviour exercised is the real
 * `notFound()` from `next/navigation`, used unmocked below so the assertion is against
 * Next's actual contract (a thrown `Error` digested `NEXT_HTTP_ERROR_FALLBACK;404`) rather
 * than against a stand-in for it.
 */
async function renderPage(scenario: string) {
  const { default: DemoScenarioPage } = await import("../page");
  const element = await DemoScenarioPage({ params: Promise.resolve({ scenario }) });
  return render(element);
}

describe("DemoScenarioPage", () => {
  it("renders the current estimate, weekly rate, forecast and synthetic label from real response fields", async () => {
    fetchDemoAnalysis.mockResolvedValueOnce(demoAnalysisFixture as DemoAnalysis);
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);

    await renderPage("gradual-loss");

    // `{ selector: "p" }` disambiguates the visible Headline/RateReadout/ForecastCallout
    // paragraphs from the chart's visually-hidden <table>, which deliberately repeats the
    // same figures as table cells for non-visual access (see TrendChart's own tests).
    expect(screen.getByText("81.7 kg", { selector: "p" })).toBeInTheDocument(); // current.w_kg
    expect(screen.getByText("−0.42 kg/week", { selector: "p" })).toBeInTheDocument(); // weekly_rate_kg
    // The badge's text is one paragraph mixing a fixed prefix with the scenario's label;
    // `toHaveTextContent` matches substrings, unlike `getByText`'s default exact match.
    expect(screen.getByText(/Synthetic demo data/)).toHaveTextContent(demoAnalysisFixture.scenario.label);
    expect(screen.getByRole("img", { name: /Weight trend chart/ })).toBeInTheDocument();
  });

  it("renders the 30-day forecast headline, not the 7- or 90-day ones", async () => {
    fetchDemoAnalysis.mockResolvedValueOnce(demoAnalysisFixture as DemoAnalysis);
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);

    await renderPage("gradual-loss");

    const at30 = demoAnalysisFixture.forecast.horizons.find((h) => h.horizon_days === 30)!;
    expect(screen.getByText(/30-day forecast/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(`${at30.w_kg.toFixed(1)} kg`, { selector: "p" })).toBeInTheDocument();
  });

  it("marks the requested scenario current in the nav", async () => {
    fetchDemoAnalysis.mockResolvedValueOnce(demoAnalysisFixture as DemoAnalysis);
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);

    await renderPage("gradual-loss");

    expect(screen.getByRole("link", { name: "Gradual loss" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Plateau" })).not.toHaveAttribute("aria-current");
  });

  it("renders a different scenario's own numbers when switched", async () => {
    const plateauAnalysis: DemoAnalysis = {
      ...demoAnalysisFixture,
      current: { ...demoAnalysisFixture.current, w_kg: 80.0, weekly_rate_kg: 0.01 },
      scenario: { ...demoAnalysisFixture.scenario, id: "plateau", title: "Plateau", label: "synthetic plateau" },
    };
    fetchDemoAnalysis.mockResolvedValueOnce(plateauAnalysis);
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);

    await renderPage("plateau");

    expect(screen.getByText("80.0 kg", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plateau" })).toHaveAttribute("aria-current", "page");
    expect(fetchDemoAnalysis).toHaveBeenCalledWith("plateau");
  });

  it("calls Next's real notFound() -- not a generic error -- for an unregistered scenario", async () => {
    fetchDemoAnalysis.mockRejectedValueOnce(new NotFoundError(undefined));
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);

    const { default: DemoScenarioPage } = await import("../page");
    const failure = await DemoScenarioPage({ params: Promise.resolve({ scenario: "nonsense" }) }).catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error & { digest?: string }).digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("propagates any other failure so the nearest error.tsx handles it, rather than treating it as not-found", async () => {
    const backendDown = new ApiError(500, undefined);
    fetchDemoAnalysis.mockRejectedValueOnce(backendDown);
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);

    const { default: DemoScenarioPage } = await import("../page");
    await expect(
      DemoScenarioPage({ params: Promise.resolve({ scenario: "gradual-loss" }) }),
    ).rejects.toBe(backendDown);
  });

  it("has no detectable accessibility violations", async () => {
    fetchDemoAnalysis.mockResolvedValueOnce(demoAnalysisFixture as DemoAnalysis);
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);

    const { container } = await renderPage("gradual-loss");
    // jsdom has no layout/paint engine, so axe cannot evaluate real rendered colour --
    // color-contrast would only report false positives or negatives here, never a
    // meaningful result either way. Everything else (labels, roles, landmarks, name
    // computation) is real DOM structure and is exactly what this check is for.
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
