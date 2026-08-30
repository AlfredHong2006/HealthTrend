const { MeasurementTable, SegmentedControl, Select, Qualifier, SupportingMetric, Sparkline,
        TrajectoryChart, Prose, Badge } = window.HealthTrendDesignSystem_5b333a;

function MeasurementsScreen() {
  const f = window.HT_FIXTURES;
  const [scope, setScope] = React.useState('All readings');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-9)' }}>
      <header style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="ht-eyebrow">Measurements</span>
          <h1 className="ht-title">103 readings, 120 days</h1>
          <Qualifier>Fixture series &middot; morning readings &middot; 17 days without a reading</Qualifier>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end' }}>
          <SegmentedControl options={['All readings', 'Gaps', 'Outliers']} value={scope} onChange={setScope} />
          <Select label="Unit" options={['kg', 'lb', 'st']} value="kg" width={96} size="sm" />
        </div>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-11)', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', flex: '1 1 420px', minWidth: 380, maxWidth: 560 }}>
          <MeasurementTable rows={f.rows} unit="kg" />
          <Qualifier>Trend column is the model&rsquo;s estimate for that day, including days you did not weigh in.</Qualifier>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-9)', flex: '1 1 420px', minWidth: 360 }}>
          <div style={{ display: 'flex', gap: 'var(--space-9)', flexWrap: 'wrap' }}>
            <SupportingMetric label="Mean residual" value="+0.02" unit="kg" qualifier="readings sit symmetrically around the line" />
            <SupportingMetric label="Residual &sigma;" value="0.71" unit="kg" qualifier="n = 103" />
            <SupportingMetric label="Longest gap" value="6" unit="days" qualifier="12&ndash;18 Jul" />
          </div>
          <div style={{ background: 'var(--surface-well)', padding: 'var(--space-7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span className="ht-eyebrow">Readings against the estimate</span>
              <Badge variant="outline">last 60 days</Badge>
            </div>
            <TrajectoryChart trend={f.trend.slice(-60)} raw={f.raw.filter(p => p.i >= f.trend.length - 60).map(p => ({ i: p.i - (f.trend.length - 60), y: p.y }))}
              projection={[]} showProjection={false} height={200} unit="kg" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="ht-eyebrow">Readings per week</span>
              <Sparkline trend={f.trend.slice(-84).filter((_, i) => i % 7 === 0)} width={180} height={36} showBand={false} />
            </div>
            <Prose size="sm" width="narrow">
              <p>Six or seven readings a week keep the band near its floor. Below three, the estimate is mostly prior.</p>
            </Prose>
          </div>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { MeasurementsScreen });
