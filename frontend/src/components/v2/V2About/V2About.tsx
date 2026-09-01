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
          I wanted a calmer and more analytical alternative to basic weight loggers — something
          that focuses on the underlying trajectory rather than noisy day-to-day fluctuations, and
          that explains the reasoning behind the estimate rather than only showing raw numbers.
        </p>
        <p>
          A bathroom scale does not measure the thing you actually want to know. Weight moves by a
          kilogram or more within a single day for reasons that have nothing to do with a trend,
          so a logger that plots readings faithfully still leaves you to guess at the signal.
          HealthTrend estimates that signal, states how uncertain it is, and shows its working.
        </p>
      </Section>

      <Section title="What this version demonstrates">
        <p>
          This version is built to show product thinking, statistical communication and frontend
          implementation together: deciding what a number is allowed to claim, presenting an
          estimate and its uncertainty without overstating either, and building the interface that
          carries them.
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
