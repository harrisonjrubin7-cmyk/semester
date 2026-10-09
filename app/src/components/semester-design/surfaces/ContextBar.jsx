import React, { useId } from 'react';
/** The object a screen is about, with its states and actions — one bar, not a card inside a card.
 * Hardened: labelled region, optional identifier with copy, source/freshness slot, sticky mode for long pages, heading level configurable, long titles wrap. */
export function ContextBar({ kicker, title, states, actions, id, source, sticky = false, level = 2, back }) {
  const hid = useId(); const H = 'h' + Math.min(6, Math.max(1, level)); const [copied, setCopied] = React.useState(false);
  return (
    <section className="context-bar" aria-labelledby={hid} data-sticky={sticky || undefined}>
      {back && <a className="context-bar-back" href={back.href} onClick={back.onClick}>← {back.label}</a>}
      {kicker && <div className="kicker">{kicker}</div>}
      <H id={hid} className="context-bar-title" style={{ overflowWrap: 'anywhere' }}>{title}</H>
      {(id || source) && <div className="context-bar-meta">{id && <><span className="mono">{id}</span> <button type="button" className="btn-link" onClick={() => { try { navigator.clipboard.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }} aria-label={'Copy ' + id}>{copied ? 'Copied' : 'Copy'}</button></>}{source && <span>{source}</span>}</div>}
      {states && <div className="context-bar-states">{states}</div>}
      {actions && <div className="object-card-actions" style={{ marginTop: 'var(--sp-2)' }}>{actions}</div>}
    </section>
  );
}
