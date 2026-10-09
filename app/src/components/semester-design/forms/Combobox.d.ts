import * as React from 'react';
/** Text box with a filtered listbox beneath — course search, people, rooms. */
export interface ComboboxProps { label: string; hint?: string; options: { label: string; detail?: string }[]; value?: string; onChange?: (q: string) => void; onSelect?: (o: any) => void; placeholder?: string; defaultOpen?: boolean; }
export declare function Combobox(props: ComboboxProps): JSX.Element;
