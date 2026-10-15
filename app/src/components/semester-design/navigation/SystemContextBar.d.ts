import * as React from 'react';
/**
 * Persistent top bar: location, term, ⌘K search, sync state, quiet tools.
 */
export interface SystemContextBarProps { location?: string; term?: string; sync?: string; onSearch?: () => void; actions?: React.ReactNode; }
export declare function SystemContextBar(props: SystemContextBarProps): JSX.Element;
