import React from 'react';

// Pins body copy to the prose measure so a paragraph never leaves orphaned space.
export function Prose({ children, size = 'body', width = 'prose', align = 'start', style }) {
  const cls = size === 'lede' ? 'ht-lede' : size === 'sm' ? 'ht-body-sm' : 'ht-body';
  const max = width === 'narrow' ? 'var(--measure-narrow)' : width === 'wide' ? 'var(--measure-wide)' : 'var(--measure-prose)';
  return (
    <div
      className={cls}
      style={{
        maxWidth: max,
        marginInline: align === 'center' ? 'auto' : undefined,
        ...style,
      }}
    >{children}</div>
  );
}
