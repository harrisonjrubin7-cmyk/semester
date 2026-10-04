/**
 * Hybrid logical clock. Orders edits across devices without trusting any
 * device's wall clock: a phone set a year ahead cannot win every conflict,
 * because the server clamps what it receives to its own time plus a bound.
 */
export interface Hlc {
  /** Milliseconds, wall-clock-ish; never ahead of the server by more than the drift bound. */
  wall: number
  /** Breaks ties within one millisecond. */
  counter: number
  /** The device installation, so two clocks are never equal. */
  node: string
}

export const MAX_DRIFT_MS = 5 * 60_000

export function hlcNow(prev: Hlc | null, wallNow: number, node: string): Hlc {
  if (!prev || wallNow > prev.wall) return { wall: wallNow, counter: 0, node }
  return { wall: prev.wall, counter: prev.counter + 1, node }
}

/** Merge a clock seen from elsewhere into ours (on receive). Rejects an absurd one. */
export function hlcReceive(local: Hlc, remote: Hlc, wallNow: number, node: string, maxDrift = MAX_DRIFT_MS): Hlc {
  if (remote.wall - wallNow > maxDrift) throw new RangeError('remote clock is too far ahead')
  const wall = Math.max(local.wall, remote.wall, wallNow)
  const counter =
    wall === local.wall && wall === remote.wall ? Math.max(local.counter, remote.counter) + 1
    : wall === local.wall ? local.counter + 1
    : wall === remote.wall ? remote.counter + 1
    : 0
  return { wall, counter, node }
}

/**
 * What the server does to a client's clock before ordering by it: nothing
 * later than the moment the command actually arrived. A phone set a year ahead
 * therefore gets no advantage over edits that reach the server after its own —
 * it can claim to be "now", never "the future". A clock set *back* only hurts
 * its owner. What no scheme can do without trusted time is stop a device that
 * simply syncs last; that is why same-field conflicts on anything a person
 * would mind losing are asked about, not settled by the clock (`policy.ts`).
 */
export function clampToServer(h: Hlc, serverNow: number): Hlc {
  return h.wall > serverNow ? { wall: serverNow, counter: 0, node: h.node } : h
}

export function hlcCompare(a: Hlc, b: Hlc): number {
  return a.wall - b.wall || a.counter - b.counter || (a.node < b.node ? -1 : a.node > b.node ? 1 : 0)
}

export const hlcEncode = (h: Hlc): string =>
  `${h.wall.toString(36).padStart(10, '0')}:${h.counter.toString(36).padStart(4, '0')}:${h.node}`

export function hlcDecode(s: string): Hlc {
  const [w, c, ...n] = s.split(':')
  return { wall: parseInt(w, 36), counter: parseInt(c, 36), node: n.join(':') }
}
