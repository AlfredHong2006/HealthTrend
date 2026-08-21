import Link from "next/link";
import type { DemoScenario } from "@/lib/api/types";
import styles from "./ScenarioNav.module.css";

interface ScenarioNavProps {
  scenarios: DemoScenario[];
  activeId: string;
}

/**
 * The scenario selector. Switching scenarios is navigation, not client state: each one is a
 * URL (`/demo/[scenario]`), so this is a plain list of links. That gives shareable URLs,
 * browser back/forward and a route-level loading skeleton for free, with no `useState` and
 * no client-side data fetching anywhere on the page.
 */
export function ScenarioNav({ scenarios, activeId }: ScenarioNavProps) {
  return (
    <nav aria-label="Demo scenario" className={styles.nav}>
      <ul className={styles.list}>
        {scenarios.map((scenario) => {
          const isActive = scenario.id === activeId;
          return (
            <li key={scenario.id}>
              <Link
                href={`/demo/${scenario.id}`}
                aria-current={isActive ? "page" : undefined}
                className={isActive ? `${styles.link} ${styles.active}` : styles.link}
              >
                {scenario.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
