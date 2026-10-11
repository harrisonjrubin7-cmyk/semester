import * as React from 'react';
/**
 * A determinate wait (upload, import) with real <progress>, percentage in words, Cancel/Retry.
 */
export interface ProgressStateProps { label: string; done?: number; total?: number; note?: string; failed?: string; onCancel?: () => void; onRetry?: () => void; }
export declare function ProgressState(props: ProgressStateProps): JSX.Element;
