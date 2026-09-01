import type { ReactNode } from "react";
import { formatFullDate } from "@/lib/chart/format";
import { formatTimeOfDay } from "@/lib/v2/format";
import { formatSignedWeightUnit, formatWeightUnit } from "@/lib/v2/units";
import type { DisplayUnit } from "@/lib/v2/units";
import { analysisLede } from "@/lib/v2/lede";
import { latestObservation } from "@/lib/v2/latest";
import { summaryLine } from "@/lib/v2/narrative";
import type { AnalysisResponse } from "@/lib/api/types";
import styles from "./V2Summary.module.css";

interface V2SummaryProps {
  analysis: AnalysisResponse;
  unit: DisplayUnit;
  /**
   * Whether an estimated trajectory exists to describe (`lib/v2/span.ts`). Passed down rather
   * than recomputed so the whole screen answers the question once, in one place.
   */
  hasSpan: boolean;
  /**
   * The goal control, rendered into the supporting column. Injected rather than imported
   * because the goal's draft state is ephemeral and lives in `V2Workspace`, which owns it for
   * the length of the visit (docs/privacy.md); this component stays free of that state.
   */
  goal?: ReactNode;
}

/**
 * What this analysis says, and beside it the supporting context: the most recent raw scale
 * reading against the estimate for the same instant, and the goal reference.
 *
 * That reading is the last one in the series, which is not necessarily one taken today -- a
 * user analysing an export may last have weighed in months ago. It is labelled "Latest reading"
 * and carries its own date for exactly that reason: "Reading today" asserted a fact about the
 * calendar that nothing in the response supports.
 *
 * This was the persistent right rail. It now sits in the centred main composition directly
 * below the canvas: a reserved 400px column beside the chart pushed the canvas visibly left of
 * centre at desktop widths, which is the opposite of what the rail was for. The content, the
 * copy and the honesty rules are unchanged -- only where it sits is.
 *
 * There are still no cards: hierarchy is type size, alignment and hairlines, and at desktop the
 * two columns are separated by a vertical rule rather than boxed. The lede states only what
 * `lib/v2/lede.ts` computes from published numbers -- nothing here classifies the trend, and the
 * word "residual" is avoided per docs/design/IMPLEMENTATION_NOTES.md, "2. Residual terminology":
 * the reading-versus-estimate gap is named plainly as a difference.
 */
export function V2Summary({ analysis, unit, hasSpan, goal }: V2SummaryProps) {
  const lede = analysisLede(analysis, unit);
  const latest = latestObservation(analysis);

  return (
    <section className={styles.summary} aria-label="Analysis summary">
      <div className={styles.says}>
        <h2 className={styles.eyebrow}>What this analysis says</h2>
        <p className={styles.lede}>{lede.headline}</p>
        <p className={styles.detail}>{lede.detail}</p>
      </div>

      <div className={styles.support}>
        {latest === null ? null : (
          <div className={styles.today}>
            <span className={styles.eyebrow}>Latest reading</span>
            <div className={styles.readingRow}>
              <span className={styles.readingValue}>
                {formatWeightUnit(latest.readingKg, unit)}
              </span>
              <span className={styles.readingQualifier}>
                scale reading on {formatFullDate(latest.date)}, {formatTimeOfDay(latest.date)} ·
                difference from estimate {formatSignedWeightUnit(latest.differenceKg, unit)}
              </span>
            </div>
            {/* The extent sentence names a span the series has to actually have. */}
            {hasSpan ? <p className={styles.gapNote}>{summaryLine(analysis)}</p> : null}
          </div>
        )}

        {goal}
      </div>
    </section>
  );
}
