import { describe, expect, it } from 'vitest';
import { healthEventProblems, transitionHealthEvent, type HealthEvent } from './health-event';

const base: HealthEvent = {
  id: 'HE-1',
  category: 'source_freshness',
  severity: 'high',
  state: 'open',
  summary: 'SIS snapshot is older than the approved window',
  affectedCapability: 'registration_readiness',
  affectedScope: { tenantId: 'named-institution', sourceSystem: 'SIS' },
  safeImmediateAction: 'Show stale state and block definitive outcomes',
  accountableOwner: 'integration_owner',
  correlationId: 'corr-1',
  evidenceReferences: [],
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
};

describe('healthEventProblems', () => {
  it('accepts a complete event', () => {
    expect(healthEventProblems(base)).toEqual([]);
  });

  it('requires an accountable owner and a correlation id', () => {
    const problems = healthEventProblems({ ...base, accountableOwner: ' ', correlationId: '' });
    expect(problems).toEqual(expect.arrayContaining(['accountableOwner is required', 'correlationId is required']));
  });

  it('requires at least one affected scope key', () => {
    expect(healthEventProblems({ ...base, affectedScope: {} })).toContain('affectedScope must name at least one scope key');
  });

  it('requires a safe immediate action for critical and high events', () => {
    const { safeImmediateAction: _omit, ...withoutAction } = base;
    expect(healthEventProblems({ ...withoutAction, severity: 'critical' })).toContain(
      'critical and high events need a safeImmediateAction',
    );
    expect(healthEventProblems({ ...withoutAction, severity: 'low' })).toEqual([]);
  });

  it('rejects unknown enum values and non-ISO timestamps', () => {
    const problems = healthEventProblems({
      ...base,
      category: 'weather' as HealthEvent['category'],
      createdAt: 'yesterday',
    });
    expect(problems).toEqual(
      expect.arrayContaining(['unknown category: weather', 'createdAt must be an ISO timestamp']),
    );
  });

  it('rejects an update before creation', () => {
    expect(healthEventProblems({ ...base, updatedAt: '2026-09-30T09:00:00.000Z' })).toContain(
      'updatedAt is before createdAt',
    );
  });
});

describe('transitionHealthEvent', () => {
  it('follows the allowed path from open to mitigated', () => {
    const acknowledged = transitionHealthEvent(base, 'acknowledged', '2026-10-01T10:00:00.000Z');
    expect(acknowledged.ok).toBe(true);
    if (!acknowledged.ok) return;
    expect(acknowledged.event.state).toBe('acknowledged');
    expect(acknowledged.event.updatedAt).toBe('2026-10-01T10:00:00.000Z');

    const mitigated = transitionHealthEvent(acknowledged.event, 'mitigated', '2026-10-01T11:00:00.000Z');
    expect(mitigated.ok).toBe(true);
  });

  it('refuses to skip states', () => {
    const result = transitionHealthEvent(base, 'closed', '2026-10-01T10:00:00.000Z');
    expect(result).toEqual({ ok: false, reason: 'cannot move from open to closed' });
  });

  it('refuses to close without evidence, and closes once evidence is attached', () => {
    const mitigated = transitionHealthEvent(
      { ...base, state: 'mitigated' },
      'closed',
      '2026-10-02T10:00:00.000Z',
    );
    expect(mitigated.ok).toBe(false);
    if (mitigated.ok) return;
    expect(mitigated.reason).toBe('a closed event needs evidenceReferences');

    const closed = transitionHealthEvent(
      { ...base, state: 'mitigated', evidenceReferences: ['evidence/drills/DRILL-STALE-001.yaml'] },
      'closed',
      '2026-10-02T10:00:00.000Z',
    );
    expect(closed.ok).toBe(true);
  });

  it('keeps a closed event terminal', () => {
    const closed = { ...base, state: 'closed' as const, evidenceReferences: ['e1'] };
    expect(transitionHealthEvent(closed, 'open', '2026-10-03T10:00:00.000Z').ok).toBe(false);
  });

  it('refuses an unknown current state without throwing', () => {
    const result = transitionHealthEvent({ ...base, state: 'archived' as HealthEvent['state'] }, 'acknowledged', '2026-10-01T10:00:00.000Z');
    expect(result).toEqual({ ok: false, reason: 'unknown state: archived' });
  });

  it('refuses a transition timestamped before the last update', () => {
    const result = transitionHealthEvent({ ...base, updatedAt: '2026-10-01T11:00:00.000Z' }, 'acknowledged', '2026-10-01T10:00:00.000Z');
    expect(result).toEqual({ ok: false, reason: 'transition time precedes the last update' });
  });
});

describe('tenant scope', () => {
  it('refuses an event that names two different tenants', () => {
    expect(
      healthEventProblems({ ...base, tenantId: 'tenant-a', affectedScope: { tenantId: 'tenant-b' } }),
    ).toContain('tenantId and affectedScope.tenantId name different tenants');
  });

  it('accepts the same tenant named in both places', () => {
    expect(healthEventProblems({ ...base, tenantId: 'named-institution', affectedScope: { tenantId: 'named-institution' } })).toEqual([]);
  });
});

describe('timestamps and evidence', () => {
  it('does not count blank evidence references as evidence', () => {
    expect(healthEventProblems({ ...base, state: 'closed', evidenceReferences: ['', '   '] })).toContain(
      'a closed event needs evidenceReferences',
    );
  });

  it('reports a closed event with a missing or null evidence array instead of throwing', () => {
    const { evidenceReferences: _omit, ...withoutEvidence } = base;
    expect(healthEventProblems({ ...withoutEvidence, state: 'closed' } as HealthEvent)).toContain(
      'a closed event needs evidenceReferences',
    );
    expect(healthEventProblems({ ...base, state: 'closed', evidenceReferences: null as unknown as string[] })).toContain(
      'a closed event needs evidenceReferences',
    );
  });

  it('requires ISO 8601, not a locale date that Date.parse would also accept', () => {
    expect(healthEventProblems({ ...base, createdAt: '10/01/2026', updatedAt: '10/01/2026' })).toEqual(
      expect.arrayContaining(['createdAt must be an ISO timestamp', 'updatedAt must be an ISO timestamp']),
    );
  });
});
