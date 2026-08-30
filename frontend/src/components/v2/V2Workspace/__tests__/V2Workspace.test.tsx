import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { V2Workspace } from "../V2Workspace";

/**
 * jsdom has no `matchMedia`, so the canvas's domain tween would otherwise run its real
 * `requestAnimationFrame` loop during these tests and land state updates after they finish.
 * Reporting reduced motion is both the honest stub and the branch worth pinning: a reader who
 * asks for reduced motion must get the new domain immediately, not a shortened animation.
 */
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

function renderWorkspace() {
  return render(<V2Workspace analysis={demoAnalysisFixture} />);
}

const summary = () => screen.getByRole("region", { name: "Analysis summary" });
const detail = () => screen.getByRole("region", { name: "Analysis detail" });

describe("V2Workspace summary", () => {
  it("answers the three questions the rail exists for, and no more", () => {
    renderWorkspace();

    expect(within(summary()).getByText("81.7 kg")).toBeInTheDocument();
    expect(within(summary()).getByText(/95% 81\.2–82\.3 kg/)).toBeInTheDocument();
    expect(within(summary()).getByText("−0.42 kg/week")).toBeInTheDocument();
    expect(within(summary()).getByText(/sd 0\.85 kg\/week/)).toBeInTheDocument();
    expect(within(summary()).getByText("72.2 kg")).toBeInTheDocument();
    expect(within(summary()).getByText(/95% 67\.4–76\.9 kg/)).toBeInTheDocument();
  });

  /**
   * The canvas already reports the latest reading in its own readout, and flags the trend
   * weight on the weight axis. Restating the raw reading in the rail is what turned the right
   * side into a second dashboard, so it is gone from here.
   */
  it("does not repeat the raw scale reading the canvas readout already carries", () => {
    renderWorkspace();
    expect(within(summary()).queryByText(/Latest scale reading/)).toBeNull();
    expect(within(summary()).queryByText("82.1 kg")).toBeNull();
  });

  it("says what the estimate was made from, without repeating the figures above it", () => {
    renderWorkspace();
    expect(
      within(summary()).getByText(
        "Estimated from 4 readings spanning 3 days, the most recent on 26 April 2026.",
      ),
    ).toBeInTheDocument();
  });
});

describe("V2Workspace inspection", () => {
  it("offers depth rather than displaying it, and links to the method behind the numbers", () => {
    renderWorkspace();

    expect(
      within(detail()).getByRole("button", { name: /Inspect this analysis/ }),
    ).toBeInTheDocument();
    expect(
      within(detail()).getByRole("link", { name: /How HealthTrend calculates this/ }),
    ).toHaveAttribute("href", "/v2/method");
  });

  /**
   * The entry has to read as a way into something, not as a sentence. Saying what it opens is
   * what makes that legible without hover -- which a phone never has -- and it has to be in the
   * accessible name too, because a screen-reader user gets no visual affordance at all.
   */
  it("says what the entry opens, in its accessible name too", () => {
    renderWorkspace();
    const entry = within(detail()).getByRole("button", { name: /Inspect this analysis/ });

    expect(entry).toHaveAccessibleName("Inspect this analysis Opens Why, Evidence, Statistics");
    expect(within(entry).getByText("Opens Why, Evidence, Statistics")).toBeInTheDocument();
  });

  /**
   * A labelled section, not a loose row: the eyebrow is what says something lives here before
   * the entry has to argue for itself. It is a real heading so the structure a screen reader
   * hears is the one the eye sees.
   */
  it("labels the inspection block as a section of its own", () => {
    renderWorkspace();
    expect(
      within(detail()).getByRole("heading", { name: "Deeper analysis", level: 2 }),
    ).toBeInTheDocument();
  });

  it("shows no tier content at all until asked", () => {
    renderWorkspace();
    expect(screen.queryByRole("heading", { name: "Why this estimate?" })).toBeNull();
    expect(screen.queryByText("Latest observation")).toBeNull();
    expect(screen.queryByText("Current rate")).toBeNull();
  });

  it("pushes into Why, showing this analysis's own numbers rather than model documentation", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));

    const panel = detail();
    expect(within(panel).getByRole("heading", { name: "Why this estimate?" })).toBeInTheDocument();
    expect(within(panel).getByText("Latest reading")).toBeInTheDocument();
    expect(within(panel).getByText("82.1 kg")).toBeInTheDocument();
    expect(within(panel).getByText("Estimate, same instant")).toBeInTheDocument();
    expect(within(panel).getByText("+0.4 kg")).toBeInTheDocument();
    expect(within(panel).getByText(/measurement noise assumed here is 0\.50 kg/)).toBeInTheDocument();
  });

  it("keeps the summary on screen while a detail is open, as context for it", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));
    expect(within(summary()).getByText("81.7 kg")).toBeInTheDocument();
  });

  it("shows exactly one tier at a time", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));

    expect(screen.getByRole("heading", { name: "Why this estimate?" })).toBeInTheDocument();
    expect(screen.queryByText("Series")).toBeNull(); // Evidence
    expect(screen.queryByText("Current estimate")).toBeNull(); // Statistics
  });

  /** Reaching Statistics must not mean reading Why and Evidence on the way. */
  it("moves straight to any tier from any other", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Statistics" }));

    expect(screen.getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Why this estimate?" })).toBeNull();
    expect(within(detail()).getByRole("button", { name: "Statistics" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("returns to the summary from a detail", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analysis/ }));

    expect(screen.queryByRole("heading", { name: "Why this estimate?" })).toBeNull();
    expect(
      within(detail()).getByRole("button", { name: /Inspect this analysis/ }),
    ).toBeInTheDocument();
  });

  it("keeps the recent-readings table on demand rather than letting it fill the rail", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Evidence" }));

    expect(screen.queryByRole("columnheader", { name: "Reading" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show the last \d+ readings/ }));
    expect(screen.getByRole("columnheader", { name: "Reading" })).toBeInTheDocument();
  });

  it("publishes every horizon in Statistics, whatever the canvas draws", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Statistics" }));

    for (const horizon of ["7 days", "30 days", "90 days"]) {
      expect(screen.getByRole("rowheader", { name: horizon })).toBeInTheDocument();
    }
  });

  /**
   * Generic model explanation is the same on every series, so it is not analysis-specific
   * content and does not belong on this screen at all -- it is a page of its own.
   */
  it("carries no equations or model mechanics anywhere in the workspace", () => {
    renderWorkspace();
    for (const tier of ["Why", "Evidence", "Statistics"]) {
      fireEvent.click(
        screen.queryByRole("button", { name: /Inspect this analysis/ }) ??
          within(detail()).getByRole("button", { name: tier }),
      );
      const text = document.body.textContent ?? "";
      expect(text).not.toContain("Kalman");
      expect(text).not.toContain("Joseph");
      expect(text).not.toContain("covariance");
      expect(text).not.toContain("Wiener");
      expect(text).not.toContain("transition_matrix");
    }
  });
});

describe("V2Workspace honesty", () => {
  /**
   * The binding rule from the honesty ledger: no qualitative status, confidence label,
   * plateau claim, change point or goal ETA may reach the interface, and an unimplemented
   * capability is absent rather than rendered as "unknown / not enough evidence".
   */
  it("renders no classification, confidence label or ETA in any state", () => {
    renderWorkspace();
    const forbidden = [
      "steadily",
      "plateau",
      "confidence",
      "on track",
      "not enough evidence",
      "unknown",
      "change point",
      "outlier",
      "will reach",
      "expected to reach",
    ];

    const check = () => {
      const text = (document.body.textContent ?? "").toLowerCase();
      for (const phrase of forbidden) {
        expect(text).not.toContain(phrase);
      }
    };

    check();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));
    check();
    for (const tier of ["Evidence", "Statistics"]) {
      fireEvent.click(within(detail()).getByRole("button", { name: tier }));
      check();
    }
  });
});

describe("V2Workspace goal", () => {
  it("shows no goal at all until one is asked for", () => {
    renderWorkspace();

    expect(screen.queryByRole("region", { name: "Goal reference" })).toBeNull();
    expect(screen.queryByText(/below the current estimate/)).toBeNull();
    expect(screen.queryByText("Goal reference")).toBeNull(); // no chart key either
    expect(screen.getByRole("button", { name: "+ Add a goal" })).toBeInTheDocument();
  });

  it("draws the reference and its distance only once a target is entered", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a goal" }));
    fireEvent.change(screen.getByLabelText("Target weight (kg)"), { target: { value: "78.5" } });

    const goal = screen.getByRole("region", { name: "Goal reference" });
    expect(within(goal).getByText("78.5 kg")).toBeInTheDocument();
    expect(within(goal).getByText("3.2 kg below the current estimate")).toBeInTheDocument();

    // The chart gains its key at the same moment it gains the line.
    const legend = screen.getByRole("figure").querySelector("figcaption")!;
    expect(within(legend).getByText("Goal reference")).toBeInTheDocument();
  });

  it("compares the current rate with a target rate as two numbers and a difference", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a goal" }));
    fireEvent.change(screen.getByLabelText("Target rate (kg/week, optional)"), {
      target: { value: "-0.5" },
    });

    const goal = screen.getByRole("region", { name: "Goal reference" });
    expect(within(goal).getByText(/target −0\.50 kg\/week/)).toBeInTheDocument();
    expect(within(goal).getByText(/current −0\.42 kg\/week/)).toBeInTheDocument();
    expect(within(goal).getByText(/difference \+0\.08 kg\/week/)).toBeInTheDocument();
  });

  it("returns to the bare control when the goal is removed", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a goal" }));
    fireEvent.change(screen.getByLabelText("Target weight (kg)"), { target: { value: "78.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove goal" }));

    expect(screen.queryByRole("region", { name: "Goal reference" })).toBeNull();
    expect(screen.getByRole("button", { name: "+ Add a goal" })).toBeInTheDocument();
  });
});

describe("V2Workspace composition", () => {
  /**
   * One DOM order serves both layouts: it is the mobile order from the design direction, and
   * desktop folds it into two columns with grid areas rather than re-rendering it.
   */
  it("renders in the mobile order: summary, chart, inspection", () => {
    renderWorkspace();
    const canvas = screen.getByRole("img", { name: /Weight trend canvas/ });

    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(summary(), canvas)).toBe(true);
    expect(follows(canvas, detail())).toBe(true);
  });

  it("has no accessibility violations in its default state", async () => {
    const { container } = renderWorkspace();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with a detail tier open", async () => {
    const { container } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect this analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Evidence" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("V2Workspace canvas", () => {
  it("draws one quiet mark per raw reading, and both the trend and forecast lines", () => {
    renderWorkspace();
    const canvas = screen.getByRole("img", { name: /Weight trend canvas/ });

    expect(canvas.querySelectorAll("circle")).toHaveLength(
      demoAnalysisFixture.observations.length,
    );
    const paths = canvas.querySelectorAll("path.visx-linepath");
    expect(paths).toHaveLength(2);
    expect([...paths].filter((path) => path.getAttribute("stroke-dasharray"))).toHaveLength(1);
  });

  it("reports the current estimate in the readout before anything is inspected", () => {
    renderWorkspace();
    expect(screen.getByText("Last weigh-in")).toBeInTheDocument();
    expect(screen.getByText("26 April 2026")).toBeInTheDocument();
  });

  it("moves the readout to the inspected point when the crosshair is moved", () => {
    renderWorkspace();
    fireEvent.change(screen.getByRole("slider", { name: "Inspect a point on the chart" }), {
      target: { value: "1" },
    });

    expect(screen.getByText("Estimate on")).toBeInTheDocument();
    expect(screen.getByText("24 April 2026")).toBeInTheDocument();
    expect(screen.getByText("81.5 kg")).toBeInTheDocument();
  });

  it("narrows the drawn forecast when a shorter look-ahead is chosen", () => {
    renderWorkspace();
    const slider = () => screen.getByRole("slider", { name: "Inspect a point on the chart" });

    // Default 30d: four trajectory points plus the 0, 7 and 30-day forecast points.
    expect(slider()).toHaveAttribute("max", "6");

    fireEvent.click(screen.getByRole("button", { name: "seven days ahead" }));
    expect(slider()).toHaveAttribute("max", "5");

    fireEvent.click(screen.getByRole("button", { name: "ninety days ahead" }));
    expect(slider()).toHaveAttribute("max", "7");
  });

  it("offers only history ranges shorter than the series, so no control does nothing", () => {
    renderWorkspace();
    expect(screen.getByRole("button", { name: "all history" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "one month of history" })).toBeNull();
  });
});
