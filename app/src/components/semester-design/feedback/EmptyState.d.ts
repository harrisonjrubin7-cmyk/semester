import * as React from 'react';
/**
 * Explains why a list is empty and offers one relevant next action.
 * @startingPoint section="States" subtitle="Explains why a list is empty and offers one relevant next action." viewport="700x400"
 */
export interface EmptyStateProps { title?: string; body?: string; action?: React.ReactNode; /** Why it is empty; sets a default title. */ kind?: 'first' | 'filtered' | 'cleared' | 'restricted' | 'error'; onClearFilters?: () => void; level?: 2 | 3 | 4; /** Announce when it replaces content. */ live?: boolean; icon?: React.ReactNode; }
export declare function EmptyState(props: EmptyStateProps): JSX.Element;
