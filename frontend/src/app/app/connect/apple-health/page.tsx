import { AppAuthGate } from "@/components/app/AppAuthGate/AppAuthGate";
import { AppleHealthConnect } from "@/components/app/AppleHealthConnect/AppleHealthConnect";

/**
 * `/app/connect/apple-health`: create a sync connection and set up the Apple Shortcut that uses
 * it, behind the same `AppAuthGate` every protected `/app` page sits behind.
 */
export default function AppConnectAppleHealthPage() {
  return (
    <AppAuthGate>
      <main id="main-content">
        <AppleHealthConnect />
      </main>
    </AppAuthGate>
  );
}
