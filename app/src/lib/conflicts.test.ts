// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { strategyFor } from './merge';
import { DEFAULT_PERSISTED } from '../state/shape';
import { reducer } from '../state/reducer';
import type { State } from '../state/shape';
import {
  SETTINGS,
  addReview,
  baseOf,
  keptHere,
  conflictsIn,
  describe as describeRecord,
  fingerprint,
  putRecord,
  readReview,
  REVIEW_KEY,
  writeReview,
  type Conflict,
} from './conflicts';

/**
 * Telling "edited on both devices" apart from "edited on one".
 *
 * The merge keeps the later edit of a record both sides hold. That is right
 * when one side edited it and wrong when both did, and only the version both
 * last agreed on — the base — can say which happened.
 */

const note = (body: string, updated: number) => ({
  id: 'n1',
  title: 'Week 6 notes',
  body,
  created: 1,
  updated,
  courseId: null,
  fileIds: [],
});

const agreed = note('as synced', 100);
const base = baseOf({ notes: [agreed] });

afterEach(() => localStorage.clear());

describe('conflictsIn', () => {
  it('finds a record edited on both sides, apart', () => {
    const found = conflictsIn({ notes: [note('on the bus', 200)] }, { notes: [note('in the library', 300)] }, base);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ key: 'notes/n1', field: 'notes', id: 'n1', kept: 'theirs' });
  });

  it('says which one the merge kept — the later, as `union` decides', () => {
    const found = conflictsIn({ notes: [note('later here', 400)] }, { notes: [note('earlier there', 300)] }, base);
    expect(found[0].kept).toBe('mine');
  });

  it('finds nothing when only this device edited it — the ordinary case', () => {
    expect(conflictsIn({ notes: [note('edited here', 200)] }, { notes: [agreed] }, base)).toEqual([]);
  });

  it('finds nothing when only the other device edited it', () => {
    expect(conflictsIn({ notes: [agreed] }, { notes: [note('edited there', 200)] }, base)).toEqual([]);
  });

  it('finds nothing when both made the same edit', () => {
    const same = note('same words', 200);
    expect(conflictsIn({ notes: [same] }, { notes: [same] }, base)).toEqual([]);
  });

  it('finds nothing without a base — every difference would look like a conflict', () => {
    expect(conflictsIn({ notes: [note('a', 2)] }, { notes: [note('b', 3)] }, null)).toEqual([]);
  });

  it('finds nothing for a record the base never saw', () => {
    const other = { ...note('x', 2), id: 'n2' };
    expect(conflictsIn({ notes: [other] }, { notes: [{ ...other, body: 'y' }] }, base)).toEqual([]);
  });

  it('leaves settings alone: they are not records and have no second copy to choose', () => {
    expect(conflictsIn({ nav: 'tabs' }, { nav: 'desk' }, { 'nav/x': 'y' })).toEqual([]);
  });
});

describe('putRecord', () => {
  it('replaces the record with its id and stamps it now, so the next merge keeps it', () => {
    const out = putRecord([note('in use', 300), { ...note('other', 1), id: 'n2' }], note('chosen', 200), 999);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ id: 'n1', body: 'chosen', updated: 999 });
  });

  it('adds it back if it went while the question was open', () => {
    expect(putRecord([], note('chosen', 200), 999)).toHaveLength(1);
  });
});

describe('the review list', () => {
  const c = (key: string, body: string): Conflict => ({
    key,
    field: 'notes',
    id: key.split('/')[1],
    mine: note(body, 1),
    theirs: note(body, 2),
    kept: 'theirs',
    found: 0,
  });

  it('asks once per record, about its latest two versions', () => {
    const out = addReview([c('notes/n1', 'old')], [c('notes/n1', 'new'), c('notes/n2', 'x')]);
    expect(out.map((x) => x.key)).toEqual(['notes/n1', 'notes/n2']);
    expect((out[0].mine as { body: string }).body).toBe('new');
  });

  it('survives a reload, and drops what it did not write', () => {
    writeReview([c('notes/n1', 'a')]);
    expect(readReview()).toHaveLength(1);
    localStorage.setItem(REVIEW_KEY, JSON.stringify([{ nope: 1 }, c('notes/n2', 'b')]));
    expect(readReview().map((x) => x.key)).toEqual(['notes/n2']);
  });

  it('names a record by its own title', () => {
    expect(describeRecord('notes', note('the body', 1))).toMatchObject({ kind: 'Notes', title: 'Week 6 notes', preview: 'the body' });
  });
});

describe('fingerprint', () => {
  it('is the same for the same value, and different for a different one', () => {
    expect(fingerprint(note('a', 1))).toBe(fingerprint(note('a', 1)));
    expect(fingerprint(note('a', 1))).not.toBe(fingerprint(note('b', 1)));
  });
});

describe('settings', () => {
  const agreedLook = { accent: 'sterling', hue: -1, ground: 'ink', liveSession: null };
  const base2 = baseOf(agreedLook);

  it('offers a setting both devices changed, the accent and its hue as one', () => {
    const found = conflictsIn(
      { ...agreedLook, accent: 'hue', hue: 210 },
      { ...agreedLook, accent: 'oxide' },
      base2,
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ key: 'settings/accent', field: 'settings', id: 'accent', kept: 'theirs' });
    expect(found[0].mine).toEqual({ accent: 'hue', hue: 210 });
    expect(found[0].theirs).toEqual({ accent: 'oxide', hue: -1 });
  });

  it('does not offer one changed on one side only — the control', () => {
    expect(conflictsIn({ ...agreedLook, ground: 'paper' }, agreedLook, base2)).toEqual([]);
    expect(conflictsIn(agreedLook, { ...agreedLook, ground: 'paper' }, base2)).toEqual([]);
  });

  it("does not ask about the app's own state, whatever both sides did", () => {
    const found = conflictsIn(
      { ...agreedLook, liveSession: { id: 'a' } },
      { ...agreedLook, liveSession: { id: 'b' } },
      base2,
    );
    expect(found).toEqual([]);
  });

  it('says a setting in words, not as JSON', () => {
    expect(describeRecord('settings', { accent: 'oxide', hue: -1 }, 'accent')).toMatchObject({ kind: 'Setting', preview: 'Oxide' });
    expect(describeRecord('settings', { accent: 'hue', hue: 210 }, 'accent').preview).toBe('Hue (hue 210)');
    expect(describeRecord('settings', { boardOrder: ['a', 'b', 'c'] }, 'boardOrder').preview).toBe('3 items');
    expect(describeRecord('settings', { calm: true }, 'calm').preview).toBe('On');
  });

  it('only names fields that exist and that the merge takes from the account', () => {
    // A typo here would offer a setting nothing writes; a `mine` field here
    // would offer a choice the merge never took from anybody.
    for (const field of SETTINGS.flat()) {
      expect(field in DEFAULT_PERSISTED, `${field} is not a persisted field`).toBe(true);
      expect(strategyFor(field), field).toBe('theirs');
    }
  });
});

describe('keptHere', () => {
  const agreed = baseOf({ accent: 'sterling', ground: 'ink' });

  it('holds back a field the account has not changed since the two agreed', () => {
    // This device changed the accent; the account still has the agreed one.
    expect(keptHere({ accent: 'sterling', ground: 'ink' }, agreed)).toEqual(['accent', 'ground']);
  });

  it('takes a field the account did change', () => {
    expect(keptHere({ accent: 'oxide', ground: 'ink' }, agreed)).toEqual(['ground']);
  });

  it('holds back nothing without a base — the merge\'s old rule stands', () => {
    expect(keptHere({ accent: 'sterling' }, null)).toEqual([]);
  });

  it('never holds back a list the merge unions', () => {
    expect(keptHere({ notes: [] }, baseOf({ notes: [] }))).toEqual([]);
  });
});

describe('restoreSettings', () => {
  const state = { ...DEFAULT_PERSISTED, screen: 'home' } as unknown as State;

  it('writes back a chosen setting', () => {
    const next = reducer(state, { type: 'restoreSettings', values: { accent: 'hue', hue: 210 } });
    expect(next).toMatchObject({ accent: 'hue', hue: 210 });
  });

  it('writes nothing that is not a setting on the list, whatever it is handed', () => {
    const next = reducer(state, { type: 'restoreSettings', values: { registered: true, notes: ['x'] } });
    expect(next).toBe(state);
  });
});
