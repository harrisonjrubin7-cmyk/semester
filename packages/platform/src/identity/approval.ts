/**
 * Approvals: a consequential action that waits for other people.
 *
 * Grade amendments, record corrections, bulk role changes, support access to
 * a student's context — each is an action the *requester must not be able to
 * finish alone*. An approval request is a small workflow (it uses the same
 * `WorkflowDefinition` and `transition` the institution package's machines
 * use, ADR 0009) with the rules that make it more than a button:
 *
 * - **Separation of duties.** The requester cannot approve their own request,
 *   whatever capability they hold.
 * - **Distinct approvers.** N approvals means N people. One person cannot
 *   approve twice, and cannot approve and then reject.
 * - **A required capability** to decide, checked by the caller from policy
 *   and passed in as `canDecide`; this module does not know what a role is.
 * - **Expiry.** An approval nobody answered lapses; a lapsed request cannot
 *   be approved late, because the record it was about may have moved.
 * - **A rejection is final** and needs a reason a person can read.
 *
 * What an approved request *does* is not here. The command that asked for it
 * runs again, carrying the approval id, and checks `isApprovedFor` — approval
 * is permission to proceed, never the proceeding.
 */

import { transition, type WorkflowDefinition } from '../seam/institution.ts';

export const APPROVAL_STATES = ['pending', 'approved', 'rejected', 'expired', 'cancelled', 'consumed'] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

export const APPROVAL: WorkflowDefinition<ApprovalState> = {
  type: 'approval',
  initial: 'pending',
  terminal: ['rejected', 'expired', 'cancelled', 'consumed'],
  transitions: {
    pending: ['approved', 'rejected', 'expired', 'cancelled'],
    approved: ['consumed', 'expired', 'cancelled'],
    rejected: [],
    expired: [],
    cancelled: [],
    consumed: [],
  },
  exceptional: [['approved', 'cancelled'], ['approved', 'expired']],
};

export interface ApprovalDecision {
  approverId: string;
  decision: 'approve' | 'reject';
  at: string;
  reason?: string;
}

export interface ApprovalRequest {
  id: string;
  tenantId: string;
  /** The policy action this approval is for, and the exact thing it is for. */
  action: string;
  subject: { type: string; id: string };
  /** A hash of the proposed change, so approval of one change is not approval of another. */
  changeHash: string;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  requiredApprovals: number;
  state: ApprovalState;
  decisions: ApprovalDecision[];
}

export type ApprovalVerdict = { ok: true; request: ApprovalRequest } | { ok: false; reason: string };

export function openApproval(input: Omit<ApprovalRequest, 'state' | 'decisions'>): ApprovalVerdict {
  if (input.requiredApprovals < 1 || !Number.isInteger(input.requiredApprovals)) return { ok: false, reason: 'at least one approval is required' };
  if (Date.parse(input.expiresAt) <= Date.parse(input.requestedAt)) return { ok: false, reason: 'an approval must expire after it is requested' };
  return { ok: true, request: { ...input, state: 'pending', decisions: [] } };
}

/** Moves a pending or approved request to `expired` if its time has passed. Pure; the caller persists the result. */
export function expireIfDue(r: ApprovalRequest, nowMs: number): ApprovalRequest {
  if ((r.state === 'pending' || r.state === 'approved') && Date.parse(r.expiresAt) <= nowMs) {
    const t = transition(APPROVAL, r.state, 'expired');
    if (t.ok) return { ...r, state: 'expired' };
  }
  return r;
}

export function decide(
  request: ApprovalRequest,
  d: { approverId: string; decision: 'approve' | 'reject'; reason?: string },
  ctx: { nowMs: number; canDecide: boolean },
): ApprovalVerdict {
  const r = expireIfDue(request, ctx.nowMs);
  if (r.state !== 'pending') return { ok: false, reason: `request is ${r.state}` };
  if (!ctx.canDecide) return { ok: false, reason: 'approver lacks the capability to decide this request' };
  if (d.approverId === r.requestedBy) return { ok: false, reason: 'the requester cannot decide their own request' };
  if (r.decisions.some((x) => x.approverId === d.approverId)) return { ok: false, reason: 'this approver has already decided' };
  if (d.decision === 'reject' && !d.reason?.trim()) return { ok: false, reason: 'a rejection needs a reason' };

  const at = new Date(ctx.nowMs).toISOString();
  const decisions = [...r.decisions, { approverId: d.approverId, decision: d.decision, at, ...(d.reason ? { reason: d.reason } : {}) }];
  const approvals = decisions.filter((x) => x.decision === 'approve').length;
  const next: ApprovalState = d.decision === 'reject' ? 'rejected' : approvals >= r.requiredApprovals ? 'approved' : 'pending';
  if (next !== r.state) {
    const t = transition(APPROVAL, r.state, next);
    if (!t.ok) return { ok: false, reason: t.reason };
  }
  return { ok: true, request: { ...r, state: next, decisions } };
}

/** Whether `request` authorises exactly this change right now — the check the re-run command makes. */
export function isApprovedFor(request: ApprovalRequest, tenantId: string, action: string, changeHash: string, nowMs: number): boolean {
  const r = expireIfDue(request, nowMs);
  return r.state === 'approved' && r.tenantId === tenantId && r.action === action && r.changeHash === changeHash;
}

/** Use it once: an approved request is consumed by the command it authorised, so it cannot authorise a second. */
export function consume(request: ApprovalRequest, nowMs: number): ApprovalVerdict {
  const r = expireIfDue(request, nowMs);
  const t = transition(APPROVAL, r.state, 'consumed');
  return t.ok ? { ok: true, request: { ...r, state: 'consumed' } } : { ok: false, reason: t.reason };
}
