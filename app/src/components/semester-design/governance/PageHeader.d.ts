import * as React from 'react';
/** Page head: breadcrumbs, kicker, one heading, status, purpose, source line, actions. */
export interface PageHeaderProps { kicker?: string; title: string; purpose?: string; source?: React.ReactNode; actions?: React.ReactNode; level?: 1 | 2 | 3; breadcrumbs?: { label: string; href?: string }[]; status?: React.ReactNode; id?: string; }
export declare function PageHeader(props: PageHeaderProps): JSX.Element;
