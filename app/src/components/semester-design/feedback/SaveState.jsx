import React from 'react';
import { STATUSES } from '../trust/vocabulary.js';
/** A quiet save/sync line near the work — not a toast. Polite live region; offline/conflict interrupt. */
export function SaveState({ status = 'saved' }) {
  const s = STATUSES[status] || STATUSES.unknown;
  return <span className="save-state" data-tone={s.tone} role={s.urgent ? 'alert' : 'status'} aria-live={s.urgent ? 'assertive' : 'polite'}><span className="status-glyph" aria-hidden="true">{s.glyph}</span>{s.label}</span>;
}
