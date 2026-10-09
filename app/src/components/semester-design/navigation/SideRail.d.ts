import * as React from 'react';
/**
 * Desktop side rail on dark Ink chrome — persistent, quiet, labelled.
 * @startingPoint section="Navigation" subtitle="Desktop side rail on dark Ink chrome — persistent, quiet, labelled." viewport="700x400"
 */
export interface SideRailProps { groups: { label?: string; items: { id: string; label: string; short?: string; icon: string; count?: number; href?: string; disabled?: boolean; disabledReason?: string }[] }[]; current?: string; onNavigate?: (id: string) => void; foot?: React.ReactNode; brand?: boolean; label?: string; compact?: boolean; /** 'auto' shows a filter past 12 items. */ filter?: boolean | 'auto'; collapsible?: boolean; }
export declare function SideRail(props: SideRailProps): JSX.Element;
