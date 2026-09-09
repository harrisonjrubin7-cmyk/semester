/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reducer } from './reducer';
import { DEFAULT_PERSISTED, initialEphemeral, type State } from './shape';
import { directoryOf } from '../lib/look';

/**
 * The reducer, tested at last.
 *
 * It had none of this before, for a reason that was structural rather than
 * anybody's fault: it lived inside `store.tsx` next to a React context and a
 * Supabase client, so reaching it from a test meant loading both. Splitting it
 * out is what makes the rest of this file possible, and the first test below
 * is the one that pays for the split — a switch statement is exhaustive by
 * construction and eight chained functions are not, so the exhaustiveness has
 * to be asserted instead.
 */

const at = new Date('2026-09-03T09:00:00');
const blank = (): State => ({ ...DEFAULT_PERSISTED, ...initialEphemeral(at) });

describe('every action is handled somewhere', () => {
  const here = join(process.cwd(), 'src/state');

  const declared = (): string[] => {
    const source = readFileSync(join(here, 'shape.ts'), 'utf8');
    const union = source.split('export type Action =')[1]?.split('\nconst ')[0] ?? '';
    return [...union.matchAll(/\btype: '(\w+)'/g)].map((m) => m[1]);
  };

  /**
   * Two places, because there are two places.
   *
   * Almost everything is a `case` in a slice. Undo is not: it is a property of
   * every destructive action rather than of any one of them, so it is handled
   * in `reducer.ts` above the loop. Reading only the slices would report those
   * as unhandled and reading only for `case` would miss them, so this reads
   * both — the point of the test is that nothing falls through, not that
   * everything is written the same way.
   */
  const handled = (): string[] => {
    const dir = join(here, 'slices');
    const inSlices = readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .flatMap((f) => [
        ...readFileSync(join(dir, f), 'utf8').matchAll(/^ {4}case '(\w+)':/gm),
      ])
      .map((m) => m[1]);
    const above = [
      ...readFileSync(join(here, 'reducer.ts'), 'utf8').matchAll(
        /action\.type === '(\w+)'/g,
      ),
    ].map((m) => m[1]);
    return [...inSlices, ...above];
  };

  it('read both lists, so the rest of this means something', () => {
    expect(declared().length).toBeGreaterThan(80);
    expect(handled().length).toBeGreaterThan(80);
  });

  it('no action falls through every slice', () => {
    const covered = new Set(handled());
    expect(declared().filter((a) => !covered.has(a))).toEqual([]);
  });

  it('no slice handles an action that no longer exists', () => {
    const real = new Set(declared());
    expect(handled().filter((a) => !real.has(a))).toEqual([]);
  });

  it('no two slices claim the same action', () => {
    const seen = handled();
    const twice = seen.filter((a, i) => seen.indexOf(a) !== i);
    expect(twice).toEqual([]);
  });

  it('leaves the state alone for something it has never heard of', () => {
    const state = blank();
    // Cast because the point is an action outside the union — a saved action
    // from an older build, or a typo that typing did not catch at a call site.
    expect(reducer(state, { type: 'nonsense' } as never)).toBe(state);
  });
});

describe('ticking things off', () => {
  it('records when, as well as whether', () => {
    const next = reducer(blank(), { type: 'toggleDone', id: 'e1' });
    expect(next.done.e1).toBe(true);
    expect(next.tickedAt.e1).toBeGreaterThan(0);
  });

  it('forgets when, on untick', () => {
    const on = reducer(blank(), { type: 'toggleDone', id: 'e1' });
    const off = reducer(on, { type: 'toggleDone', id: 'e1' });
    expect(off.done.e1).toBe(false);
    expect('e1' in off.tickedAt).toBe(false);
  });

  it('does not disturb another deadline', () => {
    const one = reducer(blank(), { type: 'toggleDone', id: 'e1' });
    const two = reducer(one, { type: 'toggleDone', id: 'e2' });
    expect(two.done).toEqual({ e1: true, e2: true });
  });
});

describe('going places', () => {
  it('leaves a way back from a screen that is not a root', () => {
    const there = reducer(blank(), { type: 'go', screen: 'essay' });
    expect(there.screen).toBe('essay');
    expect(reducer(there, { type: 'back' }).screen).toBe('home');
  });

  it('resets the stack at a root in tab mode', () => {
    const deep = reducer(reducer(blank(), { type: 'go', screen: 'essay' }), {
      type: 'go',
      screen: 'study',
    });
    expect(deep.history).toEqual([]);
  });

  it('keeps a way back at a root in feed mode, which has no tab bar', () => {
    const feed = { ...blank(), nav: 'feed' as const };
    const deep = reducer(reducer(feed, { type: 'go', screen: 'essay' }), {
      type: 'go',
      screen: 'study',
    });
    expect(deep.history).toContain('essay');
  });

  it('remembers where you have been, newest first and without repeats', () => {
    let s = blank();
    for (const screen of ['essay', 'exam', 'essay'] as const) {
      s = reducer(s, { type: 'go', screen });
    }
    expect(s.recent.slice(0, 2)).toEqual(['essay', 'exam']);
  });

  it('going nowhere is not a move', () => {
    const s = reducer(blank(), { type: 'go', screen: 'essay' });
    expect(reducer(s, { type: 'go', screen: 'essay' })).toBe(s);
  });
});

describe('courses and the account', () => {
  const module = (id: string) =>
    ({
      course: { id, code: id.toUpperCase(), title: id, term: '2026FA' },
      items: [],
      schedule: [],
      guide: { code: id.toUpperCase(), units: [] },
    }) as never;

  it('queues a deleted course for the next push, once', () => {
    let s = reducer(blank(), { type: 'addCourse', module: module('econ') });
    s = reducer(s, { type: 'removeCourse', id: 'econ' });
    s = reducer(s, { type: 'removeCourse', id: 'econ' });
    expect(s.removedCourses).toEqual(['econ']);
    expect(s.courses).toHaveLength(0);
  });

  it('cancels the deletion when the same course is imported again', () => {
    let s = reducer(blank(), { type: 'addCourse', module: module('econ') });
    s = reducer(s, { type: 'removeCourse', id: 'econ' });
    s = reducer(s, { type: 'addCourse', module: module('econ') });
    expect(s.removedCourses).toEqual([]);
  });

  it('empties the queue once the account has been told', () => {
    let s = reducer(blank(), { type: 'addCourse', module: module('econ') });
    s = reducer(s, { type: 'removeCourse', id: 'econ' });
    s = reducer(s, { type: 'removalsPushed', ids: ['econ'] });
    expect(s.removedCourses).toEqual([]);
  });

  it('takes the other device without dropping this one', () => {
    const local = reducer(blank(), {
      type: 'keepNote',
      title: 'From the laptop',
      body: '',
      courseId: null,
    });
    const merged = reducer(local, {
      type: 'hydrate',
      persisted: {
        notes: [
          {
            id: 'phone-1',
            title: 'From the phone',
            body: '',
            created: 1,
            updated: 1,
            courseId: null,
            fileIds: [],
          },
        ],
      },
    });
    expect(merged.notes.map((n) => n.title).sort()).toEqual(['From the laptop', 'From the phone']);
  });

  it('does not un-delete a course whose deletion has not synced yet', () => {
    let s = reducer(blank(), { type: 'addCourse', module: module('econ') });
    s = reducer(s, { type: 'removeCourse', id: 'econ' });
    const back = reducer(s, { type: 'hydrate', persisted: { courses: [module('econ')] } });
    expect(back.courses).toHaveLength(0);
  });

  it('leaves you on the screen you were on', () => {
    const s = reducer(blank(), { type: 'go', screen: 'essay' });
    expect(reducer(s, { type: 'hydrate', persisted: { nav: 'feed' } }).screen).toBe('essay');
  });
});

describe('going back to a copy', () => {
  const module = (id: string) =>
    ({
      course: { id, code: id.toUpperCase(), title: id, term: '2026FA' },
      items: [],
      schedule: [],
      guide: { code: id.toUpperCase(), units: [] },
    }) as never;

  const note = (id: string, title: string) => ({
    id,
    title,
    body: '',
    created: 1,
    updated: 1,
    courseId: null,
    fileIds: [],
  });

  it('takes away what was added since, which merging cannot', () => {
    // The whole point. Going back to yesterday has to be able to remove this
    // morning's mistake, and a union can only ever add — restoring through
    // `hydrate` produced a state holding both days, which is neither.
    const s = { ...blank(), notes: [note('a', 'Yesterday'), note('b', 'This morning')] };
    const back = reducer(s, { type: 'restore', persisted: { notes: [note('a', 'Yesterday')] } });
    expect(back.notes.map((n) => n.id)).toEqual(['a']);
  });

  it('is the difference between restore and sync', () => {
    // Same input, two actions, deliberately opposite answers. Sync must keep
    // both devices' notes; a restore must not.
    const s = { ...blank(), notes: [note('a', 'Yesterday'), note('b', 'This morning')] };
    const synced = reducer(s, { type: 'hydrate', persisted: { notes: [note('a', 'Yesterday')] } });
    expect(synced.notes).toHaveLength(2);
  });

  it('leaves alone anything the copy does not carry', () => {
    // A copy taken before a feature existed has no key for it, and emptying
    // settings nobody chose to revert is its own kind of data loss.
    const s = reducer(blank(), {
      type: 'addTask',
      task: { title: 'Laundry', date: '', time: '', courseId: null, note: '' } as never,
    });
    const back = reducer(s, { type: 'restore', persisted: { notes: [] } });
    expect(back.tasks).toHaveLength(1);
  });

  it('still does not un-delete a course whose deletion has not synced', () => {
    // The removal list is about the account, not about which copy is on
    // screen: resurrecting one here would push it straight back up.
    let s = reducer(blank(), { type: 'addCourse', module: module('econ') });
    s = reducer(s, { type: 'removeCourse', id: 'econ' });
    const back = reducer(s, { type: 'restore', persisted: { courses: [module('econ')] } });
    expect(back.courses).toHaveLength(0);
  });

  it('ignores a null where a list should be, rather than blanking it', () => {
    const s = { ...blank(), notes: [note('a', 'Kept')] };
    const back = reducer(s, {
      type: 'restore',
      persisted: { notes: null as never, tasks: undefined },
    });
    expect(back.notes).toHaveLength(1);
  });

  /*
   * A restore's argument is a file somebody opened, and this used to spread it
   * straight into the state.
   *
   * `readBackup` in `lib/export.ts` checks that each section is an array or an
   * object, and its own error message says why it cares — "restoring it could
   * put nonsense into your account". It could go no further without
   * duplicating every field rule in `state/shape.ts`.
   *
   * So the shapes that took the app down out of localStorage came back through
   * a door that is easier to reach: somebody opens a file rather than editing
   * devtools. Measured by driving the Export screen with a backup holding
   * `courses: [{ id: 'c1' }]` and pressing Replace and restore — `Cannot read
   * properties of undefined (reading 'term')`, uncaught, and the scroll area
   * went from 1,761 characters to 0.
   */
  it('reads a restored blob the way it reads storage', () => {
    const back = reducer(blank(), {
      type: 'restore',
      persisted: {
        courses: [{ id: 'c1' }],
        tasks: [{ id: 't1', date: 9 }],
        reviews: { 'econ::c1': null },
        windows: [{ id: 'w1' }],
      } as never,
    });
    // A course with nothing to address it by is dropped, the way storage
    // drops it — not spread into the catalogue for the store to read `.term`
    // off.
    expect(back.courses).toEqual([]);
    expect(back.tasks[0].date).toBeNull();
    expect(back.reviews).toEqual({});
    expect(Array.isArray(back.windows[0].days)).toBe(true);
  });

  /*
   * And the third door, which is the one nobody has to open.
   *
   * `hydrate` is the sync path. Its blob is `remote.state as
   * Partial<Persisted>` with `remote.courses.map((c) => c.data as
   * CourseModule)` beside it — two casts — arriving from whichever build the
   * other device was running. `withNotes` takes the remote value whole
   * wherever the two shapes disagree, so a damaged list replaced a good one
   * and nothing had looked at it on the way in.
   */
  it('reads a synced blob the way it reads storage', () => {
    const s = reducer(blank(), {
      type: 'hydrate',
      persisted: {
        courses: [{ id: 'c1' }],
        windows: [{ id: 'w1' }],
        reviews: { 'a::b': null },
        tasks: [{ id: 't1', date: 9 }],
      } as never,
    });
    expect(s.courses).toEqual([]);
    expect(Array.isArray(s.windows[0].days)).toBe(true);
    expect(s.reviews).toEqual({});
    expect(s.tasks[0].date).toBeNull();
  });

  it('still merges a good sync rather than replacing it', () => {
    // The reader must not turn the union back into a replacement: two devices
    // each writing a note offline have to keep both notes.
    const mine = { ...blank(), notes: [note('a', 'Mine')] };
    const s = reducer(mine, { type: 'hydrate', persisted: { notes: [note('b', 'Theirs')] } });
    expect(s.notes.map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('still restores a whole, good file exactly', () => {
    const s = { ...blank(), notes: [note('a', 'Yesterday'), note('b', 'This morning')] };
    const back = reducer(s, { type: 'restore', persisted: { notes: [note('a', 'Yesterday')] } });
    expect(back.notes).toEqual([note('a', 'Yesterday')]);
  });
});

describe('your own things', () => {
  it('keeps a note without leaving the screen', () => {
    const s = reducer(blank(), { type: 'keepNote', title: 'Week plan', body: 'x', courseId: null });
    expect(s.notes[0].title).toBe('Week plan');
    expect(s.screen).toBe('home');
  });

  it('opens the editor on a new one', () => {
    const s = reducer(blank(), { type: 'newNote', courseId: null });
    expect(s.screen).toBe('note');
    expect(s.noteId).toBe(s.notes[0].id);
  });

  it('titles an untitled kept note rather than leaving it blank', () => {
    const s = reducer(blank(), { type: 'keepNote', title: '   ', body: 'x', courseId: null });
    expect(s.notes[0].title).toBe('Untitled');
  });

  it('closes the editor when the open note is deleted', () => {
    const s = reducer(blank(), { type: 'newNote', courseId: null });
    expect(reducer(s, { type: 'deleteNote', id: s.notes[0].id }).noteId).toBeNull();
  });

  it('does not attach the same file twice', () => {
    const s = reducer(blank(), { type: 'newNote', courseId: null });
    const id = s.notes[0].id;
    const once = reducer(s, { type: 'attachFile', noteId: id, fileId: 'f1' });
    const twice = reducer(once, { type: 'attachFile', noteId: id, fileId: 'f1' });
    expect(twice.notes[0].fileIds).toEqual(['f1']);
  });
});

describe('practice papers', () => {
  const sitting = (pct: number) => ({
    courseId: 'econ',
    title: 'Paper',
    at: Date.now(),
    minutes: 30,
    got: pct,
    outOf: 100,
    pct,
    code: '',
    missed: [],
  });

  it('keeps the newest first', () => {
    let s = reducer(blank(), { type: 'keepSitting', sitting: sitting(70) });
    s = reducer(s, { type: 'keepSitting', sitting: sitting(80) });
    expect(s.sittings[0].pct).toBe(80);
  });

  it('caps the pile at forty, dropping the oldest', () => {
    let s = blank();
    for (let i = 0; i < 45; i += 1) s = reducer(s, { type: 'keepSitting', sitting: sitting(i) });
    expect(s.sittings).toHaveLength(40);
    expect(s.sittings[0].pct).toBe(44);
  });

  it('gives every sitting its own id', () => {
    let s = reducer(blank(), { type: 'keepSitting', sitting: sitting(70) });
    s = reducer(s, { type: 'keepSitting', sitting: sitting(70) });
    expect(s.sittings[0].id).not.toBe(s.sittings[1].id);
  });
});

describe('drilling', () => {
  it('records the answer against the card, not just the run', () => {
    const s = reducer(blank(), { type: 'markCard', got: true, key: 'card1' });
    expect(s.drillGot).toBe(1);
    expect(s.reviews.card1.right).toBe(1);
    expect(s.reviews.card1.due).toBeGreaterThan(Date.now());
  });

  it('a miss resets the streak but keeps the history', () => {
    let s = reducer(blank(), { type: 'markCard', got: true, key: 'card1' });
    s = reducer(s, { type: 'markCard', got: false, key: 'card1' });
    expect(s.reviews.card1).toMatchObject({ right: 1, wrong: 1, streak: 0 });
  });

  it('ignores a second answer to the same quiz question', () => {
    const started = reducer(blank(), {
      type: 'startQuiz',
      quiz: [{ q: 'q', unit: 'u', full: 'q', opts: [{ text: 'a', ok: true }] }],
    });
    const once = reducer(started, { type: 'pickAnswer', index: 0 });
    expect(reducer(once, { type: 'pickAnswer', index: 0 })).toBe(once);
  });
});

describe('taking it back', () => {
  const twoNotes = (): State => {
    let s = reducer(blank(), { type: 'keepNote', title: 'One', body: '', courseId: null });
    return reducer(s, { type: 'keepNote', title: 'Two', body: '', courseId: null });
  };

  it('offers the last removal back, in words', () => {
    const s = twoNotes();
    const gone = reducer(s, { type: 'deleteNote', id: s.notes[0].id });
    expect(gone.notes).toHaveLength(1);
    expect(gone.undone?.label).toBe('Note deleted');
  });

  it('puts it back', () => {
    const s = twoNotes();
    const gone = reducer(s, { type: 'deleteNote', id: s.notes[0].id });
    const back = reducer(gone, { type: 'undo' });
    expect(back.notes.map((n) => n.title).sort()).toEqual(['One', 'Two']);
    expect(back.undone).toBeNull();
  });

  it('restores the fields the action touched and nothing else', () => {
    // Undoing a deleted note must not also undo the box you ticked in between.
    const s = twoNotes();
    const gone = reducer(s, { type: 'deleteNote', id: s.notes[0].id });
    const ticked = reducer(gone, { type: 'toggleDone', id: 'e1' });
    const back = reducer(ticked, { type: 'undo' });
    expect(back.notes).toHaveLength(2);
    expect(back.done.e1).toBe(true);
  });

  it('offers nothing for an action that only edits', () => {
    // An edit leaves the thing there to edit back.
    const s = twoNotes();
    expect(reducer(s, { type: 'toggleDone', id: 'e1' }).undone).toBeNull();
  });

  it('offers nothing when the removal removed nothing', () => {
    // A Remove pressed on an id that is already gone should not put a toast up
    // offering to undo nothing.
    const s = twoNotes();
    expect(reducer(s, { type: 'deleteNote', id: 'never-existed' }).undone).toBeNull();
  });

  it('holds one step, not a history', () => {
    const s = twoNotes();
    const first = reducer(s, { type: 'deleteNote', id: s.notes[0].id });
    const second = reducer(first, { type: 'deleteNote', id: first.notes[0].id });
    const back = reducer(second, { type: 'undo' });
    expect(back.notes).toHaveLength(1);
    expect(reducer(back, { type: 'undo' })).toBe(back);
  });

  it('does nothing at all when there is nothing to take back', () => {
    const s = blank();
    expect(reducer(s, { type: 'undo' })).toBe(s);
    expect(reducer(s, { type: 'forgetUndo' })).toBe(s);
  });

  it('lets the offer be dropped once it has expired', () => {
    const s = twoNotes();
    const gone = reducer(s, { type: 'deleteNote', id: s.notes[0].id });
    expect(reducer(gone, { type: 'forgetUndo' }).undone).toBeNull();
  });

  it('does not offer a removed course back, because that one asks first', () => {
    // Removing a course takes its guide, its cards and every answer against
    // them — a different order of loss from a deleted row.
    let s = reducer(blank(), {
      type: 'addCourse',
      module: {
        course: { id: 'econ', code: 'ECON', title: 'e', term: '2026FA' },
        items: [],
        schedule: [],
        guide: { code: 'ECON', units: [] },
      } as never,
    });
    expect(reducer(s, { type: 'removeCourse', id: 'econ' }).undone).toBeNull();
  });
});

describe('the look', () => {
  it('takes an id it knows', () => {
    expect(reducer(blank(), { type: 'setLook', look: { ground: 'forest' } }).ground).toBe('forest');
  });

  it('refuses one it does not, rather than storing a broken colour', () => {
    const s = reducer(blank(), { type: 'setLook', look: { ground: 'chartreuse' } });
    expect(s.ground).toBe(DEFAULT_PERSISTED.ground);
  });

  it('remembers whether the courses are coloured, and refuses a value it does not know', () => {
    // On by default: the question every list is asked is which class a thing
    // belongs to, and the colour answers it before anything is read.
    expect(blank().courseColours).toBe('on');
    expect(reducer(blank(), { type: 'setLook', look: { courseColours: 'off' } }).courseColours).toBe('off');
    expect(reducer(blank(), { type: 'setLook', look: { courseColours: 'plaid' } }).courseColours).toBe('on');
  });

  it('folds the calendar key away and remembers that it was opened', () => {
    // Closed to begin with: eleven marks above the grid on every calendar
    // view, every time, is a key that is read twice and then in the way.
    expect(blank().keyOpen).toBe(false);
    const open = reducer(blank(), { type: 'toggleKey' });
    expect(open.keyOpen).toBe(true);
    expect(reducer(open, { type: 'toggleKey' }).keyOpen).toBe(false);
  });

  it('changes one part without disturbing the rest', () => {
    const s = reducer(blank(), { type: 'setLook', look: { accent: 'copper' } });
    expect(s.accent).toBe('copper');
    expect(s.typeface).toBe(DEFAULT_PERSISTED.typeface);
  });

  /*
   * The directory ships unchosen, and has to stay that way through a change of
   * layout. It was `list` here once, which made "nobody has chosen"
   * unreachable — the state is written whole every save, so the first save
   * stamped an answer nobody had given, and the soft layout could never hand
   * anybody the tiles again. See `directoryOf` in `lib/look.ts`.
   */
  it('ships the directory unchosen, so the layout can answer for it', () => {
    expect(DEFAULT_PERSISTED.directory).toBe('');
    expect(directoryOf(DEFAULT_PERSISTED.directory, DEFAULT_PERSISTED.shell)).toBe('list');
  });

  it('does not answer the directory on the way past when the layout changes', () => {
    const s = reducer(blank(), { type: 'setLook', look: { shell: 'soft' } });
    expect(s.directory).toBe('');
    expect(directoryOf(s.directory, s.shell)).toBe('tiles');
    // And back again, still never having been asked.
    const back = reducer(s, { type: 'setLook', look: { shell: 'plain' } });
    expect(back.directory).toBe('');
    expect(directoryOf(back.directory, back.shell)).toBe('list');
  });

  it('lets the choice outrank the layout once it is made', () => {
    const s = reducer(blank(), { type: 'setLook', look: { shell: 'soft', directory: 'list' } });
    expect(directoryOf(s.directory, s.shell)).toBe('list');
    const t = reducer(blank(), { type: 'setLook', look: { directory: 'tiles' } });
    expect(directoryOf(t.directory, t.shell)).toBe('tiles');
  });
});

describe('editTask', () => {
  const withTask = () =>
    reducer(blank(), {
      type: 'addTask',
      task: { title: 'Draft the paper', date: '2026-09-20', time: '', note: 'Step', courseId: 'econ' },
    });

  it('changes what it is told to and nothing else', () => {
    const s = withTask();
    const before = s.tasks[0];
    const after = reducer(s, { type: 'editTask', id: before.id, patch: { date: '2026-09-27' } }).tasks[0];
    expect(after.date).toBe('2026-09-27');
    expect(after.title).toBe('Draft the paper');
    expect(after.courseId).toBe('econ');
    expect(after.note).toBe('Step');
  });

  it('keeps the id, when it was made, and whether it is done', () => {
    // The whole reason this action exists: the old remedy was delete and
    // retype, which threw all three away.
    let s = withTask();
    const before = s.tasks[0];
    s = reducer(s, { type: 'toggleTask', id: before.id });
    const after = reducer(s, { type: 'editTask', id: before.id, patch: { title: 'Rewritten' } }).tasks[0];
    expect(after.id).toBe(before.id);
    expect(after.created).toBe(before.created);
    expect(after.done).toBe(true);
  });

  it('sends a task to Someday when the date is cleared', () => {
    const s = withTask();
    const after = reducer(s, { type: 'editTask', id: s.tasks[0].id, patch: { date: null } }).tasks[0];
    expect(after.date).toBeNull();
  });

  it('leaves the other tasks alone', () => {
    let s = withTask();
    s = reducer(s, {
      type: 'addTask',
      task: { title: 'Laundry', date: null, time: '', note: '', courseId: null },
    });
    const out = reducer(s, { type: 'editTask', id: s.tasks[0].id, patch: { title: 'Changed' } });
    expect(out.tasks.map((t) => t.title)).toEqual(['Changed', 'Laundry']);
  });

  it('does nothing at all for an id that is not there', () => {
    const s = withTask();
    expect(reducer(s, { type: 'editTask', id: 'gone', patch: { title: 'x' } }).tasks).toEqual(s.tasks);
  });
});
