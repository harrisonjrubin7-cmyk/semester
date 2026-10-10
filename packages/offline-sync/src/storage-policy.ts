import { classifyPersistence, policyFor, type TenantOfflinePolicy, NO_OPT_IN } from './policy.ts'
import type { EntityRow, LocalStore } from './types.ts'

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

const JOURNAL = '__offline_policy_purge_journal__'
const keyOf = (row: PolicyPurgeRow) => `${row.kind}\u0000${row.dataClass}\u0000${row.id}\u0000${row.why}`

function readJournal(raw: string | undefined): PolicyPurgeRow[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.filter((row): row is PolicyPurgeRow => {
      if (!row || typeof row !== 'object') return false
      const candidate = row as Partial<PolicyPurgeRow>
      return (candidate.kind === 'entity' || candidate.kind === 'outbox') && typeof candidate.dataClass === 'string' && typeof candidate.id === 'string' && typeof candidate.why === 'string'
    })
  } catch {
    return []
  }
}

function mergeRows(left: readonly PolicyPurgeRow[], right: readonly PolicyPurgeRow[]): PolicyPurgeRow[] {
  return [...new Map([...left, ...right].map((row) => [keyOf(row), row])).values()]
}

function restoredEntity(entity: EntityRow): EntityRow | undefined {
  if (entity.confirmed === undefined) return undefined
  return { ...entity, value: entity.confirmed, phase: 'reconciled', commandId: undefined }
}

/**
 * Primary deletion and the content-free secondary-cleanup journal commit
 * together. The journal is acknowledged only after the idempotent hook
 * succeeds, so a restart can finish cleanup without retaining payloads.
 */
export async function purgeDisallowedOfflineData(
  store: LocalStore,
  tenant: TenantOfflinePolicy = NO_OPT_IN,
  onPurged?: (rows: readonly PolicyPurgeRow[]) => Promise<void>,
): Promise<PolicyPurgeResult> {
  const prior = readJournal(await store.cursors.get(JOURNAL))
  const entities = await store.entities.all()
  const outbox = await store.outbox.all()
  const rows: PolicyPurgeRow[] = []
  const entityRemovals: Array<{ dataClass: string; id: string }> = []
  const commandRemovals: string[] = []
  const repairs = new Map<string, EntityRow | undefined>()

  for (const entity of entities) {
    const decision = classifyPersistence(String(entity.dataClass), tenant)
    if (decision.allowed) continue
    entityRemovals.push({ dataClass: String(entity.dataClass), id: entity.id })
    rows.push({ kind: 'entity', dataClass: String(entity.dataClass), id: entity.id, why: decision.why })
  }

  for (const command of outbox) {
    let allowed = false
    try {
      const write = policyFor(String(command.dataClass)).write
      allowed = write === 'auto' || write === 'held-send'
    } catch {
      // Unknown classifications fail closed.
    }
    if (allowed) continue
    commandRemovals.push(command.id)
    const persistence = classifyPersistence(String(command.dataClass), tenant)
    rows.push({ kind: 'outbox', dataClass: String(command.dataClass), id: command.entityId, why: persistence.allowed ? 'offline_write_prohibited' : persistence.why })
    const entity = entities.find((candidate) => candidate.dataClass === command.dataClass && candidate.id === command.entityId)
    if (entity && classifyPersistence(String(entity.dataClass), tenant).allowed) repairs.set(`${entity.dataClass}\u0000${entity.id}`, restoredEntity(entity))
  }

  const pending = mergeRows(prior, rows)
  if (rows.length) {
    await store.transaction(async () => {
      for (const row of entityRemovals) await store.entities.remove(row.dataClass, row.id)
      for (const id of commandRemovals) await store.outbox.remove(id)
      for (const [key, entity] of repairs) {
        const split = key.indexOf('\u0000')
        if (entity) await store.entities.put(entity)
        else await store.entities.remove(key.slice(0, split), key.slice(split + 1))
      }
      if (onPurged && pending.length) await store.cursors.set(JOURNAL, JSON.stringify(pending))
    })
  }

  if (onPurged && pending.length) {
    await onPurged(pending)
    await store.transaction(async () => { await store.cursors.remove(JOURNAL) })
  } else if (!onPurged && prior.length) {
    await store.transaction(async () => { await store.cursors.remove(JOURNAL) })
  }

  return {
    rows,
    entities: rows.filter((row) => row.kind === 'entity').length,
    outbox: rows.filter((row) => row.kind === 'outbox').length,
  }
}
