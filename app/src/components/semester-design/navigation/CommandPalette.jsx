import React, { useState } from 'react';
import { Icon } from '../core/Icon.jsx';
/** Global search + command palette. Arrow keys move an edge + weight, not colour alone. */
export function CommandPalette({ groups = [], placeholder = 'Search Semester or type a command', onSelect }) {
  const [q, setQ] = useState(''); const [sel, setSel] = useState(0);
  const flat = []; const shown = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())) })).filter((g) => g.items.length);
  shown.forEach((g) => g.items.forEach((i) => flat.push(i)));
  const key = (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(flat.length - 1, s + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } if (e.key === 'Enter' && flat[sel] && onSelect) onSelect(flat[sel]); };
  let n = -1;
  return (
    <div className="palette" role="dialog" aria-label="Command palette">
      <div className="palette-input"><Icon name="search" size={19} style={{ color: 'var(--text-secondary)' }} /><input value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={key} placeholder={placeholder} aria-label={placeholder} /><span className="kbd">esc</span></div>
      <div role="listbox">
        {shown.map((g) => (
          <div className="palette-group" key={g.label} role="group" aria-label={g.label}>
            <div className="palette-group-label">{g.label}</div>
            {g.items.map((it) => { n++; const i = n; return (
              <button key={it.label} type="button" role="option" aria-selected={i === sel} className="palette-option" onMouseEnter={() => setSel(i)} onClick={() => onSelect && onSelect(it)}>
                {it.icon && <Icon name={it.icon} size={17} style={{ color: 'var(--text-secondary)' }} />}<span>{it.label}</span>{it.detail && <span className="palette-option-detail">{it.detail}</span>}
              </button>); })}
          </div>
        ))}
        {flat.length === 0 && <div style={{ padding: 'var(--sp-7)', color: 'var(--text-secondary)', fontSize: 'var(--type-sm)' }}>Nothing matches “{q}”. Try a course code, a person, or “ask”.</div>}
      </div>
      <div className="palette-foot"><span><span className="kbd">↑</span> <span className="kbd">↓</span> move</span><span><span className="kbd">↵</span> open</span><span>Results respect your privacy settings</span></div>
    </div>
  );
}
