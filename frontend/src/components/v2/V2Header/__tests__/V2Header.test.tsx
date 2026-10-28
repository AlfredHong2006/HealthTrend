import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { V2Header } from "../V2Header";

const CURRENTS = ["analysis", "analyse", "method", "about"] as const;

describe("V2Header", () => {
  it("keeps the four public destinations, in order", () => {
    render(<V2Header current="method" />);

    const nav = screen.getByRole("navigation", { name: "HealthTrend" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Analysis", "/v2"],
      ["Analyse your data", "/v2/analyse"],
      ["Method", "/v2/method"],
      ["About", "/v2/about"],
    ]);
    expect(within(nav).getByRole("link", { name: "Method" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each(CURRENTS)("offers a way into the app from the %s page", (current) => {
    render(<V2Header current={current} />);

    expect(screen.getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/app");
  });

  it("links the wordmark to the public home, never to the signed-in app", () => {
    render(<V2Header current="about" />);

    expect(screen.getByRole("link", { name: "HealthTrend" })).toHaveAttribute("href", "/v2");
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<V2Header current="about" />);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
