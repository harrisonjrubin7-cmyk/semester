import * as React from 'react';
/**
 * Modal confirmation — focus lands on Cancel, Tab trapped, Escape closes, focus returns. Busy blocks double submits; confirmText adds type-to-confirm; error keeps it open.
 */
export interface DialogProps { open?: boolean; title: string; children?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; onCancel?: () => void; destructive?: boolean; inline?: boolean; busy?: boolean; error?: string; /** Exact text the person must type, for irreversible actions. */ confirmText?: string; description?: string; }
export declare function Dialog(props: DialogProps): JSX.Element | null;
