import React from 'react';
import { SOURCES } from './vocabulary.js';
/** The signature device: a thin editorial line from a statement to its source chip. Only where a real source exists. */
export function SourceLine({ children, source = 'official', by, when }) {
  const s = SOURCES[source] || SOURCES.external;
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <div>{children}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }} title={s.meaning}>
        <span aria-hidden="true" style={{ flex: '0 0 48px', height: 1, background: 'var(--accent-editorial)' }}></span>
        <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-editorial)', marginLeft: -6 }}></span>
        <span className="status-chip" data-tone={s.tone} data-fill={s.fill}><span className="status-glyph" aria-hidden="true">{s.glyph}</span>{[s.short, by, when].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  );
}
