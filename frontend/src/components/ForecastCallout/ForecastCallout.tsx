import { HEADLINE_FORECAST_HORIZON_DAYS, horizonPoint } from "@/lib/analysis";
import { formatWeightKg, formatWeightRangeKg } from "@/lib/chart/format";
import type { Forecast } from "@/lib/api/types";
import styles from "./ForecastCallout.module.css";

interface ForecastCalloutProps {
  forecast: Forecast;
}

/**
 * The 30-day forecast: the primary consumer horizon (master plan section 9). The 7- and
 * 90-day horizons are still present in the response and readable from the graph and its
 * tooltip, but only one number is promoted to a headline figure here -- the page should
 * answer one question clearly, not publish a table of three.
 */
export function ForecastCallout({ forecast }: ForecastCalloutProps) {
  const at30Days = horizonPoint(forecast, HEADLINE_FORECAST_HORIZON_DAYS);

  return (
    <div className={styles.forecast}>
      <p className={styles.value}>{formatWeightKg(at30Days.w_kg)}</p>
      <p className={styles.caption}>
        30-day forecast
        <span className={styles.range}>
          {" "}
          &middot; likely range {formatWeightRangeKg(at30Days.w_lower95, at30Days.w_upper95)}
        </span>
      </p>
    </div>
  );
}
