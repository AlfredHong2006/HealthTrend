"use client";

import { AxisBottom, AxisLeft } from "@visx/axis";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, Circle, LinePath } from "@visx/shape";
import { buildChartSeries } from "@/lib/chart/series";
import { formatShortDate } from "@/lib/chart/format";
import { formatNumber } from "@/lib/v2/format";
import type { DemoAnalysis } from "@/lib/api/types";
import styles from "./V2Method.module.css";

const MARGIN = { top: 8, right: 12, bottom: 22, left: 40 };

/**
 * Figure 1: the posterior mean of the level with its 95% band, the readings it saw, and the
 * forecast continuing it -- built from a real generated scenario, not the frozen mock's fixture
 * generator (docs/design/09_1B_Implementation_Spec §8.3 names "Method figure" as one of the
 * fixture slots to remove once real data is connected).
 *
 * Static and non-interactive on purpose: Method illustrates the shape of an estimate in
 * general, so it carries none of the analysis screen's crosshair, range control or goal
 * reference -- those are specific to reading one series, not to explaining the model.
 */
export function V2MethodFigure({ analysis }: { analysis: DemoAnalysis }) {
  const series = buildChartSeries(analysis);

  return (
    <figure className={styles.figure}>
      <div className={styles.figureWell}>
        <div className={styles.figurePlot}>
          <ParentSize initialSize={{ width: 640, height: 280 }}>
            {({ width, height }) =>
              width > 0 && height > 0 ? <FigurePlot width={width} height={height} series={series} /> : null
            }
          </ParentSize>
        </div>
      </div>
      <figcaption className={styles.figureCaption}>
        <p className={styles.figureCaptionText}>
          The posterior mean of the level with its 95% band, the readings it saw, and a
          projection whose band widens with every step forward.
        </p>
        <p className={styles.figureSource}>
          Figure 1 · Source: synthetic demo data, &ldquo;{analysis.scenario.title}&rdquo; scenario
        </p>
      </figcaption>
    </figure>
  );
}

function FigurePlot({
  width,
  height,
  series,
}: {
  width: number;
  height: number;
  series: ReturnType<typeof buildChartSeries>;
}) {
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const values = [
    ...series.observations.map((p) => p.weightKg),
    ...series.historyBand.flatMap((p) => [p.lowerKg, p.upperKg]),
    ...series.forecastBand.flatMap((p) => [p.lowerKg, p.upperKg]),
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.08, 0.4);

  const xScale = scaleTime({
    domain: [series.domain.start, series.domain.end],
    range: [0, innerWidth],
  });
  const yScale = scaleLinear({ domain: [min - pad, max + pad], range: [innerHeight, 0] });

  return (
    <svg width={width} height={height} role="img" aria-label="A generated weight trend, its 95% band, and its forecast.">
      <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
        <AreaClosed
          data={series.historyBand}
          x={(d) => xScale(d.date)}
          y0={(d) => yScale(d.lowerKg)}
          y1={(d) => yScale(d.upperKg)}
          yScale={yScale}
          fill="var(--v2-trend-band)"
        />
        <AreaClosed
          data={series.forecastBand}
          x={(d) => xScale(d.date)}
          y0={(d) => yScale(d.lowerKg)}
          y1={(d) => yScale(d.upperKg)}
          yScale={yScale}
          fill="var(--v2-forecast-band)"
        />
        {series.observations.map((point, index) => (
          <Circle key={index} cx={xScale(point.date)} cy={yScale(point.weightKg)} r={1.75} fill="var(--v2-observation)" />
        ))}
        <LinePath
          data={series.historyLine}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(d.weightKg)}
          stroke="var(--v2-trend)"
          strokeWidth={2}
        />
        <LinePath
          data={series.forecastLine}
          x={(d) => xScale(d.date)}
          y={(d) => yScale(d.weightKg)}
          stroke="var(--v2-forecast)"
          strokeWidth={1.75}
          strokeDasharray="5,4"
        />
        <AxisLeft
          scale={yScale}
          numTicks={4}
          hideAxisLine
          hideTicks
          tickFormat={(v) => formatNumber(Number(v), 0)}
          tickLabelProps={{ fill: "var(--v2-ink-faint)", fontSize: 10 }}
        />
        <AxisBottom
          top={innerHeight}
          scale={xScale}
          numTicks={4}
          hideAxisLine
          hideTicks
          tickFormat={(v) => formatShortDate(v as Date)}
          tickLabelProps={{ fill: "var(--v2-ink-faint)", fontSize: 10 }}
        />
      </g>
    </svg>
  );
}
