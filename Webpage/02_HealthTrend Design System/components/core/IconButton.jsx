import React from 'react';
import { Icon } from './Icon.jsx';

export function IconButton({ icon, label, size = 30, onClick, active, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: active || hover ? 'var(--surface-hover)' : 'transparent',
        color: active ? 'var(--text-accent)' : hover ? 'var(--text-display)' : 'var(--text-secondary)',
        border: '1px solid transparent', borderRadius: 'var(--radius-1)',
        cursor: 'pointer', transition: 'var(--transition-control)', ...style,
      }}
    >
      <Icon name={icon} size={Math.round(size * 0.54)} />
    </button>
  );
}
