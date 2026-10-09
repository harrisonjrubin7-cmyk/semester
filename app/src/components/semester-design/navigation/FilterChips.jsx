import React from 'react';
/** Toggleable filters above a list or table. Selected state uses ✓ + weight, not colour alone.
 * Hardened: single-select mode (radio semantics), zero-count options disabled unless already on, live result count, Clear says how many it clears, ids kept stable for string options. */
export function FilterChips({ options = [], selected = [], onToggle, label = 'Filters', onClear, single = false, resultCount, disableEmpty = true }) {
  const opts = options.map((o) => (typeof o === 'string' ? { id: o, label: o } : o));
  return (
    <div className="filters" role={single ? 'radiogroup' : 'group'} aria-label={label}>
      {opts.map((o) => { const on = selected.includes(o.id); const off = o.disabled || (disableEmpty && o.count === 0 && !on);
        return <button key={o.id} type="button" className="filter-chip" role={single ? 'radio' : undefined} aria-checked={single ? on : undefined} aria-pressed={single ? undefined : on} disabled={off} onClick={() => !off && onToggle && onToggle(o.id)}>{on && <span aria-hidden="true">✓</span>}{o.label}{o.count != null && <span className="tab-count" aria-label={'(' + o.count + ')'}>{o.count}</span>}</button>; })}
      {onClear && selected.length > 0 && <button type="button" className="link-quiet" onClick={onClear}>Clear {selected.length > 1 ? selected.length + ' filters' : 'filter'}</button>}
      {resultCount != null && <span className="filters-count" role="status" aria-live="polite">{resultCount} {resultCount === 1 ? 'result' : 'results'}</span>}
    </div>
  );
}
