import * as React from 'react';
/**
 * Native select drawn in Semester's palette, with placeholder, error, required, disabled options and groups.
 */
export type SelectOption = string | { value: string; label: string; disabled?: boolean };
export interface SelectProps { label: string; hint?: string; error?: string; options?: SelectOption[]; groups?: { label: string; options: SelectOption[] }[]; placeholder?: string; required?: boolean; value?: string; defaultValue?: string; onChange?: (e: any) => void; id?: string; disabled?: boolean; name?: string; }
export declare function Select(props: SelectProps): JSX.Element;
