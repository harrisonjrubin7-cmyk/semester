import { describe, expect, it } from 'vitest';
import { mergePersisted } from './merge';
import { DEFAULT_PERSISTED, type Persisted } from '../state/shape';

/**
 * The bug the per-record sync exists to fix, written down before it is fixed.
 *
 * `union` is the right default for a merge that must not lose work: a note
 * written on the laptop and a note written on the phone both survive. It has
 * one consequence nobody chose, and this file is here to state it plainly
 * rather than leave it as folklore.
 *
 * A union cannot express a deletion. There is no difference, in the data,
 * between "the laptop has never heard of this note" and "the phone deleted it"
 * — so the merge does the only thing it can, and keeps it. Delete a note on
 * your phone, open the laptop, and it comes back. Delete it again on the
 * laptop, open the phone, and it comes back there.
 *
 * The author already knew this for courses: `removedCourses` is a tombstone
 * list, and `library.ts` keeps an id in it until the account confirms the
 * deletion. It is session-scoped on purpose — an unsynced deletion coming back
 * is visible and fixable rather than a silent loss. Notes, tasks, appointments
 * and practice papers have no equivalent at all, which is why a note deleted
 * on a phone comes back from a laptop every single time.
 *
 * These tests describe what happens today. When the per-record sync lands they
 * should be rewritten to assert the opposite, and the rewrite is the proof the
 * migration did what it was for.
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

describe('what a union merge cannot express', () => {
  it('keeps both devices’ new work, which is the point', () => {
    const merged = mergePersisted(withNotes(['laptop']), withNotes(['phone']));
    expect(titles(merged)).toEqual(['laptop', 'phone']);
  });

  it('brings back a note the other device deleted — today', () => {
    // The phone deleted "shared"; the laptop still has it. There is nothing in
    // the data that says which of those is the newer fact.
    const phoneAfterDelete = withNotes(['phone-only']);
    const laptopStillHasIt = withNotes(['phone-only', 'shared']);
    const merged = mergePersisted(phoneAfterDelete, laptopStillHasIt);
    expect(titles(merged)).toContain('shared');
  });

  it('does the same for tasks and papers', () => {
    const gone: Persisted = { ...DEFAULT_PERSISTED, tasks: [] };
    const stale: Persisted = {
      ...DEFAULT_PERSISTED,
      tasks: [{ id: 't1', title: 'Deleted on the phone', date: null, time: '', note: '', courseId: null, done: false }],
    } as Persisted;
    expect(mergePersisted(gone, stale).tasks).toHaveLength(1);
  });

  it('has a tombstone for courses and for nothing else', () => {
    // `removedCourses` is the pattern the rest of the data needs — a push
    // tells the account exactly what this device removed. It is deliberately
    // *not* persisted, on the reasoning that an unsynced deletion coming back
    // is visible and fixable rather than a silent loss. That reasoning is
    // sound and it is also an admission: the mechanism exists because a union
    // cannot express a deletion, and notes, tasks and papers have no
    // equivalent at all.
    expect('removedCourses' in DEFAULT_PERSISTED).toBe(false);
    for (const kind of ['removedNotes', 'removedTasks', 'removedSittings']) {
      expect(kind in DEFAULT_PERSISTED, kind).toBe(false);
    }
  });
});
