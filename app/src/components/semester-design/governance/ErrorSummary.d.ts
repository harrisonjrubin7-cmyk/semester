import * as React from 'react';
/** Form error summary that takes focus when errors appear; each error links to and focuses its field. Field-less errors render as text. */
export interface ErrorSummaryProps { errors: { field?: string; message: string }[]; title?: string; autoFocus?: boolean; onFieldFocus?: (field: string) => void; }
export declare const ErrorSummary: (props: ErrorSummaryProps & { ref?: any }) => JSX.Element | null;
