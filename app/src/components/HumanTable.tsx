import './HumanTable.css';
import {
  createContext,
  useContext,
  useState,
  useMemo,
  useEffect,
  type ReactNode,
  type HTMLAttributes,
  type TdHTMLAttributes,
} from 'react';
import { useAccountId } from '../state/store';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import {
  EMPTY_TABLE_PREFERENCES,
  filterDictionary,
  ownFilter,
  readTablePreferences,
  retainTablePreferences,
  safeTableCsv,
  type TableCriteria,
  type TablePersistencePolicy,
} from '../lib/human-table';

/** Institutional roots supply tenant + authenticated viewer; no record IDs belong in the scope. */
export const HumanTableOwner = createContext<string | null>(null);
export interface HumanColumn<T> {
  id: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  cellProps?: (row: T) => TdHTMLAttributes<HTMLTableCellElement> | undefined;
  filter?: boolean;
  /** Explicit code-defined categories safe to save; record-derived values stay in memory. */
  persistFilterValues?: readonly string[];
  /** Keep actions/provenance in the concise view; other details remain reachable. */
  summary?: boolean;
  rowHeader?: boolean;
}
export interface HumanTableProps<T> {
  id: string;
  label: string;
  viewLabel?: string;
  rows: readonly T[];
  rowId: (row: T) => string;
  columns: readonly HumanColumn<T>[];
  /** Optional native card renderer receives only the filtered, authorized rows. */
  renderCards?: (rows: readonly T[]) => ReactNode;
  summaryPrimary?: (row: T) => boolean;
  rowProps?: (row: T) => HTMLAttributes<HTMLTableRowElement> | undefined;
  tableProps?: HTMLAttributes<HTMLTableElement>;
  caption?: ReactNode;
  defaultView?: TableCriteria['view'];
  /** Exact code-defined search choices safe to save. Free text is transient by default. */
  persistSearchValues?: readonly string[];
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
function OwnedHumanTable<T>({
  id,
  label,
  viewLabel,
  rows,
  rowId,
  columns,
  rowProps,
  renderCards,
  summaryPrimary,
  tableProps,
  caption,
  exportAllowed = true,
  exportReason,
  defaultView = 'table',
  persistSearchValues = [],
  owner,
}: HumanTableProps<T> & { owner: string }) {
  const empty = useMemo(
    () => ({ ...EMPTY_TABLE_PREFERENCES, current: { ...EMPTY_TABLE_PREFERENCES.current, view: defaultView } }),
    [defaultView],
  );
  const key = `semester.human-tables.v1:${encodeURIComponent(owner)}:${encodeURIComponent(id)}`;
  // Adapters may recreate columns each render; keep the validator stable for the same policy.
  const policyKey = JSON.stringify({
    searchValues: persistSearchValues,
    filters: columns
      .filter((c) => c.filter !== false && c.persistFilterValues)
      .map((c) => ({
        id: c.id,
        values: c.persistFilterValues,
      })),
  });
  const policy = useMemo(() => JSON.parse(policyKey) as TablePersistencePolicy, [policyKey]);
  const readPreferences = useMemo(() => (raw: unknown) => retainTablePreferences(readTablePreferences(raw), policy), [policy]);
  const prefs = useDeviceLibrary(key, readPreferences, empty, 150_000);
  const updatePreferences = prefs.update;
  useEffect(() => {
    // Migrate valid legacy preferences on disk too, including values in named views.
    // Malformed bytes remain blocked by the existing recovery contract.
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null && JSON.stringify(readPreferences(JSON.parse(raw))) !== raw) updatePreferences((old) => old);
    } catch {
      /* The library presents storage/read failures without destroying recovery data. */
    }
  }, [key, readPreferences, updatePreferences]);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [sessionCriteria, setSessionCriteria] = useState<TableCriteria | null>(null);
  const criteria = sessionCriteria ?? prefs.value.current;
  const retainedCriteria = retainTablePreferences({ current: criteria, saved: [] }, policy).current;
  const hasTransientCriteria =
    criteria.search !== retainedCriteria.search ||
    Object.entries(criteria.filters).some(([id, value]) => ownFilter(retainedCriteria.filters, id) !== value);
  const setCriteria = (patch: Partial<TableCriteria>) => {
    const next = { ...criteria, ...patch };
    setSessionCriteria(next);
    prefs.update((old) => ({ ...old, current: next }));
    setMessage('');
  };
  const value = (column: HumanColumn<T>, row: T) => String(column.value(row) ?? 'Not supplied');
  const visible = rows.filter(
    (row) =>
      columns.some((c) => value(c, row).toLocaleLowerCase().includes(criteria.search.toLocaleLowerCase())) &&
      columns.every(
        (c) => ownFilter(criteria.filters, c.id) === undefined || value(c, row) === ownFilter(criteria.filters, c.id),
      ),
  );
  const draw = (column: HumanColumn<T>, row: T) => (column.render ? column.render(row) : value(column, row));
  const fields = (row: T) => (
    <dl>
      {columns.map((c, i) => (
        <div key={c.id}>
          <dt>{c.label}</dt>
          <dd>
            {criteria.view === 'summary' && i > 1 && !c.summary ? (
              <details>
                <summary>Show {c.label}</summary>
                {draw(c, row)}
              </details>
            ) : (
              draw(c, row)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
  return (
    <section aria-label={label} data-human-table={id}>
      <div role="group" aria-label={viewLabel ?? `${label} view`}>
        {(['table', 'cards', 'summary'] as const).map((view) => (
          <button type="button" key={view} aria-pressed={criteria.view === view} onClick={() => setCriteria({ view })}>
            {view === 'cards' ? 'Card' : view === 'table' ? 'Table' : 'Summary'} view
          </button>
        ))}
      </div>
      <label>
        Search {label}
        <input type="search" maxLength={500} value={criteria.search} onChange={(e) => setCriteria({ search: e.target.value })} />
      </label>
      <details>
        <summary>Filter rows</summary>
        {columns
          .filter((c) => c.filter !== false)
          .map((c) => {
            const options = [...new Set(rows.map((row) => value(c, row)))].filter((v) => v.length <= 2000).sort();
            const selected = ownFilter(criteria.filters, c.id);
            return (
              <label key={c.id}>
                {c.label}
                <select
                  value={selected === undefined ? '' : JSON.stringify(selected)}
                  onChange={(e) => {
                    const filters = filterDictionary(criteria.filters);
                    if (e.target.value === '') delete filters[c.id];
                    else filters[c.id] = JSON.parse(e.target.value) as string;
                    setCriteria({ filters });
                  }}
                >
                  <option value="">All</option>
                  {selected !== undefined && !options.includes(selected) && (
                    <option value={JSON.stringify(selected)}>Selected value is no longer present</option>
                  )}
                  {options.map((option) => (
                    <option key={option} value={JSON.stringify(option)}>
                      {option || '(empty)'}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        <button type="button" onClick={() => setCriteria({ search: '', filters: filterDictionary() })}>
          Clear search and filters
        </button>
      </details>
      <details>
        <summary>Saved views</summary>
        <p>
          {policy.searchValues.length || policy.filters.length
            ? 'Layout and approved search/filter choices are saved on this device for this account. Other search and filter values stay in this session.'
            : 'Saved views keep the layout on this device for this account. Search and filters stay in this session.'}{' '}
          Use a view name without record details.
        </p>
        {hasTransientCriteria && (
          <p>This search or filter contains session-only values. They will not be included in a saved view.</p>
        )}
        <label>
          View name
          <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button
          type="button"
          disabled={
            !name.trim() ||
            prefs.blocked ||
            (prefs.value.saved.length >= 20 && !prefs.value.saved.some((v) => v.name === name.trim()))
          }
          onClick={() => {
            if (
              prefs.update((old) => ({
                ...old,
                saved: [...old.saved.filter((v) => v.name !== name.trim()), { name: name.trim(), criteria }],
              }))
            )
              setMessage(
                hasTransientCriteria ? 'View saved. Session-only search and filter values were left out.' : 'View saved.',
              );
          }}
        >
          Save view
        </button>
        <ul>
          {prefs.value.saved.map((saved) => (
            <li key={saved.name}>
              <button type="button" onClick={() => setCriteria(saved.criteria)}>
                Load {saved.name}
              </button>{' '}
              <button
                type="button"
                aria-label={`Delete view ${saved.name}`}
                onClick={() => prefs.update((old) => ({ ...old, saved: old.saved.filter((v) => v.name !== saved.name) }))}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </details>
      <button
        type="button"
        disabled={!exportAllowed || !visible.length}
        onClick={() =>
          download({
            name: `${id.replace(/[^a-z0-9-]/gi, '-')}-working-view.csv`,
            mime: 'text/csv',
            body: safeTableCsv([
              ['Working view — not an official signed record', label],
              columns.map((c) => c.label),
              ...visible.map((row) => columns.map((c) => value(c, row))),
            ]),
          })
        }
      >
        Download visible rows
      </button>
      {!exportAllowed && <p>{exportReason ?? 'Downloads are unavailable for this data.'}</p>}
      <p role="status">
        {visible.length} of {rows.length} rows. Working view; not an official signed record. {message}
      </p>
      {typeof window !== 'undefined' && prefs.error && <p role="alert">{prefs.error}</p>}
      {!visible.length ? (
        <p>No rows match this view.</p>
      ) : criteria.view === 'table' ? (
        <div data-table-scroll>
          <table {...tableProps} aria-label={label}>
            <caption>{caption ?? label}</caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.id} scope="col">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr {...rowProps?.(row)} key={rowId(row)}>
                  {columns.map((c, i) =>
                    c.rowHeader || (i === 0 && !columns.some((col) => col.rowHeader)) ? (
                      <th {...c.cellProps?.(row)} scope="row" key={c.id}>
                        {draw(c, row)}
                      </th>
                    ) : (
                      <td {...c.cellProps?.(row)} key={c.id}>
                        {draw(c, row)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : criteria.view === 'cards' && renderCards ? (
        <>
          {caption && <p>{caption}</p>}
          {renderCards(visible)}
        </>
      ) : (
        <>
          {caption && <p>{caption}</p>}
          <ul aria-label={`${label} ${criteria.view}`} style={{ listStyle: 'none', padding: 0 }}>
            {visible.map((row) => (
              <li key={rowId(row)}>
                <article aria-label={value(columns.find((c) => c.rowHeader) ?? columns[0], row)}>
                  <h3>{value(columns.find((c) => c.rowHeader) ?? columns[0], row)}</h3>
                  {criteria.view === 'summary' && summaryPrimary && !summaryPrimary(row) ? (
                    <details>
                      <summary>Show supporting detail</summary>
                      {fields(row)}
                    </details>
                  ) : (
                    fields(row)
                  )}
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
/** Adapter for dynamic matrices: values are explicitly supplied beside original React controls. */
export interface RecordCell {
  value: string | number | null | undefined;
  content?: ReactNode;
  props?: TdHTMLAttributes<HTMLTableCellElement>;
  header?: boolean;
  interactive?: boolean;
}
export interface TableRecord {
  id: string;
  cells: RecordCell[];
  props?: HTMLAttributes<HTMLTableRowElement> & { [key: `data-${string}`]: string | number | undefined };
}
export interface RecordColumn {
  id: string;
  label: string;
  filter?: boolean;
  /** Explicit code-defined categories safe to save; record-derived values stay in memory. */
  persistFilterValues?: readonly string[];
  summary?: boolean;
}
export function RecordTable({
  columns,
  ...props
}: Omit<HumanTableProps<TableRecord>, 'columns' | 'rowId' | 'rowProps'> & { columns: RecordColumn[] }) {
  return (
    <HumanTable<TableRecord>
      {...props}
      rowId={(r) => r.id}
      rowProps={(r) => r.props}
      columns={columns.map((c, i) => ({
        ...c,
        value: (r) => r.cells[i]?.value,
        render: (r) => r.cells[i]?.content ?? r.cells[i]?.value,
        cellProps: (r) => r.cells[i]?.props,
        rowHeader: props.rows.some((r) => r.cells[i]?.header),
        summary: c.summary || props.rows.some((r) => r.cells[i]?.interactive),
      }))}
    />
  );
}
/** Explicit display values supplied by adapters; never examines elements, DOM, or record objects. */
export type TableTextValue = string | number | boolean | null | undefined | readonly TableTextValue[];
export function tableText(value: TableTextValue): string {
  if (Array.isArray(value))
    return value
      .map((v) => tableText(v))
      .filter(Boolean)
      .join(' ');
  return value == null || value === false ? '' : String(value);
}
