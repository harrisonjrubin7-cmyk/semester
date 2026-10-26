import { describe, expect, it } from 'vitest';
import type { ApprovalRequest, CommandItem, IntegrationHealth } from './client';
import { fromApproval, fromCommand, fromIntegration, overview, sortWork, type SourceRead, type WorkSource } from './workqueue';

const NOW = new Date('2026-10-26T12:00:00Z');
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const command = (over: Partial<CommandItem> = {}): CommandItem => ({
  id: 'c1', severity: 'high', category: 'release', title: 'Release gate open', tenantId: null, tenantName: null,
  isDemo: false, owner: 'ops', dueAt: null, status: 'open', nextStep: 'Hold the release', route: '/console',
  source: 'release_gate', evidence: 'gate row', limitation: 'none', observedAt: inHours(-1), ...over,
});

const approval = (over: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  id: 'a1', dutyId: 'role.grant', requester: 'op-2', tenantId: 'vu', tenantName: 'Vanderbilt', isDemo: false,
  target: 'user-9', detail: {}, evidence: 'Access review', ticket: 'OPS-1', status: 'pending', correlationId: null,
  createdAt: inHours(-2), expiresAt: inHours(72), decidedAt: null, executedAt: null, approvals: 0, rejections: 0,
  mine: false, decidedByMe: false, canDecide: true, ...over,
});

const health = (over: Partial<IntegrationHealth> = {}): IntegrationHealth => ({
  connectionId: 'i1', tenantId: 'vu', tenantName: 'Vanderbilt', isDemo: false, connectionName: 'Brightspace',
  providerDomain: 'lms', providerName: 'D2L', configurationState: 'configured', healthState: 'stale', featureState: 'on',
  lastSuccessfulSyncAt: null, freshnessTargetMinutes: 60, minutesSinceSuccess: 300, latestRunStatus: 'failed',
  latestRunAt: inHours(-1), reconciliationState: null, recordsReceived: 0, recordsRejected: 0, openErrors: 2,
  criticalErrors: 0, openDeadLetters: 0, ownerName: 'Integrations', backupOwnerName: '', customerImpact: '',
  nextSafeAction: 'Retry the sync', configurationApprovalId: null, configurationApprovalStatus: null, canRequest: false,
  classification: 'restricted', provenance: 'integration_run', limitation: 'credential-free', ...over,
});

describe('work queue mapping', () => {
  it('maps command severity to priority and keeps provenance', () => {
    expect(fromCommand(command({ severity: 'info' })).priority).toBe('low');
    const w = fromCommand(command());
    expect(w).toMatchObject({ priority: 'high', openIn: 'command', evidence: 'gate row', limitation: 'none' });
  });

  it('includes only approvals the operator can move', () => {
    expect(fromApproval(approval(), NOW)?.status).toBe('Awaiting your decision');
    expect(fromApproval(approval({ canDecide: false, mine: true }), NOW)?.status).toBe('Waiting on approvers');
    expect(fromApproval(approval({ canDecide: false, mine: true, status: 'approved' }), NOW)?.status).toBe('Approved — ready to act');
    expect(fromApproval(approval({ canDecide: false }), NOW)).toBeNull();
    expect(fromApproval(approval({ decidedByMe: true, canDecide: true }), NOW)).toBeNull();
    expect(fromApproval(approval({ status: 'executed', mine: true }), NOW)).toBeNull();
    expect(fromApproval(approval({ status: 'approved', mine: true, executedAt: inHours(-1) }), NOW)).toBeNull();
  });

  it('drops an expired approval and raises one that expires within a day', () => {
    expect(fromApproval(approval({ expiresAt: inHours(-1) }), NOW)).toBeNull();
    const soon = fromApproval(approval({ canDecide: false, mine: true, expiresAt: inHours(3) }), NOW);
    expect(soon?.priority).toBe('high');
    expect(soon?.reason).toMatch(/expires within a day/);
    expect(fromApproval(approval({ canDecide: false, mine: true }), NOW)?.priority).toBe('medium');
  });

  it('leaves healthy connectors out and raises critical errors', () => {
    expect(fromIntegration(health({ healthState: 'healthy' }))).toBeNull();
    expect(fromIntegration(health())?.priority).toBe('medium');
    expect(fromIntegration(health({ healthState: 'failed' }))?.priority).toBe('high');
    expect(fromIntegration(health({ criticalErrors: 1 }))?.priority).toBe('critical');
    expect(fromIntegration(health({ minutesSinceSuccess: null }))?.reason).toMatch(/no successful sync recorded/);
  });
});

describe('work queue ordering', () => {
  it('sorts by priority, then due date, with undated work last', () => {
    const items = [
      fromCommand(command({ id: 'a', severity: 'medium', title: 'M' })),
      fromCommand(command({ id: 'b', severity: 'critical', title: 'C' })),
      fromCommand(command({ id: 'c', severity: 'high', title: 'H late', dueAt: inHours(48) })),
      fromCommand(command({ id: 'd', severity: 'high', title: 'H soon', dueAt: inHours(2) })),
      fromCommand(command({ id: 'e', severity: 'high', title: 'H none' })),
    ];
    expect(sortWork(items).map((w) => w.title)).toEqual(['C', 'H soon', 'H late', 'H none', 'M']);
    expect(sortWork(items, 'due')[0].title).toBe('H soon');
  });
});

describe('work queue overview', () => {
  const reads = (over: Partial<Record<WorkSource, SourceRead>>): Record<WorkSource, SourceRead> => ({
    command: { state: 'read', readAt: NOW.toISOString() },
    approvals: { state: 'read', readAt: NOW.toISOString() },
    'integration-health': { state: 'not-granted' },
    ...over,
  });

  it('is complete only when every granted source was read', () => {
    const items = [fromCommand(command())];
    expect(overview(items, reads({}))).toMatchObject({ counted: 1, granted: 2, read: 2, complete: true, missing: [] });
  });

  it('never treats an unavailable source as zero', () => {
    const o = overview([], reads({ approvals: { state: 'unavailable', error: 'refused' } }));
    expect(o).toMatchObject({ counted: 0, complete: false, missing: ['approvals'], read: 1 });
  });

  it('is not complete when nothing is granted', () => {
    const none = overview([], { command: { state: 'not-granted' }, approvals: { state: 'not-granted' }, 'integration-health': { state: 'not-granted' } });
    expect(none.complete).toBe(false);
  });
});
