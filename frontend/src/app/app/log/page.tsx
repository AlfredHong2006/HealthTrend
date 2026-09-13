import { AppAuthGate } from "@/components/app/AppAuthGate/AppAuthGate";
import { QuickLog } from "@/components/app/QuickLog/QuickLog";

/**
 * `/app/log`: Stage 5's quick weigh-in entry, behind the same `AppAuthGate` every protected
 * `/app` page sits behind.
 */
export default function AppLogPage() {
  return (
    <AppAuthGate>
      <main id="main-content">
        <QuickLog />
      </main>
    </AppAuthGate>
  );
}
