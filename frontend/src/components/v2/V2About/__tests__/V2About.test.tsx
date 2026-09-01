import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { V2About } from "../V2About";

describe("V2About", () => {
  it("names the project and who built it", () => {
    render(<V2About />);

    expect(screen.getByRole("heading", { name: "HealthTrend" })).toBeInTheDocument();
    expect(screen.getByText("Built by")).toBeInTheDocument();
    expect(screen.getByText("Alfred Hong")).toBeInTheDocument();
  });

  it("says what the product estimates without claiming more than it computes", () => {
    render(<V2About />);

    // The standfirst and the personal account name the same four published quantities, so the
    // whole standfirst sentence is asserted rather than a fragment that now matches twice.
    expect(
      screen.getByText(
        /^HealthTrend estimates an underlying weight trend from noisy scale readings and presents the current estimate, rate of change, uncertainty, and forecast\.$/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /estimates the underlying weight trajectory from noisy and irregular measurements/,
      ),
    ).toBeInTheDocument();
  });

  /** Why the project exists, in Alfred's own words, and still his name on it. */
  it("gives a first-person account of why the project was built", () => {
    render(<V2About />);

    expect(screen.getByText("Alfred Hong")).toBeInTheDocument();
    expect(
      screen.getByText(/started from a problem I kept running into while cutting/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/more useful than a basic weight log or a moving average/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/testing where the model does and does not work/),
    ).toBeInTheDocument();
  });

  /** A settled punctuation decision for this page: plain sentences, no em dashes. */
  it("uses no em dashes anywhere in its copy", () => {
    const { container } = render(<V2About />);
    expect(container.textContent ?? "").not.toContain("—");
  });

  /**
   * The page states the non-persistence promise the rest of the product keeps
   * (docs/privacy.md). If this copy ever drifts from the behaviour, one of the two is wrong.
   */
  it("states that measurements are not stored and not kept in the browser", () => {
    render(<V2About />);

    expect(screen.getByText(/are not stored/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is saved in your browser/)).toBeInTheDocument();
  });

  it("routes onward to the destinations a first-time reader needs", () => {
    render(<V2About />);

    expect(screen.getByRole("link", { name: "See an analysis" })).toHaveAttribute("href", "/v2");
    expect(screen.getByRole("link", { name: "Analyse your own data" })).toHaveAttribute(
      "href",
      "/v2/analyse",
    );
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "/v2/method",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<V2About />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
