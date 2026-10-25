import { zite } from 'zitejs/db';
import { sourceState, SourceView } from './sources';

/** Loads the tenant's data feeds with freshness computed server-side. */
export async function tenantSources(institutionId: string): Promise<SourceView[]> {
  const { rows } = await zite.sql({
    query: `SELECT i."name", i."connector", i."enabled", i."authorizedByInstitution" AS auth, i."syncStatus", i."lastSyncedAt"
            FROM "Integrations" i JOIN "IntegrationsInstitutions" l ON l."integrationsId" = i.id WHERE l."institutionsId" = $1`,
    params: [institutionId],
  });
  const now = new Date();
  return (rows as Record<string, unknown>[]).map((r) => sourceState({
    name: String(r.name ?? 'Unnamed source'), connector: String(r.connector ?? ''), enabled: !!r.enabled, authorized: !!r.auth,
    syncStatus: String(r.syncStatus ?? 'Never Run'), lastSyncedAt: r.lastSyncedAt ? String(r.lastSyncedAt) : null,
  }, now));
}
