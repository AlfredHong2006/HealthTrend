import { AppAuthGate } from "@/components/app/AppAuthGate/AppAuthGate";
import { MeasurementList } from "@/components/app/MeasurementList/MeasurementList";

/**
 * `/app/measurements`: the authoritative stored history, with edit and delete -- Stage 5's
 * second new route, behind the same `AppAuthGate` every protected `/app` page sits behind.
 */
export default function AppMeasurementsPage() {
  return (
    <AppAuthGate>
      <main id="main-content">
        <MeasurementList />
      </main>
    </AppAuthGate>
  );
}
