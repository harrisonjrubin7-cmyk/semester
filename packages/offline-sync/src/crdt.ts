import { assertCrdt } from './policy.ts'

/**
 * A reference sequence CRDT (RGA) and add-wins set for student-authored
 * shared text and its annotations — and the server-side gate every update
 * must pass.
 *
 * Production may swap the engine for Yjs or Automerge after the benchmark and
 * threat model `docs/architecture/crdt-replication.md` requires; what must not
 * change is the envelope, the gate, and the rule that this module is reachable
 * only for classes `policy.ts` marks `crdt`.
 */

export type OpId = string // `${actor}:${seq}`

export type TextOp =
  | { kind: 'ins'; id: OpId; actor: string; seq: number; ts: number; after: OpId | null; ch: string }
  | { kind: 'del'; id: OpId; actor: string; seq: number; ts: number; target: OpId }

interface El { id: OpId; ts: number; actor: string; ch: string; dead: boolean }

const cmp = (aTs: number, aActor: string, bTs: number, bActor: string) => aTs - bTs || (aActor < bActor ? -1 : aActor > bActor ? 1 : 0)

export class TextDoc {
  private els: El[] = []
  private index = new Map<OpId, El>()
  private seen = new Set<OpId>()
  private waiting: TextOp[] = []
  private clock = 0
  private seq = 0
  /** Applied ops, in the order they were applied, for `opsSince`. */
  private log: TextOp[] = []
  readonly actor: string

  constructor(actor: string) {
    this.actor = actor
  }

  text(): string {
    return this.els.filter((e) => !e.dead).map((e) => e.ch).join('')
  }

  /** Per-actor highest contiguous sequence applied. */
  stateVector(): Record<string, number> {
    const by = new Map<string, Set<number>>()
    for (const id of this.seen) {
      const [a, s] = split(id)
      if (!by.has(a)) by.set(a, new Set())
      by.get(a)!.add(s)
    }
    const sv: Record<string, number> = {}
    for (const [a, set] of by) {
      let k = 0
      while (set.has(k + 1)) k++
      sv[a] = k
    }
    return sv
  }

  insert(at: number, s: string): TextOp[] {
    const out: TextOp[] = []
    const visible = this.els.filter((e) => !e.dead)
    let after: OpId | null = at > 0 ? visible[at - 1]!.id : null
    for (const ch of s) {
      const op: TextOp = { kind: 'ins', id: `${this.actor}:${++this.seq}`, actor: this.actor, seq: this.seq, ts: ++this.clock, after, ch }
      this.apply(op)
      out.push(op)
      after = op.id
    }
    return out
  }

  delete(at: number, len: number): TextOp[] {
    const targets = this.els.filter((e) => !e.dead).slice(at, at + len)
    return targets.map((t) => {
      const op: TextOp = { kind: 'del', id: `${this.actor}:${++this.seq}`, actor: this.actor, seq: this.seq, ts: ++this.clock, target: t.id }
      this.apply(op)
      return op
    })
  }

  /** Idempotent and order-tolerant: a duplicate is ignored, an op whose dependency has not arrived waits. */
  apply(op: TextOp): void {
    if (this.seen.has(op.id)) return
    if (!this.ready(op)) {
      if (!this.waiting.some((w) => w.id === op.id)) this.waiting.push(op)
      return
    }
    this.integrate(op)
    for (let progressed = true; progressed;) {
      progressed = false
      for (const w of [...this.waiting]) {
        if (this.ready(w)) {
          this.waiting = this.waiting.filter((x) => x !== w)
          this.integrate(w)
          progressed = true
        }
      }
    }
  }

  private ready(op: TextOp): boolean {
    return op.kind === 'ins' ? op.after === null || this.index.has(op.after) : this.index.has(op.target)
  }

  private integrate(op: TextOp): void {
    this.seen.add(op.id)
    this.log.push(op)
    this.clock = Math.max(this.clock, op.ts)
    if (op.actor === this.actor) this.seq = Math.max(this.seq, op.seq)
    if (op.kind === 'del') {
      this.index.get(op.target)!.dead = true
      return
    }
    const el: El = { id: op.id, ts: op.ts, actor: op.actor, ch: op.ch, dead: false }
    let i = op.after === null ? 0 : this.els.indexOf(this.index.get(op.after)!) + 1
    // Skip concurrent siblings (and their subtrees) that sort after this one.
    while (i < this.els.length && cmp(this.els[i]!.ts, this.els[i]!.actor, el.ts, el.actor) > 0) i++
    this.els.splice(i, 0, el)
    this.index.set(el.id, el)
  }

  opsSince(sv: Record<string, number>): TextOp[] {
    return this.log.filter((o) => o.seq > (sv[o.actor] ?? 0))
  }

  /** Ops still waiting for something that has not arrived. A growing list is a sync bug to surface. */
  waitingCount(): number {
    return this.waiting.length
  }
}

const split = (id: OpId): [string, number] => {
  const i = id.lastIndexOf(':')
  return [id.slice(0, i), Number(id.slice(i + 1))]
}

/** Add-wins set: a concurrent add and remove of the same item keeps the item. Comments, checklist items. */
export class AddWinsSet<T> {
  private adds = new Map<string, { tag: string; value: T }>()
  private removed = new Set<string>()
  private n = 0
  readonly actor: string
  constructor(actor: string) {
    this.actor = actor
  }

  add(value: T): { kind: 'add'; tag: string; value: T } {
    const op = { kind: 'add' as const, tag: `${this.actor}:${++this.n}`, value }
    this.apply(op)
    return op
  }
  remove(value: T): { kind: 'rm'; tags: string[] } {
    const op = { kind: 'rm' as const, tags: [...this.adds.values()].filter((a) => JSON.stringify(a.value) === JSON.stringify(value)).map((a) => a.tag) }
    this.apply(op)
    return op
  }
  apply(op: { kind: 'add'; tag: string; value: T } | { kind: 'rm'; tags: string[] }): void {
    if (op.kind === 'add') { if (!this.removed.has(op.tag)) this.adds.set(op.tag, { tag: op.tag, value: op.value }) }
    else for (const t of op.tags) { this.removed.add(t); this.adds.delete(t) }
  }
  values(): T[] {
    return [...this.adds.values()].map((a) => a.value)
  }
}

// ---- the gate every update passes -----------------------------------------

export interface CrdtUpdate {
  updateId: string
  docId: string
  tenantId: string
  userId: string
  deviceId: string
  ops: TextOp[]
  stateVector: Record<string, number>
  policyVersion: string
  permissionEpoch: number
  /** SHA-256 of the canonical ops, so a relay cannot alter them. */
  payloadHash: string
  dataClass: string
}

export type GateVerdict =
  | { accepted: true; duplicate: boolean }
  | { accepted: false; reason: 'not_a_crdt_class' | 'tenant_mismatch' | 'not_a_member' | 'read_only' | 'permission_epoch_stale' | 'too_large' | 'rate_limited' | 'hash_mismatch' | 'malformed' }

export interface GateDeps {
  member(docId: string, userId: string): { role: 'editor' | 'commenter' | 'viewer'; epoch: number } | null
  docTenant(docId: string): string | null
  seen(updateId: string): boolean
  recent(userId: string, windowMs: number): number
  hash(ops: TextOp[]): Promise<string>
  limits: { maxOps: number; maxPerMinute: number }
}

/**
 * Accepts or refuses one update. Runs for every update, including one a
 * device queued days ago and replays now: a person removed since then, or a
 * role lowered since, fails here and cannot merge.
 */
export async function gateUpdate(u: CrdtUpdate, g: GateDeps): Promise<GateVerdict> {
  try { assertCrdt(u.dataClass) } catch { return { accepted: false, reason: 'not_a_crdt_class' } }
  if (!u.ops?.length || !u.updateId) return { accepted: false, reason: 'malformed' }
  if (g.docTenant(u.docId) !== u.tenantId) return { accepted: false, reason: 'tenant_mismatch' }
  const m = g.member(u.docId, u.userId)
  if (!m) return { accepted: false, reason: 'not_a_member' }
  if (u.permissionEpoch < m.epoch) return { accepted: false, reason: 'permission_epoch_stale' }
  // A commenter may add annotations but not edit the text; the caller maps roles to op kinds.
  if (m.role === 'viewer') return { accepted: false, reason: 'read_only' }
  if (u.ops.length > g.limits.maxOps) return { accepted: false, reason: 'too_large' }
  if (g.recent(u.userId, 60_000) >= g.limits.maxPerMinute) return { accepted: false, reason: 'rate_limited' }
  if ((await g.hash(u.ops)) !== u.payloadHash) return { accepted: false, reason: 'hash_mismatch' }
  return { accepted: true, duplicate: g.seen(u.updateId) }
}
