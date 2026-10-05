import { describe, expect, it } from 'vitest';
import { baseOf } from './conflicts';
import { settleDeletions } from './deletions';
import { mergePersisted } from './merge';
import { DEFAULT_PERSISTED, type Persisted } from '../state/shape';

/**
 * What a union merge cannot express, and what expresses it.
 *
 * `union` is the right default for a merge that must not lose work: a note
 * written on the laptop and a note written on the phone both survive. It has
 * one consequence nobody chose. There is no difference, in the data, between
 * "the laptop has never heard of this note" and "the phone deleted it" — so
 * on its own the merge does the only thing it can, and keeps it. Delete a
 * note on your phone, open the laptop, and it came back; delete it on the
 * laptop, and it came back on the phone.
 *
 * The first block below is that fact, and it is still true of `mergePersisted`
 * by itself: the union is unchanged on purpose. What changed is what runs
 * before it. `lib/deletions.ts` reads the version both devices last agreed on
 * (the base, kept on the device across a restart) and settles a deletion
 * first, so the merge is never handed a copy that could bring the record
 * back. The second block asserts the opposite of what this file asserted
 * before that landed, and the rewrite is the proof it did what it was for.
 * The store-level scenarios — airplane mode, a restart, a connection that
 * comes and goes — are `state/deletions.test.tsx`.
 */

const withNotes = (titles: string[]): Persisted => ({
  ...DEFAULT_PERSISTED,
  notes: titles.map((t, i) => ({
    id: `n-${t}`,
    title: t,
    body: '',
    created: 1 + i,
    updated: 1 + i,
    courseId: null,
    fileIds: [],
  })),
});

const titles = (p: Persisted) => p.notes.map((n) => n.title).sort();

describe('the union on its own', () => {
  it('keeps both devices’ new work, which is the point', () => {
    const merged = mergePersisted(withNotes(['laptop']), withNotes(['phone']));
    expect(titles(merged)).toEqual(['laptop', 'phone']);
  });

  it('still brings back a note the other device deleted, because it cannot tell', () => {
    // The phone deleted "shared"; the laptop still has it. There is nothing in
    // the data that says which of those is the newer fact.
    const phoneAfterDelete = withNotes(['phone-only']);
    const laptopStillHasIt = withNotes(['phone-only', 'shared']);
    const merged = mergePersisted(phoneAfterDelete, laptopStillHasIt);
    expect(titles(merged)).toContain('shared');
  });

  it('does the same for tasks', () => {
    const gone: Persisted = { ...DEFAULT_PERSISTED, tasks: [] };
    const stale: Persisted = {
      ...DEFAULT_PERSISTED,
      tasks: [{ id: 't1', title: 'Deleted on the phone', date: null, time: '', note: '', courseId: null, done: false }],
    } as Persisted;
    expect(mergePersisted(gone, stale).tasks).toHaveLength(1);
  });
});

describe('with the deletion settled first', () => {
  const agreed = baseOf({ notes: withNotes(['phone-only', 'shared']).notes, tasks: [] });

  it('keeps a note deleted on the phone from coming back from the laptop', () => {
    const phoneAfterDelete = withNotes(['phone-only']);
    const laptopStillHasIt = withNotes(['phone-only', 'shared']);
    const { remote } = settleDeletions(phoneAfterDelete as never, laptopStillHasIt as never, agreed);
    expect(titles(mergePersisted(phoneAfterDelete, remote as Partial<Persisted>))).toEqual(['phone-only']);
  });

  it('and the other way round: what the laptop deleted goes from the phone', () => {
    const { dropHere } = settleDeletions(withNotes(['phone-only', 'shared']) as never, withNotes(['phone-only']) as never, agreed);
    expect(dropHere).toEqual({ notes: ['n-shared'] });
  });

  it('still keeps both devices’ new work, which is the point of the union', () => {
    const { remote } = settleDeletions(withNotes(['phone-only', 'shared', 'phone-new']) as never, withNotes(['phone-only', 'shared', 'laptop-new']) as never, agreed);
    expect(titles(mergePersisted(withNotes(['phone-only', 'shared', 'phone-new']), remote as Partial<Persisted>))).toEqual(['laptop-new', 'phone-new', 'phone-only', 'shared']);
  });

  it('adds no list of removals to what is saved or synced: the base is the memory', () => {
    // The deletion is read from a fingerprint the device already keeps, so
    // there is no second record that could disagree with the first.
    for (const kind of ['removedCourses', 'removedNotes', 'removedTasks', 'tombstones', 'deletions']) {
      expect(kind in DEFAULT_PERSISTED, kind).toBe(false);
    }
  });
});
