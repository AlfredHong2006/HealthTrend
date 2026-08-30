import { HEADLINE_FORECAST_HORIZON_DAYS } from "@/lib/analysis";
import { formatWeeklyRateKg, formatWeightKg, formatWeightRangeKg } from "@/lib/chart/format";
import { formatRateMagnitude } from "@/lib/v2/format";
import { summaryLine } from "@/lib/v2/narrative";
import type { AnalysisResponse, ForecastPoint } from "@/lib/api/types";
import styles from "./V2Summary.module.css";

interface V2SummaryProps {
  analysis: AnalysisResponse;
  headlineForecast: ForecastPoint;
}

/**
 * The calm top of the analysis surface: the estimate, the rate, where the trajectory
 * projects, and one line saying what that was estimated from.
 *
 * What is deliberately *not* here is as important as what is. The canvas already reports the
 * latest scale reading, the estimate at that instant and its interval in its own readout, and
 * flags the trend weight on the weight axis; restating all of it here in larger type made the
 * right-hand side a second dashboard rather than an interpretation of the first. So the raw
 * reading is gone from this block (it is evidence, and it lives in the canvas readout and in
 * the Evidence detail), and the rate and the projection -- the two figures the canvas does not
 * state numerically -- stay.
 *
 * There are no cards: hierarchy is type size and hairlines. Nothing here classifies the trend.
 */
export function V2Summary({ analysis, headlineForecast }: V2SummaryProps) {
  const { current } = analysis;

  return (
    <div className={styles.summary}>
      <h2 className={styles.eyebrow}>Analysis</h2>

      <div className={styles.lead}>
        <p className={styles.leadValue}>{formatWeightKg(current.w_kg)}</p>
        <p className={styles.leadCaption}>
          Estimated underlying weight
          <span className={styles.leadRange}>
            95% {formatWeightRangeKg(current.w_lower95, current.w_upper95)}
          </span>
        </p>
      </div>

      <div className={styles.pair}>
        <div className={styles.figure}>
          <p className={styles.figureValue}>{formatWeeklyRateKg(current.weekly_rate_kg)}</p>
          <p className={styles.figureLabel}>Current weekly rate</p>
          <p className={styles.figureDetail}>
            sd {formatRateMagnitude(current.weekly_rate_sd_kg)}
          </p>
        </div>

        <div className={styles.figure}>
          <p className={styles.figureValue}>{formatWeightKg(headlineForecast.w_kg)}</p>
          <p className={styles.figureLabel}>
            {HEADLINE_FORECAST_HORIZON_DAYS} days ahead
          </p>
          <p className={styles.figureDetail}>
            95% {formatWeightRangeKg(headlineForecast.w_lower95, headlineForecast.w_upper95)}
          </p>
        </div>
      </div>

      <p className={styles.provenance}>{summaryLine(analysis)}</p>
    </div>
  );
}
