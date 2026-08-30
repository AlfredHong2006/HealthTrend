"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AxisBottom, AxisRight } from "@visx/axis";
import { localPoint } from "@visx/event";
import { GridRows } from "@visx/grid";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear, scaleTime } from "@visx/scale";
import { AreaClosed, Circle, Line, LinePath } from "@visx/shape";
import {
  formatFullDate,
  formatShortDate,
  formatWeightKg,
  formatWeightRangeKg,
} from "@/lib/chart/format";
import type { ChartSeries } from "@/lib/chart/series";
import { formatDayCount, formatMonthYear, formatNumber } from "@/lib/v2/format";
import { nearestInspectionIndex, type InspectionPoint } from "@/lib/v2/inspect";
import {
  v2DateTickCount,
  v2MarginFor,
  v2WeightTickCount,
  V2_COMPACT_BREAKPOINT,
} from "@/lib/v2/layout";
import type { ForecastWindow, HistoryRange } from "@/lib/v2/view";
import styles from "./V2Canvas.module.css";

const MS_PER_DAY = 86_400_000;
const MONTHLY_AXIS_THRESHOLD_DAYS = 300;

export interface CanvasCurrent {
  /** The estimated trend weight, which the right-edge value flag reports. */
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
  historyRanges: readonly HistoryRange[];
  historyRangeId: string;
  onHistoryRangeChange: (id: string) => void;
  forecastWindows: readonly ForecastWindow[];
  forecastWindowId: string;
  onForecastWindowChange: (id: string) => void;
}

/**
 * The analytical canvas: the primary product surface, and the main way a conclusion is seen,
 * interrogated and believed.
 *
 * Every mark is a value the backend published, mapped to a pixel. Nothing here derives a
 * statistic, and the marks whose mathematics does not exist yet -- checkpoint markers above
 * all -- are simply absent, not drawn greyed out (docs/design/V2_DESIGN.md).
 *
 * What it borrows from a charting instrument is discipline, not aesthetic: the weight axis
 * sits on the right beside a value flag reporting the current trend weight, inspection is a
 * crosshair with an axis-linked readout rather than a floating tooltip card, and the two view
 * controls window data that is already on the page.
 */
export function V2Canvas({
  series,
  points,
  inspectIndex,
  onInspect,
  current,
  goalKg,
  historyRanges,
  historyRangeId,
  onHistoryRangeChange,
  forecastWindows,
  forecastWindowId,
  onForecastWindowChange,
}: V2CanvasProps) {
  const inspected = inspectIndex === null ? null : (points[inspectIndex] ?? null);

  return (
    <figure className={styles.canvas}>
      <div className={styles.head}>
        <CanvasReadout inspected={inspected} current={current} originDate={series.originDate} />
        <div className={styles.controls}>
          <ControlGroup
            label="History"
            options={historyRanges}
            selectedId={historyRangeId}
            onSelect={onHistoryRangeChange}
          />
          <ControlGroup
            label="Ahead"
            options={forecastWindows}
            selectedId={forecastWindowId}
            onSelect={onForecastWindowChange}
          />
        </div>
      </div>

      <div className={styles.plotShell}>
        <div className={styles.plot}>
          {/* initialSize gives the server-rendered HTML a real chart at a plausible size
              rather than an empty box until the client's ResizeObserver reports the true
              one; it is replaced on hydration, at every width. */}
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
                />
              ) : null
            }
          </ParentSize>
        </div>
        <InspectionSlider points={points} inspectIndex={inspectIndex} onInspect={onInspect} />
      </div>

      <figcaption className={styles.legend}>
        <Key markClass={styles.keyObservation} label="Scale readings" />
        <Key markClass={styles.keyTrend} label="Estimated trend" />
        <Key markClass={styles.keyBand} label="95% range" />
        <Key markClass={styles.keyForecast} label="Forecast" />
        {goalKg === null ? null : <Key markClass={styles.keyGoal} label="Goal reference" />}
      </figcaption>

      <AccessibleSummary series={series} current={current} />
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

interface ControlOption {
  id: string;
  label: string;
  description: string;
}

function ControlGroup({
  label,
  options,
  selectedId,
  onSelect,
}: {
  label: string;
  options: readonly ControlOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.controlGroup} role="group" aria-label={label}>
      <span className={styles.controlLabel} aria-hidden="true">
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={option.id === selectedId}
          aria-label={option.description}
          className={
            option.id === selectedId ? `${styles.control} ${styles.controlOn}` : styles.control
          }
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The axis-linked readout: one line reporting either the inspected point or, when nothing is
 * being inspected, the current estimate. It stands in for the floating tooltip card the
 * design direction rules out wherever an integrated readout can work instead.
 *
 * The first cell's label doubles as the region indicator -- history, forecast, or the last
 * weigh-in -- so no separate chip is needed to say where the crosshair is.
 */
function CanvasReadout({
  inspected,
  current,
  originDate,
}: {
  inspected: InspectionPoint | null;
  current: CanvasCurrent;
  originDate: Date;
}) {
  const date = inspected?.date ?? current.timestamp;
  const weightKg = inspected?.weightKg ?? current.weightKg;
  const lowerKg = inspected?.lowerKg ?? current.lowerKg;
  const upperKg = inspected?.upperKg ?? current.upperKg;
  const readingKg = inspected === null ? current.readingKg : inspected.readingKg;

  // The label doubles as the region indicator, and is worded so it never reads as one of the
  // view controls beside it ("History", "Ahead") -- two different meanings of the same word on
  // one line would be ambiguous on screen, not only in a test.
  const region =
    inspected === null ? "Last weigh-in" : inspected.isForecast ? "Forecast for" : "Estimate on";
  const horizonDays = Math.round((date.getTime() - originDate.getTime()) / MS_PER_DAY);

  // On a phone the rail's summary sits directly above the chart and already states the estimate
  // and its interval, so at rest the readout would repeat them a centimetre lower. It appears
  // there only while a point is being inspected, which is when it is saying something new.
  return (
    <dl className={inspected ? `${styles.readout} ${styles.readoutActive}` : styles.readout}>
      <Cell label={region} value={formatFullDate(date)} />
      <Cell label="Estimated weight" value={formatWeightKg(weightKg)} />
      <Cell label="95% range" value={formatWeightRangeKg(lowerKg, upperKg)} />
      {inspected?.isForecast ? (
        <Cell label="Horizon" value={`+${formatDayCount(horizonDays)}`} />
      ) : (
        <Cell
          label="Scale reading"
          value={readingKg === null ? "none at this point" : formatWeightKg(readingKg)}
        />
      )}
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
 * rather than a bespoke key handler on a focusable div: arrow keys, Home and End come from
 * the platform, and `aria-valuetext` reports the point in words instead of an index. It is
 * visually hidden; the plot draws the focus ring through `:focus-within`.
 */
function InspectionSlider({
  points,
  inspectIndex,
  onInspect,
}: {
  points: readonly InspectionPoint[];
  inspectIndex: number | null;
  onInspect: (index: number | null) => void;
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
            `${formatWeightKg(point.weightKg)}, 95% range ` +
            `${formatWeightRangeKg(point.lowerKg, point.upperKg)}`
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
}

function Plot({
  width,
  height,
  series,
  points,
  inspectIndex,
  onInspect,
  current,
  goalKg,
}: PlotProps) {
  const clipId = useId();
  const margin = v2MarginFor(width);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);
  const compact = width < V2_COMPACT_BREAKPOINT;

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
  const flagWidth = margin.right - 12;
  const flagHeight = 17;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={styles.svg}
      role="img"
      aria-label={ariaLabel(current, series)}
    >
      <defs>
        {/* A few pixels of bleed: the clip exists to stop marks spilling into the axes during
            a range transition, not to slice the first and last observation dots in half. */}
        <clipPath id={clipId}>
          <rect x={-3} y={-3} width={innerWidth + 6} height={innerHeight + 6} />
        </clipPath>
      </defs>

      <Group left={margin.left} top={margin.top}>
        {/* Colours are written as presentation attributes carrying a custom property, the way
            V1's TrendChart does, rather than through the CSS module: several visx marks set a
            default `stroke`/`fill` attribute of their own, and an attribute beats a class. */}
        <g clipPath={`url(#${clipId})`} pointerEvents="none">
          {/* The forecast half of the canvas, washed just enough to read as a different
              region rather than as decoration. */}
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
            numTicks={v2WeightTickCount(innerHeight)}
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
                x={4}
                y={yScale(goalKg) - 6}
                className={styles.goalLabel}
                fill="var(--v2-goal)"
              >
                Goal {formatNumber(goalKg, 1)}
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

        <AxisRight
          left={innerWidth}
          scale={yScale}
          numTicks={v2WeightTickCount(innerHeight)}
          hideAxisLine
          tickLength={4}
          tickStroke="var(--v2-rule-strong)"
          tickFormat={(value) => formatNumber(Number(value), 1)}
          tickLabelProps={{ fill: "var(--v2-ink-faint)", fontSize: 10.5, dx: 2, dy: 3 }}
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

        {/* The right-edge value flag: the current trend weight, read off the same axis, the
            way an instrument tags its last price. It has no leader line running across the
            forecast region -- a horizontal rule there would read as a prediction of no
            change, which is not what the model says. */}
        <g transform={`translate(${innerWidth}, ${yScale(current.weightKg)})`} pointerEvents="none">
          <line x1={0} x2={5} y1={0} y2={0} stroke="var(--v2-trend)" />
          <rect
            x={5}
            y={-flagHeight / 2}
            width={flagWidth}
            height={flagHeight}
            rx={2}
            fill="var(--v2-trend)"
          />
          <text
            x={5 + flagWidth / 2}
            y={4}
            textAnchor="middle"
            className={styles.flagText}
            fill="var(--v2-flag-ink)"
          >
            {formatNumber(current.weightKg, 1)}
          </text>
        </g>

        {inspected ? (
          <DateChip
            x={clamp(xScale(inspected.date), 28, Math.max(28, innerWidth - 28))}
            y={innerHeight}
            label={formatShortDate(inspected.date)}
            compact={compact}
          />
        ) : null}

        <rect
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          // `onPointerDown` matters on touch: a tap generates pointerdown but never
          // pointermove, so without it the crosshair is unreachable by touch. `touchAction`
          // stops the browser claiming a drag here for page scrolling, so a finger scrubs.
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

function DateChip({
  x,
  y,
  label,
  compact,
}: {
  x: number;
  y: number;
  label: string;
  compact: boolean;
}) {
  const chipWidth = compact ? 46 : 52;
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect
        x={-chipWidth / 2}
        y={4}
        width={chipWidth}
        height={16}
        rx={2}
        fill="var(--v2-ink)"
      />
      <text
        x={0}
        y={15.5}
        textAnchor="middle"
        className={styles.chipText}
        fill="var(--v2-bg)"
      >
        {label}
      </text>
    </g>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The weight extent the axis must cover: every drawn value, plus the goal reference when one
 * is set. The goal extends the domain rather than being clipped to an edge -- a reference
 * line pinned to the frame would misreport where it sits relative to the trend.
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

function ariaLabel(current: CanvasCurrent, series: ChartSeries): string {
  return (
    `Weight trend canvas. ${series.observations.length} scale readings drawn as points, the ` +
    `estimated underlying trend as a line with its 95% range, and the forecast continuing it. ` +
    `Estimated underlying weight ${formatWeightKg(current.weightKg)}, 95% range ` +
    `${formatWeightRangeKg(current.lowerKg, current.upperKg)}.`
  );
}

/**
 * The same numbers in plain text, for anyone who cannot or does not want to read the SVG. The
 * wrapper carries `.visuallyHidden`, not the table: a table treats `width: 1px` as a minimum
 * rather than a cap, and would otherwise overflow a phone-width page.
 */
function AccessibleSummary({ series, current }: { series: ChartSeries; current: CanvasCurrent }) {
  const lastForecast = series.forecastLine.at(-1);
  return (
    <div className="visuallyHidden">
      <table>
        <caption>Values behind the canvas above</caption>
        <tbody>
          <tr>
            <th scope="row">Latest scale reading</th>
            <td>{current.readingKg === null ? "none" : formatWeightKg(current.readingKg)}</td>
          </tr>
          <tr>
            <th scope="row">Estimated underlying weight</th>
            <td>
              {formatWeightKg(current.weightKg)}, 95% range{" "}
              {formatWeightRangeKg(current.lowerKg, current.upperKg)}
            </td>
          </tr>
          <tr>
            <th scope="row">End of the drawn forecast</th>
            <td>
              {lastForecast
                ? `${formatFullDate(lastForecast.date)}, ${formatWeightKg(lastForecast.weightKg)}`
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
 * Ease a scale domain to a new one instead of cutting to it.
 *
 * The one place the design direction asks for motion on the canvas: a range change is a
 * continuity problem, and a chart that jumps makes the reader re-find the trend. It is not
 * decoration -- nothing animates on load, on hover or on selection, and a reader who has
 * asked for reduced motion gets the new domain immediately.
 */
function useTweenedRange(targetMin: number, targetMax: number): [number, number] {
  const [range, setRange] = useState<[number, number]>([targetMin, targetMax]);
  // Written only from inside the animation frame, never during render: the state it mirrors
  // has no other writer, and the effect needs the value it starts from without depending on it.
  const rangeRef = useRef(range);

  useEffect(() => {
    const [fromMin, fromMax] = rangeRef.current;
    if (fromMin === targetMin && fromMax === targetMax) {
      return;
    }

    // Reduced motion is expressed as a zero-length tween rather than an early assignment, so
    // there is one code path: the first frame lands on the target and the loop stops there.
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
