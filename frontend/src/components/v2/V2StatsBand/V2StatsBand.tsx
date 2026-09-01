import { changeOverDays } from "@/lib/v2/change";
import { daysWithoutReading, readingsPerWeek } from "@/lib/v2/evidence";
import { formatDayCount } from "@/lib/v2/format";
import {
  formatHalfWidthUnit,
  formatSignedWeightUnit,
  formatWeightUnit,
} from "@/lib/v2/units";
import type { DisplayUnit } from "@/lib/v2/units";
import type { AnalysisResponse } from "@/lib/api/types";
import styles from "./V2StatsBand.module.css";

interface V2StatsBandProps {
  analysis: Pick<AnalysisResponse, "forecast" | "n_obs" | "span_days" | "observations" | "trajectory">;
  unit: DisplayUnit;
}

const CHANGE_WINDOW_DAYS = 90;

/**
 * The tier-2 statistics band beneath the chart: the 30-day forecast, the 90-day change (when the
 * series reaches back that far), and how many readings the estimate rests on
 * (docs/design/09_1B_Implementation_Spec §5.1).
 *
 * "Down-weighted" is not a fourth metric here. The frozen fixture drew one because its generator
 * invented an outlier threshold; the shipped model has no robust-observation rule, so there is
 * nothing real to report, and the honest response is to omit the slot rather than draw a zero
 * (docs/design/IMPLEMENTATION_NOTES.md, "1. No fake down-weighting").
 */
export function V2StatsBand({ analysis, unit }: V2StatsBandProps) {
  const { forecast, trajectory } = analysis;
  const thirtyDay = forecast.horizons.find((horizon) => horizon.horizon_days === 30);
  const change = changeOverDays(trajectory, CHANGE_WINDOW_DAYS);
  const gapDays = daysWithoutReading(analysis.observations);

  return (
    <div className={styles.band}>
      {thirtyDay ? (
        <Metric
          label="Projected, 30 days"
          value={formatWeightUnit(thirtyDay.w_kg, unit)}
          qualifier={`${formatHalfWidthUnit(thirtyDay.w_sd, unit)} (68%)`}
        />
      ) : null}

      {change ? (
        <Metric
          label={`Change, ${CHANGE_WINDOW_DAYS} days`}
          value={formatSignedWeightUnit(change.deltaKg, unit)}
          qualifier={`over the last ${formatDayCount(Math.round(change.actualDays))}`}
        />
      ) : (
        <p className={styles.absent}>
          No {CHANGE_WINDOW_DAYS}-day change: this series spans {formatDayCount(analysis.span_days)}
          . The figure is not estimated from a shorter span.
        </p>
      )}

      <Metric
        label="Readings used"
        value={String(analysis.n_obs)}
        qualifier={`of ${formatDayCount(analysis.span_days)} · ${gapDays} without a reading`}
      />

      <Metric
        label="Readings per week"
        value={readingsPerWeek(analysis.n_obs, analysis.span_days).toFixed(1)}
        qualifier="mean across the series"
      />
    </div>
  );
}

function Metric({ label, value, qualifier }: { label: string; value: string; qualifier: string }) {
  return (
    <div className={styles.metric}>
      <p className={styles.value}>{value}</p>
      <p className={styles.label}>{label}</p>
      <p className={styles.qualifier}>{qualifier}</p>
    </div>
  );
}
