// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseOf } from './conflicts';
import {
  BULK_COUNT,
  DELETABLE,
  INGRESS_KEY,
  bulk,
  clearIngressDrops,
  coursesDeletedHere,
  droppedOnRead,
  ingressDrops,
  noteIngressDrops,
  settleDeletions,
} from './deletions';
import { mergePersisted } from './merge';

const note = (id: string, body = id, updated = 1) => ({ id, title: id, body, created: 1, updated });
const course = (id: string) => ({ course: { id, code: id, name: id }, items: [] });
const persisted = (notes: unknown[], courses: unknown[] = []) => ({ notes, courses, tasks: [] });

describe('a deletion the merge cannot see', () => {
  const agreed = baseOf(persisted([note('a'), note('b'), note('c')]));

  it('keeps a note deleted here from coming back from the account', () => {
    const here = persisted([note('a'), note('b')]);
    const there = persisted([note('a'), note('b'), note('c')]);
    const s = settleDeletions(here, there, agreed);
    expect((s.remote.notes as { id: string }[]).map((n) => n.id)).toEqual(['a', 'b']);
    expect(s.conflicts).toEqual([]);
    // and the ordinary merge, given that copy, no longer resurrects it
    const merged = mergePersisted(here as never, s.remote as never) as unknown as { notes: { id: string }[] };
    expect(merged.notes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('does the same for a record another device deleted and this one never touched', () => {
    const here = persisted([note('a'), note('b'), note('c')]);
    const there = persisted([note('a'), note('b')]);
    expect(settleDeletions(here, there, agreed).dropHere).toEqual({ notes: ['c'] });
  });

  it('asks, and keeps the edit, when one side deleted and the other edited', () => {
    const editedThere = settleDeletions(
      persisted([note('a'), note('b')]),
      persisted([note('a'), note('b'), note('c', 'rewritten', 9)]),
      agreed,
    );
    expect(editedThere.conflicts).toMatchObject([{ field: 'notes', id: 'c', mine: null, kept: 'theirs' }]);
    expect((editedThere.remote.notes as unknown[]).length).toBe(3); // nothing lost: the edit stays

    const editedHere = settleDeletions(
      persisted([note('a'), note('b'), note('c', 'rewritten', 9)]),
      persisted([note('a'), note('b')]),
      agreed,
    );
    expect(editedHere.conflicts).toMatchObject([{ field: 'notes', id: 'c', theirs: null, kept: 'mine' }]);
    expect(editedHere.dropHere).toEqual({});
  });

  it('says nothing about a record neither side had agreed on, a device with no base, or a list a copy lacks', () => {
    const fresh = settleDeletions(persisted([note('a')]), persisted([note('a'), note('new')]), agreed);
    expect(fresh.remote.notes).toHaveLength(2); // added over there, not deleted here
    expect(settleDeletions(persisted([]), persisted([note('a')]), null).remote.notes).toHaveLength(1);
    expect(settleDeletions({ notes: [] }, { tasks: [] }, agreed).dropHere).toEqual({});
  });

  it('leaves lists the student does not delete from on purpose alone', () => {
    const baseWithPlaces = { ...agreed, 'places/p': 'x' };
    const s = settleDeletions({ places: [], notes: [] }, { places: [{ id: 'p' }], notes: [] }, baseWithPlaces);
    expect(s.remote.places).toEqual([{ id: 'p' }]);
    expect(DELETABLE).not.toContain('places');
  });

  it('does not believe a removal of nearly everything, and says which list', () => {
    const many = Array.from({ length: 10 }, (_, i) => note(`n${i}`));
    const base = baseOf(persisted(many));
    const s = settleDeletions(persisted([]), persisted(many), base);
    expect(s.heldBack).toEqual(['notes']);
    expect(s.remote.notes).toHaveLength(10); // the rows come back rather than being deleted from the account
    // but clearing out some old ones is a deletion
    const some = settleDeletions(persisted(many.slice(4)), persisted(many), base);
    expect(some.heldBack).toEqual([]);
    expect(some.remote.notes).toHaveLength(6);
    expect(bulk(BULK_COUNT - 1, 5)).toBe(false); // a handful is never bulk
  });

  it('is stable when it runs again, as a flapping connection makes it', () => {
    const here = persisted([note('a'), note('b')]);
    const there = persisted([note('a'), note('b'), note('c')]);
    const once = settleDeletions(here, there, agreed);
    const twice = settleDeletions(here, once.remote, agreed);
    expect(twice.remote).toEqual(once.remote);
    expect(twice.conflicts).toEqual([]);
  });
});

describe('a course deleted offline', () => {
  const agreed = baseOf(persisted([], [course('econ'), course('bus'), course('law'), course('art'), course('cs'), course('bio'), course('mus')]));

  it('is still deleted after the app is closed and opened again, because the base is on the device', () => {
    // A new page load: nothing in memory but the base and what is saved.
    const reopened = [course('bus'), course('law'), course('art'), course('cs'), course('bio'), course('mus')];
    expect(coursesDeletedHere(agreed, reopened)).toEqual(['econ']);
  });

  it('names nothing without a base, and nothing when almost everything is gone', () => {
    expect(coursesDeletedHere(null, [])).toEqual([]);
    expect(coursesDeletedHere(agreed, [])).toEqual([]); // 7 of 7: not believed
    expect(coursesDeletedHere(agreed, [course('econ')])).toEqual([]); // 6 of 7
  });

  it('keeps the account’s copy of a deleted course out of the merge', () => {
    const here = persisted([], [course('bus'), course('law')]);
    const there = persisted([], [course('econ'), course('bus'), course('law')]);
    const base = baseOf(persisted([], [course('econ'), course('bus'), course('law')]));
    const s = settleDeletions(here, there, base);
    expect((s.remote.courses as { course: { id: string } }[]).map((c) => c.course.id)).toEqual(['bus', 'law']);
  });
});

describe('what is allowed to be deleted by the sync', () => {
  const slices = join(import.meta.dirname, '../state/slices');
  const source = readdirSync(slices)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => readFileSync(join(slices, f), 'utf8'))
    .join('\n');

  it('has exactly one removal for every list, so the sync spreads a choice and never a trim', () => {
    for (const field of DELETABLE.filter((f) => f !== 'courses')) {
      const removals = source.match(new RegExp(`\\b${field}: state\\.${field}\\.filter\\(`, 'g')) ?? [];
      expect(removals.length, `${field} is filtered ${removals.length} times in the reducers`).toBe(1);
      expect(source, field).toMatch(new RegExp(`case '(delete|remove)[A-Za-z]*': *\\n?[^]*?${field}: state\\.${field}\\.filter`));
    }
  });
});

/*
 * A row this device could not read back is not a row anybody deleted.
 *
 * Found reviewing #1501: a note whose stored copy lost its id was dropped (or
 * kept, unaddressable) on load, its agreed id was then missing here, and the
 * next settle took the good copy out of the account. One row is under the
 * bulk guard, so nothing stood in the way.
 */
describe('rows lost on the way in', () => {
  const agreed = baseOf(persisted([note('a'), note('b'), note('c')]));

  afterEach(() => {
    clearIngressDrops();
    localStorage.clear();
  });

  it('does not take a row out of the account when this device lost it reading its own storage', () => {
    const here = persisted([note('a'), note('b')]);
    const there = persisted([note('a'), note('b'), note('c')]);
    const s = settleDeletions(here, there, agreed, 1, ['notes']);
    expect((s.remote.notes as { id: string }[]).map((n) => n.id)).toEqual(['a', 'b', 'c']);
    const merged = mergePersisted(here as never, s.remote as never) as unknown as { notes: { id: string }[] };
    expect(merged.notes.map((n) => n.id).sort(), 'the account copy comes back').toEqual(['a', 'b', 'c']);
    // A list it did not lose rows from still settles as before.
    const other = settleDeletions(here, there, agreed, 1, ['tasks']);
    expect((other.remote.notes as { id: string }[]).map((n) => n.id)).toEqual(['a', 'b']);
  });

  // Found reviewing 60dd44c: keyed to the loose row rather than to the pull
  // that heals it, one stray id-less row stopped every later deletion in the
  // list, on this device and from every other, for good.
  it('still settles a deliberate deletion while a stray id-less row sits in the list', () => {
    const stray = { title: 'loose', body: 'no id', created: 1, updated: 1 };
    const here = settleDeletions(persisted([note('a'), note('b'), stray]), persisted([note('a'), note('b'), note('c')]), agreed);
    expect((here.remote.notes as { id?: string }[]).map((n) => n.id), 'deleted here').toEqual(['a', 'b']);
    const there = settleDeletions(persisted([note('a'), note('b'), note('c')]), persisted([note('a'), note('b'), stray]), agreed);
    expect(there.dropHere, 'deleted on another device').toEqual({ notes: ['c'] });
  });

  it('does not delete a course from the account that this device lost on load', () => {
    const base = baseOf(persisted([], [course('x'), course('y')]));
    expect(coursesDeletedHere(base, [course('x')]), 'an ordinary deletion still counts').toEqual(['y']);
    expect(coursesDeletedHere(base, [course('x')], ['courses'])).toEqual([]);
    expect(coursesDeletedHere(base, [course('x'), { course: {} }]), 'a stray row does not stop it').toEqual(['y']);
  });

  it('notices the lists a reader shortened or could not address, and only those', () => {
    const raw = { notes: [note('a'), null], tasks: [{ title: 't' }], documents: [{ id: 'd' }], places: [null] };
    const read = { notes: [note('a')], tasks: [{ title: 't' }], documents: [{ id: 'd' }], places: [] };
    expect(droppedOnRead(raw, read)).toEqual(['notes', 'tasks']);
    expect(droppedOnRead({ notes: [note('a')] }, { notes: [note('a')] })).toEqual([]);
    // A list this copy did not carry says nothing.
    expect(droppedOnRead({}, { notes: [] })).toEqual([]);
  });

  it('counts a list stored as something other than a list as lost', () => {
    // The reader makes `{}` into `[]`; pushed as it is, that empties the account's list.
    expect(droppedOnRead({ notes: {}, tasks: 'x', courses: null }, { notes: [], tasks: [], courses: [] })).toEqual([
      'courses',
      'notes',
      'tasks',
    ]);
  });

  it('remembers the lists until a pull clears them, across more than one boot', () => {
    expect(ingressDrops()).toEqual([]);
    noteIngressDrops(['notes']);
    noteIngressDrops(['courses', 'notes']);
    expect(ingressDrops().sort()).toEqual(['courses', 'notes']);
    noteIngressDrops([]);
    expect(ingressDrops().sort()).toEqual(['courses', 'notes']);
    clearIngressDrops();
    expect(localStorage.getItem(INGRESS_KEY)).toBeNull();
    localStorage.setItem(INGRESS_KEY, '{"not":"a list"}');
    expect(ingressDrops()).toEqual([]);
  });

  // Found reviewing 60dd44c: storage at its quota refused the note while the
  // reader still dropped the row, and the pull read the gap as a deletion.
  it('holds the note for this session when storage refuses it', () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    noteIngressDrops(['notes']);
    expect(localStorage.getItem(INGRESS_KEY)).toBeNull();
    expect(ingressDrops()).toEqual(['notes']);
    set.mockRestore();
    clearIngressDrops();
    expect(ingressDrops()).toEqual([]);
  });
});
