import React from 'react';
/** Honest state of a connected record or journey. Distinguishes confirmed facts from pending, updating, stale, blocked, degraded and reconciling. Glyph + words carry meaning; colour only reinforces. */
const CS = {
  confirmed: ['✓', 'Confirmed'],
  pending: ['…', 'Pending confirmation'],
  updating: ['↻', 'Updating'],
  stale: ['◷', 'Source stale'],
  blocked: ['⊘', 'Action blocked'],
  degraded: ['!', 'Connection degraded'],
  reconcile: ['⇄', 'Reconciliation required'],
  resolved: ['✓', 'Resolved'],
};
export function ConnectionState({ state = 'confirmed', label, detail, source }) {
  const [g, w] = CS[state] || CS.confirmed;
  return <span className="cxs" data-state={state}><span aria-hidden="true">{g}</span><span>{label || w}</span>{(detail || source) && <span className="gov-sub">{[detail, source].filter(Boolean).join(' · ')}</span>}</span>;
}
/** One line pairing a confirmed fact with a projection still catching up, e.g. "Enrollment confirmed · schedule updating". */
export function ConnectionLine({ items }) {
  return <span className="cxl">{(items || []).map((it, i) => <ConnectionState key={i} {...it} />)}</span>;
}
