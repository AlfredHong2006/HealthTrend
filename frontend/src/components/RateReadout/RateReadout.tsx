import { formatWeeklyRateKg } from "@/lib/chart/format";
import type { CurrentEstimate } from "@/lib/api/types";
import styles from "./RateReadout.module.css";

interface RateReadoutProps {
  current: CurrentEstimate;
}

/**
 * The current weekly rate, shown as the plain point estimate the backend publishes.
 *
 * The backend also reports `weekly_rate_sd_kg`, but not a 95% interval for the rate the way
 * it does for weight -- only a standard deviation. Deriving `1.96 * sd` here would be the
 * frontend performing statistics, so this component shows the point value only and leaves
 * that gap for a deliberate M2 contract decision rather than papering over it.
 */
export function RateReadout({ current }: RateReadoutProps) {
  return (
    <div className={styles.rate}>
      <p className={styles.value}>{formatWeeklyRateKg(current.weekly_rate_kg)}</p>
      <p className={styles.caption}>Current weekly rate</p>
    </div>
  );
}
