const { Prose, SectionHeading, Equation, MarginNote, FigureCaption, Citation, TextLink,
        TrajectoryChart, ChartLegend, Qualifier, SegmentedControl, Switch, Sparkline } = window.HealthTrendDesignSystem_5b333a;

function Figure({ label, caption, source, children }) {
  return (
    <figure style={{ margin: 'var(--gap-block) 0', maxWidth: 'var(--col-page)' }}>
      <div style={{ background: 'var(--surface-well)', padding: 'var(--space-7)' }}>{children}</div>
      <FigureCaption label={label} source={source}>{caption}</FigureCaption>
    </figure>
  );
}

function InteractiveFigure() {
  const f = window.HT_FIXTURES;
  const [win, setWin] = React.useState('14 days');
  const [showRaw, setShowRaw] = React.useState(true);
  const k = { '7 days': 7, '14 days': 14, '28 days': 28 }[win];
  const trend = React.useMemo(() => {
    const src = f.trend.slice(-90);
    return src.map((p, i) => {
      const from = Math.max(0, i - k), slice = src.slice(from, i + 1).filter(q => q.rawY != null);
      const mean = slice.length ? slice.reduce((a, q) => a + q.rawY, 0) / slice.length : p.y;
      const s = 0.13 + 1.1 / Math.sqrt(Math.max(1, slice.length));
      return { y: mean, lo68: mean - s, hi68: mean + s, lo95: mean - s * 1.96, hi95: mean + s * 1.96, label: p.label };
    });
  }, [k]);
  return (
    <div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="ht-eyebrow">Window</span>
        <SegmentedControl size="sm" options={['7 days', '14 days', '28 days']} value={win} onChange={setWin} />
        <Switch checked={showRaw} onChange={setShowRaw} label="Readings" />
        <Qualifier style={{ marginLeft: 'auto' }}>Widen the window and the line lags; narrow it and the noise returns.</Qualifier>
      </div>
      <TrajectoryChart height={260} unit="kg" showProjection={false} showRaw={showRaw}
        trend={trend}
        raw={f.raw.filter(p => p.i >= f.trend.length - 90).map(p => ({ i: p.i - (f.trend.length - 90), y: p.y }))} />
    </div>
  );
}

function MethodBody() {
  const f = window.HT_FIXTURES;
  return (
    <div style={{ paddingBottom: 'var(--gap-chapter)' }}>
      <Prose size="lede" style={{ marginTop: 'var(--gap-block)' }}>
        <p>A bathroom scale is an honest instrument answering a question you did not ask. It reports the mass of a body at one moment, including its water, its last meal and the hour of the morning. What you want to know is the slow quantity underneath: where the trajectory sits today, and how fast it is moving.</p>
      </Prose>

      <SectionHeading eyebrow="Section 1" level={2} rule note="Why the average is the wrong tool" style={{ marginTop: 'var(--gap-block)' }}>
        The measurement is not the state
      </SectionHeading>
      <Prose style={{ marginTop: 'var(--space-7)' }}>
        <p>Write the thing you care about as a hidden state and the number on the scale as a noisy view of it. On day <em>t</em> the state has a level and a velocity; the reading adds independent measurement error on top.</p>
      </Prose>
      <Equation number="1">x&#8348; = x&#8348;&#8331;&#8321; + v&#8348;&#8331;&#8321; + &eta;&#8348;,   v&#8348; = v&#8348;&#8331;&#8321; + &zeta;&#8348;,   y&#8348; = x&#8348; + &epsilon;&#8348;</Equation>
      <Prose>
        <MarginNote marker="1">Hydration, glycogen and gut contents dominate day-to-day variance, which is why a single morning can move by more than a fortnight of real change.</MarginNote>
        <p>Here <em>x</em> is trend weight, <em>v</em> its daily velocity, and the three noise terms carry three different admissions of ignorance: how fast the level may wander, how fast the velocity may change, and how badly a single reading may mislead<Citation marker="1" />.</p>
        <p>A seven-day mean is a special case of this with the velocity term deleted and the noise assumed constant. That is why it lags: it estimates the average of a window, and the average of a falling window is a value from the middle of it.</p>
      </Prose>

      <Figure label="Figure 1" source="Fixture series, 90 days; window length varied"
        caption="A moving average is a choice between lag and noise. The filter does not require that choice — it infers how much of each reading to believe.">
        <InteractiveFigure />
      </Figure>

      <SectionHeading eyebrow="Section 2" level={2} rule>
        What the filter actually computes
      </SectionHeading>
      <Prose style={{ marginTop: 'var(--space-7)' }}>
        <p>Each morning the model carries a belief forward one day, widening it by the process noise; then it sees a reading and narrows it in proportion to how trustworthy that reading is relative to the belief.</p>
      </Prose>
      <Equation number="2">K&#8348; = P&#8348;&#8331; / (P&#8348;&#8331; + &sigma;&sup2;&#8342;),   x&#770;&#8348; = x&#770;&#8348;&#8331; + K&#8348;(y&#8348; &minus; x&#770;&#8348;&#8331;)</Equation>
      <Prose>
        <MarginNote marker="2">When you skip a day, only the first step runs: the band widens and the line continues on its last velocity. Absence of data never moves the estimate — it only makes it less certain.</MarginNote>
        <p>The gain <em>K</em> is the whole argument in one line. When your readings are consistent, <em>K</em> is large and the estimate tracks them closely. When they scatter, <em>K</em> falls and a single 2 kg morning barely registers.</p>
        <p>The shaded bands on every chart in the product are this belief&rsquo;s posterior standard deviation, at 68% and 95%. They are credible intervals for the state — not the range in which tomorrow&rsquo;s reading will fall, which is wider.</p>
      </Prose>

      <Figure label="Figure 2" source="Fixture series, 120 days, n = 103 readings — invented data"
        caption="The posterior mean with its 68% and 95% bands, the readings it saw, and a 30-day projection whose band widens because velocity itself is uncertain.">
        <TrajectoryChart trend={f.trend} raw={f.raw} projection={f.projection} height={300} unit="kg" xTicks={f.xTicks} />
        <div style={{ marginTop: 14 }}>
          <ChartLegend items={[
            { role: 'trend', label: 'Posterior mean' },
            { role: 'band', label: '68% / 95% credible interval' },
            { role: 'raw', label: 'Measurements' },
            { role: 'projection', label: 'Projection' },
          ]} />
        </div>
      </Figure>

      <SectionHeading eyebrow="Section 3" level={2} rule>
        Where the variances come from
      </SectionHeading>
      <Prose style={{ marginTop: 'var(--space-7)' }}>
        <p>Three variances govern everything above. HealthTrend ships them as fixed, documented parameters, calibrated once on our evaluation set and published with each model revision<Citation marker="2" />.</p>
        <p>We do not fit them to a single person&rsquo;s short history: with a few weeks of readings, per-user maximum likelihood is not justified by the evaluation &mdash; it moves the variances more than the data supports. The band still tightens over the first weeks of use, because the filter&rsquo;s posterior narrows as readings accumulate, not because the parameters change.</p>
      </Prose>
      <div style={{ display: 'flex', gap: 'var(--space-9)', alignItems: 'center', margin: 'var(--space-8) 0', maxWidth: 'var(--col-body)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="ht-eyebrow">Band width, first 90 days</span>
          <Sparkline trend={f.trend.slice(0, 90).map(p => ({ y: -(p.hi68 - p.y) }))} width={220} height={44} showBand={false} />
        </div>
        <Qualifier>In this fixture the 68% half-width falls from 0.55 kg to 0.13 kg as readings accumulate.</Qualifier>
      </div>

      <SectionHeading eyebrow="Section 4" level={2} rule>
        What we refuse to say
      </SectionHeading>
      <Prose style={{ marginTop: 'var(--space-7)' }}>
        <p>The model produces a level, a velocity, their uncertainties, and a forecast that assumes the current velocity persists. It does not produce causes, body composition, or a judgement about the rate.</p>
        <p>So the product does not state them. If a screen shows a claim, that claim traces to one of the quantities on the <TextLink href="../app/index.html">Evidence screen</TextLink>. Where the model is uncertain, the interface says so in the same breath as the number &mdash; never in a footnote.</p>
      </Prose>

      <div style={{ marginTop: 'var(--gap-block)', paddingTop: 'var(--space-7)', borderTop: '1px solid var(--rule-2)' }}>
        <span className="ht-eyebrow">References</span>
        <div style={{ marginTop: 'var(--space-6)', maxWidth: 'var(--col-body)' }}>
          <Citation marker="1">Harvey, A. C. Forecasting, Structural Time Series Models and the Kalman Filter. Cambridge University Press, 1989.</Citation>
          <Citation marker="2">Durbin, J. &amp; Koopman, S. J. Time Series Analysis by State Space Methods. 2nd ed., Oxford University Press, 2012.</Citation>
          <Citation marker="3">Kalman, R. E. A New Approach to Linear Filtering and Prediction Problems. Journal of Basic Engineering, 1960.</Citation>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { MethodBody, Figure, InteractiveFigure });
