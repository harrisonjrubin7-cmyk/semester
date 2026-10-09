import * as React from 'react';
/** Names the governing policy with owner, version, effective date and lifecycle status. */
export interface PolicyBadgeProps { name: string; version?: string; owner?: string; effective?: string; status?: 'active' | 'draft' | 'superseded' | 'expired'; onOpen?: () => void; href?: string; }
export declare function PolicyBadge(props: PolicyBadgeProps): JSX.Element;
