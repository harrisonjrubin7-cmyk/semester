import * as React from 'react';
/**
 * The object a screen is about, with its id, source, states and actions. Optional back link and sticky mode.
 */
export interface ContextBarProps { kicker?: string; title: string; states?: React.ReactNode; actions?: React.ReactNode; id?: string; source?: React.ReactNode; sticky?: boolean; level?: 1 | 2 | 3; back?: { label: string; href?: string; onClick?: () => void }; }
export declare function ContextBar(props: ContextBarProps): JSX.Element;
