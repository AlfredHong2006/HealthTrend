const { Icon, Button, Badge, Sparkline } = window.HealthTrendDesignSystem_ec2bc0;

function NavItem({ icon, label, active, onClick }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '7px 10px', border: 0, borderRadius: 'var(--radius-1)', cursor: 'pointer',
        background: active ? 'var(--surface-hover)' : hover ? 'var(--surface-hover)' : 'transparent',
        color: active ? 'var(--text-display)' : 'var(--text-secondary)',
        font: (active ? '600' : '450') + ' var(--size-ui)/1.2 var(--font-numeric)',
        transition: 'var(--transition-control)', textAlign: 'left',
      }}>
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function AppShell({ view, setView, onLog, children }) {
  const f = window.HT_FIXTURES;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'var(--shell-nav-w) 1fr', minHeight: '100vh', background: 'var(--surface-page)' }}>
      <nav style={{ borderRight: '1px solid var(--rule-1)', padding: '20px 14px', display: 'flex', flexDirection: 'column', gap: 26 }}>
        <div style={{ padding: '0 10px' }}>
          <div style={{ font: '400 21px var(--font-prose)', letterSpacing: '-0.02em', color: 'var(--ink-1)' }}>HealthTrend</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavItem icon="trending-down" label="Trend" active={view === 'trend'} onClick={() => setView('trend')} />
          <NavItem icon="table-2" label="Measurements" active={view === 'measurements'} onClick={() => setView('measurements')} />
          <NavItem icon="sigma" label="Evidence" active={view === 'evidence'} onClick={() => setView('evidence')} />
          <NavItem icon="book-open" label="Method" active={view === 'method'} onClick={() => setView('method')} />
          <NavItem icon="sliders-horizontal" label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '0 10px' }}>
          <span className="ht-eyebrow">Last 30 days</span>
          <Sparkline trend={f.trend.slice(-30)} width={160} height={38} />
          <span className="ht-qualifier">Sample data, not a real person</span>
        </div>
      </nav>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{
          height: 'var(--shell-header-h)', display: 'flex', alignItems: 'center', gap: 18,
          padding: '0 var(--shell-pad-x)', borderBottom: '1px solid var(--rule-1)',
        }}>
          <span className="ht-qualifier">Synced from Withings &middot; today, 06:40</span>
          <Badge variant="accent">Local linear trend, v2</Badge>
          <Badge variant="outline">Fixture series &mdash; invented data</Badge>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button variant="quiet" size="sm" iconRight="download">Export CSV</Button>
            <Button variant="primary" size="sm" icon="plus" onClick={onLog}>Log a weigh-in</Button>
          </div>
        </header>
        <main style={{ padding: 'var(--space-10) var(--shell-pad-x) var(--space-12)', minWidth: 0 }}>
          <div style={{ maxWidth: 'var(--col-screen)' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { AppShell, NavItem });
