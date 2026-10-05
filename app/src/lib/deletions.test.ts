import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baseOf } from './conflicts';
import { BULK_COUNT, DELETABLE, bulk, coursesDeletedHere, settleDeletions } from './deletions';
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
