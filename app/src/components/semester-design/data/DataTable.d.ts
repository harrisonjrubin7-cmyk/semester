import * as React from 'react';
/**
 * Crisp comparison table with caps headers, hairline rows, tabular numerals. Optional sorting, row headers, loading/empty/error states.
 * @startingPoint section="Data" subtitle="Crisp comparison table with caps headers, hairline rows, tabular numerals." viewport="700x400"
 */
export interface DataTableProps {
  columns: DataTableColumn[]; rows: any[]; caption?: string;
  /** Field used as the React key; falls back to index. Default 'id'. */
  rowKey?: string;
  /** Column key rendered as <th scope="row">. */
  rowHeader?: string;
  /** Make plain-value columns sortable (rendered columns need sortValue). */
  sortable?: boolean; defaultSort?: { key: string; dir: 'asc' | 'desc' };
  state?: 'ready' | 'loading' | 'error'; emptyText?: string; errorText?: string; onRetry?: () => void;
  density?: 'comfortable' | 'snug' | 'tight'; footnote?: React.ReactNode;
}
export interface DataTableColumn { key: string; label: string; numeric?: boolean; render?: (row: any) => React.ReactNode; sortable?: boolean; sortValue?: (row: any) => string | number; width?: string | number; }
export declare function DataTable(props: DataTableProps): JSX.Element;
