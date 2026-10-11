import * as React from 'react';
/**
 * 2–4 mutually exclusive choices (e.g. Cards / Rows / Timeline). Keyboard: one tab stop, arrows/Home/End select.
 * label is always the accessible name; showLabel also renders it visibly above the group.
 */
export interface SegmentedProps { options: (string | { value: string; label: string; disabled?: boolean; hint?: string })[]; value: string; onChange?: (v: string) => void; label: string; showLabel?: boolean; disabled?: boolean; size?: 'sm' | 'md'; fullWidth?: boolean; }
export declare function Segmented(props: SegmentedProps): JSX.Element;
