import React from 'react';
/** In-page tabs for switching views of one object. Count is optional; current tab gets a 2px underline + weight.
 * When the row overflows, the selected tab is scrolled into view horizontally (never scrollIntoView). Use 7 tabs or fewer; group beyond that.
 * Hardened: WAI-ARIA tabs keyboard model (one tab stop, arrows/Home/End), aria-controls wiring via idBase, disabled tabs skipped, unknown current falls back to the first tab, counts announced. */
export function Tabs({ items = [], current, onChange, label = 'Views', idBase, manual = false }) {
  const ref = React.useRef(null); const refs = React.useRef({});
  const enabled = items.filter((i) => !i.disabled);
  const cur = items.some((i) => i.id === current && !i.disabled) ? current : enabled[0] && enabled[0].id;
  const [focusId, setFocusId] = React.useState(cur);
  const activeFocusId = enabled.some((item) => item.id === focusId) ? focusId : cur;
  React.useEffect(() => {
    const tl = ref.current; if (!tl || tl.scrollWidth <= tl.clientWidth) return;
    const s = tl.querySelector('[aria-selected="true"]'); if (!s) return;
    tl.scrollLeft = Math.max(0, s.offsetLeft - tl.offsetLeft - tl.clientWidth / 2 + s.offsetWidth / 2);
  }, [cur, items.length]);
  const go = (id) => { setFocusId(id); const el = refs.current[id]; if (el) el.focus(); if (!manual && onChange) onChange(id); };
  const key = (e) => { if (!enabled.length) return; const i = Math.max(0, enabled.findIndex((t) => t.id === activeFocusId)); let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % enabled.length; else if (e.key === 'ArrowLeft') n = (i - 1 + enabled.length) % enabled.length; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = enabled.length - 1;
    else if ((e.key === 'Enter' || e.key === ' ') && manual) { e.preventDefault(); if (onChange) onChange(activeFocusId); return; }
    if (n !== null) { e.preventDefault(); go(enabled[n].id); } };
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={key}>
      {items.map((it) => { const sel = it.id === cur; return <button key={it.id} ref={(el) => (refs.current[it.id] = el)} type="button" role="tab" id={idBase ? idBase + '-tab-' + it.id : undefined} aria-controls={idBase ? idBase + '-panel-' + it.id : undefined} aria-selected={sel} tabIndex={it.id === activeFocusId ? 0 : -1} disabled={it.disabled} className="tab" onClick={() => { if (!it.disabled && onChange) onChange(it.id); }}>{it.label}{it.count != null && <span className="tab-count" aria-label={'(' + it.count + ')'}>{it.count}</span>}</button>; })}
    </div>
  );
}
/** Pairs with Tabs idBase: renders the panel with the matching ids and aria-labelledby. */
export function TabPanel({ idBase, id, current, children }) {
  return <div role="tabpanel" id={idBase + '-panel-' + id} aria-labelledby={idBase + '-tab-' + id} hidden={current !== id} tabIndex={0}>{current === id ? children : null}</div>;
}
