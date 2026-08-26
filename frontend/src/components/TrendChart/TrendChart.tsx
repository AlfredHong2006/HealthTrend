"use client";

import { useMemo } from "react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, Circle, Line, LinePath } from "@visx/shape";
import { TooltipWithBounds, useTooltip } from "@visx/tooltip";
import { buildHoverPoints, nearestHoverPoint, type HoverPoint } from "@/lib/chart/hover";
import { formatFullDate, formatShortDate, formatWeightKg, formatWeightRangeKg } from "@/lib/chart/format";
import { chartHeightFor, marginFor, MOBILE_BREAKPOINT } from "@/lib/chart/layout";
import type { ChartSeries } from "@/lib/chart/series";
import styles from "./TrendChart.module.css";

export interface ChartSummary {
  currentWeightKg: number;
  forecastHorizonDays: number;
  forecastWeightKg: number;
  forecastLowerKg: number;
  forecastUpperKg: number;
}

interface TrendChartProps {
  series: ChartSeries;
  summary: ChartSummary;
}

/**
 * The graph: past observations, the filtered latent trend, and the widening forecast band,
 * joined so history and forecast read as one continuous story.
 *
 * No mark here computes anything. Every position comes from `series`, which
 * {@link buildChartSeries} already shaped from backend values; this component only maps
 * numbers to pixels.
 */
export function TrendChart({ series, summary }: TrendChartProps) {
  const ariaLabel = buildAriaLabel(summary);

  return (
    <figure className={styles.figure}>
      <div className={styles.canvas}>
        {/* initialSize gives the server-rendered (pre-hydration) HTML a real chart at a
            plausible width, rather than an empty box until the client's ResizeObserver
            reports the true size. It is not a fallback for a missing measurement -- it is
            immediately replaced once the real width is known, on every screen size. */}
        <ParentSize initialSize={{ width: 800, height: 336 }}>
          {({ width }) =>
            width > 0 ? (
              <Chart width={width} height={chartHeightFor(width)} series={series} ariaLabel={ariaLabel} />
            ) : null
          }
        </ParentSize>
      </div>
      <VisuallyHiddenSummary series={series} summary={summary} />
    </figure>
  );
}

function buildAriaLabel(summary: ChartSummary): string {
  return (
    `Weight trend chart. Estimated underlying weight ${formatWeightKg(summary.currentWeightKg)}. ` +
    `${summary.forecastHorizonDays}-day forecast ${formatWeightKg(summary.forecastWeightKg)}, ` +
    `likely range ${formatWeightRangeKg(summary.forecastLowerKg, summary.forecastUpperKg)}.`
  );
}

interface ChartProps {
  width: number;
  height: number;
  series: ChartSeries;
  ariaLabel: string;
}

function Chart({ width, height, series, ariaLabel }: ChartProps) {
  const MARGIN = marginFor(width);
  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const xScale = useMemo(
    () => scaleTime({ domain: [series.domain.start, series.domain.end], range: [0, innerWidth] }),
    [series.domain.start, series.domain.end, innerWidth],
  );

  const yScale = useMemo(() => {
    const values = [
      ...series.observations.map((p) => p.weightKg),
      ...series.historyBand.flatMap((p) => [p.lowerKg, p.upperKg]),
      ...series.forecastBand.flatMap((p) => [p.lowerKg, p.upperKg]),
    ];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.08, 0.5);
    return scaleLinear({ domain: [min - padding, max + padding], range: [innerHeight, 0] });
  }, [series.observations, series.historyBand, series.forecastBand, innerHeight]);

  const hoverPoints = useMemo(() => buildHoverPoints(series), [series]);

  const { tooltipData, tooltipLeft, tooltipTop, showTooltip, hideTooltip } =
    useTooltip<HoverPoint>();

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const point = localPoint(event);
    if (!point) return;
    const date = xScale.invert(point.x - MARGIN.left);
    const nearest = nearestHoverPoint(hoverPoints, date);
    if (!nearest) return;
    showTooltip({
      tooltipData: nearest,
      tooltipLeft: xScale(nearest.date) + MARGIN.left,
      tooltipTop: yScale(nearest.weightKg) + MARGIN.top,
    });
  }

  // A touch pointer has no hover state, so per the Pointer Events spec it fires
  // `pointerleave` immediately after `pointerup` -- with an unconditional `hideTooltip` that
  // erases the tap-to-inspect result the instant a finger lifts, before anyone can read it.
  // Mouse/pen pointers keep the original hide-on-leave behaviour unchanged.
  function handlePointerLeave(event: React.PointerEvent<SVGRectElement>) {
    if (event.pointerType === "touch") return;
    hideTooltip();
  }

  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  return (
    <div className={styles.svgWrapper}>
      {/* viewBox (plus the 100%-sized CSS box in TrendChart.module.css) makes the SVG scale
          to whatever box it actually lands in instead of rendering at a literal `width` pixel
          size: on the server-rendered demo page, that box is briefly `initialSize` (800x336,
          see ParentSize above) even on a narrow phone, before hydration measures the real
          width. Without a viewBox that mismatch clips the chart to a cropped-looking sliver;
          with it, the browser scales the same drawing down to fit -- exactly what happens on
          every resize once the real ResizeObserver value replaces the guess. */}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
      >
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            stroke="var(--ht-border)"
            strokeOpacity={0.6}
            pointerEvents="none"
          />

          {/* 95% band, history then forecast. */}
          <AreaClosed
            data={series.historyBand}
            x={(d) => xScale(d.date)}
            y0={(d) => yScale(d.lowerKg)}
            y1={(d) => yScale(d.upperKg)}
            yScale={yScale}
            fill="var(--ht-accent-soft)"
            pointerEvents="none"
          />
          <AreaClosed
            data={series.forecastBand}
            x={(d) => xScale(d.date)}
            y0={(d) => yScale(d.lowerKg)}
            y1={(d) => yScale(d.upperKg)}
            yScale={yScale}
            fill="var(--ht-forecast-soft)"
            pointerEvents="none"
          />

          {/* The "now" / forecast-origin marker, drawn under the lines. */}
          <Line
            from={{ x: xScale(series.originDate), y: 0 }}
            to={{ x: xScale(series.originDate), y: innerHeight }}
            stroke="var(--ht-text-faint)"
            strokeDasharray="2,3"
            pointerEvents="none"
          />

          {/* Raw observations: quiet, so the estimate draws the eye. */}
          {series.observations.map((point, index) => (
            <Circle
              key={index}
              cx={xScale(point.date)}
              cy={yScale(point.weightKg)}
              r={2.5}
              fill="var(--ht-observation)"
              pointerEvents="none"
            />
          ))}

          {/* The filtered latent trajectory, then the forecast continuing from it. */}
          <LinePath
            data={series.historyLine}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.weightKg)}
            stroke="var(--ht-accent)"
            strokeWidth={2}
            pointerEvents="none"
          />
          <LinePath
            data={series.forecastLine}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.weightKg)}
            stroke="var(--ht-forecast)"
            strokeWidth={2}
            strokeDasharray="6,4"
            pointerEvents="none"
          />

          {tooltipData ? (
            <Line
              from={{ x: xScale(tooltipData.date), y: 0 }}
              to={{ x: xScale(tooltipData.date), y: innerHeight }}
              stroke="var(--ht-text-faint)"
              pointerEvents="none"
            />
          ) : null}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickFormat={(value) => formatShortDate(value as Date)}
            stroke="var(--ht-border)"
            tickStroke="var(--ht-border)"
            tickLabelProps={{ fill: "var(--ht-text-muted)", fontSize: 11 }}
            numTicks={width < MOBILE_BREAKPOINT ? 4 : 7}
          />
          <AxisLeft
            scale={yScale}
            stroke="var(--ht-border)"
            tickStroke="var(--ht-border)"
            tickLabelProps={{ fill: "var(--ht-text-muted)", fontSize: 11, dx: -4 }}
            numTicks={5}
          />

          <rect
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            // `onPointerDown` matters on touch: a tap generates pointerdown but never
            // pointermove, so without it the tooltip is simply unreachable by touch. Pairing
            // it with `touchAction: "none"` stops the browser from claiming a touch-drag here
            // for page scrolling, so dragging a finger across the chart scrubs the tooltip
            // the same way moving a mouse does, instead of scrolling the page underneath it.
            style={{ touchAction: "none" }}
            onPointerDown={handlePointerMove}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            aria-hidden="true"
          />
        </Group>
      </svg>

      {tooltipData ? (
        <TooltipWithBounds left={tooltipLeft} top={tooltipTop} className={styles.tooltip}>
          <p className={styles.tooltipDate}>{formatFullDate(tooltipData.date)}</p>
          <p>{formatWeightKg(tooltipData.weightKg)}</p>
          <p className={styles.tooltipRange}>
            {tooltipData.isForecast ? "Likely range " : "95% range "}
            {formatWeightRangeKg(tooltipData.lowerKg, tooltipData.upperKg)}
          </p>
        </TooltipWithBounds>
      ) : null}
    </div>
  );
}

interface VisuallyHiddenSummaryProps {
  series: ChartSeries;
  summary: ChartSummary;
}

/**
 * A plain-text table of the headline figures, for anyone who cannot or does not want to
 * read the SVG. `aria-label` on the chart summarises it in prose; this gives the exact
 * numbers, the way a sighted user reading the callouts elsewhere on the page already has.
 */
function VisuallyHiddenSummary({ series, summary }: VisuallyHiddenSummaryProps) {
  const lastObservation = series.observations.at(-1);
  // `.visuallyHidden` sets width/height:1px, which a <table> in the default auto layout
  // treats as a minimum rather than a cap -- it still renders at its full content width
  // (~450px here). Applied straight to the table that box is absolutely positioned yet wider
  // than the mobile chart figure, so it pokes out and forces real horizontal page overflow.
  // A wrapping div (which does respect width:1px) collapses the box; the table inside keeps
  // its normal row/column structure for assistive tech.
  return (
    <div className="visuallyHidden">
      <table>
        <caption>Weight trend data behind the chart above</caption>
        <tbody>
          <tr>
            <th scope="row">Latest observation</th>
            <td>{lastObservation ? formatWeightKg(lastObservation.weightKg) : "none"}</td>
          </tr>
          <tr>
            <th scope="row">Estimated underlying weight</th>
            <td>{formatWeightKg(summary.currentWeightKg)}</td>
          </tr>
          <tr>
            <th scope="row">{summary.forecastHorizonDays}-day forecast</th>
            <td>
              {formatWeightKg(summary.forecastWeightKg)}, likely range{" "}
              {formatWeightRangeKg(summary.forecastLowerKg, summary.forecastUpperKg)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
