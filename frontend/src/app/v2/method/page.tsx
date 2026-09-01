import { V2Header } from "@/components/v2/V2Header/V2Header";
import { V2Method } from "@/components/v2/V2Method/V2Method";
import { fetchDemoAnalysis } from "@/lib/api/client";
import styles from "./page.module.css";

// A static segment wins over the sibling `[scenario]` route, so `/v2/method` is this page and
// never a scenario lookup. No scenario is named "method", and none may be.
export const dynamic = "force-dynamic";

/**
 * The scenario the model parameters are read from.
 *
 * The parameters are the same documented priors for every series, but reading them from a real
 * response rather than hardcoding them in the frontend is what stops this page and the service
 * drifting apart. Any scenario would do; this is the one `/v2` opens on.
 */
const PARAMETER_SOURCE_SCENARIO = "gradual-loss";

/**
 * How HealthTrend calculates an estimate: the V2 prototype's second destination.
 *
 * A separate route rather than a tier of the analysis. None of this content is specific to one
 * series, so it belongs to the product rather than to an analysis -- and as its own page it
 * gets the width the equations need, and browser Back works the way a reader expects
 * (docs/design/V2_DESIGN.md).
 *
 * The fetch degrades rather than failing the page: the parameter *values* are worth showing and
 * worth being true, but the explanation stands without them.
 */
export default async function V2MethodPage() {
  const analysis = await fetchDemoAnalysis(PARAMETER_SOURCE_SCENARIO).catch(() => null);

  return (
    <main id="main-content" className={styles.page}>
      <V2Header current="method" />
      <V2Method analysis={analysis} />
    </main>
  );
}
