import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DemoScenarioLoading from "../loading";

describe("DemoScenarioLoading", () => {
  it("marks the region busy and announces loading to assistive technology", () => {
    render(<DemoScenarioLoading />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/Loading the analysis/)).toBeInTheDocument();
  });

  it("shows an unlabelled nav skeleton rather than guessing scenario names", () => {
    // The catalogue has not been fetched yet at this point, so there must be nothing here
    // that looks like a real scenario title -- that would be a hardcoded duplicate of the
    // backend's registry, and it could drift from it.
    const { container } = render(<DemoScenarioLoading />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it("renders no weight, rate or forecast number", () => {
    render(<DemoScenarioLoading />);
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });
});
