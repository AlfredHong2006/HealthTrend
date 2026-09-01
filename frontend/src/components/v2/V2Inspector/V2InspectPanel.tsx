"use client";

import { useEffect, useRef } from "react";
import { EvidenceDetail, StatisticsDetail, WhyDetail } from "./V2InspectorDetails";
import type { DisplayUnit } from "@/lib/v2/units";
import type { AnalysisResponse } from "@/lib/api/types";
import styles from "./V2Inspector.module.css";

const TIERS = [
  {
    id: "why",
    label: "Why",
    title: "Why this estimate?",
    lede: "The observations behind this estimate, the assumption they are read against, and where the trend is heading.",
  },
  {
    id: "evidence",
    label: "Evidence",
    title: "Evidence",
    lede: "What the window actually contains: readings used, days missing, and how each measurement sits against the estimated level.",
  },
  {
    id: "statistics",
    label: "Statistics",
    title: "Values and their intervals",
    lede: "The quantities the filter produces, each with the interval it carries.",
  },
] as const;

export type InspectTier = (typeof TIERS)[number]["id"];

interface V2InspectPanelProps {
  analysis: AnalysisResponse;
  unit: DisplayUnit;
  tab: InspectTier;
  onTabChange: (tab: InspectTier) => void;
  onClose: () => void;
}

/**
 * The deep tier itself: one of Why / Evidence / Statistics, below the whole analysis stack on
 * the same centred column -- never folded into the summary above it
 * (docs/design/09_1B_Implementation_Spec §6).
 *
 * Only one tier occupies the panel at a time; the switcher moves between them directly; reaching
 * Statistics never means passing through Why and Evidence on the way.
 */
export function V2InspectPanel({ analysis, unit, tab, onTabChange, onClose }: V2InspectPanelProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const tier = TIERS.find((entry) => entry.id === tab) ?? TIERS[0];

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [tab]);

  return (
    <div className={styles.panel} role="region" aria-label="Analysis detail">
      <div className={styles.panelHead}>
        <div className={styles.panelHeading}>
          <span className={styles.eyebrow}>Inspect analysis</span>
          <h2 ref={titleRef} tabIndex={-1} className={styles.panelTitle}>
            {tier.title}
          </h2>
          <p className={styles.panelLede}>{tier.lede}</p>
        </div>

        <div className={styles.panelControls}>
          <nav aria-label="Analysis detail" className={styles.switcher}>
            {TIERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-current={entry.id === tab ? "page" : undefined}
                className={entry.id === tab ? `${styles.switch} ${styles.switchOn}` : styles.switch}
                onClick={() => onTabChange(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <button type="button" className={styles.close} onClick={onClose}>
            <span aria-hidden="true">×</span>
            <span>Close</span>
          </button>
        </div>
      </div>

      <div className={styles.panelBody}>
        {tab === "why" ? <WhyDetail analysis={analysis} unit={unit} /> : null}
        {tab === "evidence" ? <EvidenceDetail analysis={analysis} unit={unit} /> : null}
        {tab === "statistics" ? <StatisticsDetail analysis={analysis} unit={unit} /> : null}
      </div>
    </div>
  );
}
