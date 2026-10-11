import * as React from 'react';
/** Where a consequential change is in its approval path. Requesters can't approve their own request; rejections need a reason; approvals bind to a version. */
export interface ApprovalBannerProps { state?: "required" | "pending" | "approved" | "rejected" | "expired" | "changed"; what: string; approver?: string; requestedBy?: string; onRequest?: () => void; onApprove?: () => void; onReject?: (reason: string) => void; step?: number; of?: number; version?: string; reason?: string; selfRequested?: boolean; busy?: boolean; expires?: string; }
export declare function ApprovalBanner(props: ApprovalBannerProps): JSX.Element;
