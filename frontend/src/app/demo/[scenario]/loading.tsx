import styles from "./loading.module.css";

/**
 * Shown automatically by Next while the async server component in `page.tsx` awaits its
 * fetch. Deliberately layout-stable -- placeholder blocks at the same size as the real
 * content -- so nothing shifts when the real numbers arrive.
 *
 * No scenario names are guessed here: the catalogue has not been fetched yet, so the nav
 * skeleton is unlabelled shapes, not a hardcoded duplicate of the backend's scenario list.
 */
export default function DemoScenarioLoading() {
  return (
    <main aria-busy="true" className={styles.page}>
      <div className={styles.navSkeleton} aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className={styles.navPill} />
        ))}
      </div>
      <p className="visuallyHidden">Loading the analysis&hellip;</p>
      <div className={styles.block} style={{ width: "40%", height: "3rem" }} aria-hidden="true" />
      <div className={styles.block} style={{ width: "25%", height: "1.5rem" }} aria-hidden="true" />
      <div className={styles.chartBlock} aria-hidden="true" />
      <div className={styles.block} style={{ width: "35%", height: "1.5rem" }} aria-hidden="true" />
    </main>
  );
}
