import { V2Header } from "@/components/v2/V2Header/V2Header";
import { V2About } from "@/components/v2/V2About/V2About";
import styles from "./page.module.css";

/**
 * About: what HealthTrend is, who built it, and why -- the V2 prototype's fourth destination.
 *
 * A static segment wins over the sibling `[scenario]` route, so `/v2/about` is this page and
 * never a scenario lookup. No scenario is named "about", and none may be.
 *
 * Unlike its three siblings this route fetches nothing and reads no clock, so it is not marked
 * `force-dynamic`: it is prerendered, which is the honest description of a page whose content
 * does not depend on a request.
 */
export default function V2AboutPage() {
  return (
    <main id="main-content" className={styles.page}>
      <V2Header current="about" />
      <V2About />
    </main>
  );
}
