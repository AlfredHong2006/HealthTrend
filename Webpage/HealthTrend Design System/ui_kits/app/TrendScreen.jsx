const { HeroMetric, SupportingMetric, TrendDelta, Qualifier, TrajectoryChart, ChartLegend, RangeStrip,
        SegmentedControl, Switch, Prose, TextLink, Tooltip, Icon } = window.HealthTrendDesignSystem_ec2bc0;

function TrendScreen({ goMethod }) {
  const f = window.HT_FIXTURES;
  const [range, setRange] = React.useState('120d');
  const [showRaw, setShowRaw] = React.useState(true);
  const [showProj, setShowProj] = React.useState(true);
  const [win, setWin] = React.useState([0.68, 1]);
  const cut = { '30d': 30, '90d': 90, '120d': 120, 'All': 120 }[range];
  const trend = f.trend.slice(-cut);
  const raw = f.raw.filter(p => p.i >= f.trend.length - cut).map(p => ({ i: p.i - (f.trend.length - cut), y: p.y }));
  const last = trend[trend.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-10)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-9)', flexWrap: 'wrap' }}>
        <HeroMetric label="Estimated trend weight" value={last.y.toFixed(1)} unit="kg"
          interval={'\u00b1' + (last.hi68 - last.y).toFixed(2) + ' kg (68%)'}
          asOf="as of today, 06:40" />
        <div style={{ display: 'flex', gap: 'var(--space-9)', alignItems: 'flex-end', paddingBottom: 6 }}>
          <TrendDelta value="&minus;0.27" direction="down" interval="95% CI &minus;0.34 to &minus;0.19 kg/week" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-10)', paddingTop: 'var(--space-7)', borderTop: '1px solid var(--rule-1)', flexWrap: 'wrap' }}>
        <SupportingMetric label="Projected 30 Sep" value={f.projection[29].y.toFixed(1)} unit="kg"
          qualifier={'\u00b1' + (f.projection[29].hi - f.projection[29].y).toFixed(1) + ' kg (68%)'} />
        <SupportingMetric label="Change, 90 days" value="&minus;3.4" unit="kg" qualifier="95% CI &minus;4.1 to &minus;2.7" />
        <SupportingMetric label="Measurements used" value="103" qualifier="of 120 days &middot; 17 days without a reading" />
        <SupportingMetric label="Residual scatter" value="0.71" unit="kg" qualifier="&sigma; of readings around the estimate" />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingTop: 2 }}>
          <Tooltip content="Every interval on this screen is the filter's posterior credible interval, not a sample confidence interval.">
            <span className="ht-qualifier" style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
              <Icon name="info" size={13} /> how to read intervals
            </span>
          </Tooltip>
        </div>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-7)', flexWrap: 'wrap' }}>
          <span className="ht-eyebrow">Trajectory</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--space-7)', alignItems: 'center' }}>
            <Switch checked={showRaw} onChange={setShowRaw} label="Raw measurements" />
            <Switch checked={showProj} onChange={setShowProj} label="Projection" />
            <SegmentedControl options={['30d', '90d', '120d', 'All']} value={range} onChange={setRange} />
          </div>
        </div>
        <TrajectoryChart trend={trend} raw={raw} projection={showProj ? f.projection : []}
          showRaw={showRaw} showProjection={showProj} height={420} unit="kg"
          xTicks={f.xTicks.filter(t => t.i >= f.trend.length - cut).map(t => ({ i: t.i - (f.trend.length - cut), label: t.label }))}
          reference={{ y: 74, label: 'goal 74.0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-9)', flexWrap: 'wrap' }}>
          <ChartLegend items={[
            { role: 'trend', label: 'Estimated trajectory' },
            { role: 'band', label: '68% / 95% credible interval' },
            { role: 'raw', label: 'Scale measurements' },
            { role: 'projection', label: 'Projection, 30 days' },
            { role: 'reference', label: 'Your goal' },
          ]} />
          <Qualifier>Updated 06:40 &middot; fixture series, shown for layout only</Qualifier>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        <span className="ht-eyebrow">Whole history</span>
        <RangeStrip series={f.history} from={win[0]} to={win[1]} onChange={setWin} height={64}
          ticks={['Sep 2024', 'Mar 2025', 'Sep 2025', 'today']} />
      </section>

      <section style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-10)', paddingTop: 'var(--space-8)', borderTop: '1px solid var(--rule-1)' }}>
        <Prose size="sm" style={{ flex: '1 1 380px' }}>
          <p>The line above is not your weight. It is the model&rsquo;s estimate of the weight underneath 103 noisy readings &mdash; and the band is how much that estimate could still move.</p>
          <p>Over the last 90 days this fixture estimate fell 3.4 kg, and the 95% interval on that change does not include zero &mdash; so in this sample the decline is resolved by the data rather than by the smoothing. Every figure here is invented fixture data. <TextLink onClick={goMethod}>How this is calculated</TextLink>.</p>
        </Prose>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4, flex: '1 1 260px', minWidth: 260 }}>
          <Qualifier icon="circle-slash">17 days have no reading. Gaps widen the band; they do not move the line.</Qualifier>
          <Qualifier icon="sigma">Rate is the filter&rsquo;s velocity state, not a difference of two readings.</Qualifier>
        </div>
      </section>
    </div>
  );
}
Object.assign(window, { TrendScreen });
