import Link from "next/link";
import { AnalysisWorkspace } from "@/components/AnalysisWorkspace/AnalysisWorkspace";
import styles from "./page.module.css";

/**
 * The manual-entry page: static structure and the privacy notice live here, in a server
 * component; everything that needs `useState` -- the form, the direct browser call to
 * FastAPI, and the rendered result -- lives in `AnalysisWorkspace` (docs/privacy.md).
 */
export default function AnalysePage() {
  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>HealthTrend</h1>
        <p className={styles.privacyNotice}>
          Your measurements are sent to the HealthTrend analysis service for this analysis and
          are not stored. They are not saved anywhere in this browser either, so nothing is here
          if you reload or come back later. Importing a CSV file works the same way: the file is
          read once, to produce measurements for this analysis, and is not kept afterwards.
        </p>
        <Link href="/demo/gradual-loss" className={styles.demoLink}>
          Try the synthetic demo instead →
        </Link>
      </header>
      <AnalysisWorkspace />
    </main>
  );
}
