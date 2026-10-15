import { describe, expect, it } from 'vitest';
import type { ApprovalRequest, DutyRow } from './client';
import {
  approvalDecisionAvailable,
  approvalReviewState,
  parseApprovalExceptionId,
} from './approval-review';

const REQUEST_ID = '123e4567-e89b-12d3-a456-426614174000';

const request = (patch: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  id: REQUEST_ID,
  dutyId: 'break-glass',
  requester: '00000000-0000-4000-8000-000000000001',
  tenantId: 'vu',
  tenantName: 'Vanderbilt University',
  isDemo: false,
  target: 'connector canvas',
  detail: { scope: 'connector canvas' },
  evidence: 'INC-7',
  ticket: 'CHG-100',
  status: 'pending',
  correlationId: null,
  createdAt: '2026-10-12T10:00:00Z',
  expiresAt: '2026-10-19T10:00:00Z',
  decidedAt: null,
  executedAt: null,
  approvals: 0,
  rejections: 0,
  mine: false,
  decidedByMe: false,
  canDecide: true,
  ...patch,
});

const duty = (patch: Partial<DutyRow> = {}): DutyRow => ({
  id: 'break-glass',
  action: 'Break-glass access to a production tenant',
  requester: 'engineering',
  approvers: ['security', 'founder'],
  twoPerson: true,
  evidence: 'An incident ticket',
  ...patch,
});

describe('approval exception navigation', () => {
  it('returns the exact UUID only for a canonical approval exception id', () => {
    expect(parseApprovalExceptionId(`approval:${REQUEST_ID}`)).toBe(REQUEST_ID);
    expect(parseApprovalExceptionId(`approval:${REQUEST_ID.toUpperCase()}`)).toBe(REQUEST_ID);
  });

  it.each([
    '',
    'approval:',
    'approval:req-1',
    'approval:123e4567e89b12d3a456426614174000',
    `approval:${REQUEST_ID}/act`,
    `approvals:${REQUEST_ID}`,
    `https://semester.example/approval:${REQUEST_ID}`,
  ])('refuses malformed or executable-looking ids: %s', (value) => {
    expect(parseApprovalExceptionId(value)).toBeNull();
  });
});

describe('approval review eligibility', () => {
  it('offers a decision only while pending, authorized, and not already decided by the caller', () => {
    expect(approvalDecisionAvailable(request())).toBe(true);
    expect(approvalDecisionAvailable(request({ status: 'approved' }))).toBe(false);
    expect(approvalDecisionAvailable(request({ status: 'expired' }))).toBe(false);
    expect(approvalDecisionAvailable(request({ canDecide: false }))).toBe(false);
    expect(approvalDecisionAvailable(request({ decidedByMe: true }))).toBe(false);
  });

  it('distinguishes pending, waiting for a second person, approved, and rejected', () => {
    expect(approvalReviewState(request(), duty())).toBe('pending');
    expect(approvalReviewState(request({ approvals: 1, decidedByMe: true }), duty())).toBe('waiting-for-second-person');
    expect(approvalReviewState(request({ status: 'approved', approvals: 2 }), duty())).toBe('approved');
    expect(approvalReviewState(request({ status: 'rejected', rejections: 1 }), duty())).toBe('rejected');
  });

  it('does not call a one-person approval pending after its first approval', () => {
    expect(approvalReviewState(request({ approvals: 1 }), duty({ twoPerson: false }))).toBe('pending');
  });
});
