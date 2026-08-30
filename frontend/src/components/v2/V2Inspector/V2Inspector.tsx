"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { EvidenceDetail, StatisticsDetail, WhyDetail } from "./V2InspectorDetails";
import type { DemoAnalysis } from "@/lib/api/types";
import styles from "./V2Inspector.module.css";

/** The analysis tiers, in the order the product definition puts them. */
const TIERS = [
  { id: "why", label: "Why", title: "Why this estimate?" },
  { id: "evidence", label: "Evidence", title: "Evidence" },
  { id: "statistics", label: "Statistics", title: "Statistics" },
] as const;

type TierId = (typeof TIERS)[number]["id"];
type View = "summary" | TierId;

/**
 * The inspection half of the analysis rail: a summary that offers to go deeper, and a detail
 * stack that shows exactly one tier at a time.
 *
 * ```
 * Summary -> Why -> Evidence -> Statistics
 * ```
 *
 * This replaces an accordion, deliberately. Four tiers that all expanded in place turned the
 * rail into one long document: the everyday screen carried the whole model explanation, and
 * reaching Statistics meant scrolling past everything above it. Here a tier *replaces* the
 * entry point rather than lengthening it, a back control returns, and a switcher moves between
 * tiers directly. The summary block above stays on screen throughout, so the detail always has
 * its context (docs/design/V2_DESIGN.md: a rail plus a detail stack).
 *
 * Generic model explanation is not here at all. How a Kalman filter absorbs a reading, what
 * the covariance does and why a band widens are the same on every series, so they belong to
 * the product, not to one analysis: they live on `/v2/method`.
 *
 * The same component serves both layouts. On a phone it sits after the chart, and pushing into
 * a tier replaces the affordance in place rather than growing an accordion below it.
 */
export function V2Inspector({ analysis }: { analysis: DemoAnalysis }) {
  const [view, setView] = useState<View>("summary");
  const enterRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);

  // Moving between views is a navigation, so it moves focus the way one does -- otherwise a
  // keyboard or screen-reader user pushes into a tier and is left where the button used to be.
  useEffect(() => {
    if (!navigated.current) {
      return;
    }
    const target = view === "summary" ? enterRef.current : titleRef.current;
    target?.focus({ preventScroll: true });
  }, [view]);

  function go(next: View) {
    navigated.current = true;
    setView(next);
  }

  if (view === "summary") {
    return (
      <div className={styles.inspector}>
        {/* The entry has to look like a way in, not like a sentence. It names the tiers it
            leads to, carries a chevron rather than the arrow the Method link uses -- one goes
            deeper into this analysis, the other leaves it for a page -- and has hover, press
            and focus states, since a phone gets no hover to discover it with. */}
        <button ref={enterRef} type="button" className={styles.enter} onClick={() => go("why")}>
          <span className={styles.enterText}>
            <span className={styles.enterTitle}>Inspect this analysis</span>{" "}
            {/* That space is load-bearing: without it the two lines concatenate into one word
                in the button's accessible name. A whitespace-only anonymous flex item is not
                rendered, so it changes nothing visually. */}
            <span className={styles.enterTiers}>
              {TIERS.map((tier) => tier.label).join(", ")}
            </span>
          </span>
          <span className={styles.chevron} aria-hidden="true" />
        </button>
        <Link href="/v2/method" className={styles.methodLink}>
          <span>How HealthTrend calculates this</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  const tier = TIERS.find((entry) => entry.id === view) ?? TIERS[0];

  return (
    <div className={styles.inspector}>
      <div className={styles.detail}>
        <button type="button" className={styles.back} onClick={() => go("summary")}>
          <span aria-hidden="true">←</span>
          <span>Analysis</span>
        </button>

        <nav aria-label="Analysis detail" className={styles.switcher}>
          {TIERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-current={entry.id === view ? "page" : undefined}
              className={
                entry.id === view ? `${styles.switch} ${styles.switchOn}` : styles.switch
              }
              onClick={() => go(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <h3 ref={titleRef} tabIndex={-1} className={styles.detailTitle}>
          {tier.title}
        </h3>

        <div className={styles.detailBody}>
          {view === "why" ? <WhyDetail analysis={analysis} /> : null}
          {view === "evidence" ? <EvidenceDetail analysis={analysis} /> : null}
          {view === "statistics" ? <StatisticsDetail analysis={analysis} /> : null}
        </div>
      </div>
    </div>
  );
}
