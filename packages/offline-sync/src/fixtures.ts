import { ReferenceGateway, type GatewayOptions } from './testing/reference-gateway.ts'
import { SyncEngine, type EngineDeps } from './engine.ts'
import { memoryStore } from './memory-store.ts'
import type { LocalStore } from './types.ts'

export const NOW = 1_800_000_000_000

export interface Rig {
  t: { now: number }
  /** This device's clock error, added to the shared (server) clock. */
  skew: { ms: number }
  gw: ReferenceGateway
  store: LocalStore
  engine: SyncEngine
  wipes: string[]
  revoked: { dataClass: string; id: string }[]
  sync(): ReturnType<SyncEngine['syncOnce']>
  advance(ms: number): void
}

interface RigOptions extends Partial<EngineDeps> {
  /** Share the server and the clock with another device of the same person. */
  with?: Rig
  device?: string
  gateway?: Partial<GatewayOptions>
}

export function rig(o: RigOptions = {}): Rig {
  const { with: other, device = 'dev-a', gateway, ...deps } = o
  const t = other?.t ?? { now: NOW }
  const gw = other?.gw ?? new ReferenceGateway({ now: () => t.now, ...gateway })
  const skew = { ms: 0 }
  const store = deps.store ?? memoryStore()
  const wipes: string[] = []
  const revoked: { dataClass: string; id: string }[] = []
  let n = 0
  const engine = new SyncEngine({
    store,
    transport: gw,
    identity: { tenantId: 't1', userId: 'u1', deviceId: device },
    now: () => t.now + skew.ms,
    newId: () => `${device}-c${++n}`,
    random: () => 0.5,
    onWipe: async (r) => { wipes.push(r) },
    onRevokedRows: async (rows) => { revoked.push(...rows) },
    ...deps,
  })
  return { t, skew, gw, store, engine, wipes, revoked, sync: () => engine.syncOnce(), advance: (ms) => { t.now += ms } }
}
