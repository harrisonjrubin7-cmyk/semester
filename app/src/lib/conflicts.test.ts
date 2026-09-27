// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { strategyFor } from './merge';
import { DEFAULT_PERSISTED, forgetSyncMemory } from '../state/shape';
import { reducer } from '../state/reducer';
import type { State } from '../state/shape';
import {
  SETTINGS,
  addReview,
  baseOf,
  keptHere,
  removedThere,
  takenTicks,
  tickConflictsIn,
  conflictsIn,
  describe as describeRecord,
  fingerprint,
  putRecord,
  readReview,
  BASE_KEY,
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
    // The key checked on its own line: `key: '<long path>'` is what the secret
    // scanner's generic-api-key rule matches, and a test is not a credential.
    expect(found[0].key).toBe('settings/accent');
    expect(found[0]).toMatchObject({ field: 'settings', id: 'accent', kept: 'theirs' });
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

describe('ticked boxes and the other per-key maps', () => {
  const agreedMaps = { grades: { econ: 'B', psci: 'A' }, done: { 'econ-m1': true } };
  const base3 = baseOf(agreedMaps);

  it('offers a key both devices changed to different values', () => {
    const found = tickConflictsIn(
      { ...agreedMaps, grades: { econ: 'B+', psci: 'A' } },
      { ...agreedMaps, grades: { econ: 'A-', psci: 'A' } },
      base3,
    );
    expect(found).toHaveLength(1);
    expect(found[0].key).toBe('ticks/grades/econ');
    expect(found[0]).toMatchObject({ field: 'ticks', id: 'grades/econ', mine: 'B+', theirs: 'A-', kept: 'theirs' });
  });

  it('offers a key both added with different values, since neither had it before', () => {
    const found = tickConflictsIn(
      { grades: { ...agreedMaps.grades, hist: 'C' } },
      { grades: { ...agreedMaps.grades, hist: 'B' } },
      base3,
    );
    expect(found.map((c) => c.key)).toEqual(['ticks/grades/hist']);
  });

  it('offers nothing for one side, or the same change on both — the control', () => {
    expect(tickConflictsIn({ grades: { econ: 'B+', psci: 'A' } }, agreedMaps, base3)).toEqual([]);
    expect(tickConflictsIn(agreedMaps, { grades: { econ: 'B+', psci: 'A' } }, base3)).toEqual([]);
    expect(tickConflictsIn({ grades: { econ: 'B+', psci: 'A' } }, { grades: { econ: 'B+', psci: 'A' } }, base3)).toEqual([]);
  });

  it('offers nothing for a map the base never saw', () => {
    expect(tickConflictsIn({ yours: { econ: 'x' } }, { yours: { econ: 'y' } }, base3)).toEqual([]);
  });

  it('cuts a pull down to the keys the account changed, so a tick here is not put back', () => {
    // This device changed the econ grade; the account still has the agreed
    // one, and changed psci. Only psci comes through.
    expect(takenTicks({ grades: { econ: 'B', psci: 'A+' } }, base3)).toEqual({ grades: { psci: 'A+' } });
  });

  it('passes a map through whole where there is no base to judge by', () => {
    expect(takenTicks({ grades: { econ: 'B' } }, null)).toEqual({ grades: { econ: 'B' } });
  });

  it('says a tick as a tick, and a grade as a grade', () => {
    expect(describeRecord('ticks', true, 'done/econ-m1')).toMatchObject({ kind: 'What you have ticked off', preview: 'Ticked' });
    expect(describeRecord('ticks', 'A-', 'grades/econ').preview).toBe('A-');
  });
});

describe('restoreTick', () => {
  const state = { ...DEFAULT_PERSISTED, grades: { econ: 'A-' }, screen: 'home' } as unknown as State;

  it('writes one key back, and removes it when the chosen version had none', () => {
    expect(reducer(state, { type: 'restoreTick', field: 'grades', key: 'econ', value: 'B+' }).grades).toEqual({ econ: 'B+' });
    expect(reducer(state, { type: 'restoreTick', field: 'grades', key: 'econ', value: undefined }).grades).toEqual({});
  });

  it('writes nothing into a field that is not a per-key map', () => {
    expect(reducer(state, { type: 'restoreTick', field: 'notes', key: '0', value: 'x' })).toBe(state);
  });
});

describe('a key removed on the other device', () => {
  const agreedMaps = { grades: { econ: 'B', psci: 'A' } };
  const base4 = baseOf(agreedMaps);

  it('is removed here too, when this device has not touched it since', () => {
    // The laptop cleared the econ grade and pushed; this device still has
    // the agreed B. The merge alone would keep it and push it back.
    expect(removedThere(agreedMaps, { grades: { psci: 'A' } }, base4)).toEqual({ grades: ['econ'] });
  });

  it('is not removed here when this device changed it since — that is a conflict, and offered', () => {
    const local = { grades: { econ: 'B+', psci: 'A' } };
    const remote = { grades: { psci: 'A' } };
    expect(removedThere(local, remote, base4)).toEqual({});
    const found = tickConflictsIn(local, remote, base4);
    expect(found.map((c) => c.key)).toEqual(['ticks/grades/econ']);
    // The account does not carry it, so the merge leaves this device's in use.
    expect(found[0]).toMatchObject({ mine: 'B+', theirs: undefined, kept: 'mine' });
  });

  it('is never a key this device added and has not pushed — the control', () => {
    expect(removedThere({ grades: { ...agreedMaps.grades, hist: 'C' } }, agreedMaps, base4)).toEqual({});
  });

  it('removes nothing without a base, or from a map the base never saw', () => {
    expect(removedThere(agreedMaps, { grades: {} }, null)).toEqual({});
    expect(removedThere({ yours: { econ: 'x' } }, { yours: {} }, base4)).toEqual({});
  });
});

describe('dropTicks', () => {
  const state = { ...DEFAULT_PERSISTED, grades: { econ: 'B', psci: 'A' }, screen: 'home' } as unknown as State;

  it('removes the keys named, and only those', () => {
    expect(reducer(state, { type: 'dropTicks', removals: { grades: ['econ'] } }).grades).toEqual({ psci: 'A' });
  });

  it('touches nothing that is not a per-key map', () => {
    expect(reducer(state, { type: 'dropTicks', removals: { notes: ['0'] } })).toBe(state);
  });
});

describe('forgetSyncMemory', () => {
  it('clears the keys this module actually uses', () => {
    // `state/shape.ts` names them as literals to avoid an import cycle; this
    // is what stops a rename here from leaving an account's memory behind.
    localStorage.setItem(BASE_KEY, '{}');
    localStorage.setItem(REVIEW_KEY, '[]');
    forgetSyncMemory();
    expect(localStorage.getItem(BASE_KEY)).toBeNull();
    expect(localStorage.getItem(REVIEW_KEY)).toBeNull();
  });
});
