import * as React from 'react';
/**
 * Auditable timeline of who did what, when, and under which authority. State words always shown for non-done steps.
 */
export interface DecisionTrailItem { id?: string; title: string; who?: string; when?: string; datetime?: string; authority?: string; detail?: string; evidence?: string; state?: "done" | "current" | "waiting" | "blocked" | "failed" | "skipped" | "reversed"; }
export interface DecisionTrailProps { items: DecisionTrailItem[]; label?: string; order?: 'oldest' | 'newest'; emptyText?: string; compact?: boolean; }
export declare function DecisionTrail(props: DecisionTrailProps): JSX.Element;
