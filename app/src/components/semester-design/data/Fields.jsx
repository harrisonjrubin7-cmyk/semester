import React from 'react';
/** Label/value definition list — the console's record and context-bar layout.
 * Hardened: empty values render "Not recorded" (never blank), optional per-field hint and source, copy for mono identifiers, stacked layout for narrow columns. */
export function Fields({ items = [], label, layout = 'grid', emptyText = 'Not recorded' }) {
  const [copied, setCopied] = React.useState(null);
  const copy = (it) => { try { navigator.clipboard.writeText(String(it.value)); setCopied(it.field); setTimeout(() => setCopied(null), 1600); } catch {} };
  return (
    <dl className="fields" data-layout={layout} aria-label={label}>
      {items.map((it, i) => { const empty = it.value === null || it.value === undefined || it.value === ''; return (
        <React.Fragment key={it.field + '-' + i}>
          <dt>{it.field}{it.hint && <span className="field-hint">{it.hint}</span>}</dt>
          <dd className={it.mono && !empty ? 'mono' : undefined}>{empty ? <span style={{ color: 'var(--text-tertiary)' }}>{it.emptyText || emptyText}</span> : it.value}
            {it.source && <span className="field-source"> · {it.source}</span>}
            {it.copy && !empty && <button type="button" className="btn-link field-copy" onClick={() => copy(it)} aria-label={'Copy ' + it.field}>{copied === it.field ? 'Copied' : 'Copy'}</button>}
            <span className="sr-only" aria-live="polite">{copied === it.field ? it.field + ' copied' : ''}</span>
          </dd>
        </React.Fragment>); })}
    </dl>
  );
}
