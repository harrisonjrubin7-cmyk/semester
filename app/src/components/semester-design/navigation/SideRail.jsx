import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Wordmark } from '../core/Wordmark.jsx';
/** Desktop side rail — persistent, quiet, always on dark chrome. Groups: [{label?, items:[{id,label,icon,count}]}].
 * Hardened: real links when items have href, collapsible groups that never hide the current page, filter box for long rails, counts announced, compact (icons + short labels) mode, disabled items say why. */
export function SideRail({ groups = [], current, onNavigate, foot, brand = true, label = 'Semester', compact = false, filter = 'auto', collapsible = false }) {
  const [q, setQ] = React.useState(''); const [shut, setShut] = React.useState({});
  const total = groups.reduce((n, g) => n + g.items.length, 0); const showFilter = !compact && (filter === true || (filter === 'auto' && total > 12));
  const match = (it) => !q || it.label.toLowerCase().includes(q.toLowerCase());
  return (
    <nav className="rail" aria-label={label} data-compact={compact || undefined}>
      {brand && <div className="rail-brand"><Wordmark size={compact ? 14 : 18} metal /></div>}
      {showFilter && <input className="rail-filter" placeholder="Find a page" value={q} onChange={(e) => setQ(e.target.value)} aria-label={'Find in ' + label} />}
      {groups.map((g, gi) => { const vis = g.items.filter(match); if (!vis.length) return null; const hasCur = g.items.some((i) => i.id === current); const open = !collapsible || q || hasCur || !shut[gi];
        return <div key={gi} role="group" aria-label={g.label || undefined}>
          {g.label && (collapsible ? <button type="button" className="rail-label rail-label-btn" aria-expanded={open} onClick={() => setShut({ ...shut, [gi]: !shut[gi] })}>{open ? '▾' : '▸'} {g.label}</button> : <div className="rail-label">{g.label}</div>)}
          {open && vis.map((it) => { const cur = current === it.id; const inner = <><Icon name={it.icon} size={19} /><span className="rail-text">{compact ? it.short || it.label : it.label}</span>{it.count != null && <span className="rail-count" aria-label={it.count + ' new'}>{it.count}</span>}</>;
            if (it.disabled) return <span key={it.id} className="rail-row" aria-disabled="true" title={it.disabledReason}>{inner}</span>;
            return it.href ? <a key={it.id} href={it.href} className="rail-row" aria-current={cur ? 'page' : undefined} title={compact ? it.label : undefined} onClick={() => onNavigate && onNavigate(it.id)}>{inner}</a>
              : <button key={it.id} type="button" className="rail-row" aria-current={cur ? 'page' : undefined} title={compact ? it.label : undefined} onClick={() => onNavigate && onNavigate(it.id)}>{inner}</button>; })}
        </div>; })}
      {q && !groups.some((g) => g.items.some(match)) && <div className="rail-label">No match</div>}
      {foot && <div className="rail-foot">{foot}</div>}
    </nav>
  );
}
