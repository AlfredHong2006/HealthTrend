import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DemoCatalogue } from "@/lib/api/types";

const { fetchDemoCatalogue } = vi.hoisted(() => ({ fetchDemoCatalogue: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ fetchDemoCatalogue }));

const CATALOGUE: DemoCatalogue = {
  synthetic: true,
  scenarios: [
    { id: "gradual-loss", title: "Gradual loss", description: "d", label: "l", seed: 1, parameters: {} },
    { id: "plateau", title: "Plateau", description: "d", label: "l", seed: 2, parameters: {} },
  ],
};

describe("DemoScenarioNotFound", () => {
  it("links to the real scenarios, fetched fresh rather than hardcoded", async () => {
    fetchDemoCatalogue.mockResolvedValueOnce(CATALOGUE);
    const { default: DemoScenarioNotFound } = await import("../not-found");
    render(await DemoScenarioNotFound());

    expect(screen.getByRole("heading", { name: /no such demo scenario/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gradual loss" })).toHaveAttribute("href", "/demo/gradual-loss");
    expect(screen.getByRole("link", { name: "Plateau" })).toHaveAttribute("href", "/demo/plateau");
  });

  it("degrades to a plain message, not a crash, if the backend is also unreachable", async () => {
    fetchDemoCatalogue.mockRejectedValueOnce(new Error("network down"));
    const { default: DemoScenarioNotFound } = await import("../not-found");
    render(await DemoScenarioNotFound());

    expect(screen.getByRole("heading", { name: /no such demo scenario/i })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
