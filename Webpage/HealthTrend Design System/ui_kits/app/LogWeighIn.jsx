const { Input, Button, Qualifier, Icon } = window.HealthTrendDesignSystem_ec2bc0;

function LogWeighIn({ open, onClose }) {
  const [w, setW] = React.useState('76.4');
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(14,20,28,.18)', display: 'flex', justifyContent: 'flex-end', zIndex: 60 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 380, background: 'var(--surface-page)', borderLeft: '1px solid var(--rule-2)', boxShadow: 'var(--shadow-overlay)', padding: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-7)' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="ht-subtitle">Log a weigh-in</span>
          <button onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <Icon name="x" size={18} />
          </button>
        </div>
        <Qualifier>Morning readings, before eating, same scale. Consistency reduces the band faster than frequency.</Qualifier>
        <Input label="Weight" value={w} onChange={setW} unit="kg" width={180} hint="last reading 75.9 kg, yesterday 06:38 (fixture)" />
        <Input label="Date" value="30 Aug 2026" numeric={false} width={220} />
        <div style={{ display: 'flex', gap: 10, paddingTop: 'var(--space-5)', borderTop: '1px solid var(--rule-1)' }}>
          <Button variant="primary" onClick={onClose}>Add reading</Button>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
        </div>
        <Qualifier tone="accent" icon="info">One reading moves the estimate by about 0.1 kg at your current data density.</Qualifier>
      </div>
    </div>
  );
}
Object.assign(window, { LogWeighIn });
