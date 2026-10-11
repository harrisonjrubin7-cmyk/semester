import React from 'react';
import { MARK_VIEWBOX, MARK_PATHS } from './markPaths.js';
/** The Semester mark (three slabs) — flat currentColor silhouette. */
export function Mark({ size = 24, style, className }) {
  const [, , w, h] = MARK_VIEWBOX.split(' ').map(Number);
  return (
    <svg width={(size * w) / h} height={size} viewBox={MARK_VIEWBOX} fill="currentColor" aria-hidden="true" focusable="false" className={className} style={{ display: 'block', flex: 'none', ...style }}>
      {MARK_PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
/** Mark + SEMESTER lockup. `metal` paints the brushed sterling used on dark chrome. */
export function Wordmark({ size = 20, metal = false, showWord = true, style }) {
  return (
    <span aria-label="Semester" role="img" style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.5, color: metal ? 'var(--sterling)' : 'currentColor', ...style }}>
      <Mark size={size} />
      {showWord && (
        <span aria-hidden="true" className={metal ? 'chrome-text' : undefined} style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 'var(--tracking-wordmark)', fontSize: size * 0.82, lineHeight: 1, paddingTop: 1 }}>Semester</span>
      )}
    </span>
  );
}
