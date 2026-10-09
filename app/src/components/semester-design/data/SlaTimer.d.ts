import * as React from 'react';
/** Time left on a service-level target. Give remaining+state, or a due timestamp to compute both. */
export interface SlaTimerProps { remaining?: string; target?: string; state?: "ok" | "soon" | "breach" | "met" | "none"; paused?: boolean; pausedReason?: string; due?: string | number | Date; soonWithinMinutes?: number; met?: boolean; metAt?: string; now?: number; }
export declare function SlaTimer(props: SlaTimerProps): JSX.Element;
