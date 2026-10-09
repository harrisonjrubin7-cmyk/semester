import * as React from 'react';
/**
 * Label/value definition list for records and context. Empty values say "Not recorded"; identifiers can be copied.
 */
export interface FieldsProps { items: { field: string; value: React.ReactNode; mono?: boolean; hint?: string; source?: string; copy?: boolean; emptyText?: string }[]; label?: string; layout?: 'grid' | 'stack'; emptyText?: string; }
export declare function Fields(props: FieldsProps): JSX.Element;
