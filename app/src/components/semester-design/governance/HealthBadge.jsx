import React from 'react';
const L = { healthy: ['✓', 'Healthy', 'success'], watch: ['?', 'Watch', 'pending'], atrisk: ['!', 'At risk', 'danger'], unknown: ['…', 'Not enough data', 'neutral'] };
/** Health band with the score's top driver — for tenants, integrations, customers.
 * Hardened: a score with no band never renders as healthy; stale data downgrades to "Not enough data"; trend in words; score range stated. */
export function HealthBadge({ band, score, outOf = 100, driver, updated, trend, stale = false }) {
  const b = stale ? 'unknown' : L[band] ? band : 'unknown';
  const [g, t, tone] = L[b];
  const tr = { up: 'improving', down: 'declining', flat: 'steady' }[trend];
  const label = [t, score != null && Number.isFinite(score) && 'score ' + score + ' of ' + outOf, tr, driver && 'driver: ' + driver, stale ? 'data out of date' : updated && 'updated ' + updated].filter(Boolean).join(', ');
  return <span className="health-badge" data-tone={tone} role="note" aria-label={label}><span className="gov-glyph" aria-hidden="true">{g}</span><b aria-hidden="true">{t}</b>{score != null && Number.isFinite(score) && !stale && <span className="nums" aria-hidden="true">{score}<span className="gov-sub">/{outOf}</span></span>}{tr && <span className="gov-sub" aria-hidden="true">· {tr}</span>}{driver && <span className="gov-sub" aria-hidden="true">· {driver}</span>}{(stale || updated) && <span className="gov-sub" aria-hidden="true">· {stale ? 'data out of date' : updated}</span>}</span>;
}
