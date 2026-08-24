import Link from "next/link";
import { notFound } from "next/navigation";
import { ForecastCallout } from "@/components/ForecastCallout/ForecastCallout";
import { Headline } from "@/components/Headline/Headline";
import { RateReadout } from "@/components/RateReadout/RateReadout";
import { ScenarioNav } from "@/components/ScenarioNav/ScenarioNav";
import { SyntheticBadge } from "@/components/SyntheticBadge/SyntheticBadge";
import { TrendChart } from "@/components/TrendChart/TrendChart";
import { fetchDemoAnalysis, fetchDemoCatalogue } from "@/lib/api/client";
import { NotFoundError } from "@/lib/api/errors";
import { HEADLINE_FORECAST_HORIZON_DAYS, horizonPoint } from "@/lib/analysis";
import { buildChartSeries } from "@/lib/chart/series";
import styles from "./page.module.css";

// Demo series are generated relative to the current instant (ADR-0007): the same URL
// legitimately returns different data on every request, so this route is never static.
export const dynamic = "force-dynamic";

interface DemoScenarioPageProps {
  params: Promise<{ scenario: string }>;
}

export default async function DemoScenarioPage({ params }: DemoScenarioPageProps) {
  const { scenario } = await params;

  const [analysis, catalogue] = await Promise.all([
    fetchDemoAnalysis(scenario).catch((error: unknown) => {
      if (error instanceof NotFoundError) {
        notFound();
      }
      throw error; // anything else is handled by the nearest error.tsx
    }),
    fetchDemoCatalogue(),
  ]);

  const series = buildChartSeries(analysis);
  const headlineForecast = horizonPoint(analysis.forecast, HEADLINE_FORECAST_HORIZON_DAYS);

  return (
    <main id="main-content" className={styles.page}>
      <ScenarioNav scenarios={catalogue.scenarios} activeId={scenario} />

      <header className={styles.header}>
        <h1 className={styles.title}>HealthTrend</h1>
        <SyntheticBadge meta={analysis.meta} scenario={analysis.scenario} />
        <Link href="/analyse" className={styles.enterDataLink}>
          Enter your own data →
        </Link>
      </header>

      <section aria-label="Current estimate" className={styles.stats}>
        <Headline current={analysis.current} />
        <RateReadout current={analysis.current} />
      </section>

      <TrendChart
        series={series}
        summary={{
          currentWeightKg: analysis.current.w_kg,
          forecastHorizonDays: HEADLINE_FORECAST_HORIZON_DAYS,
          forecastWeightKg: headlineForecast.w_kg,
          forecastLowerKg: headlineForecast.w_lower95,
          forecastUpperKg: headlineForecast.w_upper95,
        }}
      />

      <section aria-label="Forecast">
        <ForecastCallout forecast={analysis.forecast} />
      </section>
    </main>
  );
}
