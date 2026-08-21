import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyntheticBadge } from "../SyntheticBadge";

/**
 * The exact product constraint (M3 amendment 2): the frontend must not invent
 * unsupported interpretation. Here that means the badge's text must track what
 * `meta.source` actually says, not always claim "synthetic" regardless of provenance.
 */
describe("SyntheticBadge", () => {
  it("names the scenario label when the source is a demo", () => {
    render(
      <SyntheticBadge
        meta={{ source: "demo", filtered_not_smoothed: true, interval_describes: "latent_weight" }}
        label="synthetic gradual loss (seed 101)"
      />,
    );
    expect(screen.getByText(/Synthetic demo data/)).toBeInTheDocument();
    expect(screen.getByText(/synthetic gradual loss \(seed 101\)/)).toBeInTheDocument();
  });

  it("does not claim the scenario label for caller-submitted data", () => {
    // M3 never actually calls the submit path, but the component must stay honest if it
    // ever does: submitted data has no scenario label, and none should be implied.
    render(
      <SyntheticBadge
        meta={{ source: "submitted", filtered_not_smoothed: true, interval_describes: "latent_weight" }}
        label="synthetic gradual loss (seed 101)"
      />,
    );
    expect(screen.queryByText(/synthetic gradual loss/)).not.toBeInTheDocument();
    expect(screen.getByText(/submitted/)).toBeInTheDocument();
  });
});
