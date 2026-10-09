import * as React from 'react';
/** Bar chart that encodes provenance: solid official/connected, outline yours, hatched estimated/AI, dotted stale. Includes a hidden data table, empty state and optional target rule. */
export interface ProvenanceChartProps {
  title: string;
  rows: { id?: string; label: string; value: number | null; source?: 'official' | 'connected' | 'personal' | 'estimated' | 'ai' | 'stale' | string; note?: string }[];
  unit?: string; max?: number; source?: string; demo?: boolean;
  /** Draws a labelled vertical rule; never a red band. */
  target?: number; targetLabel?: string;
  sort?: 'asc' | 'desc';
  format?: (v: number) => string;
  emptyText?: string;
  /** One-sentence text summary shown above the bars. */
  summary?: string;
}
export declare function ProvenanceChart(props: ProvenanceChartProps): JSX.Element;
