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

  it('reads a counted number of weeks, as well as days', () => {
    // "due in 2 weeks" is how the other half of these get said. Without it the
    // line read as no date at all and kept the whole phrase in its title.
    expect(matchDate('in 2 weeks', NOW)?.date).toBe('2026-09-18');
    expect(matchDate('in 1 week', NOW)?.date).toBe('2026-09-11');
    expect(capture('problem set 3 due in 2 weeks', COURSES, NOW).title).toBe('problem set 3');
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

  /*
   * The little words that only exist to point at the date.
   *
   * Measured through the sheet: these came out as tasks called "essay draft
   * due" and "advisor meeting at", and read that way everywhere afterwards.
   */
  it('takes the word that introduced the date away with it', () => {
    expect(capture('essay draft due friday 5pm', COURSES, NOW).title).toBe('essay draft');
    expect(capture('advisor meeting oct 2 at 10:30am', COURSES, NOW).title).toBe('advisor meeting');
    expect(capture('psci paper due 11/14', COURSES, NOW).title).toBe('paper');
    expect(capture('pay tuition by friday', COURSES, NOW).title).toBe('pay tuition');
    expect(capture('office hours from 2pm', COURSES, NOW).title).toBe('office hours');
  });

  it('leaves the same word alone where it is part of what the thing is called', () => {
    // `on` here belongs to the essay and is nowhere near the date.
    expect(capture('psci essay on federalism oct 6', COURSES, NOW).title).toBe(
      'essay on federalism',
    );
    // And a word that merely ends in one of them is not one of them — without
    // the word boundary, "marathon saturday" becomes a task called "marath".
    expect(capture('marathon saturday', COURSES, NOW).title).toBe('marathon');
    expect(capture('group chat friday', COURSES, NOW).title).toBe('group chat');
    expect(capture('overdue library book friday', COURSES, NOW).title).toBe('overdue library book');
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


describe('a month written however far somebody bothered', () => {
  /*
   * The month was read as the whole name or exactly the first three letters,
   * and "sept" is neither — the alternation matched "sep", then wanted a dot
   * or a space and found a "t". The commonest abbreviation of the month this
   * app's own term starts in, in the one box the whole feature exists to make
   * quick.
   */
  it('reads sept', () => {
    expect(matchDate('sept 18', NOW)?.date).toBe('2026-09-18');
    expect(matchDate('Sept. 18', NOW)?.date).toBe('2026-09-18');
    expect(matchDate('ps4 due sept 18 11:59pm', NOW)?.date).toBe('2026-09-18');
  });

  it('still reads the forms it always did', () => {
    expect(matchDate('september 18', NOW)?.date).toBe('2026-09-18');
    expect(matchDate('sep 18', NOW)?.date).toBe('2026-09-18');
    expect(matchDate('sep. 18', NOW)?.date).toBe('2026-09-18');
    expect(matchDate('oct 2', NOW)?.date).toBe('2026-10-02');
    expect(matchDate('jan 20', NOW)?.date).toBe('2027-01-20');
    expect(matchDate('may 4', NOW)?.date).toBe('2027-05-04');
  });

  it('reads the whole word back, however long it was written', () => {
    // Not because of the order of the alternatives — the day that has to
    // follow forces the engine back through them either way. Listing them
    // shortest first changes nothing, which is why there is no test for it.
    expect(matchDate('september 18', NOW)?.word).toBe('september 18');
    expect(matchDate('sept 18', NOW)?.word).toBe('sept 18');
    expect(matchDate('sep 18', NOW)?.word).toBe('sep 18');
  });

  it('will not cut a month to two letters', () => {
    /*
     * Two is ambiguous where three is not: "ju" is June and July both, and an
     * alternation asked to choose would answer whichever it happened to list
     * first. "ma" is March and May, "no" is November and an ordinary word.
     */
    expect(matchDate('ju 4', NOW)).toBeNull();
    expect(matchDate('ma 4', NOW)).toBeNull();
    expect(matchDate('no 5', NOW)).toBeNull();
    expect(matchDate('de 2', NOW)).toBeNull();
    expect(matchDate('ap 7', NOW)).toBeNull();
  });

  it('refuses a word that merely starts like a month', () => {
    // A prefix of the name is the rule, not three letters and anything after.
    expect(matchDate('sepx 18', NOW)).toBeNull();
    expect(matchDate('janx 18', NOW)).toBeNull();
    expect(matchDate('feb 31', NOW)).toBeNull();
  });
});

describe('a lone meridiem letter has to be against its hour', () => {
  /*
   * A space was allowed before it, so a page reference and a sub-question both
   * read as times. Both are ordinary things to type in this box.
   */
  it('does not read a page reference as an afternoon', () => {
    expect(matchTime('read ch 4 p 12')).toBeNull();
    expect(matchTime('ch 4, pp. 100-120')).toBeNull();
  });

  it('does not read a sub-question as a morning', () => {
    expect(matchTime('problem 3 a')).toBeNull();
    expect(matchTime('part 2 a and b')).toBeNull();
  });

  it('still reads every way a time is actually written', () => {
    expect(matchTime('5pm')?.time).toBe('5:00 PM');
    expect(matchTime('5 pm')?.time).toBe('5:00 PM');
    expect(matchTime('5p')?.time).toBe('5:00 PM');
    expect(matchTime('9am')?.time).toBe('9:00 AM');
    expect(matchTime('9 am')?.time).toBe('9:00 AM');
    expect(matchTime('9a')?.time).toBe('9:00 AM');
    expect(matchTime('11:59pm')?.time).toBe('11:59 PM');
    expect(matchTime('12:30 am')?.time).toBe('12:30 AM');
    expect(matchTime('17:00')?.time).toBe('5:00 PM');
    expect(matchTime('noon')?.time).toBe('12:00 PM');
    expect(matchTime('midnight')?.time).toBe('11:59 PM');
  });

  it('reads a whole line the way somebody types it', () => {
    const c = capture('econ ps4 sept 18 5pm', COURSES, NOW);
    expect(c.courseId).toBe('econ');
    expect(c.date).toBe('2026-09-18');
    expect(c.time).toBe('5:00 PM');
  });
});
