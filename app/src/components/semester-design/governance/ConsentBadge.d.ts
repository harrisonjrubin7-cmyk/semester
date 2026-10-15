import * as React from 'react';
/** Who can see something because the student shared it, what, why and until when. Unknown states render as private. */
export interface ConsentBadgeProps { state?: "private" | "shared" | "expiring" | "expired" | "revoked" | "required" | "declined"; recipient?: string; expires?: string; purpose?: string; scope?: string; expiringSoon?: boolean; onManage?: () => void; }
export declare function ConsentBadge(props: ConsentBadgeProps): JSX.Element;
