import Link from "next/link";
import { fetchDemoCatalogue } from "@/lib/api/client";
import styles from "./not-found.module.css";

/**
 * Rendered when `page.tsx` calls `notFound()` for a scenario id the backend does not
 * recognise. Links to the real five, fetched fresh rather than hardcoded, so this page
 * cannot list a scenario the backend has since renamed or removed.
 */
export default async function DemoScenarioNotFound() {
  const scenarios = await fetchDemoCatalogue().then(
    (catalogue) => catalogue.scenarios,
    () => [], // the backend being unreachable here is not this page's job to explain
  );

  return (
    <main className={styles.page}>
      <h1>No such demo scenario</h1>
      <p>That scenario does not exist. Try one of these instead:</p>
      {scenarios.length > 0 ? (
        <ul className={styles.list}>
          {scenarios.map((scenario) => (
            <li key={scenario.id}>
              <Link href={`/demo/${scenario.id}`}>{scenario.title}</Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
