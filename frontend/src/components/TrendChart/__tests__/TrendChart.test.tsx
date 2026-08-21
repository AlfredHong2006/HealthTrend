import { render, screen } from "@testing-library/react";
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
});
