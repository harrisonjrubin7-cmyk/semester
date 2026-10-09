import React from 'react';
import { SourceBadge } from '../trust/SourceBadge.jsx';
const KIND = { actual: 'Actual', target: 'Target', estimate: 'Estimate', projection: 'Projection' };
const fmt = (v, locale) => (typeof v === 'number' && Number.isFinite(v) ? new Intl.NumberFormat(locale).format(v) : v);
/** One figure worth reading first, with its unit, kind (actual/target/estimate), period, denominator, source and age. Never an outcome claim.
 * States: loading (skeleton, announced), unavailable (value null/undefined → em dash + reason), stale (dotted rule + word). Clickable when href/onClick given. */
export function MetricTile({ label, value, unit, source, updated, delta, kind, period, denominator, state, reason, stale = false, href, onClick, locale, help }) {
  const loading = state === 'loading';
  const missing = !loading && (value === null || value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value)));
  const body = (
    <>
      <div className="kicker" style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'space-between', alignItems: 'baseline' }}><span>{label}</span>{kind && <span className="metric-kind">{KIND[kind] || kind}</span>}</div>
      {loading ? <div className="skeleton" style={{ height: 28, width: '60%' }} aria-hidden="true"></div>
        : missing ? <div><span className="metric-value" aria-hidden="true">—</span><span className="sr-only">Not available</span><div className="metric-delta">{reason || 'Not available yet'}</div></div>
        : <div><span className="metric-value">{fmt(value, locale)}</span>{unit && <span style={{ marginLeft: 6, fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{unit}</span>}</div>}
      {!loading && !missing && (denominator || period) && <div className="metric-delta">{[denominator && 'of ' + denominator, period].filter(Boolean).join(' · ')}</div>}
      {!loading && !missing && delta && <div className="metric-delta">{delta}</div>}
      {help && <div className="metric-delta">{help}</div>}
      {(source || stale) && !loading && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)', alignItems: 'center' }}>{source && <SourceBadge source={stale ? 'stale' : source} updated={updated} />}{stale && <span className="metric-delta">Out of date</span>}</div>}
    </>
  );
  const props = { className: 'metric', 'data-stale': stale || undefined, 'aria-busy': loading || undefined };
  if (href) return <a {...props} href={href} style={{ textDecoration: 'none', color: 'inherit' }}>{body}</a>;
  if (onClick) return <button type="button" {...props} onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}>{body}</button>;
  return <div {...props}>{body}</div>;
}
