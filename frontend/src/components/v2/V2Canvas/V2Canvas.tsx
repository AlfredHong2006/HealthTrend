"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, Circle, Line, LinePath } from "@visx/shape";
import { formatFullDate, formatShortDate } from "@/lib/chart/format";
import type { ChartSeries } from "@/lib/chart/series";
import { formatMonthYear } from "@/lib/v2/format";
import { nearestInspectionIndex, type InspectionPoint } from "@/lib/v2/inspect";
import {
  v2AxisDecimals,
  v2DateTickCount,
  v2GoalLabelSide,
  v2MarginFor,
  v2TerminalFlagStyle,
  v2WeightTickCount,
  V2_WIDE_BREAKPOINT,
} from "@/lib/v2/layout";
import { convertKg, formatWeightRangeUnit, formatWeightUnit } from "@/lib/v2/units";
import type { DisplayUnit } from "@/lib/v2/units";
import type { HistoryRange } from "@/lib/v2/view";
import styles from "./V2Canvas.module.css";

const MS_PER_DAY = 86_400_000;
const MONTHLY_AXIS_THRESHOLD_DAYS = 300;

export interface CanvasCurrent {
  /** The estimated trend weight, which the terminal flag reports. */
  weightKg: number;
  lowerKg: number;
  upperKg: number;
  /** The instant of the last weigh-in, and the reading taken then. */
  timestamp: Date;
  readingKg: number | null;
}

interface V2CanvasProps {
  series: ChartSeries;
  points: readonly InspectionPoint[];
  inspectIndex: number | null;
  onInspect: (index: number | null) => void;
  current: CanvasCurrent;
  /** The ephemeral goal reference, or `null` when none is set. */
  goalKg: number | null;
  unit: DisplayUnit;
  historyRanges: readonly HistoryRange[];
  historyRangeId: string;
  onHistoryRangeChange: (id: string) => void;
}

/**
 * The analytical canvas: the primary product surface, matching the frozen 1B Editorial chart
 * (docs/design/09_1B_Implementation_Spec §4, "TrajectoryChart density").
 *
 * Two structural changes from the earlier V2 prototype's chart, both from the frozen spec: the
 * weight axis moves to the **left**, in the manner of an ordinary chart rather than a trading
 * instrument, freeing the right edge for the goal label at full width; and there is a single
 * "Trajectory" range control rather than a separate history/forecast pair -- the frozen mock
 * always draws a fixed 30-day projection (the legend and the tier-2 statistics band both name it
 * "Projected, 30 days"), so only the history window is a user choice.
 *
 * Every mark is a value the backend published, mapped to a pixel. Nothing here derives a
 * statistic, and marks whose mathematics does not exist yet -- checkpoint markers above all --
 * are simply absent, not drawn greyed out (docs/design/V2_DESIGN.md).
 */
export function V2Canvas({
  series,
  points,
  inspectIndex,
  onInspect,
  current,
  goalKg,
  unit,
  historyRanges,
  historyRangeId,
  onHistoryRangeChange,
}: V2CanvasProps) {
  const inspected = inspectIndex === null ? null : (points[inspectIndex] ?? null);

  return (
    <figure className={styles.canvas}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Trajectory</span>
        <div className={styles.controls} role="group" aria-label="History">
          {historyRanges.map((range) => (
            <button
              key={range.id}
              type="button"
              aria-pressed={range.id === historyRangeId}
              aria-label={range.description}
              className={
                range.id === historyRangeId ? `${styles.control} ${styles.controlOn}` : styles.control
              }
              onClick={() => onHistoryRangeChange(range.id)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <CanvasReadout inspected={inspected} current={current} unit={unit} />

      <div className={styles.plotShell}>
        <div className={styles.plot}>
          {/* initialSize gives the server-rendered HTML a real chart at a plausible size rather
              than an empty box until the client's ResizeObserver reports the true one; it is
              replaced on hydration, at every width. */}
          <ParentSize initialSize={{ width: 900, height: 460 }}>
            {({ width, height }) =>
              width > 0 && height > 0 ? (
                <Plot
                  width={width}
                  height={height}
                  series={series}
                  points={points}
                  inspectIndex={inspectIndex}
                  onInspect={onInspect}
                  current={current}
                  goalKg={goalKg}
                  unit={unit}
                />
              ) : null
            }
          </ParentSize>
        </div>
        <InspectionSlider points={points} inspectIndex={inspectIndex} onInspect={onInspect} unit={unit} />
      </div>

      <figcaption className={styles.legend}>
        <Key markClass={styles.keyObservation} label="Scale readings" />
        <Key markClass={styles.keyTrend} label="Estimated trend" />
        <Key markClass={styles.keyBand} label="95% range" />
        <Key markClass={styles.keyForecast} label="Projection, 30 days" />
        {goalKg === null ? null : <Key markClass={styles.keyGoal} label="Goal reference" />}
      </figcaption>

      <AccessibleSummary series={series} current={current} unit={unit} />
    </figure>
  );
}

function Key({ markClass, label }: { markClass: string | undefined; label: string }) {
  return (
    <span className={styles.key}>
      <span className={`${styles.keyMark} ${markClass}`} aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * The axis-linked readout: one line reporting either the inspected point or, when nothing is
 * being inspected, the current estimate. It stands in for a floating tooltip card, which the
 * design direction rules out wherever an integrated readout can work instead.
 */
function CanvasReadout({
  inspected,
  current,
  unit,
}: {
  inspected: InspectionPoint | null;
  current: CanvasCurrent;
  unit: DisplayUnit;
}) {
  const date = inspected?.date ?? current.timestamp;
  const weightKg = inspected?.weightKg ?? current.weightKg;
  const lowerKg = inspected?.lowerKg ?? current.lowerKg;
  const upperKg = inspected?.upperKg ?? current.upperKg;
  const readingKg = inspected === null ? current.readingKg : inspected.readingKg;

  const region =
    inspected === null ? "Last weigh-in" : inspected.isForecast ? "Forecast for" : "Estimate on";

  return (
    <dl className={inspected ? `${styles.readout} ${styles.readoutActive}` : styles.readout}>
      <Cell label={region} value={formatFullDate(date)} />
      <Cell label="Estimated weight" value={formatWeightUnit(weightKg, unit)} />
      <Cell label="95% range" value={formatWeightRangeUnit(lowerKg, upperKg, unit)} />
      <Cell
        label="Scale reading"
        value={readingKg === null ? "none at this point" : formatWeightUnit(readingKg, unit)}
      />
    </dl>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.cell}>
      <dt className={styles.cellLabel}>{label}</dt>
      <dd className={styles.cellValue}>{value}</dd>
    </div>
  );
}

/**
 * Keyboard and assistive-technology access to the crosshair, as a real slider over the points
 * rather than a bespoke key handler: arrow keys, Home and End come from the platform, and
 * `aria-valuetext` reports the point in words. Visually hidden; the plot draws the focus ring
 * through `:focus-within`.
 */
function InspectionSlider({
  points,
  inspectIndex,
  onInspect,
  unit,
}: {
  points: readonly InspectionPoint[];
  inspectIndex: number | null;
  onInspect: (index: number | null) => void;
  unit: DisplayUnit;
}) {
  if (points.length === 0) {
    return null;
  }

  const value = inspectIndex ?? points.length - 1;
  const point = points[value];

  return (
    <input
      type="range"
      className="visuallyHidden"
      min={0}
      max={points.length - 1}
      step={1}
      value={value}
      aria-label="Inspect a point on the chart"
      aria-valuetext={
        point
          ? `${formatFullDate(point.date)}, ${point.isForecast ? "forecast" : "estimate"} ` +
            `${formatWeightUnit(point.weightKg, unit)}, 95% range ` +
            `${formatWeightRangeUnit(point.lowerKg, point.upperKg, unit)}`
          : undefined
      }
      onChange={(event) => onInspect(Number(event.target.value))}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onInspect(null);
        }
      }}
    />
  );
}

interface PlotProps {
  width: number;
  height: number;
  series: ChartSeries;
  points: readonly InspectionPoint[];
  inspectIndex: number | null;
  onInspect: (index: number | null) => void;
  current: CanvasCurrent;
  goalKg: number | null;
  unit: DisplayUnit;
}

function Plot({ width, height, series, points, inspectIndex, onInspect, current, goalKg, unit }: PlotProps) {
  const clipId = useId();
  const margin = v2MarginFor(width);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const flagStyle = v2TerminalFlagStyle(width);
  const goalSide = v2GoalLabelSide(width);
  const decimals = v2AxisDecimals(width);

  const [targetMinKg, targetMaxKg] = useMemo(() => weightExtent(series, goalKg), [series, goalKg]);
  const [minKg, maxKg] = useTweenedRange(targetMinKg, targetMaxKg);
  const [startMs, endMs] = useTweenedRange(
    series.domain.start.getTime(),
    series.domain.end.getTime(),
  );

  const xScale = useMemo(
    () => scaleTime({ domain: [new Date(startMs), new Date(endMs)], range: [0, innerWidth] }),
    [startMs, endMs, innerWidth],
  );
  const yScale = useMemo(
    () => scaleLinear({ domain: [minKg, maxKg], range: [innerHeight, 0] }),
    [minKg, maxKg, innerHeight],
  );

  const spanDays = (endMs - startMs) / MS_PER_DAY;
  const formatDateTick = spanDays > MONTHLY_AXIS_THRESHOLD_DAYS ? formatMonthYear : formatShortDate;
  const inspected = inspectIndex === null ? null : (points[inspectIndex] ?? null);

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const local = localPoint(event);
    if (!local) return;
    const index = nearestInspectionIndex(points, xScale.invert(local.x - margin.left));
    if (index !== null) {
      onInspect(index);
    }
  }

  // A touch pointer fires `pointerleave` immediately after `pointerup`, which would erase a
  // tap-to-inspect result before it could be read. Mouse and pen keep hide-on-leave.
  function handlePointerLeave(event: React.PointerEvent<SVGRectElement>) {
    if (event.pointerType !== "touch") {
      onInspect(null);
    }
  }

  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const originX = xScale(series.originDate);
  const flagWidth = flagStyle === "boxed" ? margin.right - 12 : 0;
  const flagHeight = 17;
  const goalX = goalSide === "right" ? innerWidth - 4 : 4;
  const goalAnchor = goalSide === "right" ? "end" : "start";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={styles.svg}
      role="img"
      aria-label={ariaLabel(current, series, unit)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={-3} y={-3} width={innerWidth + 6} height={innerHeight + 6} />
        </clipPath>
      </defs>

      <Group left={margin.left} top={margin.top}>
        <g clipPath={`url(#${clipId})`} pointerEvents="none">
          {/* The forecast half of the canvas, washed just enough to read as a different region. */}
          <rect
            x={originX}
            y={0}
            width={Math.max(0, innerWidth - originX)}
            height={innerHeight}
            fill="var(--v2-forecast-band)"
            opacity={0.22}
          />

          <GridRows
            scale={yScale}
            width={innerWidth}
            numTicks={v2WeightTickCount(width)}
            stroke="var(--v2-rule)"
          />

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

          {goalKg === null ? null : (
            <>
              <Line
                from={{ x: 0, y: yScale(goalKg) }}
                to={{ x: innerWidth, y: yScale(goalKg) }}
                stroke="var(--v2-goal)"
                strokeWidth={1.25}
                strokeDasharray="6,4"
              />
              <text
                x={goalX}
                y={yScale(goalKg) - 6}
                textAnchor={goalAnchor}
                className={styles.goalLabel}
                fill="var(--v2-goal)"
              >
                Goal {formatWeightUnit(goalKg, unit)}
              </text>
            </>
          )}

          {series.observations.map((point, index) => (
            <Circle
              key={index}
              cx={xScale(point.date)}
              cy={yScale(point.weightKg)}
              r={2}
              fill="var(--v2-observation)"
            />
          ))}

          <LinePath
            data={series.historyLine}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.weightKg)}
            stroke="var(--v2-trend)"
            strokeWidth={2.25}
          />
          <LinePath
            data={series.forecastLine}
            x={(d) => xScale(d.date)}
            y={(d) => yScale(d.weightKg)}
            stroke="var(--v2-forecast)"
            strokeWidth={2}
            strokeDasharray="5,4"
          />

          <Line
            from={{ x: originX, y: 0 }}
            to={{ x: originX, y: innerHeight }}
            stroke="var(--v2-rule-strong)"
            strokeDasharray="2,4"
          />

          {inspected ? (
            <>
              <Line
                from={{ x: xScale(inspected.date), y: 0 }}
                to={{ x: xScale(inspected.date), y: innerHeight }}
                stroke="var(--v2-crosshair)"
                strokeWidth={1}
              />
              {inspected.readingKg === null ? null : (
                <Circle
                  cx={xScale(inspected.date)}
                  cy={yScale(inspected.readingKg)}
                  r={3.5}
                  fill="var(--v2-observation)"
                  stroke="var(--v2-bg)"
                  strokeWidth={1.5}
                />
              )}
              <Circle
                cx={xScale(inspected.date)}
                cy={yScale(inspected.weightKg)}
                r={4}
                fill={inspected.isForecast ? "var(--v2-forecast)" : "var(--v2-trend)"}
                stroke="var(--v2-bg)"
                strokeWidth={1.5}
              />
            </>
          ) : null}
        </g>

        <text
          x={originX}
          y={-6}
          textAnchor="middle"
          className={styles.dividerLabel}
          fill="var(--v2-ink-faint)"
        >
          now
        </text>

        <AxisLeft
          scale={yScale}
          numTicks={v2WeightTickCount(width)}
          hideAxisLine
          tickLength={4}
          tickStroke="var(--v2-rule-strong)"
          tickFormat={(value) => convertKg(Number(value), unit).toFixed(decimals)}
          tickLabelProps={{ fill: "var(--v2-ink-faint)", fontSize: 10.5, dx: -4, dy: 3, textAnchor: "end" }}
        />
        <AxisBottom
          top={innerHeight}
          scale={xScale}
          numTicks={v2DateTickCount(innerWidth)}
          hideAxisLine
          tickLength={4}
          tickStroke="var(--v2-rule-strong)"
          tickFormat={(value) => formatDateTick(value as Date)}
          tickLabelProps={{ fill: "var(--v2-ink-faint)", fontSize: 10.5, dy: 2 }}
        />

        {/* The terminal value flag: the current trend weight, read off the same axis. Boxed at
            full width, an inline value above a leader line at compact, absent below 360 -- the
            hero states the identical number two blocks above the chart. */}
        {flagStyle === "absent" ? null : (
          <g transform={`translate(${innerWidth}, ${yScale(current.weightKg)})`} pointerEvents="none">
            {flagStyle === "boxed" ? (
              <>
                <line x1={0} x2={5} y1={0} y2={0} stroke="var(--v2-trend)" />
                <rect x={5} y={-flagHeight / 2} width={flagWidth} height={flagHeight} rx={2} fill="var(--v2-trend)" />
                <text
                  x={5 + flagWidth / 2}
                  y={4}
                  textAnchor="middle"
                  className={styles.flagText}
                  fill="var(--v2-flag-ink)"
                >
                  {convertKg(current.weightKg, unit).toFixed(decimals)}
                </text>
              </>
            ) : (
              // The compact flag needs no horizontal reservation at all: the value sits above a
              // short leader line rising from the terminal point, right-aligned so it never
              // extends past the plot's own right edge (Implementation Spec §4: "76px cheaper").
              <>
                <line x1={0} x2={0} y1={0} y2={-9} stroke="var(--v2-trend)" strokeDasharray="2,2" />
                <text x={0} y={-13} textAnchor="end" className={styles.flagTextInline} fill="var(--v2-trend)">
                  {convertKg(current.weightKg, unit).toFixed(decimals)}
                </text>
              </>
            )}
          </g>
        )}

        {inspected ? (
          <DateChip
            x={clamp(xScale(inspected.date), 28, Math.max(28, innerWidth - 28))}
            y={innerHeight}
            label={formatShortDate(inspected.date)}
            compact={width < V2_WIDE_BREAKPOINT}
          />
        ) : null}

        <rect
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerMove}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          aria-hidden="true"
        />
      </Group>
    </svg>
  );
}

function DateChip({ x, y, label, compact }: { x: number; y: number; label: string; compact: boolean }) {
  const chipWidth = compact ? 46 : 52;
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect x={-chipWidth / 2} y={4} width={chipWidth} height={16} rx={2} fill="var(--v2-ink)" />
      <text x={0} y={15.5} textAnchor="middle" className={styles.chipText} fill="var(--v2-bg)">
        {label}
      </text>
    </g>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The weight extent the axis must cover: every drawn value, plus the goal reference when one is
 * set. The goal extends the domain rather than being clipped to an edge.
 */
function weightExtent(series: ChartSeries, goalKg: number | null): [number, number] {
  const values = [
    ...series.observations.map((point) => point.weightKg),
    ...series.historyBand.flatMap((point) => [point.lowerKg, point.upperKg]),
    ...series.forecastBand.flatMap((point) => [point.lowerKg, point.upperKg]),
    ...(goalKg === null ? [] : [goalKg]),
  ];
  if (values.length === 0) {
    return [0, 1];
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.06, 0.4);
  return [min - padding, max + padding];
}

function ariaLabel(current: CanvasCurrent, series: ChartSeries, unit: DisplayUnit): string {
  return (
    `Weight trend canvas. ${series.observations.length} scale readings drawn as points, the ` +
    `estimated underlying trend as a line with its 95% range, and the forecast continuing it. ` +
    `Estimated underlying weight ${formatWeightUnit(current.weightKg, unit)}, 95% range ` +
    `${formatWeightRangeUnit(current.lowerKg, current.upperKg, unit)}.`
  );
}

/**
 * The same numbers in plain text, for anyone who cannot or does not want to read the SVG. The
 * wrapper carries `.visuallyHidden`, not the table: a table treats `width: 1px` as a minimum
 * rather than a cap, and would otherwise overflow a phone-width page.
 */
function AccessibleSummary({
  series,
  current,
  unit,
}: {
  series: ChartSeries;
  current: CanvasCurrent;
  unit: DisplayUnit;
}) {
  const lastForecast = series.forecastLine.at(-1);
  return (
    <div className="visuallyHidden">
      <table>
        <caption>Values behind the canvas above</caption>
        <tbody>
          <tr>
            <th scope="row">Latest scale reading</th>
            <td>{current.readingKg === null ? "none" : formatWeightUnit(current.readingKg, unit)}</td>
          </tr>
          <tr>
            <th scope="row">Estimated underlying weight</th>
            <td>
              {formatWeightUnit(current.weightKg, unit)}, 95% range{" "}
              {formatWeightRangeUnit(current.lowerKg, current.upperKg, unit)}
            </td>
          </tr>
          <tr>
            <th scope="row">End of the drawn forecast</th>
            <td>
              {lastForecast
                ? `${formatFullDate(lastForecast.date)}, ${formatWeightUnit(lastForecast.weightKg, unit)}`
                : "none"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const TWEEN_MS = 280;

/**
 * Ease a scale domain to a new one instead of cutting to it -- the one place the design
 * direction asks for motion on the canvas, since a chart that jumps makes the reader re-find the
 * trend. A reader who has asked for reduced motion gets the new domain immediately.
 */
function useTweenedRange(targetMin: number, targetMax: number): [number, number] {
  const [range, setRange] = useState<[number, number]>([targetMin, targetMax]);
  const rangeRef = useRef(range);

  useEffect(() => {
    const [fromMin, fromMax] = rangeRef.current;
    if (fromMin === targetMin && fromMax === targetMax) {
      return;
    }

    const duration = prefersReducedMotion() ? 0 : TWEEN_MS;
    let frame = 0;
    let startedAt: number | null = null;

    const step = (now: number) => {
      startedAt ??= now;
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next: [number, number] = [
        fromMin + (targetMin - fromMin) * eased,
        fromMax + (targetMax - fromMax) * eased,
      ];
      rangeRef.current = next;
      setRange(next);
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [targetMin, targetMax]);

  return range;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
