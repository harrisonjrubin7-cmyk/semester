import React, { useId, useState } from 'react';
/** Text box with a filtered list beneath — course search, people, rooms. Arrow keys move an edge + weight, not colour alone. */
export function Combobox({ label, hint, options = [], value = '', onChange, onSelect, placeholder, defaultOpen = false }) {
  const id = useId(); const [q, setQ] = useState(value); const [open, setOpen] = useState(defaultOpen); const [sel, setSel] = useState(0);
  const shown = options.filter((o) => (o.label + ' ' + (o.detail || '')).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const pick = (o) => { setQ(o.label); setOpen(false); if (onSelect) onSelect(o); };
  return (
    <div className="combo">
      <label className="field-label" htmlFor={id}>{label}</label>
      {hint && <span className="field-hint">{hint}</span>}
      <input id={id} className="input" role="combobox" aria-expanded={open} aria-controls={id + '-list'} aria-autocomplete="list" value={q} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setSel(0); if (onChange) onChange(e.target.value); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(shown.length - 1, s + 1)); } if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } if (e.key === 'Enter' && shown[sel]) pick(shown[sel]); if (e.key === 'Escape') setOpen(false); }} />
      {open && shown.length > 0 && (
        <ul className="combo-list" id={id + '-list'} role="listbox">
          {shown.map((o, i) => <li key={o.label} role="option" aria-selected={i === sel} className="combo-option" onMouseEnter={() => setSel(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }}>{o.label}{o.detail && <span className="combo-detail">{o.detail}</span>}</li>)}
        </ul>
      )}
    </div>
  );
}
