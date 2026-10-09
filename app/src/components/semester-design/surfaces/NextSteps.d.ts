import * as React from 'react';
/**
 * Ordered list of next safe actions, each with one line of why. Done and blocked steps are non-interactive and say so.
 */
export interface NextStepsProps { steps: { id?: string; label: string; why?: string; icon?: string; aside?: React.ReactNode; onClick?: () => void; href?: string; done?: boolean; blocked?: boolean; blockedReason?: string }[]; label?: string; hideDone?: boolean; max?: number; emptyText?: string; }
export declare function NextSteps(props: NextStepsProps): JSX.Element;
