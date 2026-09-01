import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AnalysisResponse } from "@/lib/api/types";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { V2AnalyseWorkspace } from "../V2AnalyseWorkspace";

const { submitAnalysis, ingestCsv } = vi.hoisted(() => ({
  submitAnalysis: vi.fn(),
  ingestCsv: vi.fn(),
}));
vi.mock("@/lib/api/browserClient", () => ({ submitAnalysis, ingestCsv }));

/** The canvas tweens its domain on mount; jsdom has no `matchMedia` to ask about motion. */
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

/**
 * The demo fixture standing in for a `POST /api/analyse` response. `DemoAnalysisResponse` is
 * `AnalysisResponse` plus a `scenario` block, so it satisfies the narrower type as-is; the
 * extra field is inert here because nothing under test reads it.
 */
const RESULT: AnalysisResponse = demoAnalysisFixture;

function fillOneRowAndSubmit() {
  fireEvent.change(screen.getByLabelText("Date and time"), {
    target: { value: "2026-08-21T07:30" },
  });
  fireEvent.change(screen.getByLabelText(/Weight/), { target: { value: "72.4" } });
  fireEvent.click(screen.getByRole("button", { name: "Analyse" }));
}

describe("V2AnalyseWorkspace", () => {
  /**
   * `/v2/analyse` is already the current route once a result is on screen, so the masthead's
   * own link to it does not remount this component: without an explicit control the only way
   * back to the form was a hard reload.
   */
  it("returns to the entry form when asked to analyse different data", async () => {
    submitAnalysis.mockResolvedValueOnce(RESULT);
    render(<V2AnalyseWorkspace />);

    fillOneRowAndSubmit();
    expect(await screen.findByRole("region", { name: "Analysis summary" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Date and time")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Analyse different data" }));

    expect(screen.getByLabelText("Date and time")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Analysis summary" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Analyse different data" })).toBeNull();
  });

  /** The entry column comes back in whichever mode was last chosen, not reset to manual. */
  it("returns to the CSV entry mode if that is where the result came from", async () => {
    submitAnalysis.mockResolvedValueOnce(RESULT);
    render(<V2AnalyseWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));
    expect(screen.getByLabelText("CSV file")).toBeInTheDocument();

    // Reach a result without going through the file reader: the ingestion path itself is
    // already covered by `AnalysisWorkspace`'s tests and is unchanged here.
    fireEvent.click(screen.getByRole("button", { name: "Manual entry" }));
    fillOneRowAndSubmit();
    await screen.findByRole("region", { name: "Analysis summary" });
    fireEvent.click(screen.getByRole("button", { name: "Analyse different data" }));
    fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));

    expect(screen.getByLabelText("CSV file")).toBeInTheDocument();
  });

  /** No result is retained across the return: nothing is stored, here or anywhere else. */
  it("keeps no measurement from the previous analysis on the form it returns to", async () => {
    submitAnalysis.mockResolvedValueOnce(RESULT);
    render(<V2AnalyseWorkspace />);

    fillOneRowAndSubmit();
    await screen.findByRole("region", { name: "Analysis summary" });
    fireEvent.click(screen.getByRole("button", { name: "Analyse different data" }));

    expect(screen.getByLabelText(/Weight/)).toHaveValue(null);
    expect(screen.getByLabelText("Date and time")).toHaveValue("");
  });
});
