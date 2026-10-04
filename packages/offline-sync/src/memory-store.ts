import type { EntityRow, LocalStore, OutboxRow } from './types.ts'

/** A LocalStore for tests and for the web fallback before IndexedDB is wired in. */
export function memoryStore(): LocalStore {
  let outbox = new Map<string, OutboxRow>()
  let entities = new Map<string, EntityRow>()
  let cursors = new Map<string, string>()
  const key = (c: string, id: string) => `${c}\u0000${id}`
  let depth = 0
  return {
    async transaction(fn) {
      if (depth++ > 0) {
        try { return await fn() } finally { depth-- }
      }
      const snap = { o: new Map(outbox), e: new Map(entities), c: new Map(cursors) }
      try {
        return await fn()
      } catch (err) {
        outbox = snap.o
        entities = snap.e
        cursors = snap.c
        throw err
      } finally {
        depth--
      }
    },
    outbox: {
      async put(r) { outbox.set(r.id, structuredClone(r)) },
      async get(id) { const r = outbox.get(id); return r && structuredClone(r) },
      async all() { return [...outbox.values()].map((r) => structuredClone(r)).sort((a, b) => a.seq - b.seq) },
      async remove(id) { outbox.delete(id) },
    },
    entities: {
      async put(r) { entities.set(key(r.dataClass, r.id), structuredClone(r)) },
      async get(c, id) { const r = entities.get(key(c, id)); return r && structuredClone(r) },
      async all() { return [...entities.values()].map((r) => structuredClone(r)) },
      async remove(c, id) { entities.delete(key(c, id)) },
    },
    cursors: {
      async get(s) { return cursors.get(s) },
      async set(s, v) { cursors.set(s, v) },
    },
  }
}
