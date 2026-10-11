import * as React from 'react';
/**
 * Respectful acknowledgement that points at what is next — no confetti, streaks or ranks.
 */
export interface SuccessStateProps { title: string; body?: string; nextLabel?: string; onNext?: () => void; }
export declare function SuccessState(props: SuccessStateProps): JSX.Element;
