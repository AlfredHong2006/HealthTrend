import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyntheticBadge } from "../SyntheticBadge";

const SCENARIO = { title: "Gradual loss", label: "synthetic gradual loss (seed 101)" };

/**
 * The exact product constraint (M3 amendment 2): the frontend must not invent
 * unsupported interpretation. Here that means the badge's text must track what
 * `meta.source` actually says, not always claim "synthetic" regardless of provenance.
 */
describe("SyntheticBadge", () => {
  it("names the scenario title when the source is a demo, with the provenance label as hover text", () => {
    render(
      <SyntheticBadge
        meta={{ source: "demo", filtered_not_smoothed: true, interval_describes: "latent_weight" }}
        scenario={SCENARIO}
      />,
    );
    const badge = screen.getByText("Synthetic demo data · Gradual loss");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("title", "synthetic gradual loss (seed 101)");
  });

  it("does not render the nested machine label inline", () => {
    render(
      <SyntheticBadge
        meta={{ source: "demo", filtered_not_smoothed: true, interval_describes: "latent_weight" }}
        scenario={SCENARIO}
      />,
    );
    expect(screen.queryByText(/\(seed 101\)/)).not.toBeInTheDocument();
  });

  it("does not claim the scenario for caller-submitted data", () => {
    // The demo page never renders submitted data, but the component must stay honest if it
    // ever does: submitted data has no scenario, and none should be implied.
    render(
      <SyntheticBadge
        meta={{ source: "submitted", filtered_not_smoothed: true, interval_describes: "latent_weight" }}
        scenario={SCENARIO}
      />,
    );
    expect(screen.queryByText(/Gradual loss|synthetic/)).not.toBeInTheDocument();
    expect(screen.getByText(/submitted/)).toBeInTheDocument();
    expect(screen.getByText(/submitted/)).not.toHaveAttribute("title");
  });
});
