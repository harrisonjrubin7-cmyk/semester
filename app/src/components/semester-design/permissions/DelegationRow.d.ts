import * as React from 'react';
/** Access someone has because the student granted it: who, what, until when; inline revoke with immediate effect; extend when expiring. */
export interface DelegationRowProps { who: string; role?: string; scope?: string[]; expires?: string; state?: "active" | "expiring" | "expired" | "revoked" | "pending" | "declined"; onRevoke?: () => void; onExtend?: () => void; lastAccess?: string; revoking?: boolean; }
export declare function DelegationRow(props: DelegationRowProps): JSX.Element;
