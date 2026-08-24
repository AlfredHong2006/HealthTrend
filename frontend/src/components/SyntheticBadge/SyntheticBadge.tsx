import type { DemoAnalysis, DemoScenario } from "@/lib/api/types";
import styles from "./SyntheticBadge.module.css";

interface SyntheticBadgeProps {
  meta: DemoAnalysis["meta"];
  scenario: Pick<DemoScenario, "title" | "label">;
}

/**
 * Unmistakable provenance: this is generated data, never a real measurement.
 *
 * `meta.source` is the honest claim the backend can make ("this API generated it"), and the
 * visible text tracks it rather than being a hardcoded string that could drift from the
 * underlying value (docs/privacy.md: only explicitly synthetic data is shown). The scenario's
 * human-readable `title` is what a reader needs; its machine provenance `label` (which names
 * the generator seed) is kept as hover text so it is still on the page without doubling up
 * the word "synthetic" in the headline chip.
 */
export function SyntheticBadge({ meta, scenario }: SyntheticBadgeProps) {
  const isDemo = meta.source === "demo";
  return (
    <p className={styles.badge} title={isDemo ? scenario.label : undefined}>
      <span className={styles.dot} aria-hidden="true" />
      {isDemo ? `Synthetic demo data · ${scenario.title}` : `Source: ${meta.source}`}
    </p>
  );
}
