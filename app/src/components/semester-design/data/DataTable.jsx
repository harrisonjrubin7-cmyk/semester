import React from 'react';
const cmp = (a, b) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' }));
/** Crisp comparison table. Use only when comparing columns; the region (not the page) scrolls on compact screens.
 * Hardened: optional client sorting (aria-sort on headers), row headers, empty/loading/error states, stable keys, missing cells shown as an em dash. */
export function DataTable({ columns = [], rows = [], caption, rowKey = 'id', rowHeader, sortable = false, defaultSort, state, emptyText = 'Nothing to show yet', errorText = 'Couldn’t load this table', onRetry, density, footnote }) {
  const [sort, setSort] = React.useState(defaultSort || null);
  const keyed = rows.map((r, i) => ({ r, k: (r && r[rowKey]) ?? i }));
  const col = sort && columns.find((c) => c.key === sort.key);
  const list = col ? [...keyed].sort((a, b) => (sort.dir === 'desc' ? -1 : 1) * cmp(col.sortValue ? col.sortValue(a.r) : a.r[col.key], col.sortValue ? col.sortValue(b.r) : b.r[col.key])) : keyed;
  const canSort = (c) => (c.sortable ?? sortable) && !c.render || (c.sortable && c.sortValue);
  const toggle = (c) => setSort((s) => (s && s.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: 'asc' }));
  const cell = (c, r) => { const v = c.render ? c.render(r) : r[c.key]; return v === null || v === undefined || v === '' ? <span aria-label="Not recorded" style={{ color: 'var(--text-tertiary)' }}>—</span> : v; };
  const span = Math.max(1, columns.length);
  return (
    <div className="table-wrap" role="region" aria-label={caption || 'Table'} aria-busy={state === 'loading' || undefined} tabIndex={0} data-density={density}>
      <table className="table">
        {caption && <caption className="sr-only">{caption}{col ? ', sorted by ' + col.label + (sort.dir === 'desc' ? ' descending' : ' ascending') : ''}</caption>}
        <thead><tr>{columns.map((c) => { const s = canSort(c); const on = sort && sort.key === c.key; return <th key={c.key} className={c.numeric ? 'num' : undefined} scope="col" aria-sort={s ? (on ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none') : undefined} style={c.width ? { width: c.width } : undefined}>{s ? <button type="button" className="th-sort" onClick={() => toggle(c)}>{c.label}<span aria-hidden="true" className="th-sort-ind">{on ? (sort.dir === 'desc' ? '↓' : '↑') : '↕'}</span></button> : c.label}</th>; })}</tr></thead>
        <tbody>
          {state === 'loading' ? [0, 1, 2].map((i) => <tr key={'sk' + i} aria-hidden="true">{columns.map((c) => <td key={c.key}><span className="skeleton" style={{ display: 'block', height: 12, width: c.numeric ? '40%' : '70%', marginLeft: c.numeric ? 'auto' : 0 }}></span></td>)}</tr>)
            : state === 'error' ? <tr><td colSpan={span} className="table-state" role="alert">{errorText}{onRetry && <> · <button type="button" className="btn-link" onClick={onRetry}>Try again</button></>}</td></tr>
            : !list.length ? <tr><td colSpan={span} className="table-state">{emptyText}</td></tr>
            : list.map(({ r, k }) => <tr key={k}>{columns.map((c) => { const head = rowHeader ? c.key === rowHeader : false; const Tag = head ? 'th' : 'td'; return <Tag key={c.key} scope={head ? 'row' : undefined} className={c.numeric ? 'num' : undefined}>{cell(c, r)}</Tag>; })}</tr>)}
        </tbody>
      </table>
      {footnote && <div className="table-foot">{footnote}</div>}
    </div>
  );
}
