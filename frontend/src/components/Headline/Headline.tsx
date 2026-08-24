import { formatWeightKg, formatWeightRangeKg } from "@/lib/chart/format";
import type { CurrentEstimate } from "@/lib/api/types";
import styles from "./Headline.module.css";

interface HeadlineProps {
  current: CurrentEstimate;
}

/**
 * The single most important number on the page: the estimated underlying weight, not the
 * latest scale reading -- the first thing on the page.
 */
export function Headline({ current }: HeadlineProps) {
  return (
    <div className={styles.headline}>
      <p className={styles.value}>{formatWeightKg(current.w_kg)}</p>
      <p className={styles.caption}>
        Estimated underlying weight
        <span className={styles.range}>
          {" "}
          &middot; 95% range {formatWeightRangeKg(current.w_lower95, current.w_upper95)}
        </span>
      </p>
    </div>
  );
}
