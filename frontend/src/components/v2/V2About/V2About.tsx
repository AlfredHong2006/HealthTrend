import Link from "next/link";
import styles from "./V2About.module.css";

/**
 * About: what HealthTrend is, who built it, and why.
 *
 * Deliberately short. It is a recruiter's first stop, not a second Method page -- the model is
 * documented at length there, and repeating any of it here would only make both pages worse.
 * Everything on this page is a plain statement about the project; nothing is derived from an
 * analysis, so this component takes no props and fetches nothing.
 *
 * The "Why I built it" and "What building it involved" copy is Alfred's own account, supplied
 * verbatim. Edit it only on his say-so: it is a first-person statement about why the project
 * exists, not product prose to be tightened or paraphrased. It also sets the page's punctuation
 * convention, which is plain sentences and no em dashes.
 *
 * The claims stay inside the honesty ledger the rest of the product observes
 * (CLAUDE.md, "Claim only what is implemented and measured"): it describes what HealthTrend
 * estimates and publishes, and makes no claim about accuracy, health or outcomes.
 */
export function V2About() {
  return (
    <article className={styles.about}>
      <header className={styles.masthead}>
        <p className={styles.eyebrow}>About</p>
        <h2 className={styles.title}>HealthTrend</h2>
        <p className={styles.standfirst}>
          HealthTrend estimates an underlying weight trend from noisy scale readings and presents
          the current estimate, rate of change, uncertainty, and forecast.
        </p>
        <div className={styles.metaRow}>
          <MetaItem label="Built by" value="Alfred Hong" />
          <MetaItem label="Kind" value="Personal project" />
          <MetaItem label="Model" value="Local linear trend, Kalman filter" />
        </div>
      </header>

      <Section title="Why I built it">
        <p>
          HealthTrend started from a problem I kept running into while cutting. I could weigh
          myself every day and still have no idea what my weight was actually doing. A single
          reading could jump up or down because of food, water, timing, or normal day-to-day
          noise, while what I actually cared about was whether my underlying weight was trending
          down and how quickly.
        </p>
        <p>
          I wanted something more useful than a basic weight log or a moving average. I wanted to
          separate the signal from the noise, quantify how certain that estimate was, and make the
          result easy to understand rather than hiding everything behind a single smoothed number.
        </p>
        <p>
          So I built HealthTrend. It estimates the underlying weight trajectory from noisy and
          irregular measurements, then presents the current estimate, rate of change, uncertainty,
          and forecast in a form that I would actually want to use myself.
        </p>
      </Section>

      <Section title="What building it involved">
        <p>
          Building it also became a way for me to bring together statistical modelling, software
          engineering, product design, and rigorous evaluation. An important part of the project
          was testing where the model does and does not work, rather than assuming that a more
          sophisticated model must automatically be better.
        </p>
        <p className={styles.note}>
          The estimator, its assumptions and its limitations are set out in full on{" "}
          <Link href="/v2/method" className={styles.link}>
            Method
          </Link>
          , down to the equations and the code that implements them.
        </p>
      </Section>

      <Section title="Your data">
        <p>
          Measurements you enter are sent to the analysis service to produce the analysis on
          screen, and are not stored. Nothing is saved in your browser either, so a reload starts
          from an empty page. Every series in the demo scenarios is synthetic and labelled as
          such.
        </p>
      </Section>

      <footer className={styles.footer}>
        <Link href="/v2" className={styles.footerLink}>
          See an analysis
        </Link>
        <Link href="/v2/analyse" className={styles.footerLink}>
          Analyse your own data
        </Link>
        <Link href="/v2/method" className={styles.footerLink}>
          How it works
        </Link>
      </footer>
    </article>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}
