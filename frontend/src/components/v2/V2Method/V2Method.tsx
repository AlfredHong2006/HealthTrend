import { V2MathAppendix } from "./V2MathAppendix";
import { formatNumber } from "@/lib/v2/format";
import type { components } from "@/lib/api/schema.d.ts";
import styles from "./V2Method.module.css";

type ModelParams = components["schemas"]["ModelParamsOut"];

const SECTIONS = [
  { id: "estimates", title: "What HealthTrend estimates" },
  { id: "reading", title: "How a reading changes the estimate" },
  { id: "uncertainty", title: "What the uncertainty means" },
  { id: "forecasting", title: "How forecasting works" },
  { id: "parameters", title: "Model parameters" },
  { id: "assumptions", title: "Assumptions and limitations" },
  { id: "appendix", title: "Mathematical appendix" },
] as const;

/**
 * Method: how HealthTrend calculates an estimate.
 *
 * This is the page that used to be a tier inside the analysis rail, and moving it out is the
 * point. None of it is specific to one series -- how a reading moves the estimate, what an
 * interval describes, why a band widens -- so carrying it on the everyday analysis screen made
 * that screen a documentation page and left the rail saying almost nothing about the data in
 * front of the reader (docs/design/V2_DESIGN.md).
 *
 * The order is a ramp, not a specification dump: plain language first, then the parameters and
 * the assumptions they rest on, then the full mathematics as an appendix. A reader who wants
 * only the first paragraph should be able to stop there and have learned something true.
 */
export function V2Method({ params }: { params: ModelParams | null }) {
  return (
    <article className={styles.method}>
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>Method</p>
        <h2 className={styles.title}>How HealthTrend calculates an estimate</h2>
        <p className={styles.standfirst}>
          HealthTrend is an estimation product, not a weight logger. This page describes the
          model behind every number the analysis screen shows, from the idea to the equations,
          and names the code that implements each one.
        </p>
      </header>

      <nav aria-label="On this page" className={styles.contents}>
        <ol className={styles.contentsList}>
          {SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={styles.contentsLink}>
                <span className={styles.contentsIndex}>{index + 1}</span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="estimates" index={1} title="What HealthTrend estimates">
        <p>
          A bathroom scale does not measure the thing you want to know. Body weight moves by a
          kilogram or more within a single day for reasons that have nothing to do with a trend
          — fluid, food, time of day — so any one reading is the underlying weight plus an
          unknown amount of noise.
        </p>
        <p>
          HealthTrend estimates the quantity underneath: a latent weight, and the rate at which
          that weight is changing, in kilograms per week. Both are estimates with a stated
          uncertainty rather than measurements, and the rate is usually the more useful of the
          two — it answers &ldquo;am I progressing&rdquo; more directly than any single weight
          value does.
        </p>
        <p>
          The estimator has no parameter through which a goal could reach it. A target weight is
          interpreted above the model, never inside it, so the same series produces the same
          estimate whatever anyone is aiming for.
        </p>
      </Section>

      <Section id="reading" index={2} title="How a reading changes the estimate">
        <p>
          Each new reading is evidence, not a replacement. The estimate moves part of the way
          towards it, and how far depends on two things the model tracks: how uncertain the
          current estimate already is, and how noisy a single reading is assumed to be. A
          well-determined estimate barely moves for one surprising reading; an uncertain one
          moves a long way.
        </p>
        <p>
          Time enters as real elapsed time, not as a count of readings. Two weigh-ins a day
          apart and two a month apart are treated differently, and a gap of thirty days is
          handled exactly as thirty one-day steps would be — the same distribution, not an
          approximation. Weighing yourself irregularly costs precision; it does not break the
          model.
        </p>
        <p>
          The trajectory is <em>filtered</em>, not smoothed. Every point on the line reflects
          only the data available at that instant, so nothing earlier is rewritten when a new
          reading arrives: it is the estimate you would have had on the day. A retrospective
          view, which revises the past in light of what came after, is a different calculation
          and is not what the chart shows.
        </p>
      </Section>

      <Section id="uncertainty" index={3} title="What the uncertainty means">
        <p>
          The band around the line is a 95% interval on the <em>underlying</em> weight — not on
          what a scale would read tomorrow morning. An interval for a future scale reading would
          be wider, by the measurement noise, and answers a different question.
        </p>
        <p>
          It is the model&rsquo;s own spread, computed from the assumptions below. It is exact
          only if those assumptions and those parameters are right; it does not include
          uncertainty about the parameters themselves, and its coverage has never been measured
          against real recorded data.
        </p>
        <p>
          HealthTrend states the interval and stops there. It does not turn a spread into a
          label such as &ldquo;high confidence&rdquo; or &ldquo;low confidence&rdquo;, because
          that would be a judgement the numbers do not make and a threshold nobody has defined.
        </p>
      </Section>

      <Section id="forecasting" index={4} title="How forecasting works">
        <p>
          A forecast is the current state carried forward: the estimated weight moves at the
          estimated rate. Nothing is added to it, and no other information is used.
        </p>
        <p>
          The interval grows with distance for two separate reasons. The rate is itself only an
          estimate, and its error compounds over a longer lever arm; and the rate is allowed to
          drift over the period rather than being held fixed. Together those make a distant
          forecast honestly vague rather than wrong with a narrow interval.
        </p>
        <p>
          Horizons are fixed at 7, 30 and 90 days and are measured from a forecast origin. If
          the last weigh-in was some days ago, those days are real elapsed time in which the
          trend both moved and became less certain, so they are carried through as well.
        </p>
        <p>
          The model has no notion of a floor, a ceiling or a return to any usual weight, so it
          is only locally valid: simulated far enough forward it produces weights no body could
          have. That is a true property of this class of model, and it is why the product
          forecasts 90 days rather than years.
        </p>
      </Section>

      <Section id="parameters" index={5} title="Model parameters">
        <p>
          These are documented priors, not values fitted to anybody&rsquo;s data. They are
          plausible, they are stated in product units and converted, and they determine how hard
          the estimate smooths — which makes them the single biggest influence on what the
          analysis screen shows.
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Parameter</th>
                {params === null ? null : <th scope="col">Value</th>}
                <th scope="col">What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Measurement noise</th>
                {params === null ? null : (
                  <td className={styles.numeric}>
                    {formatNumber(params.sigma_obs_kg, 2)} kg
                  </td>
                )}
                <td>
                  How far a single scale reading is assumed to sit from the underlying weight,
                  as one standard deviation.
                </td>
              </tr>
              <tr>
                <th scope="row">Weekly-rate drift</th>
                {params === null ? null : (
                  <td className={styles.numeric}>
                    {formatNumber(params.weekly_rate_drift_kg_per_week, 2)} kg/week per week
                  </td>
                )}
                <td>
                  How much the weekly rate is allowed to change from one week to the next. Raise
                  it and the estimate follows recent readings more closely; lower it and the
                  estimate is steadier and slower to turn.
                </td>
              </tr>
              <tr>
                <th scope="row">Initial rate spread</th>
                {params === null ? null : (
                  <td className={styles.numeric}>
                    {formatNumber(params.initial_weekly_rate_spread_kg_per_week, 2)} kg/week
                  </td>
                )}
                <td>
                  How uncertain the rate is before any trend has been seen. With a single
                  reading the model reports a weight and declines to invent a trend at all.
                </td>
              </tr>
              <tr>
                <th scope="row">Process-noise intensity</th>
                {params === null ? null : (
                  <td className={styles.numeric}>{formatNumber(params.sigma_accel, 6)}</td>
                )}
                <td>
                  The weekly-rate drift expressed in the model&rsquo;s own units. Derived, not
                  chosen separately — see the appendix.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {params === null ? (
          <p className={styles.note}>
            The values are read from the analysis service, which could not be reached just now.
          </p>
        ) : (
          <p className={styles.note}>
            These values are read from the analysis service rather than copied into this page,
            so they cannot drift apart from the ones an analysis actually used.
          </p>
        )}
      </Section>

      <Section id="assumptions" index={6} title="Assumptions and limitations">
        <p>
          These are stated because they are load-bearing. None of them has been validated
          against real recorded data.
        </p>
        <ul className={styles.list}>
          <li>
            The parameters above are priors, not fitted values. They are plausible and
            documented, and they determine how hard the product smooths.
          </li>
          <li>
            Intervals are exact only for fixed parameters. Coverage on real data is unmeasured.
          </li>
          <li>
            There is no robustness to mistyped or freak readings, by design. The filter is
            linear, so one bad reading displaces the estimate in proportion to the gain, and the
            displacement decays as a damped oscillation rather than steadily.
          </li>
          <li>
            The model has no mean reversion, so it is only locally valid — the reason horizons
            stop at 90 days.
          </li>
          <li>
            Weigh-ins taken minutes apart are treated as independent, which shrinks the interval
            slightly more than reality warrants.
          </li>
          <li>
            A local linear trend cannot represent a flattening or a turn as structure; it tracks
            them by drifting velocity, which lags.
          </li>
          <li>
            The trajectory is filtered, not smoothed: each point reflects only the data
            available at that instant.
          </li>
          <li>
            Calibration has been demonstrated only on data drawn from the model itself, which
            validates the implementation rather than the choice of model.
          </li>
        </ul>
      </Section>

      <Section id="appendix" index={7} title="Mathematical appendix">
        <p className={styles.appendixIntro}>
          The complete specification of the estimator, unsimplified. Everything above is a
          description of what follows.
        </p>
        <V2MathAppendix params={params} />
      </Section>
    </article>
  );
}

function Section({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`} className={styles.sectionTitle}>
        <span className={styles.sectionIndex}>{index}</span>
        {title}
      </h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}
