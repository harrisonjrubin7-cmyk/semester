import { describe, expect, it } from 'vitest';
import {
  RESOLUTION_REQUIRED,
  isRepairAllowed,
  moveCase,
  openCase,
  type MoveOptions,
  type ReconciliationCase,
} from './case';

const opened = (): ReconciliationCase =>
  openCase({
    id: 'REC-2026-001',
    tenantId: 'named-institution',
    capability: 'registration_readiness',
    discrepancy: 'stale_source',
    severity: 'high',
    ownerId: 'registrar_owner',
  });

const AT = '2026-10-01T09:00:00.000Z';

describe('isRepairAllowed', () => {
  it('allows only the repairs the contract names for a class', () => {
    expect(isRepairAllowed('stale_source', 'refresh_source_snapshot')).toBe(true);
    expect(isRepairAllowed('stale_source', 'correct_versioned_mapping')).toBe(false);
  });

  it('never allows a prohibited repair, even if it were listed', () => {
    expect(isRepairAllowed('stale_source', 'overwrite_authoritative_record')).toBe(false);
    expect(isRepairAllowed('unknown', 'delete_discrepancy')).toBe(false);
  });

  it('gives classes without a named repair no repair at all', () => {
    expect(isRepairAllowed('schema_change', 'refresh_source_snapshot')).toBe(false);
  });
});

describe('moveCase', () => {
  it('walks triage, source wait, proposal, approval and repair', () => {
    let c = opened();
    const step = (to: ReconciliationCase['state'], options: MoveOptions = { by: 'registrar_owner', at: AT }) => {
      const result = moveCase(c, to, options);
      if (!result.ok) throw new Error(result.reason);
      c = result.case;
    };
    step('triaged');
    step('awaiting_source');
    step('repair_proposed', { by: 'integration_owner', at: AT, repair: 'refresh_source_snapshot' });
    step('repair_approved', { by: 'registrar_owner', at: AT });
    step('repaired');
    expect(c.state).toBe('repaired');
    expect(c.proposedBy).toBe('integration_owner');
    expect(c.approvedBy).toBe('registrar_owner');
    expect(c.history).toHaveLength(5);
  });

  it('refuses to skip states', () => {
    expect(moveCase(opened(), 'closed', { by: 'x', at: AT })).toEqual({
      ok: false,
      reason: 'cannot move from detected to closed',
    });
  });

  it('refuses a repair the class does not allow, and points to escalation', () => {
    const triaged = moveCase(opened(), 'triaged', { by: 'x', at: AT });
    if (!triaged.ok) throw new Error('setup');
    const result = moveCase(triaged.case, 'repair_proposed', { by: 'x', at: AT, repair: 'correct_versioned_mapping' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('escalate instead');
  });

  it('refuses a prohibited repair by name', () => {
    const triaged = moveCase(opened(), 'triaged', { by: 'x', at: AT });
    if (!triaged.ok) throw new Error('setup');
    const result = moveCase(triaged.case, 'repair_proposed', { by: 'x', at: AT, repair: 'delete_discrepancy' });
    expect(result).toEqual({ ok: false, reason: 'prohibited repair: delete_discrepancy' });
  });

  it('does not let the proposer approve their own repair', () => {
    const triaged = moveCase(opened(), 'triaged', { by: 'x', at: AT });
    if (!triaged.ok) throw new Error('setup');
    const proposed = moveCase(triaged.case, 'repair_proposed', { by: 'integration_owner', at: AT, repair: 'refresh_source_snapshot' });
    if (!proposed.ok) throw new Error('setup');
    const result = moveCase(proposed.case, 'repair_approved', { by: 'integration_owner', at: AT });
    expect(result).toEqual({ ok: false, reason: 'the proposer cannot approve their own repair' });
  });

  it('closes only when every resolution key is present', () => {
    const reverified: ReconciliationCase = {
      ...opened(),
      state: 'reverified',
      resolution: RESOLUTION_REQUIRED.slice(0, 3),
    };
    const short = moveCase(reverified, 'closed', { by: 'registrar_owner', at: AT });
    expect(short.ok).toBe(false);
    if (short.ok) return;
    expect(short.reason).toContain('student_outcome_recomputed_or_reviewed');
    expect(short.reason).toContain('case_owner_closed');

    const complete = moveCase(reverified, 'closed', {
      by: 'registrar_owner',
      at: AT,
      evidence: ['student_outcome_recomputed_or_reviewed', 'case_owner_closed'],
    });
    expect(complete.ok).toBe(true);
  });

  it('returns to triage when re-verification fails, and keeps a closed case closed', () => {
    const reverified: ReconciliationCase = { ...opened(), state: 'reverified' };
    expect(moveCase(reverified, 'triaged', { by: 'x', at: AT }).ok).toBe(true);
    expect(moveCase({ ...opened(), state: 'closed' }, 'triaged', { by: 'x', at: AT }).ok).toBe(false);
  });

  it('requires a named actor', () => {
    expect(moveCase(opened(), 'triaged', { by: '  ', at: AT })).toEqual({
      ok: false,
      reason: 'a named actor is required',
    });
  });
});
