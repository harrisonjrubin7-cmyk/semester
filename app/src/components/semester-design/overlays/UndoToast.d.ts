import * as React from 'react';
/** One-sentence confirmation with Undo for reversible work — instead of an "are you sure?" dialog. Auto-dismiss ≥ 6 s, paused on hover/focus. */
export interface UndoToastProps { message: string; onUndo?: () => void; undoLabel?: string; /** ms; clamped to at least 6000. Omit to stay until dismissed. */ duration?: number; onExpire?: () => void; onDismiss?: () => void; }
export declare function UndoToast(props: UndoToastProps): JSX.Element | null;
