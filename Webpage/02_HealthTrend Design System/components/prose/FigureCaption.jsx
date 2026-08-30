import React from 'react';

export function FigureCaption({ label, children, source }) {
  return (
    <figcaption style={{
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
      maxWidth: 'var(--measure-narrow)', marginTop: 'var(--space-6)',
    }}>
      <span style={{
        fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-qualifier)',
        fontWeight: 'var(--weight-ui-strong)', letterSpacing: 'var(--tracking-eyebrow)',
        textTransform: 'uppercase', color: 'var(--text-qualifier)',
      }}>{label}</span>
      <span style={{
        font: 'var(--weight-prose) var(--size-body-sm)/1.5 var(--font-prose)',
        color: 'var(--text-secondary)', textWrap: 'pretty',
      }}>{children}</span>
      {source ? <span className="ht-qualifier" style={{ fontSize: 'var(--size-qualifier-sm)' }}>{source}</span> : null}
    </figcaption>
  );
}
