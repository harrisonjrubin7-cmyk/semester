import { cell as csvCell } from './gradebook/views';

/** Working criteria can contain record values; persistence must apply an explicit allowlist. */
export type HumanView = 'table' | 'cards' | 'summary';
export interface TableCriteria {
  view: HumanView;
  search: string;
  filters: Record<string, string>;
}
export interface SavedTableView {
  name: string;
  criteria: TableCriteria;
}
export interface TablePreferences {
  current: TableCriteria;
  saved: SavedTableView[];
}
/** Arbitrary source headings, including __proto__, are valid column identifiers. */
export const filterDictionary = (values?: Record<string, string>): Record<string, string> =>
  Object.assign(Object.create(null) as Record<string, string>, values);
export const ownFilter = (filters: Record<string, string>, id: string): string | undefined =>
  Object.hasOwn(filters, id) ? filters[id] : undefined;
export const EMPTY_TABLE_PREFERENCES: TablePreferences = {
  current: { view: 'table', search: '', filters: filterDictionary() },
  saved: [],
};
/** Only code-defined categorical values belong here, never values harvested from records. */
export interface TablePersistencePolicy {
  searchValues: readonly string[];
  filters: readonly { id: string; values: readonly string[] }[];
}
export function retainTablePreferences(prefs: TablePreferences, policy: TablePersistencePolicy): TablePreferences {
  const retain = (criteria: TableCriteria): TableCriteria => {
    const filters = filterDictionary();
    for (const column of policy.filters) {
      const value = ownFilter(criteria.filters, column.id);
      if (value !== undefined && column.values.includes(value)) filters[column.id] = value;
    }
    return {
      view: criteria.view,
      search: policy.searchValues.includes(criteria.search) ? criteria.search : '',
      filters,
    };
  };
  return { current: retain(prefs.current), saved: prefs.saved.map((view) => ({ ...view, criteria: retain(view.criteria) })) };
}
export function readTablePreferences(raw: unknown): TablePreferences {
  const criteria = (v: unknown): TableCriteria => {
    if (!v || typeof v !== 'object') throw new Error('Invalid table criteria');
    const r = v as Record<string, unknown>;
    if (
      !['table', 'cards', 'summary'].includes(String(r.view)) ||
      typeof r.search !== 'string' ||
      r.search.length > 500 ||
      !r.filters ||
      typeof r.filters !== 'object' ||
      Array.isArray(r.filters)
    )
      throw new Error('Invalid table criteria');
    const filters = filterDictionary();
    for (const [k, value] of Object.entries(r.filters)) {
      if (k.length > 200 || typeof value !== 'string' || value.length > 2000 || Object.keys(filters).length >= 100)
        throw new Error('Invalid table filter');
      Object.defineProperty(filters, k, { value, enumerable: true, writable: true, configurable: true });
    }
    return { view: r.view as HumanView, search: r.search, filters };
  };
  if (!raw || typeof raw !== 'object') throw new Error('Invalid table preferences');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.saved) || r.saved.length > 20) throw new Error('Invalid saved views');
  return {
    current: criteria(r.current),
    saved: r.saved.map((s) => {
      if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80) throw new Error('Invalid view name');
      return { name: s.name, criteria: criteria(s.criteria) };
    }),
  };
}
/** Also protects leading whitespace/control characters and header cells. */
export function safeTableCsv(rows: readonly (readonly string[])[]): string {
  return (
    rows
      .map((row) => row.map((value) => csvCell(/^[\s\p{Cc}]*[=+@-]/u.test(value) ? "'" + value : value)).join(','))
      .join('\r\n') + '\r\n'
  );
}
