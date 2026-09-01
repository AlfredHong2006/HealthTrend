import Link from "next/link";
import type { DisplayUnit } from "@/lib/v2/units";
import type { AnalysisResponse, DemoScenario } from "@/lib/api/types";
import styles from "./V2Header.module.css";

interface V2HeaderProps {
  /** Which real V2 destination is on screen (docs/design/IMPLEMENTATION_NOTES.md, "5. First-deployment navigation": ship only destinations that exist -- these four do). */
  current: "analysis" | "analyse" | "method" | "about";
  /** The synthetic-scenario list, on a demo analysis page only -- absent on every other destination. */
  scenarios?: DemoScenario[];
  activeId?: string;
  meta?: AnalysisResponse["meta"];
  scenario?: DemoScenario;
  /** The display-unit toggle, wherever an analysis is on screen -- absent before one exists. */
  unit?: DisplayUnit;
  onUnitChange?: (unit: DisplayUnit) => void;
}

const PRIMARY_NAV = [
  { id: "analysis", label: "Analysis", href: "/v2" },
  { id: "analyse", label: "Analyse your data", href: "/v2/analyse" },
  { id: "method", label: "Method", href: "/v2/method" },
  { id: "about", label: "About", href: "/v2/about" },
] as const;

/**
 * A hairline masthead in the 1B Editorial serif register: the wordmark, the product's four
 * real destinations, and -- on a demo analysis page only -- a quiet secondary selector for
 * which synthetic scenario is on screen.
 *
 * The frozen design (docs/design/09_1B_Implementation_Spec/Analysis Screen.dc.html) draws a
 * single "Analysis" nav label because its mock has exactly one series; this product has both a
 * demo analysis and a real-data one, so the primary nav names both destinations plainly rather
 * than making the demo scenario list read as primary navigation. "Measurements" and "Settings"
 * are dead labels in the export and are not reproduced here: ship only real destinations
 * (docs/design/IMPLEMENTATION_NOTES.md, §5).
 *
 * The scenario switcher moves into a `<details>` disclosure tied to the existing provenance
 * badge -- a native, JS-free control rather than a second interactive surface, so it stays
 * quiet and secondary the way a demo control should, while switching scenarios remains one
 * click away.
 */
export function V2Header({
  current,
  scenarios,
  activeId,
  meta,
  scenario,
  unit,
  onUnitChange,
}: V2HeaderProps) {
  return (
    <header className={styles.header}>
      <span className={styles.wordmark}>HealthTrend</span>

      <nav aria-label="HealthTrend" className={styles.nav}>
        <ul className={styles.navList}>
          {PRIMARY_NAV.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={item.id === current ? "page" : undefined}
                className={
                  item.id === current ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.trailing}>
        {unit && onUnitChange ? (
          <div className={styles.unitToggle} role="group" aria-label="Display unit">
            {(["kg", "lb"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={option === unit}
                className={
                  option === unit ? `${styles.unitOption} ${styles.unitOptionOn}` : styles.unitOption
                }
                onClick={() => onUnitChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}

        {scenarios && scenarios.length > 0 && scenario ? (
          <details className={styles.scenarioMenu}>
            <summary className={styles.badge}>Synthetic · {scenario.title}</summary>
            <ul className={styles.scenarioList}>
              {scenarios.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/v2/${entry.id}`}
                    aria-current={entry.id === activeId ? "page" : undefined}
                    className={
                      entry.id === activeId
                        ? `${styles.scenarioLink} ${styles.scenarioLinkActive}`
                        : styles.scenarioLink
                    }
                  >
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : meta && meta.source === "submitted" ? (
          <span className={styles.badge}>Your data · not saved</span>
        ) : null}
      </div>
    </header>
  );
}
