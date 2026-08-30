import React from 'react';

export function TextLink({ children, href = '#', variant = 'prose', onClick, style }) {
  const [hover, setHover] = React.useState(false);
  const prose = variant === 'prose';
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: prose ? 'inherit' : 'var(--font-numeric)',
        fontSize: prose ? 'inherit' : 'var(--size-ui)',
        color: hover ? 'var(--azure-600)' : 'var(--text-accent)',
        textDecoration: 'none',
        borderBottom: '1px solid ' + (hover ? 'var(--azure-500)' : 'var(--azure-300)'),
        transition: 'var(--transition-control)', ...style,
      }}
    >{children}</a>
  );
}
