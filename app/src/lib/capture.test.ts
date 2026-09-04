import { describe, expect, it } from 'vitest';
import { capture, enough, matchCourse, matchDate, matchTime, readBack, type Named } from './capture';

// 4 September 2026 is a Friday.
const NOW = new Date(2026, 8, 4, 14, 0);

const COURSES: Named[] = [
  { id: 'econ', code: 'ECON 1020', title: 'Principles of Microeconomics' },
  { id: 'psci', code: 'PSCI 1104', title: 'Understanding Political Controversy' },
  { id: 'core', code: 'CORE 2500', title: 'Sports, Culture, and Society' },
  { id: 'bus', code: 'BUS 1600', title: 'Marketing Management' },
];

const codeOf = (id: string) => COURSES.find((c) => c.id === id)?.code ?? id;

describe('finding the course', () => {
  it('matches on the letters, which is what people type', () => {
    expect(matchCourse('econ ps4 friday', COURSES)?.id).toBe('econ');
    expect(matchCourse('ECON 1020 problem set', COURSES)?.id).toBe('econ');
    expect(matchCourse('econ1020 ps4', COURSES)?.id).toBe('econ');
  });

  it('uses the number to separate two courses in one department', () => {
    const two: Named[] = [
      { id: 'a', code: 'ECON 1020', title: '' },
      { id: 'b', code: 'ECON 3012', title: '' },
    ];
    expect(matchCourse('econ1020 ps4', two)?.id).toBe('a');
    expect(matchCourse('econ3012 ps4', two)?.id).toBe('b');
  });

  it('refuses rather than guessing when two could match', () => {
    const two: Named[] = [
      { id: 'a', code: 'ECON 1020', title: '' },
      { id: 'b', code: 'ECON 3012', title: '' },
    ];
    expect(matchCourse('econ ps4', two)).toBeNull();
  });

  it('finds nothing where there is nothing', () => {
    expect(matchCourse('buy milk tomorrow', COURSES)).toBeNull();
    expect(matchCourse('', COURSES)).toBeNull();
  });
});

describe('finding the date', () => {
  it('reads the plain words', () => {
    expect(matchDate('due today', NOW)?.date).toBe('2026-09-04');
    expect(matchDate('due tonight', NOW)?.date).toBe('2026-09-04');
    expect(matchDate('due tomorrow', NOW)?.date).toBe('2026-09-05');
    expect(matchDate('due tmrw', NOW)?.date).toBe('2026-09-05');
  });

  it('reads a weekday as the next one, never today', () => {
    // Somebody standing there on a Friday saying "friday" means the coming
    // one, and an item due in four minutes is not what they meant.
    expect(matchDate('friday', NOW)?.date).toBe('2026-09-11');
    expect(matchDate('monday', NOW)?.date).toBe('2026-09-07');
    expect(matchDate('next monday', NOW)?.date).toBe('2026-09-14');
    expect(matchDate('tues', NOW)?.date).toBe('2026-09-08');
  });

  it('reads a counted number of days', () => {
    expect(matchDate('in 3 days', NOW)?.date).toBe('2026-09-07');
  });

  it('reads a month and a day', () => {
    expect(matchDate('oct 6', NOW)?.date).toBe('2026-10-06');
    expect(matchDate('October 6', NOW)?.date).toBe('2026-10-06');
  });

  it('rolls a past month into the coming year', () => {
    // "jan 20" typed in September means the coming January.
    expect(matchDate('jan 20', NOW)?.date).toBe('2027-01-20');
  });

  it('reads slashes, month first', () => {
    expect(matchDate('10/6', NOW)?.date).toBe('2026-10-06');
    expect(matchDate('10/6/27', NOW)?.date).toBe('2027-10-06');
  });

  it('refuses rather than defaulting to today', () => {
    // A blank the student fills is recoverable; a wrong date nobody noticed
    // is not.
    expect(matchDate('econ problem set', NOW)).toBeNull();
    expect(matchDate('13/45', NOW)).toBeNull();
  });
});

describe('finding the time', () => {
  it('reads the ordinary forms', () => {
    expect(matchTime('5pm')?.time).toBe('5:00 PM');
    expect(matchTime('5:30pm')?.time).toBe('5:30 PM');
    expect(matchTime('9a')?.time).toBe('9:00 AM');
    expect(matchTime('17:00')?.time).toBe('5:00 PM');
    expect(matchTime('noon')?.at).toBe(12 * 60);
    expect(matchTime('midnight')?.time).toBe('11:59 PM');
  });

  it('does not read a bare four-digit number as a time', () => {
    // "1700" is far more often a room number or a course code, and reading it
    // as a time would put a deadline at five on a day nobody chose.
    expect(matchTime('econ 1020 ps4')).toBeNull();
    expect(matchTime('room 1700')).toBeNull();
  });

  it('says nothing when there is no time', () => {
    expect(matchTime('friday')).toBeNull();
    expect(matchTime('99:99')).toBeNull();
  });
});

describe('the whole line', () => {
  it('reads the example it exists for', () => {
    const c = capture('econ ps4 friday 5pm', COURSES, NOW);
    expect(c.courseId).toBe('econ');
    expect(c.kind).toBe('Problem set');
    expect(c.date).toBe('2026-09-11');
    expect(c.time).toBe('5:00 PM');
    expect(c.title).toBe('ps4');
  });

  it('keeps the kind’s own words in the title', () => {
    // "PS4" is the name of the thing, not just its category, and stripping it
    // leaves a row called nothing.
    expect(capture('psci essay on federalism oct 6', COURSES, NOW).title).toBe(
      'essay on federalism',
    );
  });

  it('falls back on the kind when nothing else is left', () => {
    expect(capture('core quiz tomorrow', COURSES, NOW).title).toBe('quiz');
  });

  it('leaves a personal thing without a course', () => {
    const c = capture('dentist tuesday 9am', COURSES, NOW);
    expect(c.courseId).toBeNull();
    expect(c.date).toBe('2026-09-08');
    expect(c.title).toBe('dentist');
  });

  it('makes something of a line with no date at all', () => {
    const c = capture('bus reading', COURSES, NOW);
    expect(c.courseId).toBe('bus');
    expect(c.date).toBe('');
    expect(c.at).toBe(24 * 60);
    expect(enough(c)).toBe(true);
  });

  it('has nothing to make a row out of from nothing', () => {
    expect(enough(capture('   ', COURSES, NOW))).toBe(false);
  });
});

describe('showing its working', () => {
  it('names the words each reading came from', () => {
    // "friday → Sep 11" is checkable at a glance and "Sep 11" is not.
    const said = readBack(capture('econ ps4 friday 5pm', COURSES, NOW), codeOf);
    expect(said).toContain('econ → ECON 1020');
    expect(said).toContain('friday → Sep 11');
    // "Sep 05" is what toDateString gives and not what anybody writes.
    expect(readBack(capture('core quiz tomorrow', COURSES, NOW), codeOf)).toContain(
      'tomorrow → Sep 5',
    );
    expect(said).toContain('5pm → 5:00 PM');
    expect(said).toContain('ps4 → Problem set');
  });

  it('says plainly what it could not read', () => {
    const said = readBack(capture('buy milk', COURSES, NOW), codeOf);
    expect(said.some((l) => l.includes('No course'))).toBe(true);
    expect(said.some((l) => l.includes('No date read'))).toBe(true);
  });
});
