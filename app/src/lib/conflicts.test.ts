// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  addReview,
  baseOf,
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
