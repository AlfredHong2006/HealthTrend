import { V2AnalyseWorkspace } from "@/components/v2/V2AnalyseWorkspace/V2AnalyseWorkspace";
import styles from "./page.module.css";

// A static segment wins over the sibling `[scenario]` route, so `/v2/analyse` is this page and
// never a scenario lookup (the same reasoning `/v2/method` already documents). No scenario is
// named "analyse", and none may be.
export const dynamic = "force-dynamic";

/**
 * The real-user entry point: enter or import your own measurements and see them analysed
 * through the same 1B Editorial presentation a synthetic scenario uses.
 *
 * Everything that needs `useState` -- entry mode, the direct browser call to FastAPI, and the
 * rendered result -- lives in `V2AnalyseWorkspace`, a client component; this route stays a
 * server component with no logic of its own (docs/privacy.md, matching `src/app/analyse/page.tsx`).
 */
export default function V2AnalysePage() {
  return (
    <main id="main-content" className={styles.page}>
      <V2AnalyseWorkspace />
    </main>
  );
}
