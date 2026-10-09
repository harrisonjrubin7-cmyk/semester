import * as React from 'react';
export type ConnectionStateName = "confirmed" | "pending" | "updating" | "stale" | "blocked" | "degraded" | "reconcile" | "resolved";
export interface ConnectionStateProps { state?: ConnectionStateName; label?: string; detail?: string; source?: string; }
export declare function ConnectionState(props: ConnectionStateProps): JSX.Element;
export interface ConnectionLineProps { items: ConnectionStateProps[]; }
export declare function ConnectionLine(props: ConnectionLineProps): JSX.Element;
