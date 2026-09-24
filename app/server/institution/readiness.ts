import type { ActionJournalStore } from './journal.ts';

export interface ReadinessRequirements {
  journal: ActionJournalStore;
  monitoringConfigured: boolean;
  adaptersInstalled: number;
  minimumAdapters?: number;
  integrationsHealthy: boolean;
  intelligenceStatus: 'policy-disabled' | 'configured-sandbox' | 'configured-production';
  requireProductionIntelligence?: boolean;
}

export interface ReadinessResult {
  ready: boolean;
  status: 'ready' | 'unavailable';
}

/**
 * Production readiness is deliberately stricter than liveness. The public
 * endpoint receives only the aggregate result; individual dependency names
 * remain in server telemetry rather than becoming an unauthenticated map.
 */
export async function institutionReadiness(requirements: ReadinessRequirements): Promise<ReadinessResult> {
  let journalReady = false;
  let retentionReady = false;
  try {
    journalReady = await requirements.journal.healthy();
    retentionReady = requirements.journal.retentionHealthy
      ? await requirements.journal.retentionHealthy()
      : true;
  } catch {
    // A readiness dependency throwing is unavailability, not an internal
    // error to expose to an unauthenticated probe.
  }
  const adaptersReady = requirements.adaptersInstalled >= (requirements.minimumAdapters ?? 0);
  const integrationsReady = (requirements.minimumAdapters ?? 0) === 0 || requirements.integrationsHealthy;
  const intelligenceReady = !requirements.requireProductionIntelligence ||
    requirements.intelligenceStatus === 'configured-production';
  const ready = Boolean(
    journalReady && retentionReady && requirements.monitoringConfigured && adaptersReady && integrationsReady && intelligenceReady,
  );
  return { ready, status: ready ? 'ready' : 'unavailable' };
}
