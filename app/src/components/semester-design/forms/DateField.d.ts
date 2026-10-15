import * as React from 'react';
/** Native date/time input with the chosen date spoken back unambiguously. */
export interface DateFieldProps { label: string; hint?: string; value?: string; onChange?: (e: any) => void; withTime?: boolean; said?: string; }
export declare function DateField(props: DateFieldProps): JSX.Element;
