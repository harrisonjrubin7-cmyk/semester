import type { ApprovalRequest, DutyRow } from './client';

const APPROVAL_EXCEPTION = /^approval:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** An exception route is data, never a URL. Only the canonical approval id shape can navigate. */
export function parseApprovalExceptionId(value: string): string | null {
  const matched = APPROVAL_EXCEPTION.exec(value);
  return matched ? matched[1].toLowerCase() : null;
}

export function approvalDecisionAvailable(request: ApprovalRequest): boolean {
  return request.status === 'pending' && request.canDecide && !request.decidedByMe;
}

export type ApprovalReviewState =
  | 'pending'
  | 'waiting-for-second-person'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'expired';

export function approvalReviewState(request: ApprovalRequest, duty: DutyRow | undefined): ApprovalReviewState {
  if (request.status !== 'pending') return request.status;
  return duty?.twoPerson && request.approvals === 1
    ? 'waiting-for-second-person'
    : 'pending';
}
