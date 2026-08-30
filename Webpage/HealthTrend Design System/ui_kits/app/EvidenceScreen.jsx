const { SectionHeading, Prose, Equation, Qualifier, SupportingMetric, MeasurementTable,
        TrajectoryChart, ChartLegend, TextLink, Tooltip, Icon, Badge } = window.HealthTrendDesignSystem_ec2bc0;

function EvidenceScreen({ goMethod }) {
  const f = window.HT_FIXTURES;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="ht-eyebrow">Evidence</span>
        <h1 className="ht-title" style={{ maxWidth: '28em' }}>What the data supports, and how strongly</h1>
        <Qualifier>Fixture series &mdash; invented values. In the product every figure below is produced by the fitted model, and nothing is inferred by hand.</Qualifier>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-10)', flexWrap: 'wrap', paddingBottom: 'var(--space-7)', borderBottom: '1px solid var(--rule-1)' }}>
        <SupportingMetric label="Velocity estimate" value="&minus;0.27" unit="kg/week" qualifier="95% CI &minus;0.34 to &minus;0.19" emphasis="accent" />
        <SupportingMetric label="Posterior P(declining)" value="0.997" qualifier="mass of velocity below zero" />
        <SupportingMetric label="Measurement noise &sigma;" value="0.71" unit="kg" qualifier="fixed model parameter, revision v2" />
        <SupportingMetric label="Process noise &sigma;" value="0.043" unit="kg/day" qualifier="fixed model parameter, revision v2" />
        <SupportingMetric label="One-step MAE" value="0.54" unit="kg" qualifier="held-out, last 30 days" />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-11)', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', flex: '1 1 460px', minWidth: 380, maxWidth: 'var(--col-body)' }}>
          <Prose>
            <p>The claim on the Trend screen is narrow: the state-space model puts your current trajectory at 76.2 kg, moving at &minus;0.27 kg per week, and 99.7% of the posterior mass for that velocity sits below zero.</p>
            <p>That is a statement about the model&rsquo;s belief given 103 readings &mdash; not a prediction about your body, and not a claim that the decline will continue. <TextLink onClick={goMethod}>Read the method</TextLink>.</p>
          </Prose>
          <Equation number="1">v&#770;&#8348; | y&#8321;&#8230;&#8348; ~ N(&minus;0.038, 0.011&sup2;) kg/day</Equation>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className="ht-eyebrow">Model parameters</span>
              <Badge variant="accent">Local linear trend, v2</Badge>
            </div>
            <MeasurementTable dense
              columns={['date', 'reading', 'trend', 'residual']}
              rows={[
                { date: 'Level \u03c3', reading: '0.043', trend: '0.031', residual: '0.058' },
                { date: 'Velocity \u03c3', reading: '0.004', trend: '0.002', residual: '0.007' },
                { date: 'Observation \u03c3', reading: '0.710', trend: '0.641', residual: '0.789' },
                { date: 'Init level', reading: '92.40', trend: '91.02', residual: '93.71' },
              ]} />
            <Qualifier style={{ marginTop: 10 }}>Columns: shipped value, and the range spanned by the evaluation set. Fixture values.</Qualifier>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', flex: '1 1 320px', minWidth: 300 }}>
          <div style={{ background: 'var(--surface-well)', padding: 'var(--space-7)' }}>
            <span className="ht-eyebrow">One-step-ahead residuals</span>
            <div style={{ marginTop: 12 }}>
              <TrajectoryChart height={190} unit="kg" showBands={false} showProjection={false}
                trend={f.trend.slice(-60).map((p, i) => ({ y: (p.rawY == null ? p.y : p.rawY) - p.y, label: p.label }))}
                raw={[]} />
            </div>
            <Qualifier style={{ marginTop: 10 }}>No visible autocorrelation; Ljung&ndash;Box p = 0.41 at lag 10.</Qualifier>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span className="ht-eyebrow">Claims the model does not make</span>
            {['Why the trajectory changed', 'Body composition', 'Whether the rate is healthy', 'What will happen if you change nothing'].map(t => (
              <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'baseline', paddingBottom: 8, borderBottom: '1px solid var(--rule-1)' }}>
                <Icon name="minus" size={13} color="var(--ink-5)" />
                <span className="ht-body-sm" style={{ color: 'var(--text-secondary)' }}>{t}</span>
              </div>
            ))}
            <Tooltip content="If a screen shows a claim, it must trace to a quantity in this table.">
              <span className="ht-qualifier" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}><Icon name="info" size={13} /> provenance rule</span>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { EvidenceScreen });
