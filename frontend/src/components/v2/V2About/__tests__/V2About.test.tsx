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

    expect(
      screen.getByText(/estimates an underlying weight trend from noisy scale readings/),
    ).toBeInTheDocument();
    expect(screen.getByText(/rate of change, uncertainty, and forecast/)).toBeInTheDocument();
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
