import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { demoAnalysisFixture } from "@/lib/api/__fixtures__/demoAnalysisFixture";
import { HEADLINE_FORECAST_HORIZON_DAYS, horizonPoint } from "@/lib/analysis";
import { buildChartSeries } from "@/lib/chart/series";
import { TrendChart } from "../TrendChart";

/**
 * Assertions here are structural (how many marks, what the accessible label says), never
 * geometric (exact coordinates, path data): the chart maps numbers to pixels, and pixels
 * are the layout engine's job, not this codebase's.
 */
describe("TrendChart", () => {
  function renderChart() {
    const series = buildChartSeries(demoAnalysisFixture);
    const at30 = horizonPoint(demoAnalysisFixture.forecast, HEADLINE_FORECAST_HORIZON_DAYS);
    render(
      <TrendChart
        series={series}
        summary={{
          currentWeightKg: demoAnalysisFixture.current.w_kg,
          forecastHorizonDays: HEADLINE_FORECAST_HORIZON_DAYS,
          forecastWeightKg: at30.w_kg,
          forecastLowerKg: at30.w_lower95,
          forecastUpperKg: at30.w_upper95,
        }}
      />,
    );
    return series;
  }

  it("renders one observation mark per raw reading", () => {
    renderChart();
    const image = screen.getByRole("img", { name: /Weight trend chart/ });
    expect(image.querySelectorAll("circle")).toHaveLength(demoAnalysisFixture.observations.length);
  });

  it("draws exactly two lines: the solid history line and the dashed forecast line", () => {
    renderChart();
    const image = screen.getByRole("img", { name: /Weight trend chart/ });
    const paths = image.querySelectorAll("path.visx-linepath");
    expect(paths).toHaveLength(2);
    const dashed = [...paths].filter((path) => path.getAttribute("stroke-dasharray"));
    expect(dashed).toHaveLength(1);
  });

  it("summarises the current estimate and the 30-day forecast in its accessible label", () => {
    renderChart();
    const image = screen.getByRole("img", { name: /Weight trend chart/ });
    expect(image).toHaveAccessibleName(/81\.7 kg/); // current
    expect(image).toHaveAccessibleName(/30-day forecast 72\.2 kg/);
  });

  it("gives a visually-hidden table access to the same numbers", () => {
    renderChart();
    expect(screen.getByText("Weight trend data behind the chart above")).toBeInTheDocument();
    expect(screen.getByText("Latest observation")).toBeInTheDocument();
    expect(screen.getByText(`${HEADLINE_FORECAST_HORIZON_DAYS}-day forecast`)).toBeInTheDocument();
  });

  /**
   * A <table> in the default auto layout treats a CSS `width: 1px` as a minimum, not a cap,
   * so it keeps rendering at its full content width (~450px) regardless. Applying the
   * `.visuallyHidden` class straight to the table (as this used to) leaves that oversized,
   * absolutely-positioned box overflowing the page on any viewport narrower than the table's
   * content -- exactly a real phone's width. It must sit on a wrapper, not the table itself.
   */
  it("collapses the accessible summary table via a wrapping element, not the table itself", () => {
    renderChart();
    const table = screen.getByText("Weight trend data behind the chart above").closest("table")!;
    expect(table.className).not.toMatch(/visuallyHidden/);
    expect(table.parentElement?.className).toMatch(/visuallyHidden/);
  });

  /**
   * Touch has no hover concept: a tap fires `pointerdown` but never `pointermove`, so the
   * tooltip needs its own handler on `pointerdown` to be reachable by touch at all.
   */
  it("shows the tooltip on a touch tap, not just on pointer movement", () => {
    renderChart();
    const rect = document.querySelector('rect[aria-hidden="true"]')!;
    expect(screen.queryByText(/95% range|Likely range/)).not.toBeInTheDocument();
    fireEvent.pointerDown(rect, { clientX: 100, clientY: 100, pointerType: "touch" });
    expect(screen.getByText(/95% range|Likely range/)).toBeInTheDocument();
  });

  /**
   * Per the Pointer Events spec, a touch pointer -- having no hover state -- fires
   * `pointerleave` immediately after `pointerup`. Hiding the tooltip unconditionally on
   * `pointerleave` (as this used to) means a finger lifting off the chart erases the just-shown
   * value before anyone can read it, making tap-to-inspect useless on a phone even once
   * `pointerdown` is wired up. A touch-originated leave must be ignored.
   */
  it("keeps a tapped tooltip visible when the touch pointer leaves, but hides on mouse leave", () => {
    renderChart();
    const rect = document.querySelector('rect[aria-hidden="true"]')!;

    fireEvent.pointerDown(rect, { clientX: 100, clientY: 100, pointerType: "touch" });
    expect(screen.getByText(/95% range|Likely range/)).toBeInTheDocument();
    fireEvent.pointerLeave(rect, { pointerType: "touch" });
    expect(screen.getByText(/95% range|Likely range/)).toBeInTheDocument();

    fireEvent.pointerLeave(rect, { pointerType: "mouse" });
    expect(screen.queryByText(/95% range|Likely range/)).not.toBeInTheDocument();
  });

  /**
   * Without a `viewBox`, an SVG's `width`/`height` attributes are also its only rendered
   * pixel size -- CSS can't scale it. On the server-rendered demo page that size is briefly
   * `ParentSize`'s `initialSize` guess (a desktop-plausible 800x336) even on a narrow phone,
   * before hydration measures the real container; without a `viewBox`, that guess renders at
   * a literal 800px and gets clipped to a cropped-looking sliver by the container's
   * `overflow: hidden`. A `viewBox` matching the current width/height (paired with the SVG's
   * CSS box being 100% of its wrapper, in TrendChart.module.css) makes the browser scale the
   * whole drawing to fit instead, on any mismatch -- including this one.
   */
  it("sets a viewBox matching the rendered size, so a wrong pre-hydration guess scales instead of clipping", () => {
    renderChart();
    const image = screen.getByRole("img", { name: /Weight trend chart/ });
    const width = image.getAttribute("width");
    const height = image.getAttribute("height");
    expect(width).toBeTruthy();
    expect(height).toBeTruthy();
    expect(image.getAttribute("viewBox")).toBe(`0 0 ${width} ${height}`);
  });
});
