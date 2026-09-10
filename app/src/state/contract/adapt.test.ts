import { describe, expect, it } from 'vitest';
import { alive, changedSince, merge, sweep, stamp, attendId, dayAt, newId, TOMBSTONE_DAYS } from '@semester/contract';
import type { Envelope, Note } from '@semester/contract';
import { DEFAULT_PERSISTED, type Persisted } from '../shape';
import { toContract, fromContract, readScore } from './adapt';
import { key as gradeKey } from '../../lib/grades';
import type { CourseModule } from '../../lib/types';

/**
 * The contract, and the seven round-trip tests that gate Phase 2.
 *
 * Four of the seven need two clients and the website is not in this
 * repository, so those are marked and skipped rather than quietly passing on
 * a stand-in. A gate that goes green because half of it never ran is worse
 * than a gate that says which half.
 *
 * What *is* testable now is the app's own half: does state survive the
 * crossing, does a tombstone travel, does a simultaneous edit get reported
 * rather than swallowed, and is a double round-trip stable. Those are real,
 * and three of them are the parts most likely to be got wrong.
 */

const course = (over: Partial<CourseModule['course']> = {}): CourseModule => ({
  course: {
    id: 'econ',
    code: 'ECON 1020',
    name: 'Principles of Macroeconomics',
    prof: 'Larsen',
    email: 'larsen@vanderbilt.edu',
    meets: 'MWF 10:10',
    room: 'Calhoun 101',
    credits: '3',
    term: '2026FA',
    source: 'econ.pdf',
    grading: [
      { what: 'Problem sets', pct: '20' },
      { what: 'Exams', pct: '80' },
    ],
    ...over,
  },
  items: [
    {
      id: 'd-1',
      c: 'econ',
      title: 'Problem set 2',
      kind: 'Problem set',
      month: 8,
      day: 9,
      year: 2026,
      dueTime: '11:59pm',
      weight: '5',
      where: '',
      detail: '',
      quote: '',
      source: 'econ.pdf',
    },
  ],
  schedule: [{ days: [1, 3, 5], at: 610, time: '10:10a', title: 'ECON 1020', meta: 'Calhoun 101' }],
  guide: {
    code: 'ECON 1020',
    name: 'Principles of Macroeconomics',
    blurb: '',
    source: 'econ.pdf',
    mastery: 0,
    audio: false,
    units: [],
    terms: [],
  },
  planMinutes: '90',
  frameLabel: 'Exam frames',
});

function state(over: Partial<Persisted> = {}): Persisted {
  return { ...DEFAULT_PERSISTED, courses: [course()], ...over };
}

describe('the crossing', () => {
  it('carries a course, and fixes the shapes the mapping table named', () => {
    const c = toContract(state()).courses[0];
    expect(c.title).toBe('Principles of Macroeconomics');
    expect(c.professor).toBe('Larsen');
    // A number, not the string the syllabus used — a degree audit adds these.
    expect(c.credits).toBe(3);
    expect(typeof c.credits).toBe('number');
    expect(c.termId).toBe('term:2026FA');
  });

  it('reads the credit count out of the line the syllabus wrote', () => {
    /*
     * What crosses this wire is what a degree audit divides by. `parseFloat`
     * took the leading number and stopped: it read the "Three (3)" the
     * mapping comment offers as an example as none at all, and a line that
     * opens with the term as two thousand and twenty-six.
     */
    const said = (credits: string) =>
      toContract(state({ courses: [course({ credits })] })).courses[0].credits;
    expect(said('Three (3)')).toBe(3);
    expect(said('2026 Spring · 3 credits')).toBe(3);
    expect(said('9:30 TR, 3 credits')).toBe(3);
    // A line with no credit count in it still crosses as zero, not as NaN.
    expect(said('TR 9:30-10:45')).toBe(0);
  });

  it('turns one recurring block into one meeting per day', () => {
    // The app holds `days: [1,3,5]` and one start time; a calendar cannot
    // render that, so it becomes three meetings.
    const m = toContract(state()).courses[0].meetings;
    expect(m).toHaveLength(3);
    expect(m.map((x) => x.day)).toEqual([1, 3, 5]);
    expect(m[0].from).toBe('10:10');
    expect(m[0].where).toBe('Calhoun 101');
  });

  it('keeps the syllabus wording for a due time instead of inventing a clock', () => {
    const item = toContract(state()).items[0];
    expect(item.dueText).toBe('11:59pm');
    // Noon UTC, so every zone from UTC-11 to UTC+13 reads the same day back.
    expect(item.dueAt).toBe(dayAt(2026, 8, 9));
    expect(item.dueAt?.slice(0, 10)).toBe('2026-09-09');
  });

  it('carries the date the syllabus gave, where somebody has moved it', () => {
    /*
     * The whole premise of the app is that a deadline is the syllabus's rather
     * than the app's, and every item travels with the sentence and page it came
     * from. Sending only the date in force would hand a second client a date
     * the document does not give, beside a quote that contradicts it, with
     * nothing saying which to believe.
     */
    const base = course();
    const moved = state({
      courses: [
        {
          ...base,
          items: [{ ...base.items[0], month: 8, day: 16, movedFrom: { month: 8, day: 9, year: 2026 } }],
        },
      ],
    });
    const item = toContract(moved).items[0];
    expect(item.dueAt).toBe(dayAt(2026, 8, 16));
    expect(item.statedDueAt).toBe(dayAt(2026, 8, 9));
  });

  it('leaves it off everything nobody has moved, which is almost everything', () => {
    // Present on every item would read as "the syllabus agrees", which is a
    // claim rather than the absence of one.
    expect(toContract(state()).items[0].statedDueAt).toBeUndefined();
  });

  it('falls back to the item’s own year for a move recorded without one', () => {
    // `movedFrom.year` is optional for the same reason `year` is: an item
    // written before the field existed has none.
    const base = course();
    const moved = state({
      courses: [
        {
          ...base,
          items: [{ ...base.items[0], month: 8, day: 16, movedFrom: { month: 8, day: 9 } }],
        },
      ],
    });
    expect(toContract(moved).items[0].statedDueAt).toBe(dayAt(2026, 8, 9));
  });

  it('says "unstated" for an unrecorded AI policy, never an empty string', () => {
    // The app treats absent as a no. An empty string reads as "no
    // restrictions", which is the opposite.
    expect(toContract(state()).courses[0].aiPolicy).toBe('unstated');
    const withPolicy = state({
      courses: [course({ ai: { stance: 'limited', note: 'Cite any use.' } })],
    });
    expect(toContract(withPolicy).courses[0].aiPolicy).toBe('limited: Cite any use.');
  });
});

describe('the positional grade key, which was a real bug', () => {
  it('keys a score by the component name, not its position', () => {
    const s = state({ grades: { [gradeKey('econ', 1)]: '88' } });
    const score = toContract(s).scores[0];
    expect(score.component).toBe('econ:exams');
    expect(score.earned).toBe(88);
    expect(score.possible).toBe(100);
  });

  it('survives a syllabus re-import that inserts a category at the top', () => {
    /*
     * The bug, demonstrated. Under the old positional key, `econ:1` meant
     * "Exams" before the re-import and "Problem sets" after it — a grade
     * silently moving to the wrong component. Keyed by name it stays put.
     */
    const before = state({ grades: { [gradeKey('econ', 1)]: '88' } });
    expect(toContract(before).scores[0].component).toBe('econ:exams');

    const reimported = state({
      grades: { [gradeKey('econ', 2)]: '88' },
      courses: [
        course({
          grading: [
            { what: 'Attendance', pct: '5' },
            { what: 'Problem sets', pct: '20' },
            { what: 'Exams', pct: '75' },
          ],
        }),
      ],
    });
    expect(toContract(reimported).scores[0].component).toBe('econ:exams');
  });

  it('reads the three things a student actually types', () => {
    expect(readScore('17/20')).toEqual({ earned: 17, possible: 20 });
    expect(readScore('85%')).toEqual({ earned: 85, possible: 100 });
    expect(readScore('85')).toEqual({ earned: 85, possible: 100 });
    expect(readScore('')).toBe(null);
    expect(readScore('most of it')).toBe(null);
    // A denominator of zero is not a score, it is a division by zero waiting.
    expect(readScore('5/0')).toBe(null);
  });
});

describe('what must not cross', () => {
  it('leaves the look alone when records arrive from another client', () => {
    // A note from a laptop must not be able to change this device's theme.
    const mine = state({ ground: 'parchment', notes: [] });
    const back = fromContract(mine, { ...toContract(mine), notes: [] });
    expect(back.ground).toBe('parchment');
  });

  it('does not let a note from elsewhere claim this device\'s files', () => {
    // `fileIds` point at blobs in a local store. A note arriving from another
    // client cannot bring them, and must not pretend to.
    const mine = state({
      notes: [
        { id: 'n1', title: 'Mine', body: 'x', created: 1, updated: 1, courseId: null, fileIds: ['f1'] },
      ],
    });
    const c = toContract(mine);
    c.notes[0] = { ...c.notes[0], body: 'edited elsewhere', updatedAt: stamp(2_000_000) };
    const back = fromContract(mine, c);
    expect(back.notes[0].body).toBe('edited elsewhere');
    expect(back.notes[0].fileIds).toEqual(['f1']);
  });
});

/* ── The merge rules ───────────────────────────────────────────────────── */

const note = (id: string, at: number, over: Partial<Note> = {}): Note => ({
  id,
  updatedAt: stamp(at),
  origin: 'app',
  kind: 'note',
  body: id,
  ...over,
});

describe('merging', () => {
  it('the later edit wins', () => {
    const { records } = merge([note('a', 1000)], [note('a', 2000, { body: 'theirs' })]);
    expect(records).toHaveLength(1);
    expect(records[0].body).toBe('theirs');
  });

  it('a tie keeps what is already held', () => {
    // A tie is the same edit arriving twice far more often than a real
    // conflict, and churning would mark it dirty and send it round again.
    const { records } = merge([note('a', 1000, { body: 'mine' })], [note('a', 1000, { body: 'theirs' })]);
    expect(records[0].body).toBe('mine');
  });

  it('a deletion is not privileged — a later edit undoes it', () => {
    // Deleting then changing your mind is recoverable; the reverse is not.
    const deleted = note('a', 1000, { deletedAt: stamp(1000) });
    const { records } = merge([deleted], [note('a', 2000, { body: 'kept' })]);
    expect(records[0].deletedAt).toBeUndefined();
    expect(records[0].body).toBe('kept');
  });

  it('reports a simultaneous edit rather than swallowing it', () => {
    /*
     * The plan's test 5: edited in both while offline, later wins, and *the
     * loss is reported*. Without the report there is no way to tell a merge
     * from an overwrite.
     */
    const since = stamp(1000);
    const { records, collided } = merge(
      [note('a', 2000, { body: 'mine' })],
      [note('a', 3000, { body: 'theirs' })],
      since,
    );
    expect(collided).toEqual(['a']);
    expect(records[0].body).toBe('theirs');
  });

  it('does not cry conflict when only one side moved', () => {
    const since = stamp(2000);
    const { collided } = merge([note('a', 1000)], [note('a', 3000)], since);
    expect(collided).toEqual([]);
  });
});

describe('tombstones', () => {
  it('travel — a deletion is a change and pushes like one', () => {
    const gone = note('a', 5000, { deletedAt: stamp(5000) });
    expect(changedSince([gone, note('b', 1000)], stamp(2000)).map((r) => r.id)).toEqual(['a']);
  });

  it('hide the record without losing the row', () => {
    const gone = note('a', 5000, { deletedAt: stamp(5000) });
    const all = [gone, note('b', 1000)];
    expect(alive(all).map((r) => r.id)).toEqual(['b']);
    expect(all).toHaveLength(2);
  });

  it('are swept only once they are older than the slowest device', () => {
    const day = 24 * 60 * 60 * 1000;
    const now = 400 * day;
    const recent = note('a', now - 10 * day, { deletedAt: stamp(now - 10 * day) });
    const ancient = note('b', now - (TOMBSTONE_DAYS + 10) * day, {
      deletedAt: stamp(now - (TOMBSTONE_DAYS + 10) * day),
    });
    expect(sweep([recent, ancient], now).map((r) => r.id)).toEqual(['a']);
  });
});

describe('ids', () => {
  it('are uuid v4, and distinct', () => {
    const ids = new Set(Array.from({ length: 500 }, newId));
    expect(ids.size).toBe(500);
    expect([...ids][0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('except attendance, which derives one on purpose', () => {
    // Two devices marking the same class must produce the same id, or the
    // merge cannot tell it is one meeting and a duplicate becomes a second
    // absence.
    expect(attendId('econ', '2026-09-09')).toBe(attendId('econ', '2026-09-09'));
    expect(attendId('econ', '2026-09-09')).not.toBe(attendId('psci', '2026-09-09'));
  });
});

/* ── The gate ──────────────────────────────────────────────────────────── */

describe('round-trip — the Phase 2 gate', () => {
  it('7. a full state through the app twice is stable', () => {
    /*
     * The plan's test 7, the half that can run here. Two crossings, because
     * one proves nothing: a conversion that loses a field loses it on the
     * first pass and looks stable on every pass after.
     */
    const start = state({
      grades: { [gradeKey('econ', 0)]: '17/20', [gradeKey('econ', 1)]: '88' },
      notes: [
        { id: 'n1', title: 'Week 3', body: 'Elasticity', created: 10, updated: 20, courseId: 'econ', fileIds: [] },
      ],
      attendance: [{ id: attendId('econ', '2026-09-09'), courseId: 'econ', date: '2026-09-09', mark: 'present', at: 500 }],
    });

    const once = toContract(start, 1_000_000);
    const twice = toContract(fromContract(start, once), 1_000_000);
    expect(twice).toEqual(once);
  });

  it('4. a tombstone from elsewhere removes the record here', () => {
    // The plan's test 4, app side: delete in one, gone in the other.
    const start = state({
      notes: [
        { id: 'n1', title: 'Doomed', body: 'x', created: 1, updated: 1, courseId: null, fileIds: [] },
      ],
    });
    const c = toContract(start);
    c.notes[0] = { ...c.notes[0], deletedAt: stamp(9_000_000), updatedAt: stamp(9_000_000) };
    expect(fromContract(start, c).notes).toHaveLength(0);
  });

  it('3. a status change from elsewhere lands here', () => {
    // The plan's test 3, app side, using the one field the app writes back.
    const start = state();
    const c = toContract(start);
    c.scores = [
      {
        id: 'econ:exams:score',
        updatedAt: stamp(9_000_000),
        origin: 'web',
        courseId: 'econ',
        component: 'econ:exams',
        earned: 91,
        possible: 100,
      },
    ];
    expect(fromContract(start, c).grades[gradeKey('econ', 1)]).toBe('91');
  });
});

/*
 * Tests 1, 2, 5 and 6 of the plan are gone rather than skipped.
 *
 * They were app↔website by definition — "create a course in the app, it
 * appears in the website with identical fields" — and stood here as four empty
 * `it` bodies inside a `describe.skip`, waiting for a second client to arrive
 * so they could be written. It has gone the other way: the separately-built
 * website has been removed, because it was a second version of this app rather
 * than a second client of the data. There is nothing to round-trip against and
 * nothing to unblock.
 *
 * Four empty tests that can never run are not a gate, they are a promise the
 * suite keeps making and cannot keep. What survives them is the pair of checks
 * that were doing the real work all along and are directly above and below
 * this: a status change written elsewhere still lands here, and every record
 * still carries the envelope. Both hold whether or not anything else ever
 * writes to the account.
 */

/** Kept honest: every contract record is an Envelope, whatever else it is. */
describe('every record carries the envelope', () => {
  it('id, updatedAt and origin on all of them', () => {
    // A fixture that reaches every list, so this checks six kinds rather than
    // whichever four a default state happens to produce.
    const c = toContract(
      state({
        grades: { [gradeKey('econ', 0)]: '90' },
        notes: [{ id: 'n1', title: 'T', body: 'b', created: 1, updated: 1, courseId: 'econ', fileIds: [] }],
        attendance: [
          { id: attendId('econ', '2026-09-09'), courseId: 'econ', date: '2026-09-09', mark: 'absent', at: 5 },
        ],
      }),
    );
    expect([c.terms, c.courses, c.items, c.scores, c.notes, c.attendance].map((l) => l.length)).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);
    const all: Envelope[] = [...c.terms, ...c.courses, ...c.items, ...c.scores, ...c.notes, ...c.attendance];
    for (const r of all) {
      expect(r.id).toBeTruthy();
      expect(Number.isNaN(Date.parse(r.updatedAt))).toBe(false);
      expect(r.origin).toBe('app');
    }
  });
});
