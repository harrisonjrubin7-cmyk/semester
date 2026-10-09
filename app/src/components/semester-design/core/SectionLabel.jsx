import React from 'react';
/** The small caps kicker over a section, with an optional count or aside on the right. */
export function SectionLabel({ children, aside, as = 'h2', style }) {
  const H = as;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--sp-4)', marginBottom: 'var(--sp-4)', ...style }}>
      <H className="kicker" style={{ margin: 0, fontFamily: 'var(--font-body)', fontWeight: 500 }}>{children}</H>
      {aside != null && <span className="kicker nums" style={{ letterSpacing: 0 }}>{aside}</span>}
    </div>
  );
}
