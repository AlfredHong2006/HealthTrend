const { TextLink, Qualifier } = window.HealthTrendDesignSystem_5b333a;

function MethodHeader() {
  return (
    <header style={{ borderBottom: '1px solid var(--rule-1)', position: 'sticky', top: 0, background: 'var(--surface-page)', zIndex: 30 }}>
      <div style={{ maxWidth: 'var(--col-screen)', margin: '0 auto', padding: '0 var(--space-10)', height: 'var(--shell-header-h)', display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ font: '400 19px var(--font-prose)', letterSpacing: '-0.02em', color: 'var(--ink-1)' }}>HealthTrend</span>
        <span className="ht-qualifier" style={{ color: 'var(--ink-5)' }}>/</span>
        <span className="ht-qualifier">Method</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, alignItems: 'center' }}>
          <Qualifier>Revision 2.4 &middot; 12 Aug 2026 &middot; figures use fixture data</Qualifier>
          <TextLink variant="ui" href="../app/index.html">Back to the app</TextLink>
        </div>
      </div>
    </header>
  );
}

function MethodTitle() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)', paddingTop: 'var(--space-12)' }}>
      <h1 className="ht-display" style={{ maxWidth: '22em' }}>Estimating a weight trajectory from noisy daily measurements</h1>
      <div style={{ display: 'flex', gap: 'var(--space-9)', flexWrap: 'wrap', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--rule-2)' }}>
        {[['Model', 'Local linear trend'], ['Estimator', 'Kalman filter, fixed documented parameters'], ['Revision', '2.4 — 12 Aug 2026'], ['Reading time', '≈ 14 min']].map(p => (
          <div key={p[0]} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="ht-eyebrow">{p[0]}</span>
            <span className="ht-qualifier" style={{ color: 'var(--text-body)' }}>{p[1]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
Object.assign(window, { MethodHeader, MethodTitle });
