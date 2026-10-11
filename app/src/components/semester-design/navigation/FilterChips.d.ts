import * as React from 'react';
/** Toggleable filters with ✓ + weight; optional single-select, disabled zero-count options, live result count. */
export type FilterOption = string | { id: string; label: string; count?: number; disabled?: boolean };
export interface FilterChipsProps { options: FilterOption[]; selected?: string[]; onToggle?: (id: string) => void; label?: string; onClear?: () => void; single?: boolean; resultCount?: number; disableEmpty?: boolean; }
export declare function FilterChips(props: FilterChipsProps): JSX.Element;
