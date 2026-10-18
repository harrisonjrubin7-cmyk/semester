import { describe, expect, it } from 'vitest';
import {
  RESOLUTION_REQUIRED,
  isRepairAllowed,
  moveCase,
  openCase,
  type DiscrepancyClass,
  type MoveOptions,
  type ReconciliationCase,
} from './case';

const AT = '2026-10-01T09:00:00.000Z';

const opened = (): ReconciliationCase =>
  openCase({
    id: 'REC-2026-001',
    tenantId: 'named-institution',
    capability: 'registration_readiness',
    discrepancy: 'stale_source',
    severity: 'high',
    ownerId: 'registrar_owner',
    detectedAt: '2026-10-01T08:00:00.000Z',
    sourceSystem: 'SIS',
    cohortId: 'approved_pilot_cohort',
  });

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
      proposedRepair: 'refresh_source_snapshot',
      proposedBy: 'integration_owner',
      approvedBy: 'registrar_owner',
      history: [
        { from: 'awaiting_source', to: 'repair_proposed', at: AT, by: 'integration_owner' },
        { from: 'repair_proposed', to: 'repair_approved', at: AT, by: 'registrar_owner' },
        { from: 'repair_approved', to: 'repaired', at: AT, by: 'integration_owner' },
        { from: 'repaired', to: 'reverified', at: AT, by: 'integration_owner' },
      ],
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

  it('treats actor names that differ only in case or spacing as one person', () => {
    const triaged = moveCase(opened(), 'triaged', { by: 'x', at: AT });
    if (!triaged.ok) throw new Error('setup');
    const proposed = moveCase(triaged.case, 'repair_proposed', { by: 'Ana', at: AT, repair: 'refresh_source_snapshot' });
    if (!proposed.ok) throw new Error('setup');
    expect(moveCase(proposed.case, 'repair_approved', { by: ' ana ', at: AT })).toEqual({
      ok: false,
      reason: 'the proposer cannot approve their own repair',
    });
  });

  it('starts a new repair cycle after a failed re-verification', () => {
    const failed: ReconciliationCase = {
      ...opened(),
      state: 'reverified',
      resolution: [...RESOLUTION_REQUIRED],
      proposedRepair: 'refresh_source_snapshot',
      proposedBy: 'integration_owner',
      approvedBy: 'registrar_owner',
    };
    const back = moveCase(failed, 'triaged', { by: 'registrar_owner', at: AT });
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.case.resolution).toEqual([]);
    expect(back.case.proposedBy).toBeUndefined();
    expect(back.case.approvedBy).toBeUndefined();

    const closeWithoutNewEvidence = moveCase(
      { ...back.case, state: 'reverified' },
      'closed',
      { by: 'registrar_owner', at: AT },
    );
    expect(closeWithoutNewEvidence.ok).toBe(false);
  });

  it('lets an escalated case with no safe repair be re-verified and closed on evidence', () => {
    const escalated: ReconciliationCase = { ...opened(), discrepancy: 'schema_change', state: 'escalated' };
    const reverified = moveCase(escalated, 'reverified', {
      by: 'registrar_owner',
      at: AT,
      evidence: [...RESOLUTION_REQUIRED],
    });
    expect(reverified.ok).toBe(true);
    if (!reverified.ok) return;
    expect(moveCase(reverified.case, 'closed', { by: 'registrar_owner', at: AT }).ok).toBe(true);
  });

  it('records when the discrepancy was detected, and where', () => {
    const c = opened();
    expect(c.detectedAt).toBe('2026-10-01T08:00:00.000Z');
    expect(c.sourceSystem).toBe('SIS');
    expect(c.cohortId).toBe('approved_pilot_cohort');
  });

  it('refuses a transition time that is not ISO 8601', () => {
    expect(moveCase(opened(), 'triaged', { by: 'x', at: '10/01/2026' })).toEqual({
      ok: false,
      reason: 'at must be an ISO timestamp',
    });
  });

  it('refuses a transition earlier than detection, or earlier than the move before it', () => {
    expect(moveCase(opened(), 'triaged', { by: 'x', at: '2026-10-01T07:00:00.000Z' })).toEqual({
      ok: false,
      reason: 'transition time precedes the case history',
    });

    const triaged = moveCase(opened(), 'triaged', { by: 'x', at: '2026-10-01T10:00:00.000Z' });
    if (!triaged.ok) throw new Error('setup');
    expect(moveCase(triaged.case, 'awaiting_source', { by: 'x', at: '2026-10-01T09:30:00.000Z' })).toEqual({
      ok: false,
      reason: 'transition time precedes the case history',
    });
  });

  it('refuses an unknown or prototype-named state without throwing', () => {
    for (const state of ['archived', 'constructor']) {
      const result = moveCase({ ...opened(), state: state as ReconciliationCase['state'] }, 'triaged', { by: 'x', at: AT });
      expect(result).toEqual({ ok: false, reason: `unknown state: ${state}` });
    }
  });

  it('refuses a discrepancy class outside the enum, even one that resolves through Object.prototype', () => {
    const unknown = 'constructor' as DiscrepancyClass;
    expect(isRepairAllowed(unknown, 'refresh_source_snapshot')).toBe(false);

    const stored: ReconciliationCase = { ...opened(), discrepancy: unknown, state: 'triaged' };
    expect(moveCase(stored, 'awaiting_source', { by: 'x', at: AT })).toEqual({
      ok: false,
      reason: 'unknown discrepancy: constructor',
    });
    expect(moveCase(stored, 'escalated', { by: 'x', at: AT }).ok).toBe(false);
  });

  it('refuses approval when the stored repair has no proposer, rather than skipping separation of duties', () => {
    for (const proposedBy of [undefined, '   ']) {
      const stored: ReconciliationCase = {
        ...opened(),
        state: 'repair_proposed',
        proposedRepair: 'refresh_source_snapshot',
        proposedBy,
      };
      expect(moveCase(stored, 'repair_approved', { by: 'anyone', at: AT })).toEqual({
        ok: false,
        reason: 'the repair has no recorded proposer',
      });
    }
  });

  it('refuses approval of a stored repair that is missing, prohibited or not allowed for the class', () => {
    const cases: (string | undefined)[] = [undefined, '  ', 'delete_discrepancy', 'correct_versioned_mapping'];
    for (const proposedRepair of cases) {
      const stored: ReconciliationCase = {
        ...opened(),
        state: 'repair_proposed',
        proposedRepair,
        proposedBy: 'integration_owner',
      };
      expect(moveCase(stored, 'repair_approved', { by: 'registrar_owner', at: AT })).toEqual({
        ok: false,
        reason: 'the proposed repair is missing or not allowed for this discrepancy',
      });
    }
  });

  it('keeps the attempt that failed re-verification before a new cycle clears it', () => {
    const failed: ReconciliationCase = {
      ...opened(),
      state: 'reverified',
      resolution: [...RESOLUTION_REQUIRED],
      proposedRepair: 'refresh_source_snapshot',
      proposedBy: 'integration_owner',
      approvedBy: 'registrar_owner',
    };
    const back = moveCase(failed, 'triaged', { by: 'registrar_owner', at: '2026-10-02T09:00:00.000Z' });
    if (!back.ok) throw new Error('setup');
    expect(back.case.priorCycles).toEqual([
      {
        repair: 'refresh_source_snapshot',
        proposedBy: 'integration_owner',
        approvedBy: 'registrar_owner',
        resolution: [...RESOLUTION_REQUIRED],
        endedAt: '2026-10-02T09:00:00.000Z',
      },
    ]);
  });

  it('refuses to close a safe-repair case that never had its approved repair on record', () => {
    const bare: ReconciliationCase = { ...opened(), state: 'reverified', resolution: [...RESOLUTION_REQUIRED] };
    expect(moveCase(bare, 'closed', { by: 'registrar_owner', at: AT })).toEqual({
      ok: false,
      reason: 'a safe-repair case closes only with its approved repair on record',
    });
  });

  it('refuses closure by someone other than the case owner, even with every evidence key', () => {
    const ready: ReconciliationCase = {
      ...opened(),
      state: 'reverified',
      resolution: [...RESOLUTION_REQUIRED],
      proposedRepair: 'refresh_source_snapshot',
      proposedBy: 'integration_owner',
      approvedBy: 'registrar_owner',
    };
    expect(moveCase(ready, 'closed', { by: 'someone_else', at: AT })).toEqual({
      ok: false,
      reason: 'only the case owner can close a case',
    });
  });

  it('refuses closure when the proposer also holds the approval on record', () => {
    const selfApproved: ReconciliationCase = {
      ...opened(),
      state: 'reverified',
      resolution: [...RESOLUTION_REQUIRED],
      proposedRepair: 'refresh_source_snapshot',
      proposedBy: 'Ana',
      approvedBy: ' ana ',
    };
    expect(moveCase(selfApproved, 'closed', { by: 'registrar_owner', at: AT })).toEqual({
      ok: false,
      reason: 'a safe-repair case closes only with its approved repair on record',
    });
  });

  it('drops evidence gathered before a repair, so only post-repair evidence can close the case', () => {
    const triaged = moveCase(opened(), 'triaged', { by: 'registrar_owner', at: AT, evidence: [...RESOLUTION_REQUIRED] });
    if (!triaged.ok) throw new Error('setup');
    const proposed = moveCase(triaged.case, 'repair_proposed', {
      by: 'integration_owner',
      at: AT,
      repair: 'refresh_source_snapshot',
    });
    if (!proposed.ok) throw new Error('setup');
    expect(proposed.case.resolution).toEqual([]);
  });

  it('refuses to open a case with a detection time that is not ISO 8601', () => {
    expect(() =>
      openCase({
        id: 'REC-2026-002',
        tenantId: 'named-institution',
        capability: 'registration_readiness',
        discrepancy: 'stale_source',
        severity: 'high',
        ownerId: 'registrar_owner',
        detectedAt: 'yesterday',
        sourceSystem: 'SIS',
        cohortId: 'approved_pilot_cohort',
      }),
    ).toThrow('detectedAt must be an ISO timestamp');
  });

  it('does not let an escalated case with a safe repair skip repair and approval', () => {
    const escalated: ReconciliationCase = { ...opened(), state: 'escalated' };
    const result = moveCase(escalated, 'reverified', { by: 'registrar_owner', at: AT, evidence: [...RESOLUTION_REQUIRED] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('has a safe repair');
  });
});

describe('persisted history and evidence windows', () => {
  const entry = (from: ReconciliationCase['state'], to: ReconciliationCase['state'], at: string) => ({
    from,
    to,
    at,
    by: 'registrar_owner',
  });

  it('checks every stored history entry, not only the last one', () => {
    const c: ReconciliationCase = {
      ...opened(),
      state: 'awaiting_source',
      history: [entry('detected', 'triaged', '2026-10-01T10:00:00.000Z'), entry('triaged', 'awaiting_source', '2026-10-01T09:00:00.000Z')],
    };
    const result = moveCase(c, 'repair_proposed', { by: 'integration_owner', at: '2026-10-01T09:30:00.000Z', repair: 'refresh_source_snapshot' });
    expect(result).toEqual({ ok: false, reason: 'case history is out of order or has an invalid timestamp' });
  });

  it('refuses a move after a stored entry that predates detection', () => {
    const c: ReconciliationCase = {
      ...opened(),
      state: 'triaged',
      history: [entry('detected', 'triaged', '2026-10-01T07:00:00.000Z')],
    };
    expect(moveCase(c, 'awaiting_source', { by: 'registrar_owner', at: '2026-10-01T08:30:00.000Z' }).ok).toBe(false);
  });

  it('records no evidence on approval, and clears pre-execution evidence on repair', () => {
    const proposed: ReconciliationCase = {
      ...opened(),
      state: 'repair_proposed',
      proposedRepair: 'refresh_source_snapshot',
      proposedBy: 'integration_owner',
      history: [entry('awaiting_source', 'repair_proposed', AT)],
    };
    const approved = moveCase(proposed, 'repair_approved', { by: 'registrar_owner', at: AT, evidence: [...RESOLUTION_REQUIRED] });
    expect(approved.ok && approved.case.resolution).toEqual([]);

    const executing: ReconciliationCase = { ...proposed, state: 'repair_approved', approvedBy: 'registrar_owner', resolution: ['audit_linked'] };
    const repaired = moveCase(executing, 'repaired', { by: 'integration_owner', at: AT });
    expect(repaired.ok && repaired.case.resolution).toEqual([]);
  });

  it('clears evidence gathered before an escalation', () => {
    const triaged: ReconciliationCase = { ...opened(), discrepancy: 'schema_change', state: 'triaged', resolution: [...RESOLUTION_REQUIRED] };
    const result = moveCase(triaged, 'escalated', { by: 'registrar_owner', at: AT });
    expect(result.ok && result.case.resolution).toEqual([]);
  });

  it('closes a class with no safe repair only after escalation and re-verification', () => {
    const reverified: ReconciliationCase = {
      ...opened(),
      discrepancy: 'schema_change',
      state: 'reverified',
      resolution: [...RESOLUTION_REQUIRED],
      history: [],
    };
    expect(moveCase(reverified, 'closed', { by: 'registrar_owner', at: AT })).toEqual({
      ok: false,
      reason: 'a class without a safe repair closes only after escalation and re-verification',
    });

    const escalated: ReconciliationCase = { ...reverified, history: [entry('escalated', 'reverified', AT)] };
    expect(moveCase(escalated, 'closed', { by: 'registrar_owner', at: AT }).ok).toBe(true);

    // An earlier escalation does not count once a later transition has moved the case on.
    const reopened: ReconciliationCase = {
      ...reverified,
      history: [entry('escalated', 'reverified', AT), entry('reverified', 'triaged', AT)],
    };
    expect(moveCase(reopened, 'closed', { by: 'registrar_owner', at: AT }).ok).toBe(false);
  });

  it('refuses evidence that is not a list of keys, without throwing', () => {
    const result = moveCase(opened(), 'triaged', { by: 'registrar_owner', at: AT, evidence: 42 as unknown as string[] });
    expect(result).toEqual({ ok: false, reason: 'evidence must be a list of resolution keys' });
  });

  it('refuses to open a case with a severity outside the contract', () => {
    expect(() => openCase({ ...opened(), severity: 'urgent' as ReconciliationCase['severity'] })).toThrow(
      'severity is not a known level',
    );
  });

  it('refuses to open a case with a discrepancy class outside the contract', () => {
    expect(() => openCase({ ...opened(), discrepancy: 'constructor' as DiscrepancyClass })).toThrow(
      'discrepancy is not a known class',
    );
  });

  it('refuses a missing actor with a result, not an exception', () => {
    const result = moveCase(opened(), 'triaged', { by: undefined as unknown as string, at: AT });
    expect(result).toEqual({ ok: false, reason: 'a named actor is required' });
  });

  it('refuses a safe-repair close whose approval never ran through the workflow', () => {
    const fields: ReconciliationCase = {
      ...opened(),
      state: 'reverified',
      proposedRepair: 'refresh_source_snapshot',
      proposedBy: 'integration_owner',
      approvedBy: 'registrar_owner',
      resolution: [...RESOLUTION_REQUIRED],
      history: [],
    };
    expect(moveCase(fields, 'closed', { by: 'registrar_owner', at: AT }).ok).toBe(false);

    const finalMoveOnly: ReconciliationCase = {
      ...fields,
      history: [{ from: 'repaired', to: 'reverified', at: AT, by: 'integration_owner' }],
    };
    expect(moveCase(finalMoveOnly, 'closed', { by: 'registrar_owner', at: AT }).ok).toBe(false);

    const partialChain: ReconciliationCase = {
      ...fields,
      history: [
        { from: 'triaged', to: 'repair_proposed', at: AT, by: 'integration_owner' },
        { from: 'repair_proposed', to: 'repair_approved', at: AT, by: 'registrar_owner' },
        { from: 'repaired', to: 'reverified', at: AT, by: 'integration_owner' },
      ],
    };
    expect(moveCase(partialChain, 'closed', { by: 'registrar_owner', at: AT }).ok).toBe(false);
  });

  it('refuses to open a case that could never close', () => {
    expect(() => openCase({ ...opened(), ownerId: '  ' })).toThrow('ownerId is required');
  });
});
