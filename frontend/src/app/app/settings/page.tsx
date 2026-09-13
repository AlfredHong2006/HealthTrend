import { AppAuthGate } from "@/components/app/AppAuthGate/AppAuthGate";
import { Settings } from "@/components/app/Settings/Settings";

/** `/app/settings`: display unit, goal, exports, sign-out and account deletion. */
export default function AppSettingsPage() {
  return (
    <AppAuthGate>
      <main id="main-content">
        <Settings />
      </main>
    </AppAuthGate>
  );
}
