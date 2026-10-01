/** Preferences contain criteria only. Records and rendered cells never enter this shape. */
export type HumanView = 'table' | 'cards' | 'summary';
export interface TableCriteria { view: HumanView; search: string; filters: Record<string, string> }
export interface SavedTableView { name: string; criteria: TableCriteria }
export interface TablePreferences { current: TableCriteria; saved: SavedTableView[] }
export const EMPTY_TABLE_PREFERENCES: TablePreferences = { current: { view: 'table', search: '', filters: {} }, saved: [] };
export function readTablePreferences(raw: unknown): TablePreferences {
  const criteria = (v: unknown): TableCriteria => {
    if (!v || typeof v !== 'object') throw new Error('Invalid table criteria');
    const r = v as Record<string, unknown>;
    if (!['table', 'cards', 'summary'].includes(String(r.view)) || typeof r.search !== 'string' || r.search.length > 500 || !r.filters || typeof r.filters !== 'object' || Array.isArray(r.filters)) throw new Error('Invalid table criteria');
    const filters: Record<string, string> = {};
    for (const [k, value] of Object.entries(r.filters)) {
      if (k.length > 200 || typeof value !== 'string' || value.length > 2000 || Object.keys(filters).length >= 100) throw new Error('Invalid table filter');
      Object.defineProperty(filters, k, {value, enumerable: true, writable: true, configurable: true});
    }
    return { view: r.view as HumanView, search: r.search, filters };
  };
  if (!raw || typeof raw !== 'object') throw new Error('Invalid table preferences');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.saved) || r.saved.length > 20) throw new Error('Invalid saved views');
  return { current: criteria(r.current), saved: r.saved.map(s => {
    if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80) throw new Error('Invalid view name');
    return { name: s.name, criteria: criteria(s.criteria) };
  }) };
}
/** Also protects leading whitespace/control characters and header cells. */
export function safeTableCsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(value => '"' + (/^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value).replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
}
