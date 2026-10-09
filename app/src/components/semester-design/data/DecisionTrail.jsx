import React from 'react';
const WORD = { done: 'Done', current: 'In progress', waiting: 'Not started', blocked: 'Blocked', failed: 'Failed', skipped: 'Skipped', reversed: 'Reversed' };
/** Auditable timeline: who did what, when, under which authority. Every step carries a state word (never colour or dot alone).
 * States: done, current, waiting, blocked, failed, skipped, reversed. Times render as <time>; newest-first available. */
export function DecisionTrail({ items = [], label = 'Decision trail', order = 'oldest', emptyText = 'No decisions recorded yet', compact = false }) {
  const list = order === 'newest' ? [...items].reverse() : items;
  if (!list.length) return <p className="trail-empty" style={{ margin: 0, fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{emptyText}</p>;
  return (
    <ol className="trail" aria-label={label} data-compact={compact || undefined}>
      {list.map((it, i) => { const st = it.state || 'done'; return (
        <li key={it.id ?? i} className="trail-item" data-state={st} aria-current={st === 'current' ? 'step' : undefined}>
          <span className="trail-dot" aria-hidden="true"></span>
          <div>
            <div className="trail-title">{it.title}{st !== 'done' && <span className="trail-state"> · {WORD[st] || st}</span>}<span className="sr-only">{st === 'done' ? ', done' : ''}</span></div>
            <div className="trail-meta">{[it.who, it.authority && 'under ' + it.authority].filter(Boolean).join(' · ')}{it.when && <>{(it.who || it.authority) ? ' · ' : ''}{it.datetime ? <time dateTime={it.datetime}>{it.when}</time> : it.when}</>}</div>
            {it.detail && !compact && <div style={{ fontSize: 'var(--type-sm)', color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>{it.detail}</div>}
            {it.evidence && !compact && <div className="trail-meta" style={{ marginTop: 'var(--sp-2)' }}>Evidence: {it.evidence}</div>}
          </div>
        </li>); })}
    </ol>
  );
}
