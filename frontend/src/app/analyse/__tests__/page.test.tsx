import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import AnalysePage from "../page";

describe("AnalysePage", () => {
  it("states plainly that measurements are sent for analysis and not stored", () => {
    render(<AnalysePage />);
    expect(
      screen.getByText(/sent to the HealthTrend analysis service.*are not stored/),
    ).toBeInTheDocument();
  });

  it("does not claim the analysis happens on-device", () => {
    render(<AnalysePage />);
    expect(screen.queryByText(/on.device/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/securely/i)).not.toBeInTheDocument();
  });

  it("renders the measurement form", () => {
    render(<AnalysePage />);
    expect(screen.getByRole("form", { name: "Enter your measurements" })).toBeInTheDocument();
  });

  it("links back to the synthetic demo", () => {
    render(<AnalysePage />);
    expect(screen.getByRole("link", { name: /synthetic demo/ })).toHaveAttribute(
      "href",
      "/demo/gradual-loss",
    );
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = render(<AnalysePage />);
    const results = await axe(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results).toHaveNoViolations();
  });
});
