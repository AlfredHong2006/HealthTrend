import Link from "next/link";
import type { DemoAnalysis, DemoScenario } from "@/lib/api/types";
import styles from "./V2Header.module.css";

interface V2HeaderProps {
  /** Which of the two V2 destinations is on screen. */
  current: "analysis" | "method";
  /** The scenario switcher, on an analysis page only. */
  scenarios?: DemoScenario[];
  activeId?: string;
  meta?: DemoAnalysis["meta"];
  scenario?: DemoScenario;
}

/**
 * A hairline masthead: what this is, which generated series is on screen, and the two places
 * the prototype can go -- the analysis, and the method behind it.
 *
 * Deliberately not V1's `ScenarioNav` and `SyntheticBadge`: those link to `/demo/[scenario]`
 * and are styled from V1's tokens, and reusing them would pull V1's shell into a route that
 * exists to try a different one.
 *
 * The provenance line tracks `meta.source` rather than hardcoding the word "synthetic", the
 * same way V1's badge does: the visible claim and the value it comes from cannot drift apart.
 */
export function V2Header({ current, scenarios, activeId, meta, scenario }: V2HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <h1 className={styles.wordmark}>
          HealthTrend
          <span className={styles.stage}>V2 prototype</span>
        </h1>
        {meta && scenario ? (
          <p className={styles.provenance} title={meta.source === "demo" ? scenario.label : undefined}>
            {meta.source === "demo"
              ? `Synthetic demo data · ${scenario.title}`
              : `Source: ${meta.source}`}
          </p>
        ) : null}
      </div>

      <nav aria-label="HealthTrend" className={styles.nav}>
        <ul className={styles.navList}>
          {scenarios?.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/v2/${entry.id}`}
                aria-current={entry.id === activeId ? "page" : undefined}
                className={
                  entry.id === activeId ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {entry.title}
              </Link>
            </li>
          ))}

          {current === "method" ? (
            <li>
              <Link href="/v2" className={styles.navLink}>
                Analysis
              </Link>
            </li>
          ) : null}

          <li className={styles.navDivider}>
            <Link
              href="/v2/method"
              aria-current={current === "method" ? "page" : undefined}
              className={
                current === "method" ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              Method
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
