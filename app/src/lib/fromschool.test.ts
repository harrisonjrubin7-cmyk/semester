import { describe, expect, it } from 'vitest';
import { resync, schoolCourse } from './fromschool';
import type { UniversityRecord } from '@semester/institution';

/**
 * A school's own records, turned into a course this app can hold.
 *
 * The completion plan's chain runs Course → Syllabus → Calendar → Study, and
 * for the whole of Phase 1 the first two were on the university gateway and
 * the last two were in the app, with nothing between them. A student enrolled
 * in the sandbox course had two published assignments whose deadlines the app
 * could not see — which is the shape the plan's own Appendix A calls the
 * dominant finding: an engine that exists and a place it has not been
 * connected to.
 */
const course: UniversityRecord = {
  id: 'sandbox-101',
  area: 'courses',
  title: 'SANDBOX · SBX 101 — Running a course end to end',
  summary: 'A demonstration course.',
  status: 'Enrolled',
  version: '2',
  updatedAt: '2026-09-17T00:00:00Z',
  details: [
    { label: 'Institution', value: 'SANDBOX — a demonstration course, not a real institution' },
    { label: 'Taught by', value: 'Sandbox faculty' },
  ],
  actions: [],
};

const syllabus: UniversityRecord = {
  id: 'syllabus',
  area: 'courses',
  title: 'SANDBOX · SBX 101 — syllabus',
  summary: 'How a course is run.',
  status: 'Revision 1, 2026-09-01',
  version: '1',
  updatedAt: '2026-09-17T00:00:00Z',
  details: [
    { label: 'Meets', value: 'Tuesdays and Thursdays, 14:00–15:15, Sandbox Hall 101.' },
    { label: 'Where to ask', value: 'Ask in the course thread first.' },
  ],
  actions: [],
};

const paper = (over: Partial<UniversityRecord> = {}): UniversityRecord => ({
  id: 'student-1:a1',
  area: 'assignments',
  title: 'SANDBOX · Problem set 1',
  summary: 'Four short answers on the reading.',
  status: 'Published — not yet submitted',
  version: '1',
  updatedAt: '2026-09-17T00:00:00Z',
  details: [
    { label: 'Worth', value: '20% of the course' },
    { label: 'Marked out of', value: '20' },
  ],
  dates: [{ at: '2026-10-02T23:59:00Z', what: 'Due' }],
  actions: [],
  ...over,
});

describe('a course from a school', () => {
  it('carries every published deadline onto the calendar', () => {
    const made = schoolCourse(course, [syllabus], [paper()]);
    expect(made.items).toHaveLength(1);
    const [item] = made.items;
    // Month is 0-based everywhere in this app; October is 9.
    expect(item.month).toBe(9);
    expect(item.day).toBe(2);
    expect(item.year).toBe(2026);
    expect(item.title).toContain('Problem set 1');
    expect(item.weight, 'what it is worth, from the record rather than guessed').toBe('20% of the course');
  });

  it('reads the date from the record’s own dates, not from a sentence', () => {
    /*
     * The whole reason `UniversityRecord.dates` exists. A record whose `Due`
     * detail says one thing and whose `dates` says another is a record with
     * two versions of one fact, and only one of them can be relied on — so
     * this reads the machine-readable one and ignores prose entirely.
     */
    const odd = paper({
      details: [{ label: 'Due', value: 'the Tuesday after reading week' }, { label: 'Worth', value: '20% of the course' }],
    });
    expect(schoolCourse(course, [syllabus], [odd]).items[0].day).toBe(2);
  });

  it('reads the school’s day wherever the reader is standing', () => {
    /*
     * `Item` is month/day/year with no zone on it, and these sync between a
     * student's devices. A deadline that read 2 October on a laptop and 3
     * October on a phone would be two records of one fact.
     *
     * This is pinned here as well as by `npm run test:zones`, which is what
     * caught it: the first version read the date with local getters and the
     * time with `toISOString`, so one item carried a UTC time beside a local
     * day, and fourteen hours of Pacific/Kiritimati moved the day.
     */
    const tz = process.env.TZ;
    for (const zone of ['Pacific/Kiritimati', 'America/Chicago', 'UTC']) {
      process.env.TZ = zone;
      const [item] = schoolCourse(course, [syllabus], [paper()]).items;
      expect(item.day, `the day moved in ${zone}`).toBe(2);
      expect(item.month, `the month moved in ${zone}`).toBe(9);
      expect(item.dueTime).toBe('23:59');
    }
    process.env.TZ = tz;
  });

  it('brings nothing from a date it cannot read', () => {
    /*
     * A school's adapter is somebody else's code. "2 October, probably" is
     * not a timestamp, and the answer to one is no calendar entry — not an
     * Invalid Date sitting in Today as a deadline with no day.
     */
    const bad = paper({ dates: [{ at: 'the Tuesday after reading week', what: 'Due' }] });
    expect(schoolCourse(course, [syllabus], [bad]).items).toEqual([]);
  });

  it('brings nothing at all from a record with no dates on it', () => {
    // A record that commits nobody to anything is not a calendar entry.
    const noDate = paper({ dates: undefined });
    expect(schoolCourse(course, [syllabus], [noDate]).items).toHaveLength(0);
  });

  it('says on every part of it that it came from a school, and which', () => {
    /*
     * The plan's standing rule: nothing is ever "a placeholder success state
     * presented as real". A course sitting in the app's own list beside four
     * real ones has to say where it came from, on the course and on each
     * deadline, or a student meets a SANDBOX date in Today with no way to
     * tell it apart from a real one.
     */
    const made = schoolCourse(course, [syllabus], [paper()]);
    expect(made.course.source).toContain('SANDBOX');
    expect(made.course.code).toBe('SBX 101');
    expect(made.course.name).toBe('Running a course end to end');
    expect(made.course.prof).toBe('Sandbox faculty');
    expect(made.items[0].detail).toContain('SANDBOX');
    // `source` names the file a deadline was lifted from everywhere else in
    // the app. A blank one here would read as "nobody knows".
    expect(made.items[0].source).toContain('SANDBOX');
    expect(made.items[0].source).toContain('student-1:a1');
  });

  it('takes the meeting pattern from the syllabus when there is one', () => {
    expect(schoolCourse(course, [syllabus], [paper()]).course.meets).toContain('Tuesdays and Thursdays');
    // And says so plainly when there is not, rather than inventing one.
    expect(schoolCourse(course, [], [paper()]).course.meets).toMatch(/not published|not stated/i);
  });

  it('gives the course an id nothing else in the app will collide with', () => {
    const made = schoolCourse(course, [syllabus], [paper()]);
    expect(made.course.id).toBe('school-sandbox-101');
    expect(made.items[0].c).toBe('school-sandbox-101');
    expect(made.items[0].id, 'a stable id, so a re-sync updates rather than duplicates').toBe(
      'school-sandbox-101:student-1:a1:0',
    );
  });

  it('is a course the rest of the app can hold without special-casing', () => {
    const made = schoolCourse(course, [syllabus], [paper()]);
    expect(made.guide.code).toBe('SBX 101');
    expect(made.guide.units).toEqual([]);
    expect(made.schedule).toEqual([]);
    expect(made.planMinutes).toBeTruthy();
    expect(made.frameLabel).toBeTruthy();
  });
});

describe('a re-sync', () => {
  const made = () => schoolCourse(course, [syllabus], [paper()]);

  it('updates the course in place rather than adding a second copy', () => {
    const first = made();
    const again = schoolCourse(course, [syllabus], [paper({ summary: 'Now five short answers.' })]);
    expect(again.course.id).toBe(first.course.id);
    expect(again.items[0].id, 'a second copy of one deadline').toBe(first.items[0].id);
    expect(again.items[0].quote).toBe('Now five short answers.');
  });

  it('keeps a date the student moved, when the school has not moved it', () => {
    /*
     * `Item.movedFrom` exists because "what must not happen is the app quietly
     * forgetting that it now disagrees with the document it is showing
     * underneath". A school re-sync that silently put a moved deadline back is
     * the same fault wearing a network request.
     */
    const mine = { ...made().items[0], month: 9, day: 5, movedFrom: { month: 9, day: 2, year: 2026 } };
    const [after] = resync([mine], schoolCourse(course, [syllabus], [paper()]).items);
    expect(after.day, 'the move was undone without saying so').toBe(5);
    expect(after.movedFrom?.day).toBe(2);
  });

  it('but takes the school’s new date when the school has moved it', () => {
    /*
     * The other half, and the reason it is not simply "the student always
     * wins": a move is a correction to a date. Once the school has changed
     * that date, the correction is to something that no longer exists, and
     * keeping it would leave a student holding a deadline the course does not
     * have.
     */
    const mine = { ...made().items[0], month: 9, day: 5, movedFrom: { month: 9, day: 2, year: 2026 } };
    const moved = schoolCourse(course, [syllabus], [paper({ dates: [{ at: '2026-10-09T23:59:00Z', what: 'Due' }] })]);
    const [after] = resync([mine], moved.items);
    expect(after.day).toBe(9);
    expect(after.movedFrom, 'a correction to a date that is gone').toBeUndefined();
  });

  it('drops a deadline the school has withdrawn', () => {
    const [mine] = made().items;
    expect(resync([mine], [])).toEqual([]);
  });

  it('keeps an item the student added themselves to a school course', () => {
    const mine = { ...made().items[0], id: 'mine-1', title: 'My own reminder' };
    const after = resync([mine], made().items);
    expect(after.map((i) => i.id)).toContain('mine-1');
    expect(after).toHaveLength(2);
  });
});
