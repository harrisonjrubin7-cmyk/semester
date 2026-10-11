import * as React from 'react';
/** One figure worth reading first, with unit, kind, period, denominator, source and age. States: loading, unavailable, stale. */
export interface MetricTileProps {
  label: string;
  /** string or number; numbers are locale-formatted. null/undefined/NaN renders the unavailable state. */
  value?: string | number | null;
  unit?: string; source?: string; updated?: string; delta?: string;
  /** Labels the figure so targets and estimates are never read as actuals. */
  kind?: 'actual' | 'target' | 'estimate' | 'projection';
  period?: string; denominator?: string;
  state?: 'ready' | 'loading';
  /** Shown when value is unavailable. */
  reason?: string;
  stale?: boolean;
  href?: string; onClick?: () => void; locale?: string; help?: string;
}
export declare function MetricTile(props: MetricTileProps): JSX.Element;
