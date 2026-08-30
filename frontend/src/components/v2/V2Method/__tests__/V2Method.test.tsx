import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { V2Method } from "../V2Method";

const params = demoAnalysisFixture.params;

describe("V2Method", () => {
  it("ramps from plain language to the mathematics, in that order", () => {
    render(<V2Method params={params} />);
    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual([
      "1What HealthTrend estimates",
      "2How a reading changes the estimate",
      "3What the uncertainty means",
      "4How forecasting works",
      "5Model parameters",
      "6Assumptions and limitations",
      "7Mathematical appendix",
    ]);
  });

  it("gives every section an anchor the contents list points at", () => {
    const { container } = render(<V2Method params={params} />);
    const links = within(screen.getByRole("navigation", { name: "On this page" })).getAllByRole(
      "link",
    );

    expect(links).toHaveLength(7);
    for (const link of links) {
      const id = link.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("reads the model parameters from the service rather than hardcoding them", () => {
    render(<V2Method params={params} />);
    expect(screen.getByText("0.50 kg")).toBeInTheDocument();
    expect(screen.getByText("0.15 kg/week per week")).toBeInTheDocument();
    expect(screen.getByText("0.008099")).toBeInTheDocument();
  });

  it("stands without the parameter values when the service cannot be reached", () => {
    render(<V2Method params={null} />);

    expect(screen.getByRole("heading", { name: /Model parameters/ })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Value" })).toBeNull();
    expect(screen.queryByText("0.008099")).toBeNull();
  });

  it("carries the full appendix, not a simplified version of it", () => {
    render(<V2Method params={params} />);

    for (const part of [
      "A1 · State and observation",
      "A2 · Transition and process noise",
      "A3 · The filter recursion",
      "A4 · The interval that is published",
      "A5 · Forecast propagation",
      "A6 · Units and the weekly rate",
      "A7 · Equation to code",
    ]) {
      expect(screen.getByText(part)).toBeInTheDocument();
    }
  });

  it("describes every equation in words for anyone who cannot read the typesetting", () => {
    render(<V2Method params={params} />);
    const equations = screen.getAllByRole("img");

    expect(equations.length).toBeGreaterThanOrEqual(10);
    for (const equation of equations) {
      expect(equation).toHaveAccessibleName();
    }
  });

  it("names the file and symbol implementing each equation", () => {
    render(<V2Method params={params} />);
    expect(screen.getByText("transition_matrix")).toBeInTheDocument();
    expect(screen.getByText("sigma_accel_from_weekly_rate_drift")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<V2Method params={params} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
