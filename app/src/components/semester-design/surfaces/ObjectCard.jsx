import React, { useId } from 'react';
import { STATUSES } from '../trust/vocabulary.js';
import { ProvenanceChips } from '../trust/ProvenanceChips.jsx';
/**
 * The universal object card — one rhythm for every kind of thing:
 * eyebrow (kind · status) → title → provenance → why it matters → metadata → one primary + one quiet secondary.
 * Hardened: loading and unavailable states, linked titles (the whole card isn't a giant link), disabled primary says why, busy blocks double submits, unknown statuses fall back to their raw label, long titles wrap.
 */
export function ObjectCard({ kind = 'Task', statuses = [], title, provenance, explanation, metadata, primary, secondary, tone, level = 3, children, href, state, stateText, busy = false }) {
  const hid = useId(); const H = 'h' + Math.min(6, Math.max(2, level));
  if (state === 'loading') return <article className="object-card" aria-busy="true" aria-label="Loading"><span className="skeleton" style={{ height: 10, width: '30%' }}></span><span className="skeleton" style={{ height: 18, width: '75%' }}></span><span className="skeleton" style={{ height: 10, width: '55%' }}></span></article>;
  if (state === 'unavailable') return <article className="object-card" data-state="unavailable" aria-labelledby={hid}><div className="object-card-eyebrow"><span>{kind}</span></div><H id={hid} className="object-card-title">{title || 'Not available'}</H><p className="object-card-why">{stateText || 'You don’t have access to this, or it was removed.'}</p></article>;
  const glyphs = statuses.map((s) => (STATUSES[s] || {}).glyph).filter(Boolean).join(' ');
  return (
    <article className="object-card" data-tone={tone} aria-labelledby={hid}>
      <div className="object-card-eyebrow">{glyphs && <span className="status-glyph" aria-hidden="true">{glyphs}</span>}<span>{[kind, ...statuses.map((s) => (STATUSES[s] || { label: s }).label)].join(' · ')}</span></div>
      <H id={hid} className="object-card-title" style={{ overflowWrap: 'anywhere' }}>{href ? <a href={href} className="object-card-link">{title}</a> : title}</H>
      {provenance && <div><ProvenanceChips {...provenance} /></div>}
      {explanation && <p className="object-card-why">{explanation}</p>}
      {metadata && <p className="object-card-meta">{metadata}</p>}
      {children}
      {(primary || secondary) && (
        <div className="object-card-actions">
          {primary && <button type="button" className="btn btn-primary" onClick={primary.onClick} disabled={busy || primary.disabled} aria-describedby={primary.disabledReason ? hid + '-pr' : undefined}>{busy ? 'Working…' : primary.label}</button>}
          {secondary && <button type="button" className="link-quiet" onClick={secondary.onClick} disabled={busy}>{secondary.label}</button>}
          {primary && primary.disabled && primary.disabledReason && <span id={hid + '-pr'} className="object-card-meta">{primary.disabledReason}</span>}
        </div>
      )}
    </article>
  );
}
