import type { EntityRow, LocalStore, OutboxRow } from './types.ts'

/** Everything a store holds, in a form that can be written down and read back. */
export interface StoreSnapshot {
  outbox: OutboxRow[]
  entities: EntityRow[]
  cursors: Record<string, string>
}

/**
 * JSON that survives what a queue holds: `Infinity` (a terminal rejection is never retried) is not JSON, and
 * `JSON.stringify` would turn it into `null` — which `null <= now` then reads as "due now". A rejected row
 * silently becoming sendable again after a restart is exactly the failure this codec exists to prevent.
 */
export const encodeSnapshot = (s: StoreSnapshot): string =>
  JSON.stringify(s, (_k, v: unknown) => (v === Infinity ? { $: 'inf' } : v))

export function decodeSnapshot(json: string): StoreSnapshot {
  const s = JSON.parse(json, (_k, v: unknown) => (v && typeof v === 'object' && (v as { $?: string }).$ === 'inf' ? Infinity : v)) as StoreSnapshot
  return { outbox: s.outbox ?? [], entities: s.entities ?? [], cursors: s.cursors ?? {} }
}

export interface MemoryStoreOptions {
  /** Start from what was last written down. */
  initial?: StoreSnapshot
  /**
   * Called with the whole state after each committed change — once per transaction, once per write
   * made outside one — never after a rollback. Calls are serialised, so a slow write cannot be overtaken by a
   * later one. A failure is kept and reported by `flush`, not thrown into the engine mid-sync.
   */
  onCommit?: (s: StoreSnapshot) => Promise<void>
}

/** A LocalStore held in memory, optionally written through to somewhere durable. */
export function memoryStore(opts: MemoryStoreOptions = {}): LocalStore & { snapshot(): StoreSnapshot; flush(): Promise<void> } {
  let outbox = new Map<string, OutboxRow>((opts.initial?.outbox ?? []).map((r) => [r.id, r]))
  const key = (c: string, id: string) => `${c}\u0000${id}`
  let entities = new Map<string, EntityRow>((opts.initial?.entities ?? []).map((e) => [key(e.dataClass, e.id), e]))
  let cursors = new Map<string, string>(Object.entries(opts.initial?.cursors ?? {}))
  let transactionActive = false
  let transactionTail: Promise<void> = Promise.resolve()
  let writing: Promise<void> = Promise.resolve()
  let dirty: { snapshot: StoreSnapshot; version: number } | undefined
  let nextVersion = 0
  let failure: unknown

  const snapshot = (): StoreSnapshot => ({
    outbox: [...outbox.values()].map((r) => structuredClone(r)),
    entities: [...entities.values()].map((e) => structuredClone(e)),
    cursors: Object.fromEntries(cursors),
  })
  const enqueue = (pending: { snapshot: StoreSnapshot; version: number }) => {
    writing = writing.then(async () => {
      try {
        await opts.onCommit!(pending.snapshot)
        if (dirty?.version === pending.version) {
          dirty = undefined
          failure = undefined
        }
      } catch (err) {
        if (dirty?.version === pending.version) failure = err
      }
    })
  }
  const changed = () => {
    if (transactionActive || !opts.onCommit) return
    const pending = { snapshot: snapshot(), version: ++nextVersion }
    dirty = pending
    failure = undefined
    enqueue(pending)
  }

  return {
    snapshot,
    async flush() {
      await writing
      if (failure !== undefined) { const f = failure; failure = undefined; throw f }
      if (dirty) {
        enqueue(dirty)
        await writing
        if (failure !== undefined) { const f = failure; failure = undefined; throw f }
      }
    },
    async transaction(fn) {
      let release!: () => void
      const previous = transactionTail
      transactionTail = new Promise<void>((resolve) => { release = resolve })
      await previous
      transactionActive = true
      const snap = { o: new Map(outbox), e: new Map(entities), c: new Map(cursors) }
      let ok = false
      try {
        const out = await fn()
        ok = true
        return out
      } catch (err) {
        outbox = snap.o
        entities = snap.e
        cursors = snap.c
        throw err
      } finally {
        transactionActive = false
        if (ok) changed()
        release()
      }
    },
    outbox: {
      async put(r) { outbox.set(r.id, structuredClone(r)); changed() },
      async get(id) { const r = outbox.get(id); return r && structuredClone(r) },
      async all() { return [...outbox.values()].map((r) => structuredClone(r)).sort((a, b) => a.seq - b.seq) },
      async remove(id) { outbox.delete(id); changed() },
    },
    entities: {
      async put(r) { entities.set(key(r.dataClass, r.id), structuredClone(r)); changed() },
      async get(c, id) { const r = entities.get(key(c, id)); return r && structuredClone(r) },
      async all() { return [...entities.values()].map((r) => structuredClone(r)) },
      async remove(c, id) { entities.delete(key(c, id)); changed() },
    },
    cursors: {
      async get(s) { return cursors.get(s) },
      async set(s, v) { cursors.set(s, v); changed() },
      async remove(s) { cursors.delete(s); changed() },
    },
  }
}
