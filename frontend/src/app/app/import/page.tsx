import { AppAuthGate } from "@/components/app/AppAuthGate/AppAuthGate";
import { AccountImport } from "@/components/app/AccountImport/AccountImport";

/** `/app/import`: CSV import into the signed-in account's history, behind `AppAuthGate`. */
export default function AppImportPage() {
  return (
    <AppAuthGate>
      <main id="main-content">
        <AccountImport />
      </main>
    </AppAuthGate>
  );
}
