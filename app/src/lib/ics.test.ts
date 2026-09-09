import { describe, expect, it } from 'vitest';
import { matchCourse, parseIcs } from './ics';
import type { Course } from './types';

const course = (id: string, code: string): Course => ({
  id,
  code,
  name: '',
  prof: '',
  email: '',
  meets: '',
  room: '',
  credits: '',
  source: '',
  grading: [],
});

const COURSES = [course('econ', 'ECON 1020'), course('psci', 'PSCI 1104'), course('bus', 'BUS 1600')];

/** A whole calendar around one event body, so the tests read like real files. */
const cal = (body: string, name = 'Brightspace') =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', `X-WR-CALNAME:${name}`, body, 'END:VCALENDAR'].join('\r\n');

const event = (...lines: string[]) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n');

describe('parseIcs', () => {
  it('reads the calendar name and a single timed event', () => {
    const out = parseIcs(
      COURSES,
      cal(event('UID:abc', 'SUMMARY:ECON 1020 Problem Set 1', 'DTSTART:20260904T235900', 'LOCATION:Gradescope')),
    );
    expect(out.name).toBe('Brightspace');
    expect(out.events).toHaveLength(1);
    expect(out.events[0]).toMatchObject({
      title: 'ECON 1020 Problem Set 1',
      date: '2026-09-04',
      where: 'Gradescope',
      courseId: 'econ',
      time: '11:59p',
    });
  });

  it('treats a date-only DTSTART as all day', () => {
    const out = parseIcs(COURSES, cal(event('UID:x', 'SUMMARY:Reading week', 'DTSTART;VALUE=DATE:20261012')));
    expect(out.events[0].date).toBe('2026-10-12');
    expect(out.events[0].time).toBe('All day');
    expect(out.events[0].at).toBeNull();
  });

  it('does not shift an all-day date across a timezone', () => {
    // The classic bug: parsing 20261012 as UTC midnight and rendering it local
    // puts a reading week on the 11th for anyone west of Greenwich.
    const out = parseIcs(COURSES, cal(event('UID:x', 'SUMMARY:x', 'DTSTART;VALUE=DATE:20260101')));
    expect(out.events[0].date).toBe('2026-01-01');
  });

  it('unfolds a continued line', () => {
    const out = parseIcs(
      COURSES,
      cal(event('UID:x', 'SUMMARY:A very long title that the\r\n  server wrapped', 'DTSTART:20260904T120000')),
    );
    expect(out.events[0].title).toBe('A very long title that the server wrapped');
  });

  it('unescapes commas, semicolons and newlines in the description', () => {
    const out = parseIcs(
      COURSES,
      cal(event('UID:x', 'SUMMARY:x', 'DTSTART:20260904T120000', 'DESCRIPTION:One\\, two\\; three\\nnext line')),
    );
    expect(out.events[0].note).toBe('One, two; three\nnext line');
  });

  it('skips an event with no start rather than inventing one', () => {
    expect(parseIcs(COURSES, cal(event('UID:x', 'SUMMARY:No date'))).events).toEqual([]);
  });

  it('skips a start it cannot read rather than guessing', () => {
    expect(parseIcs(COURSES, cal(event('UID:x', 'SUMMARY:x', 'DTSTART:not-a-date'))).events).toEqual([]);
  });

  it('survives a file with nothing in it', () => {
    expect(parseIcs(COURSES, '').events).toEqual([]);
    expect(parseIcs(COURSES, 'BEGIN:VCALENDAR\r\nEND:VCALENDAR').events).toEqual([]);
  });

  it('reads several events out of one file', () => {
    const out = parseIcs(
      COURSES,
      cal(
        [
          event('UID:a', 'SUMMARY:One', 'DTSTART:20260904T120000'),
          event('UID:b', 'SUMMARY:Two', 'DTSTART:20260905T120000'),
        ].join('\r\n'),
      ),
    );
    expect(out.events.map((e) => e.date)).toEqual(['2026-09-04', '2026-09-05']);
  });

  it('gives every occurrence its own id', () => {
    const out = parseIcs(
      COURSES,
      cal(event('UID:same', 'SUMMARY:Lecture', 'DTSTART:20260907T090500', 'RRULE:FREQ=WEEKLY;COUNT=3')),
    );
    expect(new Set(out.events.map((e) => e.id)).size).toBe(out.events.length);
  });
});

describe('parseIcs — repeating classes', () => {
  const weekly = (rule: string, start = '20260907T090500') =>
    parseIcs(COURSES, cal(event('UID:c', 'SUMMARY:ECON 1020 Lecture', `DTSTART:${start}`, `RRULE:${rule}`))).events;

  it('repeats weekly for a stated count', () => {
    // Sep 7 2026 is a Monday.
    expect(weekly('FREQ=WEEKLY;COUNT=3').map((e) => e.date)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ]);
  });

  it('stops at UNTIL', () => {
    const dates = weekly('FREQ=WEEKLY;UNTIL=20260922T000000Z').map((e) => e.date);
    expect(dates[0]).toBe('2026-09-07');
    expect(dates[dates.length - 1]).toBe('2026-09-21');
  });

  it('honours an interval', () => {
    expect(weekly('FREQ=WEEKLY;INTERVAL=2;COUNT=3').map((e) => e.date)).toEqual([
      '2026-09-07',
      '2026-09-21',
      '2026-10-05',
    ]);
  });

  it('repeats daily', () => {
    expect(weekly('FREQ=DAILY;COUNT=3').map((e) => e.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
  });

  it('puts a MWF class on Mondays, Wednesdays and Fridays', () => {
    const dates = weekly('FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6').map((e) => e.date);
    expect(dates).toEqual([
      '2026-09-07',
      '2026-09-09',
      '2026-09-11',
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
    ]);
  });

  it('never puts the same class on one day twice', () => {
    // The case that breaks a naive expansion: a BYDAY that names a weekday
    // *earlier* in the week than the start. A Wednesday start with a Monday
    // in the rule reaches forward to next Monday on week one, then reaches
    // forward to the same Monday again on week two.
    const dates = parseIcs(
      COURSES,
      cal(event('UID:c', 'SUMMARY:Lecture', 'DTSTART:20260909T090500', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6')),
    ).events.map((e) => e.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates).toEqual(['2026-09-09', '2026-09-14', '2026-09-16', '2026-09-21', '2026-09-23', '2026-09-28']);
  });

  it('keeps the time of day on every occurrence', () => {
    const out = weekly('FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4');
    expect(new Set(out.map((e) => e.time))).toEqual(new Set(['9:05a']));
    expect(new Set(out.map((e) => e.at))).toEqual(new Set([545]));
  });

  it('does not run away on a rule with no end', () => {
    const dates = weekly('FREQ=DAILY');
    expect(dates.length).toBeLessThanOrEqual(200);
    expect(dates.length).toBeGreaterThan(0);
  });

  it('ignores a frequency it does not handle, keeping the first date', () => {
    // Better one right date than twelve invented ones.
    expect(weekly('FREQ=MONTHLY;COUNT=5').map((e) => e.date)).toEqual(['2026-09-07']);
  });
});

describe('matchCourse', () => {
  it('matches a full code, spaced or not', () => {
    expect(matchCourse(COURSES, 'ECON 1020 midterm')).toBe('econ');
    expect(matchCourse(COURSES, 'ECON1020 midterm')).toBe('econ');
    expect(matchCourse(COURSES, 'econ 1020 midterm')).toBe('econ');
  });

  it('matches a bare subject when only one course has it', () => {
    expect(matchCourse(COURSES, 'PSCI reading response')).toBe('psci');
  });

  it('files nothing against a course when nothing names one', () => {
    expect(matchCourse(COURSES, 'Dentist appointment')).toBeNull();
  });

  it('does not match a subject code buried inside an ordinary word', () => {
    // "BUS" is a course here and also a word. A feed entry about catching a
    // bus, or about a business meeting, filed itself against BUS 1600 — and a
    // wrongly filed entry is worse than an unfiled one, because it lands in a
    // course's own list looking like coursework.
    expect(matchCourse(COURSES, 'Catch the bus to campus')).toBeNull();
    expect(matchCourse(COURSES, 'Business school open evening')).toBeNull();
    expect(matchCourse(COURSES, 'BUS 1600 case write-up')).toBe('bus');
    expect(matchCourse(COURSES, 'BUS seminar')).toBe('bus');
  });

  it('reads a bare subject as a code only when it is written as one', () => {
    // The full code carries a number, so case does not matter for it. A bare
    // subject has only its capitals to distinguish it from an English word.
    expect(matchCourse(COURSES, 'econ 1020 midterm')).toBe('econ');
    expect(matchCourse(COURSES, 'PSCI office hours')).toBe('psci');
    expect(matchCourse(COURSES, 'psci is my favourite subject')).toBeNull();
  });

  it('refuses a bare subject shared by two courses', () => {
    const two = [course('econ1', 'ECON 1020'), course('econ2', 'ECON 1030')];
    expect(matchCourse(two, 'ECON office hours')).toBeNull();
    expect(matchCourse(two, 'ECON 1030 quiz')).toBe('econ2');
  });

  it('matches nothing when there are no courses', () => {
    expect(matchCourse([], 'ECON 1020')).toBeNull();
  });
});

/**
 * A stamp shaped like a moment that is not one.
 *
 * The regexes above check the shape of a `DTSTART` and say nothing about
 * whether its numbers are a day, and `new Date` does not refuse 31 February —
 * it answers it, with 3 March. So a feed with one malformed stamp put an event
 * on a day nobody had scheduled, drawn on the calendar beside the real classes,
 * in the same colour, with nothing to say it was invented.
 *
 * Measured against this parser, one bad stamp at a time:
 *
 *     20260231   →  3 March            20260001  →  1 December 2025
 *     20261345   →  14 February 2027    20260900  →  31 August
 *     00000101   →  1 January 1900      T990000Z  →  the 14th, at 3:00a
 *
 * This is the one input in the app that comes from a server the student does
 * not control and is refetched without them asking, so a bad row is not a
 * one-off they can notice and correct.
 */
describe('a DTSTART that is shaped right and is not a moment', () => {
  const one = (start: string) =>
    parseIcs(COURSES, cal(event('UID:x', 'SUMMARY:Lecture', start))).events;

  it('drops a day the calendar would have rolled over', () => {
    expect(one('DTSTART;VALUE=DATE:20260231')).toEqual([]);
    expect(one('DTSTART;VALUE=DATE:20270229')).toEqual([]);
    expect(one('DTSTART;VALUE=DATE:20260900')).toEqual([]);
  });

  it('drops a month that is not one', () => {
    expect(one('DTSTART;VALUE=DATE:20261345')).toEqual([]);
    expect(one('DTSTART;VALUE=DATE:20260001')).toEqual([]);
  });

  it('drops a year the calendar will not give back', () => {
    // `new Date` maps a year under 100 into the 1900s, so this is a real
    // 1 January that lands in 1900 and is never seen again.
    expect(one('DTSTART;VALUE=DATE:00000101')).toEqual([]);
    expect(one('DTSTART;VALUE=DATE:00990601')).toEqual([]);
  });

  it('drops a clock that is not one', () => {
    // Hour 99 moved the event four days and invented three in the morning.
    expect(one('DTSTART:20260910T990000Z')).toEqual([]);
    expect(one('DTSTART:20260910T129900Z')).toEqual([]);
    expect(one('DTSTART:20260910T120099Z')).toEqual([]);
  });

  it('keeps every stamp that is a moment, in either shape', () => {
    expect(one('DTSTART;VALUE=DATE:20260910')[0]).toMatchObject({ date: '2026-09-10' });
    expect(one('DTSTART;VALUE=DATE:20280229')[0]).toMatchObject({ date: '2028-02-29' });
    expect(one('DTSTART:20260910T140000')[0]).toMatchObject({ date: '2026-09-10', time: '2:00p' });
    // A `Z` stamp is read back through the UTC getters, matching how it was
    // built. Reading it back locally would refuse every correct feed either
    // side of Greenwich — which is why both timezone runs matter here.
    expect(one('DTSTART:20260910T140000Z')).toHaveLength(1);
    expect(one('DTSTART:20260101T000000Z')).toHaveLength(1);
    expect(one('DTSTART:20261231T235959Z')).toHaveLength(1);
  });
});
