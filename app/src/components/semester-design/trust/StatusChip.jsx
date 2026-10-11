import React from 'react';
import { STATUSES } from './vocabulary.js';
/** One status, drawn one way: glyph + word + tone. */
export function StatusChip({ status = 'pending', label }) {
  const s = STATUSES[status] || { label: status, glyph: '·', tone: 'neutral' };
  return <span className="status-chip" data-tone={s.tone}><span className="status-glyph" aria-hidden="true">{s.glyph}</span>{label || s.label}</span>;
}
