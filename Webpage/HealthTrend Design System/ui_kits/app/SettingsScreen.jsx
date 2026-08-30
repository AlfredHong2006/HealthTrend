const { Select, Switch, Input, Button, Qualifier, Badge, Prose } = window.HealthTrendDesignSystem_ec2bc0;

function Row({ label, hint, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--space-9)', alignItems: 'start', padding: 'var(--space-7) 0', borderBottom: '1px solid var(--rule-1)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="ht-body-sm" style={{ color: 'var(--text-display)' }}>{label}</span>
        {hint ? <Qualifier>{hint}</Qualifier> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SettingsScreen() {
  const [unit, setUnit] = React.useState('kg');
  const [window_, setWindow] = React.useState('Adaptive');
  const [goal, setGoal] = React.useState('74.0');
  const [proj, setProj] = React.useState(true);
  const [gaps, setGaps] = React.useState(true);
  const [raw, setRaw] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-9)', maxWidth: 'var(--col-page)' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="ht-eyebrow">Settings</span>
        <h1 className="ht-title">Model and display</h1>
        <Prose size="sm"><p>Display settings change what you see. Model settings change what is estimated &mdash; and are shown on every screen that depends on them.</p></Prose>
      </header>
      <div>
        <Row label="Unit" hint="Applied to every value, including intervals">
          <Select options={['kg', 'lb', 'st']} value={unit} onChange={setUnit} width={110} />
        </Row>
        <Row label="Smoothing" hint="Adaptive lets the filter choose its own process noise">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <Select options={['Adaptive', '7 days', '14 days', '21 days', '28 days']} value={window_} onChange={setWindow} />
            <Badge variant="accent">affects every figure</Badge>
          </div>
        </Row>
        <Row label="Goal weight" hint="Drawn as a neutral dashed reference. The model never uses it.">
          <Input value={goal} onChange={setGoal} unit={unit} width={140} />
        </Row>
        <Row label="Chart layers">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Switch checked={proj} onChange={setProj} label="30-day projection" hint="dashed, with its own widening band" />
            <Switch checked={gaps} onChange={setGaps} label="Mark days without a reading" />
            <Switch checked={raw} onChange={setRaw} label="Raw readings on by default" hint="tier 3: small, grey, behind the estimate" />
          </div>
        </Row>
        <Row label="Data source" hint="Connected scale &middot; fixture connection, 4 Mar 2025">
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="secondary" size="sm" iconRight="refresh-cw">Re-sync</Button>
            <Button variant="quiet" size="sm">Disconnect</Button>
          </div>
        </Row>
      </div>
    </div>
  );
}
Object.assign(window, { SettingsScreen });
