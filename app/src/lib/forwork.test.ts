import { describe, expect, it } from 'vitest';
import {
  attachable,
  attachedTo,
  countsByItem,
  forLine,
  itemFor,
  nameFor,
  pickable,
  WORK_KINDS,
  WORK_LABEL,
  type Holdings,
} from './forwork';
import type { Doc } from './document';
import type { Sheet } from './sheet';
import type { StoredDeck } from './decks';
import type { SavedEquation } from './maths';
import type { Settled } from './files';
import type { DatedItem, Note } from './types';

/*
 * Fixtures, each the smallest thing that satisfies its type. The casts are
 * deliberate and narrow: `Settled` carries a blob-shaped record and a
 * `DatedItem` carries fifteen derived fields, and building either in full
 * would put a hundred lines of irrelevant truth between a test and what it
 * tests. Every field these functions actually read is set.
 */

const doc = (id: string, over: Partial<Doc> = {}): Doc => ({
  id,
  title: id,
  subtitle: '',
  courseId: null,
  itemId: null,
  blocks: [],
  created: 1,
  updated: 1,
  ...over,
});

const sheet = (id: string, over: Partial<Sheet> = {}): Sheet => ({
  id,
  title: id,
  courseId: null,
  itemId: null,
  cells: {},
  rows: 4,
  cols: 4,
  created: 1,
  updated: 1,
  ...over,
});

const deck = (id: string, over: Partial<StoredDeck> = {}): StoredDeck => ({
  id,
  title: id,
  subtitle: '',
  slides: [],
  courseId: null,
  itemId: null,
  created: 1,
  updated: 1,
  ...over,
});

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id,
  title: id,
  body: '',
  created: 1,
  updated: 1,
  courseId: null,
  itemId: null,
  fileIds: [],
  ...over,
});

const equation = (id: string, over: Partial<SavedEquation> = {}): SavedEquation => ({
  id,
  name: id,
  latex: 'x',
  note: '',
  courseId: null,
  itemId: null,
  created: 1,
  ...over,
});

const file = (id: string, over: Partial<Settled> = {}): Settled =>
  ({
    id,
    name: id,
    type: 'text/plain',
    size: 1,
    added: 1,
    courseId: null,
    folderId: null,
    starred: false,
    trashedAt: null,
    openedAt: null,
    itemId: null,
    ...over,
  }) as Settled;

const item = (id: string, over: Partial<DatedItem> = {}): DatedItem =>
  ({
    id,
    c: 'econ',
    title: id,
    kind: 'essay',
    month: 8,
    day: 1,
    date: new Date(2026, 8, 1),
    isPast: false,
    ...over,
  }) as DatedItem;

describe('the kinds', () => {
  it('names every kind it lists', () => {
    // The two are read together — a kind in the union with no label draws a
    // blank chip, which is a control nobody can press on purpose.
    for (const kind of WORK_KINDS) expect(WORK_LABEL[kind]).toBeTruthy();
    expect(Object.keys(WORK_LABEL).sort()).toEqual([...WORK_KINDS].sort());
  });
});

describe('attachedTo', () => {
  it('finds every kind filed against one deadline', () => {
    const held: Holdings = {
      documents: [doc('d', { itemId: 'x' })],
      sheets: [sheet('s', { itemId: 'x' })],
      decks: [deck('k', { itemId: 'x' })],
      notes: [note('n', { itemId: 'x' })],
      equations: [equation('e', { itemId: 'x' })],
      files: [file('f', { itemId: 'x' })],
    };
    expect(attachedTo(held, 'x').map((a) => a.kind).sort()).toEqual(
      ['deck', 'document', 'equation', 'file', 'note', 'sheet'],
    );
  });

  it('leaves out everything filed elsewhere or nowhere', () => {
    const held: Holdings = {
      documents: [doc('mine', { itemId: 'x' }), doc('theirs', { itemId: 'y' }), doc('loose')],
    };
    expect(attachedTo(held, 'x').map((a) => a.id)).toEqual(['mine']);
  });

  it('puts the most recently touched first', () => {
    const held: Holdings = {
      documents: [
        doc('old', { itemId: 'x', updated: 10 }),
        doc('new', { itemId: 'x', updated: 30 }),
        doc('middle', { itemId: 'x', updated: 20 }),
      ],
    };
    expect(attachedTo(held, 'x').map((a) => a.id)).toEqual(['new', 'middle', 'old']);
  });

  it('breaks a tie the same way every time', () => {
    // Two things made in the same millisecond is not hypothetical: a
    // generated deck and the sheet beside it are stamped from one Date.now().
    const held: Holdings = {
      documents: [doc('d', { itemId: 'x', updated: 5 })],
      sheets: [sheet('s', { itemId: 'x', updated: 5 })],
    };
    const once = attachedTo(held, 'x').map((a) => a.id);
    expect(once).toEqual(['d', 's']);
    expect(attachedTo(held, 'x').map((a) => a.id)).toEqual(once);
  });

  it('does not count a file in the bin', () => {
    // A delete that left the row under its deadline would be a delete that
    // did not delete.
    const held: Holdings = { files: [file('f', { itemId: 'x', trashedAt: 99 })] };
    expect(attachedTo(held, 'x')).toEqual([]);
  });

  it('reads a thing written before the field existed as filed nowhere', () => {
    const old = { ...doc('d'), itemId: undefined } as Doc;
    expect(attachedTo({ documents: [old] }, 'x')).toEqual([]);
    expect(countsByItem({ documents: [old] })).toEqual({});
  });

  it('never draws a blank row', () => {
    const held: Holdings = { documents: [doc('d', { itemId: 'x', title: '   ' })] };
    expect(attachedTo(held, 'x')[0].title).toBe('Untitled document');
  });

  it('answers for holdings it was given none of', () => {
    expect(attachedTo({}, 'x')).toEqual([]);
  });
});

describe('countsByItem', () => {
  it('counts each deadline once per thing filed against it', () => {
    const held: Holdings = {
      documents: [doc('a', { itemId: 'x' }), doc('b', { itemId: 'x' }), doc('c', { itemId: 'y' })],
      files: [file('f', { itemId: 'x' })],
    };
    expect(countsByItem(held)).toEqual({ x: 3, y: 1 });
  });

  it('has no entry for a deadline nothing is filed against', () => {
    // The marker on a row is drawn from the presence of a key, so a zero here
    // would be a paperclip on every deadline in the term.
    expect(countsByItem({ documents: [doc('a')] })).toEqual({});
  });
});

describe('attachable', () => {
  it('offers only things filed against no deadline', () => {
    const held: Holdings = {
      documents: [doc('loose'), doc('taken', { itemId: 'y' })],
    };
    expect(attachable(held, null).map((a) => a.id)).toEqual(['loose']);
  });

  it('offers the course’s own things and the ones tagged with no course', () => {
    const held: Holdings = {
      documents: [
        doc('mine', { courseId: 'econ' }),
        doc('untagged'),
        doc('other', { courseId: 'psci' }),
      ],
    };
    expect(attachable(held, 'econ').map((a) => a.id).sort()).toEqual(['mine', 'untagged']);
  });

  it('offers everything unattached for a deadline with no course', () => {
    const held: Holdings = { documents: [doc('a', { courseId: 'econ' }), doc('b')] };
    expect(attachable(held, null).map((a) => a.id).sort()).toEqual(['a', 'b']);
  });
});

describe('pickable', () => {
  it('puts what is still ahead first, soonest first', () => {
    const items = [
      item('far', { date: new Date(2026, 10, 1) }),
      item('soon', { date: new Date(2026, 8, 15) }),
    ];
    expect(pickable(items, 'econ').map((i) => i.id)).toEqual(['soon', 'far']);
  });

  it('puts what has gone by after it, most recent first', () => {
    const items = [
      item('ahead', { date: new Date(2026, 10, 1) }),
      item('yesterday', { date: new Date(2026, 7, 30), isPast: true }),
      item('ages ago', { date: new Date(2026, 6, 1), isPast: true }),
    ];
    // The second commonest case is the thing that was due yesterday and is
    // being finished now, and plain date order buries it under the term.
    expect(pickable(items, 'econ').map((i) => i.id)).toEqual(['ahead', 'yesterday', 'ages ago']);
  });

  it('keeps to one course', () => {
    const items = [item('mine'), item('theirs', { c: 'psci' })];
    expect(pickable(items, 'econ').map((i) => i.id)).toEqual(['mine']);
  });

  it('offers nothing where there is no course to offer from', () => {
    expect(pickable([item('mine')], null)).toEqual([]);
  });
});

describe('a link with nothing on the other end', () => {
  it('reads as no link at all', () => {
    const items = [item('here')];
    expect(nameFor(items, 'here')).toBe('here');
    expect(nameFor(items, 'gone')).toBeUndefined();
    expect(nameFor(items, null)).toBeUndefined();
    expect(nameFor(items, undefined)).toBeUndefined();
    expect(itemFor(items, 'gone')).toBeUndefined();
    expect(itemFor(items, 'here')?.id).toBe('here');
  });
});

describe('naming a deadline from any term', () => {
  /*
   * The catalogue is one term by design, so a lookup built from it reports a
   * perfectly good link to last term's essay as no link at all — a live
   * association drawn as a dangling one, on the screens whose whole job is to
   * say what a file is for. `nameFor` therefore asks for the least it needs,
   * so the store can hand it every term's deadlines. See `allItems` in
   * `state/store.tsx`.
   */
  it('reads an id and a title and nothing else', () => {
    const acrossTerms = [
      { id: 'last-term-essay', title: 'Final essay' },
      { id: 'this-term-quiz', title: 'Quiz #1' },
    ];
    expect(nameFor(acrossTerms, 'last-term-essay')).toBe('Final essay');
    expect(forLine(acrossTerms, 'last-term-essay')).toBe('for Final essay');
    expect(itemFor(acrossTerms, 'this-term-quiz')?.title).toBe('Quiz #1');
  });

  it('still answers nothing for an id no term holds', () => {
    expect(forLine([{ id: 'a', title: 'A' }], 'gone')).toBe('');
  });
});

describe('the picker cap', () => {
  /*
   * `DeadlinePicker` shows the first eight and hides the rest behind "N more".
   * The list it caps is this one, and the property that matters is that the
   * chosen deadline is reachable at all — a course whose ninth deadline is the
   * one somebody filed against drew eight chips with none pressed, which said
   * the thing was filed nowhere while the record said otherwise. The component
   * appends the chosen one; this holds the ordering it appends from.
   */
  it('puts a deadline three weeks out beyond the first eight of a heavy course', () => {
    const many = Array.from({ length: 12 }, (_, n) =>
      item(`q${n}`, { date: new Date(2026, 8, n + 1) }),
    );
    const order = pickable(many, 'econ').map((i) => i.id);
    expect(order).toHaveLength(12);
    expect(order.slice(0, 8)).toEqual(['q0', 'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7']);
    // The one the component has to append rather than drop.
    expect(order.indexOf('q11')).toBe(11);
  });
});
