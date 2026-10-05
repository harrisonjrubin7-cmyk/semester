import { describe, expect, it } from 'vitest';
import { institutionReadiness } from './readiness.ts';
import type { ActionJournalStore } from './journal.ts';

const journal = (healthy = true, retention = true): ActionJournalStore => ({
  healthy: async () => healthy,
  retentionHealthy: async () => retention,
  save: async () => {}, get: async () => null, claim: async () => false,
  finish: async () => {}, audit: async () => {},
});

const base = {
  journal: journal(),
  monitoringConfigured: true,
  adaptersInstalled: 1,
  minimumAdapters: 1,
  integrationsHealthy: true,
  intelligenceStatus: 'configured-production' as const,
  requireProductionIntelligence: true,
};

describe('institution production readiness', () => {
  it('is ready only when every required production dependency is ready', async () => {
    expect(await institutionReadiness(base)).toEqual({ ready: true, status: 'ready' });
  });

  it.each([
    ['database unavailable', { journal: journal(false) }],
    ['retention overdue', { journal: journal(true, false) }],
    ['monitoring unavailable', { monitoringConfigured: false }],
    ['required adapter absent', { adaptersInstalled: 0 }],
    ['required adapter degraded', { integrationsHealthy: false }],
    ['approved AI policy/provider absent', { intelligenceStatus: 'policy-disabled' as const }],
  ])('fails closed when %s', async (_label, patch) => {
    expect((await institutionReadiness({ ...base, ...patch })).ready).toBe(false);
  });

  it('allows AI to remain optional when the deployment says it is optional', async () => {
    expect((await institutionReadiness({
      ...base, intelligenceStatus: 'policy-disabled', requireProductionIntelligence: false,
    })).ready).toBe(true);
  });

  it('turns dependency exceptions into aggregate unavailability', async () => {
    expect(await institutionReadiness({
      ...base,
      journal: { ...journal(), healthy: async () => { throw new Error('database details'); } },
    })).toEqual({ ready: false, status: 'unavailable' });
  });
});
