/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STRATEGY,
  labelFor,
  latest,
  mergePersisted,
  replacedLine,
  strategyFor,
  syncLine,
  ticks,
  union,
  withNotes,
  worthSaying,
} from './merge';

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
    /*
     * Any field, not only the ones copied off `state`.
     *
     * This matched `name: state.name` only, so `schemaVersion: SCHEMA` — a
     * constant rather than a copy — was invisible to the guard and reached the
     * sync payload with no strategy at all. A field's merge behaviour matters
     * whatever the right-hand side looks like.
     */
    return [...body.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]);
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

describe('what a sync did, reported', () => {
  const base = { ground: 'ink', notes: [] as { id: string; title: string }[], grades: {} as Record<string, string>, textSize: 'normal' };

  it('observes without changing anything', () => {
    // The whole discipline of this: the notes are a second return value, not
    // a second behaviour.
    const local = { ...base, ground: 'ink' };
    const remote = { ground: 'fog' };
    expect(withNotes(local, remote).merged).toEqual(mergePersisted(local, remote));
  });

  it('says when the other device replaced a setting', () => {
    const n = withNotes({ ...base }, { ground: 'fog' }).notes.find((x) => x.key === 'ground');
    expect(n?.outcome).toBe('took-remote');
    expect(n?.changed).toBe(1);
    expect(n?.label).toBe('Theme');
  });

  it('says nothing happened when the two agreed', () => {
    const n = withNotes({ ...base }, { ground: 'ink' }).notes.find((x) => x.key === 'ground');
    expect(n?.outcome).toBe('no-change');
    expect(n?.changed).toBe(0);
  });

  it('counts the rows a union actually brought in', () => {
    const local = { ...base, notes: [{ id: 'a', title: 'A' }] };
    const remote = { notes: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] };
    const n = withNotes(local, remote).notes.find((x) => x.key === 'notes');
    expect(n?.outcome).toBe('combined');
    expect(n?.changed).toBe(1);
  });

  it('counts the keys a map merge moved', () => {
    const local = { ...base, grades: { 'econ:0': '88' } };
    const remote = { grades: { 'econ:0': '88', 'psci:1': '91' } };
    expect(withNotes(local, remote).notes.find((x) => x.key === 'grades')?.changed).toBe(1);
  });

  it('reports a device keeping its own, and does not put it on a screen', () => {
    // "This device kept its own text size" is the fact and it is not news.
    const notes = withNotes({ ...base }, { textSize: 'largest' }).notes;
    expect(notes.find((n) => n.key === 'textSize')?.outcome).toBe('kept-local');
    expect(worthSaying(notes).map((n) => n.key)).not.toContain('textSize');
  });

  it('drops everything that did nothing, so the report is readable', () => {
    const notes = withNotes({ ...base }, { ground: 'ink', textSize: 'normal' }).notes;
    expect(worthSaying(notes)).toEqual([]);
  });
});

describe('what the two places say', () => {
  const note = (key: string, outcome: 'took-remote' | 'combined', changed = 1) => ({
    key,
    strategy: 'theirs' as const,
    outcome,
    changed,
    label: labelFor(key),
    wasDefault: false,
  });

  it('names what came from where, in words', () => {
    const said = syncLine([note('grades', 'combined', 3), note('courses', 'combined', 1)]);
    expect(said).toContain('grades');
    expect(said).toContain('courses');
    expect(said).toContain('another device');
  });

  it('says so plainly when nothing came back', () => {
    expect(syncLine([])).toContain('did not already have');
  });

  it('does not list twelve things', () => {
    const many = ['grades', 'courses', 'notes', 'tasks', 'appointments'].map((k) => note(k, 'combined'));
    expect(syncLine(many)).toContain('and 2 more');
  });

  it('says nothing about a default being filled in for the first time', () => {
    // A fresh device has defaults, and a first sync replacing one with a real
    // choice is the sync working — not something to open a banner about.
    const fresh = { ...note('ground', 'took-remote' as const), wasDefault: true };
    expect(replacedLine([fresh])).toBe('');
  });

  it('speaks up only for a value that was replaced', () => {
    // A combined list lost nothing. A setting overwritten by `theirs` did,
    // and the person it happened to is the one who cannot tell.
    expect(replacedLine([note('grades', 'combined', 5)])).toBe('');
    expect(replacedLine([note('ground', 'took-remote')])).toContain('theme');
    expect(replacedLine([note('ground', 'took-remote')])).toContain('replaced');
  });

  it('reads as a list when more than one was replaced', () => {
    const said = replacedLine([note('ground', 'took-remote'), note('dayBudget', 'took-remote')]);
    expect(said).toContain('theme and hours in a day');
    expect(said).toContain('were replaced');
  });
});
