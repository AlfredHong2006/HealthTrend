import { notFound } from "next/navigation";
import { V2Header } from "@/components/v2/V2Header/V2Header";
import { V2Workspace } from "@/components/v2/V2Workspace/V2Workspace";
import { fetchDemoAnalysis, fetchDemoCatalogue } from "@/lib/api/client";
import { NotFoundError } from "@/lib/api/errors";
import styles from "./page.module.css";

// Demo series are generated relative to the current instant (ADR-0007): the same URL
// legitimately returns different data on every request, so this route is never static.
export const dynamic = "force-dynamic";

interface V2ScenarioPageProps {
  params: Promise<{ scenario: string }>;
}

/**
 * The V2 prototype route: the approved Annotated Canvas direction, drawn from the current API
 * and nothing else.
 *
 * The same data path as `/demo/[scenario]` -- one server-side fetch of a generated scenario,
 * no browser call, no persistence -- rendered through a V2-only shell. `/demo/[scenario]` and
 * `/analyse` are untouched; this route replaces neither (docs/design/V2_DESIGN.md, locked
 * decisions).
 */
export default async function V2ScenarioPage({ params }: V2ScenarioPageProps) {
  const { scenario } = await params;

  const [analysis, catalogue] = await Promise.all([
    fetchDemoAnalysis(scenario).catch((error: unknown) => {
      if (error instanceof NotFoundError) {
        notFound();
      }
      throw error;
    }),
    fetchDemoCatalogue(),
  ]);

  return (
    <main id="main-content" className={styles.page}>
      <V2Header
        current="analysis"
        scenarios={catalogue.scenarios}
        activeId={scenario}
        meta={analysis.meta}
        scenario={analysis.scenario}
      />
      <V2Workspace analysis={analysis} />
    </main>
  );
}
