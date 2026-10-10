import { classifyPersistence, policyFor, type TenantOfflinePolicy, NO_OPT_IN } from './policy.ts'
import type { LocalStore } from './types.ts'

export type PolicyPurgeKind = 'entity' | 'outbox'

export interface PolicyPurgeRow {
  kind: PolicyPurgeKind
  dataClass: string
  id: string
  why: 'unknown_class' | 'not_cacheable' | 'tenant_has_not_opted_in' | 'offline_write_prohibited'
}

export interface PolicyPurgeResult {
  rows: PolicyPurgeRow[]
  entities: number
  outbox: number
}

/**
 * Remove data that an older build, changed tenant policy, or malformed sync
 * response left behind. This is deliberately safe to run at startup, before
 * every sync, and whenever policy changes.
 *
 * The callback is the purge hook for attachment/search/preview stores. It is
 * called after the content rows are gone and contains no row payload.
 */
export async function purgeDisallowedOfflineData(
  store: LocalStore,
  tenant: TenantOfflinePolicy = NO_OPT_IN,
  onPurged?: (rows: readonly PolicyPurgeRow[]) => Promise<void>,
): Promise<PolicyPurgeResult> {
  const rows: PolicyPurgeRow[] = []
  await store.transaction(async () => {
    for (const entity of await store.entities.all()) {
      const decision = classifyPersistence(String(entity.dataClass), tenant)
      if (decision.allowed) continue
      await store.entities.remove(String(entity.dataClass), entity.id)
      rows.push({ kind: 'entity', dataClass: String(entity.dataClass), id: entity.id, why: decision.why })
    }

    for (const command of await store.outbox.all()) {
      let allowed = false
      try {
        const write = policyFor(String(command.dataClass)).write
        allowed = write === 'auto' || write === 'held-send'
      } catch {
        // Unknown classifications fail closed and are purged below.
      }
      if (allowed) continue
      await store.outbox.remove(command.id)
      const persistence = classifyPersistence(String(command.dataClass), tenant)
      rows.push({
        kind: 'outbox', dataClass: String(command.dataClass), id: command.entityId,
        why: persistence.allowed ? 'offline_write_prohibited' : persistence.why,
      })
    }
  })
  if (rows.length) await onPurged?.(rows)
  return {
    rows,
    entities: rows.filter((row) => row.kind === 'entity').length,
    outbox: rows.filter((row) => row.kind === 'outbox').length,
  }
}
