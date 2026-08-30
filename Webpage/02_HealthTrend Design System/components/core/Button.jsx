import React from 'react';
import { Icon } from './Icon.jsx';

const htButtonBase = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  gap: 'var(--space-3)', fontFamily: 'var(--font-numeric)',
  fontWeight: 'var(--weight-ui-strong)', letterSpacing: '0.005em',
  borderRadius: 'var(--radius-1)', cursor: 'pointer',
  transition: 'var(--transition-control)', whiteSpace: 'nowrap',
  border: '1px solid transparent', textDecoration: 'none',
};

const htButtonSizes = {
  sm: { height: 28, padding: '0 10px', fontSize: 'var(--size-ui-sm)' },
  md: { height: 34, padding: '0 14px', fontSize: 'var(--size-ui)' },
};

function htButtonSkin(variant, hover, active) {
  if (variant === 'primary') return {
    background: active ? 'var(--azure-700)' : hover ? 'var(--surface-accent-hover)' : 'var(--surface-accent)',
    color: 'var(--text-inverse)',
  };
  if (variant === 'secondary') return {
    background: hover ? 'var(--surface-hover)' : 'var(--surface-page)',
    color: 'var(--text-body)',
    borderColor: hover ? 'var(--border-control-hover)' : 'var(--border-control)',
  };
  return {
    background: hover ? 'var(--surface-hover)' : 'transparent',
    color: active ? 'var(--text-display)' : 'var(--text-secondary)',
  };
}

export function Button({ children, variant = 'secondary', size = 'md', icon, iconRight, disabled, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        ...htButtonBase,
        ...htButtonSizes[size],
        ...htButtonSkin(variant, hover && !disabled, active && !disabled),
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 13 : 15} /> : null}
    </button>
  );
}
