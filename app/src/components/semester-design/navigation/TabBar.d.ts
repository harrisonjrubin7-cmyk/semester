import * as React from 'react';
/**
 * Mobile bottom navigation for the five canonical destinations, always labelled.
 */
export interface TabBarProps { items: { id: string; label: string; icon: string }[]; current?: string; onNavigate?: (id: string) => void; }
export declare function TabBar(props: TabBarProps): JSX.Element;
