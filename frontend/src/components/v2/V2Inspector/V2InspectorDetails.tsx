"use client";

import { useState } from "react";
import Link from "next/link";
import { formatFullDate, formatWeeklyRateKg, formatWeightKg, formatWeightRangeKg } from "@/lib/chart/format";
import {
  formatDayCount,
  formatKgPrecise,
  formatRateMagnitude,
  formatSignedKg,
  formatTimeOfDay,
} from "@/lib/v2/format";
import { latestObservation } from "@/lib/v2/latest";
import type { DemoAnalysis } from "@/lib/api/types";
import styles from "./V2Inspector.module.css";

/** How many recent readings the on-demand list shows before the canvas takes over again. */
const RECENT_ROWS = 8;

/**
 * A lead of less than a day does not move a 7-, 30- or 90-day projection by anything the
 * display would show, so the sentence explaining it is not worth a reader's attention. This is
 * a threshold on whether to *say* something, not on anything computed.
 */
const MATERIAL_LEAD_DAYS = 1;

/**
 * Why this estimate differs from the number on the scale.
 *
 * Everything here is specific to *this* analysis: the reading, the estimate for the same
 * instant, the difference between them, and the published assumption that explains why the
 * two are allowed to differ. What is deliberately absent is any account of *why the model
 * moved as much as it did* -- that needs the per-observation innovation and Kalman gain the
 * core computes and discards at the wire boundary. Until those are published this tier stays
 * modest, which is preferable to filling it with model documentation that would read the same
 * on every series (docs/design/V2_DESIGN.md).
 */
export function WhyDetail({ analysis }: { analysis: DemoAnalysis }) {
  const { current, forecast, params } = analysis;
  const latest = latestObservation(analysis);
  const headline = forecast.horizons.find((horizon) => horizon.horizon_days === 30);

  return (
    <div className={styles.prose}>
      {latest === null ? null : (
        <>
          <Figures
            items={[
              { label: "Latest reading", value: formatWeightKg(latest.readingKg) },
              { label: "Estimate, same instant", value: formatWeightKg(latest.estimateKg) },
              { label: "Difference", value: formatSignedKg(latest.differenceKg) },
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

      <h4 className={styles.subhead}>Where that estimate is heading</h4>
      <Rows
        items={[
          { label: "Current weekly rate", value: formatWeeklyRateKg(current.weekly_rate_kg) },
          {
            label: "Rate standard deviation",
            value: formatRateMagnitude(current.weekly_rate_sd_kg),
          },
          ...(headline
            ? [
                { label: "30 days ahead", value: formatWeightKg(headline.w_kg) },
                {
                  label: "95% interval",
                  value: formatWeightRangeKg(headline.w_lower95, headline.w_upper95),
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

      <MethodLink />
    </div>
  );
}

/**
 * What the estimate rests on: the observation nearest to it, and the extent of the series
 * behind it.
 *
 * The generator's own arguments -- seed, velocity schedule, noise parameters -- are not here.
 * They are test-and-provenance metadata rather than evidence for a conclusion, and the header
 * already labels the whole page as synthetic, which is the claim that actually matters.
 */
export function EvidenceDetail({ analysis }: { analysis: DemoAnalysis }) {
  const [showRecent, setShowRecent] = useState(false);
  const latest = latestObservation(analysis);
  const first = analysis.observations.at(0);

  return (
    <div className={styles.prose}>
      {latest === null ? null : (
        <>
          <h4 className={styles.subhead}>Latest observation</h4>
          <Rows
            items={[
              {
                label: "Recorded",
                value: `${formatFullDate(latest.date)}, ${formatTimeOfDay(latest.date)}`,
              },
              { label: "Scale reading", value: formatWeightKg(latest.readingKg) },
              { label: "Estimated trend weight", value: formatWeightKg(latest.estimateKg) },
              { label: "Difference", value: formatSignedKg(latest.differenceKg) },
              {
                label: "95% interval on the estimate",
                value: formatWeightRangeKg(latest.lowerKg, latest.upperKg),
              },
            ]}
          />
        </>
      )}

      <h4 className={styles.subhead}>Series</h4>
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

      <RecentReadings analysis={analysis} open={showRecent} onToggle={() => setShowRecent((v) => !v)} />
    </div>
  );
}

/**
 * The tail of the series, on request. Every reading is already drawn on the canvas, so a table
 * of them is a secondary way to read the same evidence -- not something that should occupy the
 * rail by default.
 */
function RecentReadings({
  analysis,
  open,
  onToggle,
}: {
  analysis: DemoAnalysis;
  open: boolean;
  onToggle: () => void;
}) {
  // The trajectory carries one point per observation, at the same instant (ADR-0005). If that
  // ever stopped holding, the estimate column is dropped rather than paired with the wrong row.
  const aligned = analysis.trajectory.length === analysis.observations.length;
  const rows = analysis.observations
    .map((observation, index) => ({
      date: new Date(observation.timestamp),
      readingKg: observation.weight_kg,
      estimateKg: aligned ? (analysis.trajectory[index]?.w_kg ?? null) : null,
    }))
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
                {aligned ? <th scope="col">Estimate</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date.toISOString()}>
                  <td>{formatFullDate(row.date)}</td>
                  <td className={styles.numeric}>{formatWeightKg(row.readingKg)}</td>
                  {aligned ? (
                    <td className={styles.numeric}>
                      {row.estimateKg === null ? "—" : formatWeightKg(row.estimateKg)}
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
 * The published quantities, at the precision a reader can use.
 *
 * Not a raw API inspector: the forecast origin, the lead, the process-noise conversion and the
 * internal parameter names are model mechanics rather than results, and they are on the Method
 * page. Weights are shown to one decimal because that is the precision the product claims
 * everywhere else; standard deviations get two, because a spread of 0.2 kg and one of 0.18 kg
 * are different statements.
 */
export function StatisticsDetail({ analysis }: { analysis: DemoAnalysis }) {
  const { current, forecast } = analysis;

  return (
    <div className={styles.prose}>
      <h4 className={styles.subhead}>Current estimate</h4>
      <Rows
        items={[
          { label: "Trend weight", value: formatWeightKg(current.w_kg) },
          { label: "Standard deviation", value: formatKgPrecise(current.w_sd, 2) },
          {
            label: "95% interval",
            value: formatWeightRangeKg(current.w_lower95, current.w_upper95),
          },
        ]}
      />

      <h4 className={styles.subhead}>Current rate</h4>
      <Rows
        items={[
          { label: "Weekly rate", value: formatWeeklyRateKg(current.weekly_rate_kg) },
          { label: "Standard deviation", value: formatRateMagnitude(current.weekly_rate_sd_kg) },
        ]}
      />

      <h4 className={styles.subhead}>Forecast</h4>
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
                <td className={styles.numeric}>{formatWeightKg(horizon.w_kg)}</td>
                <td className={styles.numeric}>
                  {formatWeightRangeKg(horizon.w_lower95, horizon.w_upper95)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MethodLink label="Model parameters and the equations behind these numbers" />
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
