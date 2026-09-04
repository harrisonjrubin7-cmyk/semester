/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STRATEGY, latest, mergePersisted, strategyFor, ticks, union } from './merge';

/**
 * The scenarios here are the ones that used to lose data, written as two
 * devices rather than as function arguments, because that is how they were
 * found and it is how anybody reading this will check the fix.
 */

const note = (id: string, title: string, updated: number) => ({
  id,
  title,
  body: '',
  created: updated,
  updated,
  courseId: null,
  fileIds: [],
});

const sitting = (id: string, at: number, pct: number) => ({
  id,
  courseId: 'econ',
  title: 'Practice paper',
  at,
  minutes: 30,
  got: pct,
  outOf: 100,
  pct,
  code: '',
  missed: [],
});

describe('two devices, one account', () => {
  it('keeps both papers when each device sat one offline', () => {
    const laptop = { sittings: [sitting('a', 1_000, 70)] };
    const phone = { sittings: [sitting('b', 2_000, 80)] };

    const merged = mergePersisted(laptop, phone);

    expect(merged.sittings.map((s) => s.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps both notes when each device wrote one offline', () => {
    const laptop = { notes: [note('a', 'Reading week plan', 5)] };
    const phone = { notes: [note('b', 'Seminar questions', 6)] };

    expect(mergePersisted(laptop, phone).notes.map((n) => n.title)).toEqual([
      'Reading week plan',
      'Seminar questions',
    ]);
  });

  it('leaves both boxes ticked when each device ticked a different one', () => {
    const laptop: { done: Record<string, boolean> } = { done: { 'econ-ps1': true } };
    const phone: { done: Record<string, boolean> } = { done: { 'psci-essay': true } };

    expect(mergePersisted(laptop, phone).done).toEqual({
      'econ-ps1': true,
      'psci-essay': true,
    });
  });

  it('keeps the local list when the remote has no such field at all', () => {
    const laptop = { sittings: [sitting('a', 1_000, 70)], accent: 'copper' };
    // An account saved before practice papers existed.
    const older = { accent: 'sage' };

    const merged = mergePersisted(laptop, older);

    expect(merged.sittings).toHaveLength(1);
    expect(merged.accent).toBe('sage');
  });

  it('takes the newer edit when both devices changed the same note', () => {
    const laptop = { notes: [note('a', 'Draft', 10)] };
    const phone = { notes: [note('a', 'Draft, revised', 20)] };

    expect(mergePersisted(laptop, phone).notes[0].title).toBe('Draft, revised');
    // And the other way round: the remote being newer is not automatic.
    expect(mergePersisted(phone, laptop).notes[0].title).toBe('Draft, revised');
  });

  it('does not let a settings change drag a list with it', () => {
    type Half = { ground: string; tasks: { id: string; title: string; created: number }[] };
    const laptop: Half = { ground: 'ink', tasks: [{ id: 't1', title: 'Email the TA', created: 1 }] };
    const phone: Half = { ground: 'forest', tasks: [] };

    const merged = mergePersisted(laptop, phone);

    expect(merged.ground).toBe('forest');
    expect(merged.tasks).toHaveLength(1);
  });
});

describe('union', () => {
  it('keeps local order and appends what only the remote has', () => {
    const local = [note('a', 'A', 1), note('b', 'B', 2)];
    const remote = [note('c', 'C', 3)];

    expect(union(local, remote).map((r) => (r as { id: string }).id)).toEqual(['a', 'b', 'c']);
  });

  it('unwraps a course, which holds its id one level down', () => {
    const local = [{ course: { id: 'econ' }, items: [] }];
    const remote = [{ course: { id: 'econ' }, items: [1] }, { course: { id: 'psci' } }];

    const merged = union(local, remote) as { course: { id: string }; items?: number[] }[];

    expect(merged).toHaveLength(2);
    expect(merged[0].items).toEqual([1]);
  });

  it('keeps a row with no id from both sides rather than dropping one', () => {
    const merged = union([{ label: 'mine' }], [{ label: 'theirs' }]);
    expect(merged).toHaveLength(2);
  });

  it('does not duplicate an identical row that has no id', () => {
    const merged = union([{ label: 'same' }], [{ label: 'same' }]);
    expect(merged).toHaveLength(1);
  });

  it('reads a sitting’s epoch `at` but never an appointment’s clock `at`', () => {
    // An appointment's `at` is minutes past midnight — 390 is 6:30am, not a
    // date. `created` is read first, so the newer of the two wins on the
    // stamp that means what it says.
    const older = { id: 'x', at: 1_400, created: 1_000, title: 'Old' };
    const newer = { id: 'x', at: 390, created: 9_000, title: 'New' };

    expect((union([older], [newer])[0] as { title: string }).title).toBe('New');
    expect((union([newer], [older])[0] as { title: string }).title).toBe('New');
  });
});

describe('ticks and latest', () => {
  it('takes every key from both sides', () => {
    expect(ticks({ a: true }, { b: true })).toEqual({ a: true, b: true });
  });

  it('lets the remote settle a genuine disagreement', () => {
    expect(ticks({ a: true }, { a: false })).toEqual({ a: false });
  });

  it('keeps the more recent drill of the same card', () => {
    const laptop = { card1: { right: 3, seen: 1_000 } };
    const phone = { card1: { right: 1, seen: 5_000 }, card2: { right: 1, seen: 2_000 } };

    expect(latest(laptop, phone)).toEqual({
      card1: { right: 1, seen: 5_000 },
      card2: { right: 1, seen: 2_000 },
    });
    // The order the two devices sync in must not change the answer.
    expect(latest(phone, laptop)).toEqual({
      card1: { right: 1, seen: 5_000 },
      card2: { right: 1, seen: 2_000 },
    });
  });

  it('does not lose a card only one device has ever seen', () => {
    type Half = { reviews: Record<string, { seen: number }> };
    const laptop: Half = { reviews: { a: { seen: 1 } } };
    const phone: Half = { reviews: { b: { seen: 2 } } };
    const merged = mergePersisted(laptop, phone);
    expect(Object.keys(merged.reviews).sort()).toEqual(['a', 'b']);
  });
});

describe('the table', () => {
  /**
   * The field names, read out of the store itself.
   *
   * `pickPersisted` is the one place that says what a persisted field is, so
   * it is what this checks against. Read out of the file rather than imported
   * so that this stays a test about a lookup table: `shape.ts` is cheap to
   * import today and the reason to keep it that way is exactly this sort of
   * creep.
   */
  const persistedFields = (): string[] => {
    const source = readFileSync(join(process.cwd(), 'src/state/shape.ts'), 'utf8');
    const body = source.split('export function pickPersisted')[1]?.split('\n}')[0] ?? '';
    return [...body.matchAll(/^\s{4}(\w+):\s*state\./gm)].map((m) => m[1]);
  };

  it('found the store, so the rest of this means something', () => {
    expect(persistedFields().length).toBeGreaterThan(20);
  });

  it('names every field the store persists', () => {
    const missing = persistedFields().filter((f) => !(f in STRATEGY));
    expect(missing).toEqual([]);
  });

  it('names nothing the store does not persist', () => {
    const fields = new Set(persistedFields());
    const stale = Object.keys(STRATEGY).filter((f) => !fields.has(f));
    expect(stale).toEqual([]);
  });

  it('falls back to union, so a forgotten field cannot lose work', () => {
    expect(strategyFor('somethingAddedNextSemester')).toBe('union');
  });
});

describe('settings about the device rather than the person', () => {
  it('keeps this device’s text size and spacing whatever the account says', () => {
    // A phone at arm's length and a laptop at desk distance want different
    // answers. Syncing one over the other is a setting that appears to
    // un-set itself every time the other device is opened.
    const here = { textSize: 'largest', density: 'roomy', accent: 'jade' };
    const there = { textSize: 'compact', density: 'tight', accent: 'brass' };
    const out = mergePersisted(here, there);
    expect(out.textSize).toBe('largest');
    expect(out.density).toBe('roomy');
    // Taste still syncs — it is about the person.
    expect(out.accent).toBe('brass');
  });

  it('is a strategy, not an omission', () => {
    // A field simply left out of the table falls through to `union`, which
    // for two strings means the remote wins — the opposite of what is wanted.
    expect(strategyFor('textSize')).toBe('mine');
    expect(strategyFor('density')).toBe('mine');
    expect(strategyFor('somethingNobodyListed')).toBe('union');
  });
});
