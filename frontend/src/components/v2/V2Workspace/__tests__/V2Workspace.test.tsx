import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { V2Workspace } from "../V2Workspace";

/**
 * jsdom has no `matchMedia`, so the canvas's domain tween would otherwise run its real
 * `requestAnimationFrame` loop during these tests. Reporting reduced motion is both the honest
 * stub and the branch worth pinning.
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
  return render(<V2Workspace analysis={demoAnalysisFixture} unit="kg" />);
}

/**
 * A response with `span_days === 0`. The instant is shared by every reading, which is the case
 * a point-count test alone lets through: four observations produce four filtered points, so
 * `trajectory.length > 1` passes while no time has elapsed and the velocity posterior is still
 * exactly the model's prior (ADR-0003).
 *
 * The velocity here is written as that prior -- zero, with the prior's own spread -- rather than
 * as a fitted value, because that is what the backend actually returns for a zero span.
 */
const SAME_INSTANT = "2026-04-26T08:50:16.705Z";

function sameInstantAnalysis(readings: number[]) {
  return {
    ...demoAnalysisFixture,
    n_obs: readings.length,
    span_days: 0,
    observations: readings.map((weight_kg) => ({ timestamp: SAME_INSTANT, weight_kg })),
    trajectory: readings.map(() => ({
      timestamp: SAME_INSTANT,
      w_kg: 81.9,
      w_sd: 0.5,
      w_lower95: 80.92,
      w_upper95: 82.88,
    })),
    current: {
      timestamp: SAME_INSTANT,
      w_kg: 81.9,
      w_sd: 0.5,
      w_lower95: 80.92,
      w_upper95: 82.88,
      weekly_rate_kg: 0,
      weekly_rate_sd_kg: 1,
    },
  };
}

const summary = () => screen.getByRole("region", { name: "Analysis summary" });
const detail = () => screen.getByRole("region", { name: "Analysis detail" });

const hero = () => screen.getByRole("group", { name: "Estimate and rate" });

describe("V2Workspace hero", () => {
  it("states the estimate, its 68% half-width, and the rate beside it", () => {
    renderWorkspace();

    expect(within(hero()).getByText("81.7 kg")).toBeInTheDocument();
    expect(within(hero()).getByText(/±0\.28 kg \(68%\)/)).toBeInTheDocument();
    expect(within(hero()).getByText("−0.42 kg/week")).toBeInTheDocument();
  });

  /**
   * The fixture's own numbers put the rate's 95% interval across zero, so "flat" is the honest
   * label -- not a stylistic default, but the rule the frozen design names once a real posterior
   * exists (docs/design/09_1B_Implementation_Spec §8.1).
   */
  it("labels the rate flat when its own 95% interval spans zero", () => {
    renderWorkspace();
    expect(within(hero()).getByText("Current rate, flat")).toBeInTheDocument();
  });
});

describe("V2Workspace statistics band", () => {
  it("shows the fixed 30-day projection and how many readings the estimate rests on", () => {
    renderWorkspace();
    expect(screen.getByText("Projected, 30 days")).toBeInTheDocument();
    expect(screen.getByText("72.2 kg")).toBeInTheDocument();
    expect(screen.getByText("Readings used")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  /**
   * The fixture spans 3 days, so a 90-day change cannot honestly be computed from it -- the
   * absent state names the real span rather than approximating from what is available.
   */
  it("states the 90-day change is absent, with the real span rather than a placeholder", () => {
    renderWorkspace();
    expect(screen.getByText(/No 90-day change: this series spans 3 days/)).toBeInTheDocument();
  });
});

describe("V2Workspace analysis summary", () => {
  it("carries a lede resting only on the published rate and its interval", () => {
    renderWorkspace();
    const region = summary();
    expect(within(region).getByText("The estimated weight is flat within its uncertainty.")).toBeInTheDocument();
    expect(within(region).getByText(/its 95% interval spans zero/)).toBeInTheDocument();
  });

  it("shows today's reading beside the estimate, named as a difference rather than a residual", () => {
    renderWorkspace();
    const region = summary();
    expect(within(region).getByText("82.1 kg")).toBeInTheDocument();
    expect(within(region).getByText(/difference from estimate/)).toBeInTheDocument();
    expect(within(region).queryByText(/residual/i)).toBeNull();
  });
});

describe("V2Workspace inspection", () => {
  it("offers depth from the main column, opening the deep panel below the whole stack", () => {
    renderWorkspace();
    expect(screen.getByRole("button", { name: /Inspect analysis/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Analysis detail" })).toBeNull();
  });

  it("opens Why by default, showing this analysis's own numbers rather than model documentation", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));

    const panel = detail();
    expect(within(panel).getByRole("heading", { name: "Why this estimate?" })).toBeInTheDocument();
    expect(within(panel).getByText("Latest reading")).toBeInTheDocument();
    expect(within(panel).getByText("82.1 kg")).toBeInTheDocument();
    expect(within(panel).getByText(/measurement noise assumed here is 0\.50 kg/)).toBeInTheDocument();
  });

  it("shows exactly one tier at a time, and moves straight to any other", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Statistics" }));

    expect(within(detail()).getByRole("heading", { name: "Values and their intervals" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Why this estimate?" })).toBeNull();
  });

  it("closes back to the entry point in the main column", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("region", { name: "Analysis detail" })).toBeNull();
    expect(screen.getByRole("button", { name: /Inspect analysis/ })).toBeInTheDocument();
  });

  it("keeps the recent-readings table on demand in Evidence", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Evidence" }));

    expect(screen.queryByRole("columnheader", { name: "Reading" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Show the last \d+ readings/ }));
    expect(screen.getByRole("columnheader", { name: "Reading" })).toBeInTheDocument();
  });

  it("publishes every horizon in Statistics", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Statistics" }));

    for (const horizon of ["7 days", "30 days", "90 days"]) {
      expect(screen.getByRole("rowheader", { name: horizon })).toBeInTheDocument();
    }
  });

  /** Generic model explanation is the same on every series and belongs to /v2/method instead. */
  it("carries no equations or model mechanics anywhere in the workspace", () => {
    renderWorkspace();
    for (const tier of ["Why", "Evidence", "Statistics"]) {
      fireEvent.click(
        screen.queryByRole("button", { name: /Inspect analysis/ }) ??
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

  /**
   * docs/design/IMPLEMENTATION_NOTES.md, "1. No fake down-weighting": the shipped model has no
   * such rule, so there is no "Down-weighted" metric and no ringed row anywhere in Evidence.
   */
  it("has no down-weighting metric or ringed-row marker in Evidence", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Evidence" }));

    expect(screen.queryByText("Down-weighted")).toBeNull();
    expect(screen.queryByText(/ringed/i)).toBeNull();
  });
});

describe("V2Workspace honesty", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));
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
    expect(screen.getByRole("button", { name: "+ Add a goal" })).toBeInTheDocument();
  });

  it("draws the reference and its distance only once a target is entered", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "+ Add a goal" }));
    fireEvent.change(screen.getByLabelText("Target weight (kg)"), { target: { value: "78.5" } });

    const goal = screen.getByRole("region", { name: "Goal reference" });
    expect(within(goal).getByText("78.5 kg")).toBeInTheDocument();
    expect(within(goal).getByText("3.2 kg below the current estimate")).toBeInTheDocument();

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
   * One order at every width, since there is no rail to reassemble: hero and chart, then what
   * the analysis says, then the statistics band, then the way into the deep tiers. The summary
   * sitting between the canvas and the statistics band is the whole point of removing the rail
   * -- if it drifts back below the band, the desktop composition has regressed.
   */
  it("renders one column in reading order: chart, summary, statistics, inspect", () => {
    renderWorkspace();
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    const canvas = screen.getByRole("img", { name: /Weight trend canvas/ });
    const statistics = screen.getByText("Projected, 30 days");
    const inspect = screen.getByRole("button", { name: /Inspect analysis/ });

    expect(follows(canvas, summary())).toBe(true);
    expect(follows(summary(), statistics)).toBe(true);
    expect(follows(statistics, inspect)).toBe(true);
  });

  /** The goal is part of the summary section now, not a separate surface beside the chart. */
  it("keeps the goal control inside the analysis summary", () => {
    renderWorkspace();
    expect(
      within(summary()).getByRole("button", { name: "+ Add a goal" }),
    ).toBeInTheDocument();
  });

  it("has no accessibility violations in its default state", async () => {
    const { container } = renderWorkspace();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with a detail tier open", async () => {
    const { container } = renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: /Inspect analysis/ }));
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

  it("offers only history ranges shorter than the series, so no control does nothing", () => {
    renderWorkspace();
    expect(screen.getByRole("button", { name: "all history" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "one month of history" })).toBeNull();
  });
});

/**
 * The zero-span state, which `span_days === 0` defines and a point count does not. `span_days`
 * is elapsed days from the first observation to the last (`backend/app/core/analyse.py`), so it
 * reaches zero three ways -- no readings, one reading, and any number of readings recorded at
 * one instant -- and all three must land in the same honest state.
 */
describe("V2Workspace with no elapsed span", () => {
  it("suppresses every trend-dependent surface for readings that share one instant", () => {
    render(<V2Workspace analysis={sameInstantAnalysis([81.8, 82.0, 81.9, 82.1])} unit="kg" />);

    // The regression this guards: four readings mean four trajectory points, so a
    // `trajectory.length > 1` gate would have drawn all of this from a prior velocity.
    expect(screen.getByText("Trend not established yet.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Estimate and rate" })).toBeNull();
    expect(screen.queryByRole("img", { name: /Weight trend canvas/ })).toBeNull();
    expect(screen.queryByText("Projected, 30 days")).toBeNull();
    expect(screen.queryByText("Readings per week")).toBeNull();
    expect(screen.queryByRole("button", { name: /Inspect analysis/ })).toBeNull();
  });

  it("prints no rate, no rate interval and no direction anywhere on the screen", () => {
    render(<V2Workspace analysis={sameInstantAnalysis([81.8, 82.0, 81.9, 82.1])} unit="kg" />);
    const text = document.body.textContent ?? "";

    expect(text).not.toContain("/week");
    expect(text).not.toContain("trending");
    expect(text).not.toContain("Projected");
    expect(within(summary()).getByText("There is no trend yet.")).toBeInTheDocument();
  });

  /**
   * The target-rate comparison republishes `current.weekly_rate_kg`, which at zero span is the
   * documented prior rather than a finding, so the field itself is absent -- not disabled, and
   * not shown against a placeholder.
   */
  it("offers a goal target but not a target rate to compare against a prior", () => {
    render(<V2Workspace analysis={sameInstantAnalysis([81.8, 82.0])} unit="kg" />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add a goal" }));

    expect(screen.getByLabelText("Target weight (kg)")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Target rate/)).toBeNull();
  });

  it("lists the readings in the displayed unit rather than a hardcoded one", () => {
    const analysis = sameInstantAnalysis([81.8, 82.0]);

    const { unmount } = render(<V2Workspace analysis={analysis} unit="kg" />);
    expect(within(screen.getByRole("list")).getByText("81.8 kg")).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText("82.0 kg")).toBeInTheDocument();
    unmount();

    render(<V2Workspace analysis={analysis} unit="lb" />);
    expect(within(screen.getByRole("list")).getByText("180.3 lb")).toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText("180.8 lb")).toBeInTheDocument();
  });

  it("describes zero, one and many same-instant readings each in its own words", () => {
    const empty = { ...sameInstantAnalysis([]), n_obs: 0 };
    const { unmount: unmountEmpty } = render(<V2Workspace analysis={empty} unit="kg" />);
    expect(screen.getByText(/There are no readings yet/)).toBeInTheDocument();
    unmountEmpty();

    const { unmount: unmountOne } = render(
      <V2Workspace analysis={sameInstantAnalysis([81.8])} unit="kg" />,
    );
    expect(screen.getByText(/There is one reading so far/)).toBeInTheDocument();
    unmountOne();

    render(<V2Workspace analysis={sameInstantAnalysis([81.8, 82.0, 81.9])} unit="kg" />);
    expect(screen.getByText(/Every reading here carries the same timestamp/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <V2Workspace analysis={sameInstantAnalysis([81.8, 82.0, 81.9])} unit="kg" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("V2Workspace latest reading", () => {
  /**
   * The series' last observation is not necessarily one taken today -- an imported export may
   * end months ago -- so the label states what it is and the date says when.
   */
  it("labels the most recent reading with its own date rather than claiming it is today's", () => {
    renderWorkspace();
    const region = summary();

    expect(within(region).getByText("Latest reading")).toBeInTheDocument();
    expect(within(region).queryByText("Reading today")).toBeNull();
    // The time is rendered in the reader's own zone, so only the date is pinned here.
    expect(
      within(region).getByText(
        /scale reading on 26 April 2026, \d\d:\d\d · difference from estimate/,
      ),
    ).toBeInTheDocument();
  });
});
