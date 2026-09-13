import { AppAuthGate } from "@/components/app/AppAuthGate/AppAuthGate";
import { AppDashboard } from "@/components/app/AppDashboard/AppDashboard";
import styles from "./page.module.css";

/**
 * `/app`: the persistent, returning-user dashboard -- Milestone 8 Stage 4's one protected
 * route. `AppAuthGate` owns every auth state (checking, unauthenticated, error, authenticated)
 * and renders the shell only once authenticated; `AppDashboard` owns the account-analysis
 * content inside it.
 */
export default function AppHomePage() {
  return (
    <AppAuthGate>
      <main id="main-content" className={styles.page}>
        <AppDashboard />
      </main>
    </AppAuthGate>
  );
}
