import type { DemoAnalysis } from "@/lib/api/types";
import styles from "./SyntheticBadge.module.css";

interface SyntheticBadgeProps {
  meta: DemoAnalysis["meta"];
  label: string;
}

/**
 * Unmistakable provenance: this is generated data, never a real measurement.
 *
 * `meta.source` is the honest claim the backend can make ("this API generated it"); the
 * scenario's own `label` is the human-readable form, and both are always rendered together
 * so the text on screen matches the underlying value rather than being a hardcoded string
 * that could drift from it (docs/privacy.md: only explicitly synthetic data is shown).
 */
export function SyntheticBadge({ meta, label }: SyntheticBadgeProps) {
  return (
    <p className={styles.badge}>
      <span className={styles.dot} aria-hidden="true" />
      Synthetic demo data ({meta.source === "demo" ? label : meta.source})
    </p>
  );
}
