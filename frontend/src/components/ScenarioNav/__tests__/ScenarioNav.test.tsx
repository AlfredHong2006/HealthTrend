import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DemoScenario } from "@/lib/api/types";
import { ScenarioNav } from "../ScenarioNav";

const scenarios: DemoScenario[] = [
  { id: "gradual-loss", title: "Gradual loss", description: "d1", label: "synthetic 1", seed: 1, parameters: {} },
  { id: "plateau", title: "Plateau", description: "d2", label: "synthetic 2", seed: 2, parameters: {} },
  { id: "reversal", title: "Reversal", description: "d3", label: "synthetic 3", seed: 3, parameters: {} },
  { id: "noisy", title: "Noisy readings", description: "d4", label: "synthetic 4", seed: 4, parameters: {} },
  { id: "irregular", title: "Irregular weigh-ins", description: "d5", label: "synthetic 5", seed: 5, parameters: {} },
];

describe("ScenarioNav", () => {
  it("renders one link per scenario, pointing at /demo/{id}", () => {
    render(<ScenarioNav scenarios={scenarios} activeId="gradual-loss" />);
    for (const scenario of scenarios) {
      expect(screen.getByRole("link", { name: scenario.title })).toHaveAttribute(
        "href",
        `/demo/${scenario.id}`,
      );
    }
  });

  it("marks exactly the active scenario with aria-current", () => {
    render(<ScenarioNav scenarios={scenarios} activeId="plateau" />);
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName("Plateau");
  });

  it("marks no link as current when the active id matches none of them", () => {
    render(<ScenarioNav scenarios={scenarios} activeId="does-not-exist" />);
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(0);
  });

  it("is a labelled navigation landmark, reachable without a mouse", () => {
    render(<ScenarioNav scenarios={scenarios} activeId="gradual-loss" />);
    expect(screen.getByRole("navigation", { name: "Demo scenario" })).toBeInTheDocument();
  });
});
