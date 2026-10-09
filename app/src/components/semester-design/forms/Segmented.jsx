import React from 'react';
/** 2–4 mutually exclusive choices (Cards / Rows / Timeline). Pass showLabel when no visible caption sits next to it, so sighted users see the question too.
 * Hardened: radiogroup keyboard model (one tab stop, arrows/Home/End move and select), disabled options skipped, falls back to the first enabled option when value is unknown. */
export function Segmented({ options = [], value, onChange, label, showLabel = false, disabled = false, size, fullWidth = false }) {
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const enabled = opts.filter((o) => !o.disabled && !disabled);
  const cur = opts.some((o) => o.value === value) ? value : enabled[0] && enabled[0].value;
  const refs = React.useRef({});
  const move = (dir, toEnd) => { if (!enabled.length) return; const i = enabled.findIndex((o) => o.value === cur); const n = toEnd === 'home' ? 0 : toEnd === 'end' ? enabled.length - 1 : (i + dir + enabled.length) % enabled.length; const v = enabled[n].value; if (onChange) onChange(v); const el = refs.current[v]; if (el) el.focus(); };
  const key = (e) => { const m = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (m) { e.preventDefault(); move(m); } else if (e.key === 'Home') { e.preventDefault(); move(0, 'home'); } else if (e.key === 'End') { e.preventDefault(); move(0, 'end'); } };
  const group = (
    <div className="seg" role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} data-size={size} data-full={fullWidth || undefined} onKeyDown={key}>
      {opts.map((o) => { const on = o.value === cur; const off = disabled || o.disabled; return <button key={o.value} ref={(el) => (refs.current[o.value] = el)} type="button" role="radio" aria-checked={on} tabIndex={on && !off ? 0 : -1} disabled={off} className="seg-opt" title={o.hint} onClick={() => !off && onChange && onChange(o.value)}>{o.label}</button>; })}
    </div>
  );
  if (!showLabel) return group;
  return <div className="seg-field"><span className="seg-label" aria-hidden="true">{label}</span>{group}</div>;
}
