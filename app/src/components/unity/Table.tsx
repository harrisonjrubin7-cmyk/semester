import type { ReactNode } from 'react';

/**
 * A table, when the task is comparing columns.
 *
 * `DESIGN-SYSTEM-GUIDE.md` says use a list when the dominant job is scanning
 * or acting on rows, and a table only when comparing columns; thirty files
 * wrote their own `<table>` and agreed on neither the caption, the headers nor
 * what happens at 320px. This is the agreed one. It is a real `<table>`:
 * caption, `scope`, a row header, `aria-sort` on the column that is sorted.
 *
 * ## Width changes how a row is reached, never whether
 *
 * (`widthgate.test.ts`.) So there is no column "priority" that drops columns on
 * a phone — hiding a cell is hiding data. Two ways to fit, and both keep every
 * cell:
 *
 * - `scroll` (default): the table keeps its columns and scrolls sideways inside
 *   its own region, not the page. The region is focusable and named, so a
 *   keyboard user can scroll it without a mouse.
 * - `stack`: under the tablet edge each row becomes a labelled block, one line
 *   per column, the header repeated on every cell. Use it when a row is a
 *   record someone reads rather than compares. The roles are written out in
 *   this mode because turning a table into blocks with CSS makes some screen
 *   readers stop calling it a table.
 *
 * ## Sorting is the caller's
 *
 * The table shows the sort it is given and reports a request; it never
 * reorders `rows`. Whoever owns the data owns the order, and says the result
 * (`useStore().say`) the way every other outcome in the app is said — this
 * file does not carry a second live region.
 *
 * Not here yet, deliberately: row selection and virtualisation. Nothing in the
 * app needs either, and a prop nobody passes is a promise nobody has tested.
 */
export interface Column<Row> {
  id: string;
  /** Plain text: it is also the label repeated on each cell when stacked. */
  header: string;
  cell: (row: Row) => ReactNode;
  /** Right-aligned, tabular figures. */
  numeric?: boolean;
  sortable?: boolean;
  /** Draw this column's cell as the row's `<th scope="row">`. At most one. */
  rowHeader?: boolean;
}

export interface SortState {
  id: string;
  dir: 'ascending' | 'descending';
}

export function Table<Row>({
  caption,
  captionHidden = false,
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  compact = 'scroll',
  empty,
}: {
  caption: string;
  /** Hide the caption visually; it is still the table's name. */
  captionHidden?: boolean;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  sort?: SortState | null;
  /** The reader asked to sort by this column. The caller decides direction and reorders. */
  onSort?: (columnId: string) => void;
  compact?: 'scroll' | 'stack';
  /** Required: a table with nothing in it explains why and offers a next step. */
  empty: ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;

  const stacked = compact === 'stack';
  const table = (
    <table className={`integration-table table-ui${stacked ? ' table-stack' : ''}`} role={stacked ? 'table' : undefined}>
      <caption className={captionHidden ? 'sr-only' : 'table-caption'}>{caption}</caption>
      <thead role={stacked ? 'rowgroup' : undefined}>
        <tr role={stacked ? 'row' : undefined}>
          {columns.map((c) => {
            const sorted = sort?.id === c.id ? sort.dir : undefined;
            return (
              <th
                key={c.id}
                scope="col"
                role={stacked ? 'columnheader' : undefined}
                aria-sort={c.sortable ? (sorted ?? 'none') : undefined}
                data-numeric={c.numeric ? '' : undefined}
              >
                {c.sortable && onSort ? (
                  <button type="button" className="bare table-sort tap" onClick={() => onSort(c.id)}>
                    {c.header}
                    <span className="table-sort-mark" aria-hidden="true">
                      {sorted === 'ascending' ? '▲' : sorted === 'descending' ? '▼' : '↕'}
                    </span>
                  </button>
                ) : (
                  c.header
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody role={stacked ? 'rowgroup' : undefined}>
        {rows.map((row) => (
          <tr key={rowKey(row)} role={stacked ? 'row' : undefined}>
            {columns.map((c) =>
              c.rowHeader ? (
                <th key={c.id} scope="row" role={stacked ? 'rowheader' : undefined} data-label={c.header}>
                  {c.cell(row)}
                </th>
              ) : (
                <td key={c.id} role={stacked ? 'cell' : undefined} data-label={c.header} data-numeric={c.numeric ? '' : undefined}>
                  {c.cell(row)}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (stacked) return table;
  // The scroll region: named and focusable, or a keyboard cannot move it (axe: scrollable-region-focusable).
  return (
    <div className="integration-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      {table}
    </div>
  );
}
