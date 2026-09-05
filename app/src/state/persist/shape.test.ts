import { describe, expect, it } from 'vitest';
import { COLLECTIONS, MAPS, PERSISTED_KEYS, SETTINGS, idOf, keyed, kindOf } from './shape';
import { writesFor } from './index';
import { STRATEGY } from '../../lib/merge';
import { DEFAULT_PERSISTED, type Persisted } from '../shape';

describe('every field is classified, and none twice', () => {
  it('accounts for all of them', () => {
    expect(COLLECTIONS.length + MAPS.length + SETTINGS.length).toBe(PERSISTED_KEYS.length);
  });

  it('puts each in exactly one place', () => {
    for (const key of PERSISTED_KEYS) {
      const found = [COLLECTIONS, MAPS, SETTINGS].filter((list) =>
        (list as string[]).includes(key),
      );
      expect(found).toHaveLength(1);
    }
  });

  it('classifies from the merge map rather than a second list', () => {
    // A hand-written list is a second source of truth that goes stale the
    // first time somebody adds a field and updates only one of them.
    for (const key of PERSISTED_KEYS) {
      const how = (STRATEGY as Record<string, string | undefined>)[key];
      if (how === 'ticks') expect(kindOf(key)).toBe('map');
      if (how !== 'union' && how !== 'ticks') expect(kindOf(key)).toBe('setting');
    }
  });

  it('sends a field with no merge strategy to settings, which is the safe default', () => {
    expect(kindOf('somethingAddedLater')).toBe('setting');
  });

  it('keeps the one union that is not records out of the collections', () => {
    // `archivedTerms` is string[]. Splitting it into rows would mean inventing
    // a key for each when the term id already is the value.
    expect(COLLECTIONS).not.toContain('archivedTerms');
    expect(SETTINGS).toContain('archivedTerms');
  });

  it('has the collections a semester is actually made of', () => {
    for (const key of ['courses', 'notes', 'tasks', 'appointments', 'sittings', 'taken']) {
      expect(COLLECTIONS).toContain(key);
    }
  });

  it('has the maps a tick lands in', () => {
    for (const key of ['done', 'tickedAt', 'grades', 'reviews' as never]) {
      // `reviews` merges as `latest`, so it is a setting — named here to make
      // that deliberate rather than an oversight.
      if (key === 'reviews') expect(SETTINGS).toContain('reviews');
      else expect(MAPS).toContain(key);
    }
  });
});

describe('what a record is stored under', () => {
  it('uses its own id', () => {
    expect(idOf({ id: 'n1' }, 0)).toBe('n1');
    expect(idOf({ id: 7 }, 0)).toBe('7');
  });

  it('reaches inside a course module, which wraps its course', () => {
    expect(idOf({ course: { id: 'econ' }, items: [] }, 0)).toBe('econ');
  });

  it('falls back to position, visibly, when there is no id at all', () => {
    // No worse than the whole-blob write it replaces — that had no per-record
    // identity either — and the `#` is what makes it findable.
    expect(idOf({ what: 'no id' }, 3)).toBe('#3');
    expect(keyed([{ id: 'a' }, { what: 'b' }])).toBe(false);
    expect(keyed([{ id: 'a' }, { id: 'b' }])).toBe(true);
  });

  it('does not fall over on a record that is not an object', () => {
    expect(idOf(null, 1)).toBe('#1');
    expect(idOf('a string', 2)).toBe('#2');
  });
});

describe('one edit, one write', () => {
  const base = (): Partial<Persisted> => ({ ...DEFAULT_PERSISTED });

  it('writes nothing when nothing changed', () => {
    const s = base();
    expect(writesFor(s, s)).toEqual([]);
  });

  it('writes one row for one ticked box', () => {
    // The headline claim. Before this, ticking a box rewrote the entire
    // account, every time, synchronously.
    const before = base();
    const after = { ...before, done: { a: true } };
    const writes = writesFor(before, after);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual({ store: 'maps', key: 'done', value: { a: true } });
  });

  it('writes one record for one edited note, not the whole list', () => {
    const kept = { id: 'n1', title: 'Kept' };
    const before = { ...base(), notes: [kept, { id: 'n2', title: 'Was' }] as never };
    const after = { ...before, notes: [kept, { id: 'n2', title: 'Now' }] as never };
    const writes = writesFor(before, after);
    expect(writes).toHaveLength(1);
    expect(writes[0].key).toBe('n2');
    expect(writes[0].store).toBe('notes');
  });

  it('deletes the row for a record that went', () => {
    const before = { ...base(), notes: [{ id: 'n1' }, { id: 'n2' }] as never };
    const after = { ...before, notes: [{ id: 'n1' }] as never };
    // Reference changed for the surviving one only because the array is new;
    // what matters is that the deletion is issued.
    const writes = writesFor(before, after);
    expect(writes).toContainEqual({ store: 'notes', key: 'n2', value: null });
  });

  it('writes one row for one changed setting', () => {
    const before = base();
    const after = { ...before, ground: 'parchment' as never };
    expect(writesFor(before, after)).toEqual([
      { store: 'settings', key: 'ground', value: 'parchment' },
    ]);
  });

  it('does not touch a collection whose reference did not move', () => {
    const before = { ...base(), courses: [{ course: { id: 'econ' } }] as never };
    const after = { ...before, ground: 'fog' as never };
    for (const w of writesFor(before, after)) expect(w.store).not.toBe('courses');
  });

  it('writes everything on a first migration, and only then', () => {
    // The migration diffs the defaults against a loaded account, so every
    // field that differs from a fresh install gets written once.
    const loaded = { ...base(), ground: 'fog' as never, done: { a: true } };
    const writes = writesFor(DEFAULT_PERSISTED, loaded);
    expect(writes.length).toBeGreaterThan(1);
    expect(writes.map((w) => w.key)).toContain('ground');
    expect(writes.map((w) => w.key)).toContain('done');
  });
});
