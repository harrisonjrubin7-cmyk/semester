import * as React from 'react';
/** Row of 2–5 labelled starting actions for empty and onboarding states. */
export interface QuickActionsProps { actions: { label: string; icon?: string; onClick?: () => void }[]; }
export declare function QuickActions(props: QuickActionsProps): JSX.Element;
