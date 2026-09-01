"use client";

import { useState } from "react";
import Link from "next/link";
import { formatFullDate } from "@/lib/chart/format";
import { formatDayCount, formatKgPrecise, formatTimeOfDay } from "@/lib/v2/format";
import { daysWithoutReading, readingsPerWeek } from "@/lib/v2/evidence";
import { measurementScatterKg } from "@/lib/v2/scatter";
import {
  formatHalfWidthUnit,
  formatMagnitudeUnit,
  formatRateRangeUnit,
  formatSignedWeightUnit,
  formatWeeklyRateUnit,
  formatWeightRangeUnit,
  formatWeightUnit,
} from "@/lib/v2/units";
import type { DisplayUnit } from "@/lib/v2/units";
import { weeklyRateInterval } from "@/lib/v2/velocity";
import { latestObservation } from "@/lib/v2/latest";
import type { AnalysisResponse } from "@/lib/api/types";
import styles from "./V2Inspector.module.css";

/** How many recent readings the on-demand list shows before the canvas takes over again. */
const RECENT_ROWS = 8;

/**
 * A lead of less than a day does not move a 7-, 30- or 90-day projection by anything the
 * display would show, so the sentence explaining it is not worth a reader's attention.
 */
const MATERIAL_LEAD_DAYS = 1;

interface TierProps {
  analysis: AnalysisResponse;
  unit: DisplayUnit;
}

/**
 * Why this estimate differs from the number on the scale, and what the rate is estimated to be.
 *
 * Everything here is specific to *this* analysis: the reading, the estimate for the same
 * instant, the difference between them, the published measurement-noise assumption, and the
 * rate with the real interval its own posterior now carries (`lib/v2/velocity.ts`). What stays
 * deliberately absent is any account of *why the model moved as much as it did* -- that needs
 * the per-observation innovation and Kalman gain the core computes and discards at the wire
 * boundary -- and any generic account of how a Kalman filter works in general, which reads
 * identically on every series and belongs to Method instead (docs/design/V2_DESIGN.md: "Why
 * means why this estimate, for this series").
 */
export function WhyDetail({ analysis, unit }: TierProps) {
  const { current, forecast, params } = analysis;
  const latest = latestObservation(analysis);
  const headline = forecast.horizons.find((horizon) => horizon.horizon_days === 30);
  const interval = weeklyRateInterval(current);

  return (
    <div className={styles.prose}>
      {latest === null ? null : (
        <>
          <Figures
            items={[
              { label: "Latest reading", value: formatWeightUnit(latest.readingKg, unit) },
              { label: "Estimate, same instant", value: formatWeightUnit(latest.estimateKg, unit) },
              { label: "Difference", value: formatSignedWeightUnit(latest.differenceKg, unit) },
            ]}
          />
          <p>
            A scale reading is treated as a noisy observation of the underlying weight rather
            than the weight itself, so the estimate moves part of the way towards a new reading
            instead of becoming it. The measurement noise assumed here is{" "}
            {formatKgPrecise(params.sigma_obs_kg, 2)}, one standard deviation.
          </p>
        </>
      )}

      <h3 className={styles.subhead}>Where that estimate is heading</h3>
      <Rows
        items={[
          { label: "Current weekly rate", value: formatWeeklyRateUnit(current.weekly_rate_kg, unit) },
          {
            label: "Rate, 95% interval",
            value: formatRateRangeUnit(interval.lowerKgPerWeek, interval.upperKgPerWeek, unit),
          },
          ...(headline
            ? [
                { label: "30 days ahead", value: formatWeightUnit(headline.w_kg, unit) },
                {
                  label: "95% interval",
                  value: formatWeightRangeUnit(headline.w_lower95, headline.w_upper95, unit),
                },
              ]
            : []),
        ]}
      />
      <p>
        The projection is that same estimate carried forward at that rate. Nothing else is added
        to it, and the interval widens with distance because both the weight and the rate are
        estimates rather than known values.
      </p>

      {forecast.lead_days >= MATERIAL_LEAD_DAYS ? (
        <p>
          Horizons are measured from a forecast origin {formatDayCount(forecast.lead_days)} after
          the last weigh-in, so the projection already carries that elapsed time.
        </p>
      ) : null}

      <p className={styles.quiet}>
        Parameters are fixed and documented rather than fitted to this history — nothing here is
        estimated per person. <MethodLink label="Read the Method" />.
      </p>
    </div>
  );
}

/**
 * What the estimate rests on: the observation nearest to it, and the extent of the series
 * behind it.
 */
export function EvidenceDetail({ analysis, unit }: TierProps) {
  const [showRecent, setShowRecent] = useState(false);
  const latest = latestObservation(analysis);
  const first = analysis.observations.at(0);
  const gapDays = daysWithoutReading(analysis.observations);

  return (
    <div className={styles.prose}>
      <Figures
        items={[
          {
            label: "Readings used",
            value: `${analysis.n_obs} of ${formatDayCount(analysis.span_days)}`,
          },
          { label: "Days without a reading", value: String(gapDays) },
          {
            label: "Readings per week",
            value: readingsPerWeek(analysis.n_obs, analysis.span_days).toFixed(1),
          },
        ]}
      />

      {latest === null ? null : (
        <>
          <h3 className={styles.subhead}>Latest observation</h3>
          <Rows
            items={[
              {
                label: "Recorded",
                value: `${formatFullDate(latest.date)}, ${formatTimeOfDay(latest.date)}`,
              },
              { label: "Scale reading", value: formatWeightUnit(latest.readingKg, unit) },
              { label: "Estimated trend weight", value: formatWeightUnit(latest.estimateKg, unit) },
              { label: "Difference from estimate", value: formatSignedWeightUnit(latest.differenceKg, unit) },
              {
                label: "95% interval on the estimate",
                value: formatWeightRangeUnit(latest.lowerKg, latest.upperKg, unit),
              },
            ]}
          />
        </>
      )}

      <h3 className={styles.subhead}>Series</h3>
      <Rows
        items={[
          { label: "Readings", value: String(analysis.n_obs) },
          { label: "Span", value: formatDayCount(analysis.span_days) },
          {
            label: "First reading",
            value: first ? formatFullDate(new Date(first.timestamp)) : "—",
          },
        ]}
      />

      <RecentReadings analysis={analysis} unit={unit} open={showRecent} onToggle={() => setShowRecent((v) => !v)} />
    </div>
  );
}

/**
 * The tail of the series, on request. Every reading is already drawn on the canvas, so a table
 * of them is a secondary way to read the same evidence.
 *
 * Named "difference from estimate", not "residual": an arbitrary measurement-minus-estimate gap
 * is not the filter's own innovation, and the two must not be conflated
 * (docs/design/IMPLEMENTATION_NOTES.md, "2. Residual terminology").
 */
function RecentReadings({
  analysis,
  unit,
  open,
  onToggle,
}: {
  analysis: AnalysisResponse;
  unit: DisplayUnit;
  open: boolean;
  onToggle: () => void;
}) {
  const aligned = analysis.trajectory.length === analysis.observations.length;
  const rows = analysis.observations
    .map((observation, index) => {
      const estimateKg = aligned ? (analysis.trajectory[index]?.w_kg ?? null) : null;
      return {
        date: new Date(observation.timestamp),
        readingKg: observation.weight_kg,
        estimateKg,
        differenceKg: estimateKg === null ? null : observation.weight_kg - estimateKg,
      };
    })
    .slice(-RECENT_ROWS)
    .reverse();

  return (
    <div className={styles.secondary}>
      <button type="button" className={styles.disclose} aria-expanded={open} onClick={onToggle}>
        {open ? "Hide recent readings" : `Show the last ${rows.length} readings`}
      </button>

      {open ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Reading</th>
                {aligned ? <th scope="col" className={styles.hideNarrow}>Estimate</th> : null}
                {aligned ? <th scope="col">Difference</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date.toISOString()}>
                  <td>{formatFullDate(row.date)}</td>
                  <td className={styles.numeric}>{formatWeightUnit(row.readingKg, unit)}</td>
                  {aligned ? (
                    <td className={`${styles.numeric} ${styles.hideNarrow}`}>
                      {row.estimateKg === null ? "—" : formatWeightUnit(row.estimateKg, unit)}
                    </td>
                  ) : null}
                  {aligned ? (
                    <td className={styles.numeric}>
                      {row.differenceKg === null ? "—" : formatSignedWeightUnit(row.differenceKg, unit)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The published quantities, at the precision a reader can use, plus the measurement scatter
 * `docs/design/IMPLEMENTATION_NOTES.md` permits: an RMS of readings around the trajectory's own
 * estimate, described as scatter -- never as innovation variance, which is a different quantity.
 */
export function StatisticsDetail({ analysis, unit }: TierProps) {
  const { current, forecast } = analysis;
  const interval = weeklyRateInterval(current);
  const scatterKg = measurementScatterKg(analysis.observations, analysis.trajectory);

  return (
    <div className={styles.prose}>
      <h3 className={styles.subhead}>Current estimate</h3>
      <Rows
        items={[
          { label: "Trend weight", value: formatWeightUnit(current.w_kg, unit) },
          { label: "68% interval", value: formatHalfWidthUnit(current.w_sd, unit) },
          {
            label: "95% interval",
            value: formatWeightRangeUnit(current.w_lower95, current.w_upper95, unit),
          },
        ]}
      />

      <h3 className={styles.subhead}>Current rate</h3>
      <Rows
        items={[
          { label: "Weekly rate", value: formatWeeklyRateUnit(current.weekly_rate_kg, unit) },
          {
            label: "95% interval",
            value: formatRateRangeUnit(interval.lowerKgPerWeek, interval.upperKgPerWeek, unit),
          },
        ]}
      />

      {scatterKg === null ? null : (
        <>
          <h3 className={styles.subhead}>Measurement scatter</h3>
          <Rows
            items={[
              {
                label: "Readings around the estimated trajectory",
                value: formatMagnitudeUnit(scatterKg, unit),
              },
            ]}
          />
        </>
      )}

      <h3 className={styles.subhead}>Forecast</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Horizon</th>
              <th scope="col">Estimate</th>
              <th scope="col">95% interval</th>
            </tr>
          </thead>
          <tbody>
            {forecast.horizons.map((horizon) => (
              <tr key={horizon.horizon_days}>
                <th scope="row" className={styles.numeric}>
                  {formatDayCount(horizon.horizon_days)}
                </th>
                <td className={styles.numeric}>{formatWeightUnit(horizon.w_kg, unit)}</td>
                <td className={styles.numeric}>
                  {formatWeightRangeUnit(horizon.w_lower95, horizon.w_upper95, unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.quiet}>
        <MethodLink label="Model parameters and the equations behind these numbers" />
      </p>
    </div>
  );
}

function MethodLink({ label = "How HealthTrend calculates this" }: { label?: string }) {
  return (
    <Link href="/v2/method" className={styles.inlineMethodLink}>
      <span>{label}</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function Figures({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className={styles.figures}>
      {items.map((item) => (
        <div key={item.label} className={styles.figure}>
          <dt className={styles.figureLabel}>{item.label}</dt>
          <dd className={styles.figureValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Rows({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className={styles.rows}>
      {items.map((item) => (
        <div key={item.label} className={styles.row}>
          <dt className={styles.rowLabel}>{item.label}</dt>
          <dd className={styles.rowValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
