import { describe, expect, it } from 'vitest';
import { newCreation } from './creations';
import type { DesignData, DesignLayer, DesignNote } from './creations';
import {
  PAPER,
  changes,
  describe as describeCanvas,
  dropEdit,
  fold,
  foldAll,
  foldNote,
  foldNotes,
  layerEdit,
  newer,
  noteChanges,
} from './coedit';
import type { Seen } from './coedit';

/**
 * The arithmetic of two people on one canvas.
 *
 * Everything the transport can be wrong about is unreachable from here, and
 * that is deliberate: the transport is a Supabase broadcast channel and cannot
 * be driven in this container at all. What *can* be established is that the
 * rules are right — which edit wins, what a delete does to a late update, and
 * that a joiner's state never lands on top of somebody's work.
 */

const NOW = 1_700_000_000_000;

const layer = (id: string, over: Partial<DesignLayer> = {}): DesignLayer => ({
  id,
  kind: 'text',
  x: 10,
  y: 20,
  w: 100,
  h: 40,
  text: 'hello',
  fill: '#000000',
  fontSize: 24,
  bold: false,
  opacity: 1,
  rotation: 0,
  gradient: null,
  fileId: '',
  ...over,
});

const canvasOf = (...layers: DesignLayer[]): DesignData => ({
  ...newCreation('design').design,
  layers,
});

describe('which edit wins', () => {
  it('is the later one', () => {
    expect(newer({ at: NOW, from: 'a' }, NOW + 1, 'b')).toBe(true);
    expect(newer({ at: NOW, from: 'a' }, NOW - 1, 'b')).toBe(false);
  });

  it('in the same millisecond, is decided by id — the same way on every device', () => {
    // Which one wins matters less than that two devices never disagree, which
    // is how a canvas ends up different on two screens with nobody able to say
    // why.
    expect(newer({ at: NOW, from: 'aaa' }, NOW, 'bbb')).toBe(true);
    expect(newer({ at: NOW, from: 'bbb' }, NOW, 'aaa')).toBe(false);
  });

  it('is anything at all, when nothing has been applied', () => {
    expect(newer(undefined, 0, 'a')).toBe(true);
  });
});

describe('an edit arriving', () => {
  it('adds a layer this device has never seen', () => {
    const out = fold(canvasOf(), {}, layerEdit(layer('one'), 'them', NOW));
    expect(out.changed).toBe(true);
    expect(out.canvas.layers.map((l) => l.id)).toEqual(['one']);
  });

  it('replaces one it has', () => {
    const out = fold(canvasOf(layer('one')), { one: { at: NOW, from: 'me' } },
      layerEdit(layer('one', { x: 999 }), 'them', NOW + 10));
    expect(out.canvas.layers[0].x).toBe(999);
  });

  it('is ignored when it is older than what was applied', () => {
    // Broadcast does not promise order, so this is not hypothetical.
    const seen: Seen = { one: { at: NOW + 100, from: 'me' } };
    const out = fold(canvasOf(layer('one', { x: 5 })), seen, layerEdit(layer('one', { x: 999 }), 'them', NOW));
    expect(out.changed).toBe(false);
    expect(out.canvas.layers[0].x).toBe(5);
  });

  it('leaves the canvas object alone when nothing changed', () => {
    const canvas = canvasOf(layer('one'));
    const out = fold(canvas, { one: { at: NOW + 100, from: 'me' } }, layerEdit(layer('one'), 'them', NOW));
    expect(out.canvas).toBe(canvas);
    expect(out.seen).toBe(out.seen);
  });

  it('never mutates the canvas it was given', () => {
    const canvas = canvasOf(layer('one'));
    fold(canvas, {}, layerEdit(layer('one', { x: 777 }), 'them', NOW + 5));
    expect(canvas.layers[0].x).toBe(10);
  });
});

describe('a layer deleted', () => {
  it('goes', () => {
    const out = fold(canvasOf(layer('one')), {}, dropEdit('one', 'them', NOW));
    expect(out.canvas.layers).toEqual([]);
    expect(out.changed).toBe(true);
  });

  it('does not come back when a slow update to it arrives afterwards', () => {
    /*
     * The bug this file's tombstones exist for, and the test worth reading.
     * Somebody deletes a layer; somebody else was mid-drag on it and their
     * update lands second. Without the mark surviving the delete, the layer
     * reappears — on one screen and not the other, which is worse than either
     * outcome.
     */
    const gone = fold(canvasOf(layer('one')), {}, dropEdit('one', 'them', NOW + 10));
    const late = fold(gone.canvas, gone.seen, layerEdit(layer('one', { x: 999 }), 'me', NOW));
    expect(late.canvas.layers, 'a deleted layer was resurrected').toEqual([]);
    expect(late.changed).toBe(false);
  });

  it('does come back if somebody deliberately makes it again afterwards', () => {
    // The tombstone must not be permanent: a later edit is a later edit.
    const gone = fold(canvasOf(layer('one')), {}, dropEdit('one', 'them', NOW));
    const again = fold(gone.canvas, gone.seen, layerEdit(layer('one'), 'me', NOW + 50));
    expect(again.canvas.layers.map((l) => l.id)).toEqual(['one']);
  });

  it('is not a change when it was already gone', () => {
    const out = fold(canvasOf(), {}, dropEdit('ghost', 'them', NOW));
    expect(out.changed).toBe(false);
    expect(out.seen.ghost).toEqual({ at: NOW, from: 'them' });
  });
});

describe('the paper', () => {
  it('takes a newer size and colour', () => {
    const out = fold(canvasOf(), {}, { t: 'paper', at: NOW, from: 'them', width: 800, height: 600, background: '#ffffff' });
    expect([out.canvas.width, out.canvas.height, out.canvas.background]).toEqual([800, 600, '#ffffff']);
  });

  it('ignores an older one', () => {
    const seen: Seen = { [PAPER]: { at: NOW + 10, from: 'me' } };
    const canvas = canvasOf();
    const out = fold(canvas, seen, { t: 'paper', at: NOW, from: 'them', width: 100, height: 100, background: '#000000' });
    expect(out.canvas).toBe(canvas);
  });
});

describe('somebody arriving', () => {
  it('is given the whole canvas, and takes it when they have nothing', () => {
    const theirs = canvasOf(layer('one'), layer('two'));
    const out = fold(canvasOf(), {}, describeCanvas(theirs, 'them', NOW));
    expect(out.canvas.layers.map((l) => l.id)).toEqual(['one', 'two']);
    expect(Object.keys(out.seen).sort()).toEqual([PAPER, 'one', 'two'].sort());
  });

  it('never lands on top of work that is already here', () => {
    /*
     * This feature's worst possible failure: one person opening a shared
     * canvas and everybody else losing an afternoon. A `whole` is only ever
     * for somebody with nothing.
     */
    const mine = canvasOf(layer('mine'));
    const out = fold(mine, {}, describeCanvas(canvasOf(layer('theirs')), 'them', NOW + 999));
    expect(out.canvas, 'an arriving peer overwrote local work').toBe(mine);
    expect(out.changed).toBe(false);
  });
});

describe('a burst of edits', () => {
  it('is applied in order and reports whether anything moved', () => {
    const out = foldAll(canvasOf(), {}, [
      layerEdit(layer('one'), 'them', NOW),
      layerEdit(layer('one', { x: 50 }), 'them', NOW + 1),
      layerEdit(layer('two'), 'them', NOW + 2),
    ]);
    expect(out.changed).toBe(true);
    expect(out.canvas.layers.map((l) => [l.id, l.x])).toEqual([['one', 50], ['two', 10]]);
  });

  it('reports nothing moved when every edit was stale', () => {
    const seen: Seen = { one: { at: NOW + 100, from: 'me' } };
    const canvas = canvasOf(layer('one'));
    expect(foldAll(canvas, seen, [layerEdit(layer('one', { x: 9 }), 'them', NOW)]).changed).toBe(false);
  });
});

describe('what to send after an edit here', () => {
  it('says nothing when nothing changed', () => {
    const canvas = canvasOf(layer('one'));
    expect(changes(canvas, canvas, 'me', NOW)).toEqual([]);
  });

  it('compares by value, not by reference', () => {
    // The editor rebuilds layer objects on every keystroke, so a reference
    // check would report every layer changed every time and flood the channel.
    const before = canvasOf(layer('one'));
    const after = canvasOf(layer('one'));
    expect(after.layers[0]).not.toBe(before.layers[0]);
    expect(changes(before, after, 'me', NOW)).toEqual([]);
  });

  /*
   * The same rule, one level down.
   *
   * `gradient` is the only field on a layer that is itself an object, so it is
   * the only one where `===` can be false for two equal values — and every
   * other field being compared by value is exactly what hides it. Written
   * separately because the test above passes with a reference check in place:
   * its layers have `gradient: null`, and `null === null` is true.
   */
  it('compares a gradient by value too, though it is an object', () => {
    const grad = () => ({ gradient: { to: '#ffffff', angle: 90 } });
    const before = canvasOf(layer('one', grad()));
    const after = canvasOf(layer('one', grad()));
    expect(after.layers[0]!.gradient).not.toBe(before.layers[0]!.gradient);
    expect(changes(before, after, 'me', NOW)).toEqual([]);
  });

  it('notices a gradient turned off, and one turned on', () => {
    const on = canvasOf(layer('one', { gradient: { to: '#ffffff', angle: 90 } }));
    const off = canvasOf(layer('one'));
    expect(changes(on, off, 'me', NOW)).toHaveLength(1);
    expect(changes(off, on, 'me', NOW)).toHaveLength(1);
  });

  it('names the one layer that moved', () => {
    const edits = changes(canvasOf(layer('one'), layer('two')), canvasOf(layer('one', { x: 99 }), layer('two')), 'me', NOW);
    expect(edits).toEqual([layerEdit(layer('one', { x: 99 }), 'me', NOW)]);
  });

  it('notices a layer added and a layer removed', () => {
    const edits = changes(canvasOf(layer('one')), canvasOf(layer('two')), 'me', NOW);
    expect(edits.map((e) => e.t)).toEqual(['layer', 'drop']);
  });

  it('notices the paper', () => {
    const before = canvasOf();
    const edits = changes(before, { ...before, background: '#123456' }, 'me', NOW);
    expect(edits.map((e) => e.t)).toEqual(['paper']);
  });

  for (const [field, over] of [
    ['x', { x: 1 }],
    ['y', { y: 1 }],
    ['w', { w: 1 }],
    ['h', { h: 1 }],
    ['text', { text: 'other' }],
    ['fill', { fill: '#ffffff' }],
    ['fontSize', { fontSize: 99 }],
    ['bold', { bold: true }],
    ['opacity', { opacity: 0.5 }],
    ['rotation', { rotation: 15 }],
    ['gradient', { gradient: { to: '#ffffff', angle: 90 } }],
    ['kind', { kind: 'rectangle' as const }],
    ['fileId', { fileId: 'abc' }],
  ] as [string, Partial<DesignLayer>][]) {
    it(`notices a change to ${field}`, () => {
      // Every field, so a layer property added later is not silently unshared.
      expect(changes(canvasOf(layer('one')), canvasOf(layer('one', over)), 'me', NOW)).toHaveLength(1);
    });
  }
});

describe('the whole round trip', () => {
  it('leaves two devices holding the same canvas', () => {
    // The property the feature exists for, asserted rather than assumed.
    let mine = canvasOf(layer('one'));
    let mySeen: Seen = {};
    let theirs = canvasOf(layer('one'));
    let theirSeen: Seen = {};

    const iMove = canvasOf(layer('one', { x: 500 }));
    for (const e of changes(mine, iMove, 'me', NOW + 1)) {
      const at = fold(theirs, theirSeen, e);
      theirs = at.canvas;
      theirSeen = at.seen;
    }
    mine = iMove;

    const theyAdd = canvasOf(layer('one', { x: 500 }), layer('two'));
    for (const e of changes(theirs, theyAdd, 'them', NOW + 2)) {
      const at = fold(mine, mySeen, e);
      mine = at.canvas;
      mySeen = at.seen;
    }
    theirs = theyAdd;

    expect(mine.layers).toEqual(theirs.layers);
  });

  it('leaves them the same after both drag the same layer at once', () => {
    // The collision. Both devices must land on the same answer, whichever it
    // is — disagreement is the failure, not loss.
    const start = canvasOf(layer('one'));
    const mineEdit = layerEdit(layer('one', { x: 100 }), 'aaa', NOW);
    const theirEdit = layerEdit(layer('one', { x: 200 }), 'bbb', NOW);

    const meFirst = foldAll(start, {}, [mineEdit, theirEdit]);
    const themFirst = foldAll(start, {}, [theirEdit, mineEdit]);
    expect(meFirst.canvas.layers).toEqual(themFirst.canvas.layers);
  });
});


/* ── Notes ───────────────────────────────────────────────────────────────── */

const note = (id: string, over: Partial<DesignNote> = {}): DesignNote => ({
  id,
  replyTo: '',
  x: 100,
  y: 200,
  at: NOW,
  authorId: 'acct-1',
  authorName: 'Harrison',
  body: 'This line runs off the edge.',
  resolved: false,
  ...over,
});

const noteEdit = (n: DesignNote, from = 'them', at = NOW + 1) =>
  ({ t: 'note', id: n.id, at, from, note: n }) as const;

describe('notes folding in from somebody else', () => {
  it('pins one that was not here', () => {
    const out = foldNote([], {}, noteEdit(note('n1')));
    expect(out.changed).toBe(true);
    expect(out.notes.map((n) => n.id)).toEqual(['n1']);
  });

  it('replaces one that was, rather than pinning it twice', () => {
    const had = [note('n1', { body: 'first' })];
    const out = foldNote(had, {}, noteEdit(note('n1', { body: 'second' })));
    expect(out.notes).toHaveLength(1);
    expect(out.notes[0]!.body).toBe('second');
  });

  /*
   * The rule the whole flat-reply design exists for. Two people answering the
   * same note at the same moment must both be heard — which is true here only
   * because their replies have different ids and never contend for one key.
   */
  it('keeps both answers when two people reply at once', () => {
    let out = foldNote([note('n1')], {}, noteEdit(note('r1', { replyTo: 'n1', body: 'mine' }), 'them', NOW + 1));
    out = foldNote(out.notes, out.seen, noteEdit(note('r2', { replyTo: 'n1', body: 'theirs' }), 'other', NOW + 1));
    expect(out.notes.map((n) => n.id)).toEqual(['n1', 'r1', 'r2']);
  });

  it('ignores an edit older than what this device already applied', () => {
    const seen: Seen = { n1: { at: NOW + 5, from: 'them' } };
    const out = foldNote([note('n1', { body: 'kept' })], seen, noteEdit(note('n1', { body: 'stale' }), 'them', NOW));
    expect(out.changed).toBe(false);
    expect(out.notes[0]!.body).toBe('kept');
  });

  it('takes a note away, and its answers with it', () => {
    const had = [note('n1'), note('r1', { replyTo: 'n1' }), note('n2')];
    const out = foldNote(had, {}, { t: 'unnote', id: 'n1', at: NOW + 1, from: 'them' });
    expect(out.notes.map((n) => n.id)).toEqual(['n2']);
  });

  /*
   * A reply whose parent is not here is dropped. `readCreations` refuses a
   * design holding an answer to nothing, so keeping one would build a project
   * this app could save and then fail to reopen.
   */
  it('refuses a reply to a note it has never seen', () => {
    const out = foldNote([], {}, noteEdit(note('r1', { replyTo: 'ghost' })));
    expect(out.changed).toBe(false);
    expect(out.notes).toEqual([]);
  });

  it('refuses a reply to a reply, one level being the whole model', () => {
    const had = [note('n1'), note('r1', { replyTo: 'n1' })];
    const out = foldNote(had, {}, noteEdit(note('r2', { replyTo: 'r1' })));
    expect(out.changed).toBe(false);
    expect(out.notes).toHaveLength(2);
  });

  it('leaves the canvas alone when a note arrives', () => {
    // The narrowing-by-elimination bug: without an explicit guard, a note
    // lands in `layers` as an object with no `kind` and the canvas draws it.
    const canvas = canvasOf(layer('one'));
    const out = fold(canvas, {}, noteEdit(note('n1')));
    expect(out.changed).toBe(false);
    expect(out.canvas.layers).toHaveLength(1);
    expect(out.canvas.layers.every((l) => l.kind)).toBe(true);
  });

  it('folds a burst in order', () => {
    const out = foldNotes([], {}, [
      noteEdit(note('n1'), 'them', NOW + 1),
      noteEdit(note('r1', { replyTo: 'n1' }), 'them', NOW + 2),
      { t: 'unnote', id: 'n1', at: NOW + 3, from: 'them' },
    ]);
    expect(out.notes).toEqual([]);
    expect(out.changed).toBe(true);
  });
});

describe('what to send after a note changed here', () => {
  it('sends nothing when nothing changed', () => {
    const was = [note('n1')];
    const now = [note('n1')];
    expect(now[0]).not.toBe(was[0]);
    expect(noteChanges(was, now, 'me', NOW)).toEqual([]);
  });

  it('sends a new note, and an answer', () => {
    expect(noteChanges([], [note('n1')], 'me', NOW)).toHaveLength(1);
    expect(noteChanges([note('n1')], [note('n1'), note('r1', { replyTo: 'n1' })], 'me', NOW)).toHaveLength(1);
  });

  for (const [field, over] of [
    ['body', { body: 'other' }],
    ['resolved', { resolved: true }],
    ['x', { x: 1 }],
    ['y', { y: 1 }],
    ['replyTo', { replyTo: 'n0' }],
    ['authorName', { authorName: 'Someone' }],
    ['authorId', { authorId: 'acct-2' }],
    ['at', { at: NOW + 9 }],
  ] as [string, Partial<DesignNote>][]) {
    it(`notices a change to ${field}`, () => {
      // Every field, so one added later is not silently unshared.
      expect(noteChanges([note('n1')], [note('n1', over)], 'me', NOW)).toHaveLength(1);
    });
  }

  /*
   * A reply that went because its parent did is not its own removal. Sending
   * an `unnote` for it as well would race the parent's, and the parent's edit
   * already takes the replies at the other end.
   */
  it('sends one removal for a note and its answers, not three', () => {
    const was = [note('n1'), note('r1', { replyTo: 'n1' }), note('r2', { replyTo: 'n1' })];
    const edits = noteChanges(was, [], 'me', NOW);
    expect(edits).toEqual([{ t: 'unnote', id: 'n1', at: NOW, from: 'me' }]);
  });

  it('sends a removal for an answer taken away on its own', () => {
    const was = [note('n1'), note('r1', { replyTo: 'n1' })];
    const edits = noteChanges(was, [note('n1')], 'me', NOW);
    expect(edits).toEqual([{ t: 'unnote', id: 'r1', at: NOW, from: 'me' }]);
  });
});
