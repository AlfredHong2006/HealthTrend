import { formatHalfWidthUnit, formatRateRangeUnit, formatWeeklyRateUnit, formatWeightUnit } from "@/lib/v2/units";
import { rateDirection, weeklyRateInterval } from "@/lib/v2/velocity";
import type { DisplayUnit } from "@/lib/v2/units";
import type { CurrentEstimate } from "@/lib/api/types";
import styles from "./V2Hero.module.css";

interface V2HeroProps {
  current: CurrentEstimate;
  unit: DisplayUnit;
  asOfLabel: string;
}

/**
 * The chart hero: the estimated trend weight at display size, its 68% half-width beneath it,
 * and the current rate beside it with its own air -- the 1B Editorial composition
 * (docs/design/09_1B_Implementation_Spec §5.1: "Rate adjacent to the hero at the display tier
 * with its own air -- it never joins the statistics band, where it would read as one diagnostic
 * among many").
 *
 * The 68% half-width is the state's own standard deviation: for a Gaussian posterior, one
 * standard deviation *is* the 68% interval by definition, the same fact the 95% interval already
 * uses a fixed multiplier for (`current.w_sd`, alongside the published `w_lower95`/`w_upper95`).
 * Stating it is not a new inference.
 *
 * The rate's own interval and its direction come from `lib/v2/velocity.ts`, built from the
 * real posterior the backend publishes (`weekly_rate_sd_kg`) -- not a placeholder. Direction is
 * "flat" whenever that interval spans zero, exactly the rule the frozen design names for the
 * moment a real posterior exists (Implementation Spec §8.1).
 */
export function V2Hero({ current, unit, asOfLabel }: V2HeroProps) {
  const interval = weeklyRateInterval(current);
  const direction = rateDirection(current);
  const directionWord = direction === "flat" ? "flat" : direction === "down" ? "falling" : "rising";

  return (
    <div className={styles.hero} role="group" aria-label="Estimate and rate">
      <div className={styles.level}>
        <p className={styles.value}>{formatWeightUnit(current.w_kg, unit)}</p>
        <p className={styles.interval}>{formatHalfWidthUnit(current.w_sd, unit)} (68%)</p>
        <p className={styles.asOf}>{asOfLabel}</p>
      </div>

      <div className={styles.rate}>
        <p className={direction === "flat" ? `${styles.rateValue} ${styles.rateFlat}` : styles.rateValue}>
          {formatWeeklyRateUnit(current.weekly_rate_kg, unit)}
        </p>
        <p className={styles.rateLabel}>Current rate, {directionWord}</p>
        <p className={styles.rateInterval}>
          95% {formatRateRangeUnit(interval.lowerKgPerWeek, interval.upperKgPerWeek, unit)}
        </p>
      </div>
    </div>
  );
}
