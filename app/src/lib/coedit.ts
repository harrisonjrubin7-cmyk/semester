import type { DesignData, DesignLayer } from './creations';

/**
 * Two people on one canvas.
 *
 * The last unbuilt half of the build-out plan's Design row. Everything here is
 * pure: what to do with an edit that arrives, given what this device has
 * already applied. `lib/cocanvas.ts` carries it out over a channel, and the
 * reason the two are separate files is the reason `lib/mesh.ts` is separate
 * from `lib/rtc.ts` — the hard part is the arithmetic, and the arithmetic can
 * be tested.
 *
 * ## The granularity is the layer, and that is a decision
 *
 * `lib/merge.ts` already settled this app's position on two devices changing
 * one thing, and it is worth quoting because this follows it rather than
 * inventing a second answer: fields merge, "what still does not merge is one
 * record edited on both devices: the later edit of the same note is the one
 * that survives. Anything cleverer is a distributed-systems project, and
 * pretending otherwise in the UI would be worse than saying it plainly."
 *
 * So: **two people editing different layers never collide**, which is nearly
 * every minute of two people on a poster — you move the headline, I move the
 * photograph. Two people dragging the *same* layer, at the same moment, end
 * with the later edit, and the earlier one sees their drag undone. That is a
 * real loss and the screen says it rather than implying a merge that is not
 * happening.
 *
 * ## Time is the sender's clock, and that is survivable here
 *
 * An edit carries the moment its author made it. Two devices with clocks a
 * minute apart will therefore let the wrong one win a collision — but a
 * collision is two people on one layer within a second of each other, and the
 * loss is one drag rather than a document. The alternative is a counter per
 * layer agreed between peers, which is a protocol, and protocols fail in ways
 * that lose more than a drag.
 *
 * Ties break by sender id, so every device resolves the same collision the
 * same way. That matters more than which one wins: two devices disagreeing
 * about who won is how a canvas ends up different on two screens with nobody
 * able to say why.
 *
 * ## Tombstones, because deleting is the edit that comes back
 *
 * A layer deleted here and dragged there, with the drag arriving second,
 * resurrects it — unless the delete is remembered. `seen` holds the moment of
 * the last edit applied per layer id and keeps holding it after a delete, so a
 * stale update to a dead layer is dropped rather than recreating it. The test
 * for that is the one worth reading.
 */

export type Edit =
  /** A layer made or changed. */
  | { t: 'layer'; id: string; at: number; from: string; layer: DesignLayer }
  /** A layer removed. */
  | { t: 'drop'; id: string; at: number; from: string }
  /** The paper itself — its size and colour. */
  | { t: 'paper'; at: number; from: string; width: number; height: number; background: string }
  /** The whole canvas, for somebody who has just arrived. */
  | { t: 'whole'; at: number; from: string; canvas: DesignData };

/** The moment of the last edit applied, per layer id, plus the paper's. */
export type Seen = Record<string, { at: number; from: string }>;

/** The key `seen` files the paper under. A layer id is a uuid, so no collision. */
export const PAPER = 'paper';

/**
 * Whether an arriving edit is newer than what this device already applied.
 *
 * Exported because the answer is the whole of the conflict rule, and a reader
 * deciding whether to trust this file should be able to find it in four lines
 * rather than inside a fold.
 */
export function newer(had: { at: number; from: string } | undefined, at: number, from: string): boolean {
  if (!had) return true;
  if (at !== had.at) return at > had.at;
  // The same millisecond. Decided by id so that every device decides it the
  // same way — which matters more than which of them wins.
  return from > had.from;
}

/** What one edit does to a canvas, and what it does to what we have applied. */
export interface Folded {
  canvas: DesignData;
  seen: Seen;
  /** False when the edit was stale or a no-op, so React is not re-rendered. */
  changed: boolean;
}

/**
 * One edit, folded in.
 *
 * Never mutates either argument: the canvas is React state on the way in and
 * an in-place change is a render that does not happen.
 */
export function fold(canvas: DesignData, seen: Seen, edit: Edit): Folded {
  const nothing: Folded = { canvas, seen, changed: false };

  if (edit.t === 'whole') {
    /*
     * Only for a canvas that has nothing on it. A joiner asks for the state
     * and is sent this; anybody else receiving it has their own work, and
     * overwriting it would be this feature's worst possible failure — one
     * person opening a shared canvas and everybody else losing an afternoon.
     */
    if (canvas.layers.length > 0) return nothing;
    const seenNow: Seen = { [PAPER]: { at: edit.at, from: edit.from } };
    for (const l of edit.canvas.layers) seenNow[l.id] = { at: edit.at, from: edit.from };
    return { canvas: edit.canvas, seen: seenNow, changed: true };
  }

  if (edit.t === 'paper') {
    if (!newer(seen[PAPER], edit.at, edit.from)) return nothing;
    return {
      canvas: { ...canvas, width: edit.width, height: edit.height, background: edit.background },
      seen: { ...seen, [PAPER]: { at: edit.at, from: edit.from } },
      changed: true,
    };
  }

  if (!newer(seen[edit.id], edit.at, edit.from)) return nothing;
  const mark: Seen = { ...seen, [edit.id]: { at: edit.at, from: edit.from } };

  if (edit.t === 'drop') {
    // The mark stays after the layer goes. That is the tombstone: a stale
    // update to a deleted layer is now older than what we applied, and is
    // dropped rather than recreating it.
    if (!canvas.layers.some((l) => l.id === edit.id)) return { canvas, seen: mark, changed: false };
    return { canvas: { ...canvas, layers: canvas.layers.filter((l) => l.id !== edit.id) }, seen: mark, changed: true };
  }

  const at = canvas.layers.findIndex((l) => l.id === edit.id);
  const layers =
    at === -1
      ? [...canvas.layers, edit.layer]
      : canvas.layers.map((l) => (l.id === edit.id ? edit.layer : l));
  return { canvas: { ...canvas, layers }, seen: mark, changed: true };
}

/** Every edit in order, for a burst that arrived together. */
export function foldAll(canvas: DesignData, seen: Seen, edits: Edit[]): Folded {
  let out: Folded = { canvas, seen, changed: false };
  for (const e of edits) {
    const next = fold(out.canvas, out.seen, e);
    out = { ...next, changed: out.changed || next.changed };
  }
  return out;
}

/**
 * The edits that describe a canvas to somebody who has just arrived.
 *
 * One `whole`, not a layer each: a joiner with nothing wants the state in one
 * message, and sending forty layers as forty edits is forty chances for one to
 * be lost and no way to tell that it was.
 */
export function describe(canvas: DesignData, from: string, at: number): Edit {
  return { t: 'whole', at, from, canvas };
}

/** The edit that says what just happened to one layer here. */
export const layerEdit = (layer: DesignLayer, from: string, at: number): Edit => ({
  t: 'layer',
  id: layer.id,
  at,
  from,
  layer,
});

/** The edit that says a layer went. */
export const dropEdit = (id: string, from: string, at: number): Edit => ({ t: 'drop', id, at, from });

/** The edit that says the paper changed. */
export const paperEdit = (canvas: DesignData, from: string, at: number): Edit => ({
  t: 'paper',
  at,
  from,
  width: canvas.width,
  height: canvas.height,
  background: canvas.background,
});

/**
 * What this device changed, compared with what it had.
 *
 * The editor hands back a whole canvas on every change — it has no notion of
 * which layer moved — so the edits to send are worked out by comparing. That
 * is a scan of at most sixty layers on a drag, which is nothing, and it keeps
 * the editor unaware that anybody is watching.
 *
 * Identity is by value, not by reference: the editor rebuilds layer objects,
 * so a reference check would report every layer changed on every keystroke and
 * flood the channel.
 */
export function changes(was: DesignData, now: DesignData, from: string, at: number): Edit[] {
  const edits: Edit[] = [];

  if (was.width !== now.width || was.height !== now.height || was.background !== now.background) {
    edits.push(paperEdit(now, from, at));
  }

  const before = new Map(was.layers.map((l) => [l.id, l]));
  for (const l of now.layers) {
    const had = before.get(l.id);
    if (!had || !same(had, l)) edits.push(layerEdit(l, from, at));
  }

  const after = new Set(now.layers.map((l) => l.id));
  for (const l of was.layers) if (!after.has(l.id)) edits.push(dropEdit(l.id, from, at));

  return edits;
}

/** Two layers with the same content. Every field, so a new one is not missed. */
function same(a: DesignLayer, b: DesignLayer): boolean {
  return (
    a.kind === b.kind &&
    a.x === b.x &&
    a.y === b.y &&
    a.w === b.w &&
    a.h === b.h &&
    a.text === b.text &&
    a.fill === b.fill &&
    a.fontSize === b.fontSize &&
    a.bold === b.bold &&
    a.opacity === b.opacity &&
    a.fileId === b.fileId
  );
}
