import React from 'react';
import { Icon } from '../core/Icon.jsx';
/** Ordered list of next safe actions, each with one line of why.
 * Hardened: semantic ordered list, done steps marked in words and skipped by default, blocked steps say why and aren't clickable, links via href, empty state, cap with "Show all". */
export function NextSteps({ steps = [], label = 'Next steps', hideDone = false, max, emptyText = 'You’re all caught up.' }) {
  const [all, setAll] = React.useState(false);
  const list = steps.filter((s) => !(hideDone && s.done)); const shown = max && !all ? list.slice(0, max) : list;
  if (!list.length) return <p className="next-steps-empty" style={{ margin: 0, fontSize: 'var(--type-sm)', color: 'var(--text-secondary)' }}>{emptyText}</p>;
  return (
    <div>
      <ol className="next-steps" aria-label={label}>
        {shown.map((s, i) => { const off = s.blocked || s.done; const inner = <>{s.icon && <Icon name={s.icon} size={19} style={{ color: 'var(--text-secondary)' }} />}<span className="next-step-text"><span className="next-step-label">{s.done && <span aria-hidden="true">✓ </span>}{s.label}{s.done && <span className="sr-only"> (done)</span>}</span>{(s.why || s.blockedReason) && <span className="next-step-why">{s.blocked && s.blockedReason ? 'Blocked: ' + s.blockedReason : s.why}</span>}</span>{s.aside}{!off && <Icon name="chevronRight" size={17} style={{ color: 'var(--text-tertiary)' }} />}</>;
          return <li key={s.id || s.label + i} data-done={s.done || undefined} data-blocked={s.blocked || undefined}>{off ? <div className="next-step" aria-disabled="true">{inner}</div> : s.href ? <a className="next-step" href={s.href}>{inner}</a> : <button type="button" className="next-step" onClick={s.onClick}>{inner}</button>}</li>; })}
      </ol>
      {max && list.length > max && <button type="button" className="btn-link" style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--type-sm)' }} onClick={() => setAll(!all)}>{all ? 'Show fewer' : 'Show all ' + list.length}</button>}
    </div>
  );
}
