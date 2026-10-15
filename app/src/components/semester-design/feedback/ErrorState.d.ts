import * as React from 'react';
/**
 * Plain-language failure with a required recovery action and an optional support reference.
 */
export interface ErrorStateProps { title: string; body: string; recoverLabel?: string; onRecover?: () => void; secondaryLabel?: string; onSecondary?: () => void; reference?: string; }
export declare function ErrorState(props: ErrorStateProps): JSX.Element;
