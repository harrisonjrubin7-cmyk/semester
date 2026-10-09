import * as React from 'react';
export type ReadinessStateName = "ready_as_of" | "blocked" | "review_required" | "unknown" | "stale" | "handoff_pending" | "action_completed";
export interface ReadinessStateProps { state?: ReadinessStateName; label?: string; asOf?: string; source?: string; }
export declare function ReadinessState(props: ReadinessStateProps): JSX.Element;
