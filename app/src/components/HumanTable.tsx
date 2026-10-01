import { createContext, useContext, useState, type ReactNode, type HTMLAttributes, type TdHTMLAttributes } from 'react';
import { useAccountId } from '../state/store';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import { EMPTY_TABLE_PREFERENCES, readTablePreferences, safeTableCsv, type TableCriteria } from '../lib/human-table';

/** Institutional roots supply tenant + authenticated viewer; no record IDs belong in the scope. */
export const HumanTableOwner = createContext<string | null>(null);
export interface HumanColumn<T> {
  id: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  cellProps?: (row: T) => TdHTMLAttributes<HTMLTableCellElement>;
  filter?: boolean;
  /** Keep actions/provenance in the concise view; other details remain reachable. */
  summary?: boolean;
  rowHeader?: boolean;
}
export interface HumanTableProps<T> {
  id: string;
  label: string;
  rows: readonly T[];
  rowId: (row: T) => string;
  columns: readonly HumanColumn<T>[];
  rowProps?: (row: T) => HTMLAttributes<HTMLTableRowElement>;
  tableProps?: HTMLAttributes<HTMLTableElement>;
  caption?: ReactNode;
  /** Use the existing surface's export gate, independently of read permission. */
  exportAllowed?: boolean;
  exportReason?: string;
}
export function HumanTable<T>(props: HumanTableProps<T>) {
  const account = useAccountId();
  const scoped = useContext(HumanTableOwner);
  const owner = scoped ?? account ?? 'local-device';
  // Remount ephemeral names/messages too: never carry another owner's search across a switch.
  return <OwnedHumanTable key={`${owner}:${props.id}`} {...props} owner={owner} />;
}
function OwnedHumanTable<T>({ id, label, rows, rowId, columns, rowProps, tableProps, caption, exportAllowed = true, exportReason, owner }: HumanTableProps<T> & { owner: string }) {
  const prefs = useDeviceLibrary(`semester:human-tables:v1:${encodeURIComponent(owner)}:${encodeURIComponent(id)}`, readTablePreferences, EMPTY_TABLE_PREFERENCES, 150_000);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const criteria = prefs.value.current;
  const setCriteria = (patch: Partial<TableCriteria>) => prefs.update(old => ({ ...old, current: { ...old.current, ...patch } }));
  const value = (column: HumanColumn<T>, row: T) => String(column.value(row) ?? 'Not supplied');
  const visible = rows.filter(row => columns.some(c => value(c, row).toLocaleLowerCase().includes(criteria.search.toLocaleLowerCase())) && columns.every(c => !criteria.filters[c.id] || value(c, row) === criteria.filters[c.id]));
  const draw = (column: HumanColumn<T>, row: T) => column.render ? column.render(row) : value(column, row);
  return <section aria-label={label}>
    <div role="group" aria-label={`${label} view`}>
      {(['table', 'cards', 'summary'] as const).map(view => <button type="button" key={view} aria-pressed={criteria.view === view} onClick={() => setCriteria({ view })}>{view === 'cards' ? 'Card' : view === 'table' ? 'Table' : 'Summary'} view</button>)}
    </div>
    <label>Search {label}<input type="search" maxLength={500} value={criteria.search} onChange={e => setCriteria({ search: e.target.value })} /></label>
    <details><summary>Filter rows</summary>{columns.filter(c => c.filter !== false).map(c => {
      const options = [...new Set(rows.map(row => value(c, row)))].filter(v => v.length <= 2000).sort();
      return <label key={c.id}>{c.label}<select value={criteria.filters[c.id] ?? ''} onChange={e => setCriteria({ filters: { ...criteria.filters, [c.id]: e.target.value } })}><option value="">All</option>{criteria.filters[c.id] && !options.includes(criteria.filters[c.id]) && <option>{criteria.filters[c.id]}</option>}{options.map(option => <option key={option} value={option}>{option || '(empty)'}</option>)}</select></label>;
    })}<button type="button" onClick={() => setCriteria({search: '', filters: {}})}>Clear search and filters</button></details>
    <details><summary>Saved views</summary>
      <p>View, search and filters saved on this device for this account. Record contents are not saved.</p>
      <label>View name<input maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
      <button type="button" disabled={!name.trim() || prefs.blocked || (prefs.value.saved.length >= 20 && !prefs.value.saved.some(v => v.name === name.trim()))} onClick={() => {
        if (prefs.update(old => ({ ...old, saved: [...old.saved.filter(v => v.name !== name.trim()), { name: name.trim(), criteria: old.current }] }))) setMessage('View saved.');
      }}>Save view</button>
      <ul>{prefs.value.saved.map(saved => <li key={saved.name}><button type="button" onClick={() => prefs.update(old => ({ ...old, current: saved.criteria }))}>Load {saved.name}</button> <button type="button" aria-label={`Delete view ${saved.name}`} onClick={() => prefs.update(old => ({ ...old, saved: old.saved.filter(v => v.name !== saved.name) }))}>Delete</button></li>)}</ul>
    </details>
    <button type="button" disabled={!exportAllowed || !visible.length} onClick={() => download({ name: `${id.replace(/[^a-z0-9-]/gi, '-')}-working-view.csv`, mime: 'text/csv', body: safeTableCsv([['Working view — not an official signed record', label], columns.map(c => c.label), ...visible.map(row => columns.map(c => value(c, row)))]) })}>Download visible rows</button>
    {!exportAllowed && <p>{exportReason ?? 'Downloads are unavailable for this data.'}</p>}
    <p role="status">{visible.length} of {rows.length} rows. Working view; not an official signed record. {message}</p>
    {prefs.error && <p role="alert">{prefs.error}</p>}
    {!visible.length ? <p>No rows match this view.</p> : criteria.view === 'table' ? <table {...tableProps} aria-label={label}>
      <caption>{caption ?? label}</caption><thead><tr>{columns.map(c => <th key={c.id} scope="col">{c.label}</th>)}</tr></thead>
      <tbody>{visible.map(row => <tr {...rowProps?.(row)} key={rowId(row)}>{columns.map((c, i) => c.rowHeader || (i === 0 && !columns.some(col => col.rowHeader)) ? <th {...c.cellProps?.(row)} scope="row" key={c.id}>{draw(c, row)}</th> : <td {...c.cellProps?.(row)} key={c.id}>{draw(c, row)}</td>)}</tr>)}</tbody>
    </table> : <>{caption && <p>{caption}</p>}<ul aria-label={`${label} ${criteria.view}`} style={{listStyle: 'none', padding: 0}}>{visible.map(row => <li key={rowId(row)}><article aria-label={value(columns.find(c => c.rowHeader) ?? columns[0], row)}><h3>{value(columns.find(c => c.rowHeader) ?? columns[0], row)}</h3><dl>{columns.map((c, i) => <div key={c.id}><dt>{c.label}</dt><dd>{criteria.view === 'summary' && i > 1 && !c.summary ? <details><summary>Show {c.label}</summary>{draw(c, row)}</details> : draw(c, row)}</dd></div>)}</dl></article></li>)}</ul></>}
  </section>;
}
/** Adapter for dynamic matrices: values are explicitly supplied beside original React controls. */
export interface RecordCell { value: string | number | null | undefined; content?: ReactNode; props?: TdHTMLAttributes<HTMLTableCellElement>; header?: boolean; interactive?: boolean }
export interface TableRecord { id: string; cells: RecordCell[]; props?: HTMLAttributes<HTMLTableRowElement> }
export interface RecordColumn { id: string; label: string; filter?: boolean; summary?: boolean }
export function RecordTable({ columns, ...props }: Omit<HumanTableProps<TableRecord>, 'columns' | 'rowId' | 'rowProps'> & { columns: RecordColumn[] }) {
  return <HumanTable {...props} rowId={r => r.id} rowProps={r => r.props} columns={columns.map((c, i) => ({ ...c, value: r => r.cells[i]?.value, render: r => r.cells[i]?.content ?? r.cells[i]?.value, cellProps: r => r.cells[i]?.props, rowHeader: props.rows.some(r => r.cells[i]?.header), summary: c.summary || props.rows.some(r => r.cells[i]?.interactive) }))} />;
}
