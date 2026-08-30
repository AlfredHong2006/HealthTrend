import type { ReactNode } from "react";
import { formatNumber } from "@/lib/v2/format";
import type { components } from "@/lib/api/schema.d.ts";
import styles from "./V2MathAppendix.module.css";

type ModelParams = components["schemas"]["ModelParamsOut"];

/**
 * The mathematical appendix: the technical reference at the deep end of Method.
 *
 * Every equation here is one the core actually implements, transcribed from
 * docs/mathematics.md together with that document's own equation-to-code index -- so a reader
 * who does not believe a number can follow it to the file and symbol that produced it. It is
 * deliberately the full thing, not a simplified version: the sections above make the model
 * understandable, and nothing there licenses weakening what is underneath.
 *
 * It is broken into seven labelled parts rather than run as one continuous wall, each equation
 * given its own ruled block and room to breathe, set in a serif at the width of the Method
 * page rather than the width of an analysis rail. That width is the point: an equation that
 * has to scroll sideways is a reference nobody checks.
 */
export function V2MathAppendix({ params }: { params: ModelParams | null }) {
  return (
    <div className={styles.appendix}>
      <h4 className={styles.part}>A1 · State and observation</h4>
      <p>
        The state carries the underlying weight <V>w</V> in kilograms and its velocity <V>v</V>{" "}
        in kg/day. A weigh-in observes the weight alone, with Gaussian measurement noise of
        variance <V>R</V>.
      </p>
      <Eq describe="The state vector x at time t is w over v; the observation y equals H times x plus noise epsilon, drawn from a normal distribution with mean zero and variance R.">
        <V>x</V>
        <Sub>t</Sub> <Op>=</Op>{" "}
        <Matrix
          columns={1}
          cells={[
            <>
              <V>w</V>
              <Sub>t</Sub>
            </>,
            <>
              <V>v</V>
              <Sub>t</Sub>
            </>,
          ]}
        />
        <Space />
        <V>y</V>
        <Sub>t</Sub> <Op>=</Op> <V>H</V>
        <V>x</V>
        <Sub>t</Sub> <Op>+</Op> <V>ε</V>
        <Sub>t</Sub>
        <Space />
        <V>ε</V>
        <Sub>t</Sub> <Op>∼</Op> <V>N</V>(0, <V>R</V>)
      </Eq>
      <Eq describe="H is the row vector one, zero. R is sigma-obs squared.">
        <V>H</V> <Op>=</Op> <Matrix columns={2} cells={[<>1</>, <>0</>]} />
        <Space />
        <V>R</V> <Op>=</Op> <V>σ</V>
        <Sub>obs</Sub>
        <Sup>2</Sup>
      </Eq>

      <h4 className={styles.part}>A2 · Transition and process noise</h4>
      <p>
        Velocity is a Wiener process and weight is its integral, so the covariance added over a
        gap is the continuous noise integrated through the dynamics — not a diagonal random
        walk. That is what makes irregular weigh-in times principled rather than approximated:
        one 30-day gap is <em>identically</em> the same distribution as thirty one-day steps.
      </p>
      <Eq describe="F of delta t is the matrix one, delta t; zero, one.">
        <V>F</V>(Δ<V>t</V>) <Op>=</Op>{" "}
        <Matrix
          columns={2}
          cells={[
            <>1</>,
            <>
              Δ<V>t</V>
            </>,
            <>0</>,
            <>1</>,
          ]}
        />
      </Eq>
      <Eq describe="Q of delta t is sigma-a squared times the matrix delta t cubed over three, delta t squared over two; delta t squared over two, delta t.">
        <V>Q</V>(Δ<V>t</V>) <Op>=</Op> <V>σ</V>
        <Sub>a</Sub>
        <Sup>2</Sup>{" "}
        <Matrix
          columns={2}
          cells={[
            <>
              Δ<V>t</V>
              <Sup>3</Sup>/3
            </>,
            <>
              Δ<V>t</V>
              <Sup>2</Sup>/2
            </>,
            <>
              Δ<V>t</V>
              <Sup>2</Sup>/2
            </>,
            <>
              Δ<V>t</V>
            </>,
          ]}
        />
      </Eq>

      <h4 className={styles.part}>A3 · The filter recursion</h4>
      <p>
        Predict forward to the next weigh-in, then correct by however much the reading surprised
        the model. The surprise <V>ν</V> is the innovation, <V>S</V> its variance, and the gain{" "}
        <V>K</V> is the share of the surprise the estimate absorbs — the reason one reading
        moves the trend only part of the way.
      </p>
      <Eq describe="The predicted state is F times the previous state; the predicted covariance is F P F transpose plus Q.">
        <V>x</V>
        <Sub>t|t−1</Sub> <Op>=</Op> <V>F</V>
        <Sub>t</Sub>
        <V>x</V>
        <Sub>t−1|t−1</Sub>
        <Space />
        <V>P</V>
        <Sub>t|t−1</Sub> <Op>=</Op> <V>F</V>
        <Sub>t</Sub>
        <V>P</V>
        <Sub>t−1|t−1</Sub>
        <V>F</V>
        <Sub>t</Sub>
        <Sup>⊤</Sup> <Op>+</Op> <V>Q</V>
        <Sub>t</Sub>
      </Eq>
      <Eq describe="The innovation nu is y minus H x; its variance S is H P H transpose plus R.">
        <V>ν</V>
        <Sub>t</Sub> <Op>=</Op> <V>y</V>
        <Sub>t</Sub> <Op>−</Op> <V>H</V>
        <V>x</V>
        <Sub>t|t−1</Sub>
        <Space />
        <V>S</V>
        <Sub>t</Sub> <Op>=</Op> <V>H</V>
        <V>P</V>
        <Sub>t|t−1</Sub>
        <V>H</V>
        <Sup>⊤</Sup> <Op>+</Op> <V>R</V>
      </Eq>
      <Eq describe="The gain K is P H transpose divided by S. S is scalar, so this is a division rather than a matrix inverse.">
        <V>K</V>
        <Sub>t</Sub> <Op>=</Op> <V>P</V>
        <Sub>t|t−1</Sub>
        <V>H</V>
        <Sup>⊤</Sup>
        <V>S</V>
        <Sub>t</Sub>
        <Sup>−1</Sup>
      </Eq>
      <p>
        The covariance update is written in Joseph form. It is algebraically identical to the
        shorter version and costs more arithmetic; it is used because only this form stays
        symmetric and positive semi-definite when accumulated over thousands of steps.
      </p>
      <Eq describe="The corrected state is the predicted state plus K times nu. The corrected covariance is I minus K H, times P, times I minus K H transposed, plus K R K transposed.">
        <V>x</V>
        <Sub>t|t</Sub> <Op>=</Op> <V>x</V>
        <Sub>t|t−1</Sub> <Op>+</Op> <V>K</V>
        <Sub>t</Sub>
        <V>ν</V>
        <Sub>t</Sub>
        <Space />
        <V>P</V>
        <Sub>t|t</Sub> <Op>=</Op> (<V>I</V> <Op>−</Op> <V>K</V>
        <Sub>t</Sub>
        <V>H</V>)<V>P</V>
        <Sub>t|t−1</Sub>(<V>I</V> <Op>−</Op> <V>K</V>
        <Sub>t</Sub>
        <V>H</V>)<Sup>⊤</Sup> <Op>+</Op> <V>K</V>
        <Sub>t</Sub>
        <V>R</V>
        <V>K</V>
        <Sub>t</Sub>
        <Sup>⊤</Sup>
      </Eq>

      <h4 className={styles.part}>A4 · The interval that is published</h4>
      <p>
        The 95% range is the posterior standard deviation of the weight component, scaled by the
        normal quantile. The multiplier is usually written 1.96; the code holds it unrounded as
        a named constant so the choice is stated once rather than scattered as a literal.
      </p>
      <Eq describe="w at time t, plus or minus z times the square root of the weight-weight entry of P, where z is 1.959963984540054.">
        <V>w</V>
        <Sub>t</Sub> <Op>±</Op> <V>z</V>
        <Sub>0.975</Sub> <Op>·</Op> √<V>P</V>
        <Sub>t,ww</Sub>
        <Space />
        <V>z</V>
        <Sub>0.975</Sub> <Op>=</Op> 1.959963984540054
      </Eq>

      <h4 className={styles.part}>A5 · Forecast propagation</h4>
      <p>
        A horizon <V>h</V> is measured from the forecast origin, but the state is carried over
        the total elapsed time <V>τ</V> — the lead <V>λ</V> since the last weigh-in, plus the
        horizon. Those lead days are real time in which the trend both moved and became less
        certain, so they are propagated through rather than skipped.
      </p>
      <Eq describe="Tau equals lambda plus h.">
        <V>τ</V> <Op>=</Op> <V>λ</V> <Op>+</Op> <V>h</V>
      </Eq>
      <Eq describe="The forecast weight is w at T plus v at T times tau. Its variance is P-ww plus two tau P-wv plus tau squared P-vv plus one third sigma-a squared tau cubed.">
        <V>w</V>(<V>h</V>) <Op>=</Op> <V>w</V>
        <Sub>T</Sub> <Op>+</Op> <V>v</V>
        <Sub>T</Sub>
        <V>τ</V>
        <Space />
        <V>P</V>
        <Sub>ww</Sub>(<V>h</V>) <Op>=</Op> <V>P</V>
        <Sub>ww</Sub> <Op>+</Op> 2<V>τ</V>
        <V>P</V>
        <Sub>wv</Sub> <Op>+</Op> <V>τ</V>
        <Sup>2</Sup>
        <V>P</V>
        <Sub>vv</Sub> <Op>+</Op> ⅓<V>σ</V>
        <Sub>a</Sub>
        <Sup>2</Sup>
        <V>τ</V>
        <Sup>3</Sup>
      </Eq>
      <p>
        The three terms after <V>P</V>
        <Sub>ww</Sub> are the whole story of the widening band: current-weight uncertainty,
        current-velocity uncertainty over a longer lever arm, and drift in the trend itself. The{" "}
        <V>τ</V>
        <Sup>3</Sup> term is what makes distant forecasts honestly vague rather than wrong with
        a narrow interval.
      </p>

      <h4 className={styles.part}>A6 · Units and the weekly rate</h4>
      <p>
        Velocity is estimated in kg/day and displayed in kg/week. The conversion is exact, and
        the standard deviation scales with it. The process-noise intensity is derived from a
        prior stated in product units, because σ<sub>a</sub> in kg·day<sup>−3/2</sup> is not
        humanly checkable.
      </p>
      <Eq describe="r at t equals seven times v at t; the standard deviation of r is seven times the standard deviation of v.">
        <V>r</V>
        <Sub>t</Sub> <Op>=</Op> 7<V>v</V>
        <Sub>t</Sub>
        <Space />
        sd(<V>r</V>
        <Sub>t</Sub>) <Op>=</Op> 7 sd(<V>v</V>
        <Sub>t</Sub>)
      </Eq>
      <Eq describe="Sigma-a equals d divided by seven root seven, where d is the weekly rate drift.">
        <V>σ</V>
        <Sub>a</Sub> <Op>=</Op> <V>d</V> <Op>⁄</Op> (7√7)
        {params === null ? null : (
          <>
            <Space />
            <V>d</V> <Op>=</Op> {formatNumber(params.weekly_rate_drift_kg_per_week, 2)}{" "}
            <Op>⇒</Op> <V>σ</V>
            <Sub>a</Sub> <Op>=</Op> {formatNumber(params.sigma_accel, 6)}
          </>
        )}
      </Eq>

      <h4 className={styles.part}>A7 · Equation to code</h4>
      <p>
        Every equation above names the file and symbol that implements it. If an equation
        appears here and no code implements it, one of the two is wrong.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Equation</th>
              <th scope="col">File</th>
              <th scope="col">Symbol</th>
            </tr>
          </thead>
          <tbody>
            {CODE_INDEX.map((entry) => (
              <tr key={entry.symbol}>
                <th scope="row">{entry.equation}</th>
                <td className={styles.mono}>{entry.file}</td>
                <td className={styles.mono}>{entry.symbol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Transcribed from the equation-to-code index in docs/mathematics.md §9. */
const CODE_INDEX: { equation: string; file: string; symbol: string }[] = [
  { equation: "F(Δt)", file: "app/core/model.py", symbol: "transition_matrix" },
  { equation: "Q(Δt)", file: "app/core/model.py", symbol: "process_noise" },
  { equation: "initial state and covariance", file: "app/core/model.py", symbol: "initial_state" },
  { equation: "symmetrise, PSD checks", file: "app/core/model.py", symbol: "validate_covariance" },
  { equation: "predict step", file: "app/core/kalman.py", symbol: "predict" },
  { equation: "ν, S, K and the Joseph update", file: "app/core/kalman.py", symbol: "update" },
  { equation: "filter over irregular Δt", file: "app/core/filter.py", symbol: "run_filter" },
  { equation: "w ± z√Pww", file: "app/core/types.py", symbol: "StateEstimate.w_interval" },
  { equation: "τ = λ + h", file: "app/core/forecast.py", symbol: "_propagated_point" },
  { equation: "forecast mean and variance", file: "app/core/forecast.py", symbol: "forecast_at" },
  { equation: "forecast band", file: "app/core/forecast.py", symbol: "forecast_path" },
  { equation: "r = 7v", file: "app/core/units.py", symbol: "per_day_to_per_week" },
  {
    equation: "σa = d ⁄ (7√7)",
    file: "app/core/units.py",
    symbol: "sigma_accel_from_weekly_rate_drift",
  },
  { equation: "the whole pipeline", file: "app/core/analyse.py", symbol: "run_analysis" },
];

/**
 * An equation, described in words for anyone who cannot read the typeset version. `role="img"`
 * plus a label is the honest description of what a set of positioned glyphs is to a screen
 * reader; the prose around each block explains the same thing at greater length.
 */
function Eq({ describe, children }: { describe: string; children: ReactNode }) {
  return (
    <div className={styles.eqWrap}>
      <div className={styles.eq} role="img" aria-label={describe}>
        {children}
      </div>
    </div>
  );
}

/** A mathematical variable: italic serif, the way it is set in the reference document. */
function V({ children }: { children: ReactNode }) {
  return <i className={styles.variable}>{children}</i>;
}

/** An operator, spaced rather than crowded against its operands. */
function Op({ children }: { children: ReactNode }) {
  return <span className={styles.operator}>{children}</span>;
}

function Sub({ children }: { children: ReactNode }) {
  return <sub className={styles.script}>{children}</sub>;
}

function Sup({ children }: { children: ReactNode }) {
  return <sup className={styles.script}>{children}</sup>;
}

/** The gap between two equations sharing one line. */
function Space() {
  return <span className={styles.gap} />;
}

function Matrix({ columns, cells }: { columns: number; cells: ReactNode[] }) {
  return (
    <span className={styles.matrix}>
      <span className={styles.bracketLeft} />
      <span
        className={styles.matrixGrid}
        style={{ gridTemplateColumns: `repeat(${columns}, auto)` }}
      >
        {cells.map((cell, index) => (
          <span key={index} className={styles.matrixCell}>
            {cell}
          </span>
        ))}
      </span>
      <span className={styles.bracketRight} />
    </span>
  );
}
