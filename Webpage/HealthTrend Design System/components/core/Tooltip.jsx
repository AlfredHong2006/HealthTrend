import React from 'react';

export function Tooltip({ children, content, side = 'top' }) {
  const [open, setOpen] = React.useState(false);
  const pos = side === 'top'
    ? { bottom: '100%', left: '50%', transform: 'translate(-50%, -6px)' }
    : { top: '100%', left: '50%', transform: 'translate(-50%, 6px)' };
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      <span style={{
        position: 'absolute', ...pos, zIndex: 40, pointerEvents: 'none',
        opacity: open ? 1 : 0, transition: 'opacity var(--dur-2) var(--ease-standard)',
        background: 'var(--surface-page)', border: '1px solid var(--border-divider)',
        borderRadius: 'var(--radius-2)', boxShadow: 'var(--shadow-tooltip)',
        padding: '7px 10px', minWidth: 120, maxWidth: 260, whiteSpace: 'normal',
        fontFamily: 'var(--font-numeric)', fontSize: 'var(--size-qualifier)',
        lineHeight: 'var(--lh-qualifier)', color: 'var(--text-body)',
        fontVariantNumeric: 'tabular-nums',
      }}>{content}</span>
    </span>
  );
}
