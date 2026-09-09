import { describe, expect, it } from 'vitest';
import { matchCourse, parseIcs } from './ics';
import { union } from './merge';
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

describe('a component nested inside an event', () => {
  /*
   * Shaped the way Google Calendar shapes an export: the event's own
   * DESCRIPTION, then a VALARM at the end of the VEVENT carrying the sentence
   * Google puts in every default reminder.
   */
  const alarmed = cal(
    event(
      'UID:abc',
      'SUMMARY:ECON 1020 midterm review',
      'DTSTART:20260918T140000',
      'DESCRIPTION:Bring the problem set. Room changed to Buttrick 101.',
      'LOCATION:Buttrick 101',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:This is an event reminder',
      'TRIGGER:-P0DT0H30M0S',
      'END:VALARM',
    ),
  );

  it('leaves the note the professor wrote', () => {
    const { events } = parseIcs(COURSES, alarmed);
    expect(events).toHaveLength(1);
    expect(events[0].note).toBe('Bring the problem set. Room changed to Buttrick 101.');
  });

  it('leaves the title, against an alarm that carries one', () => {
    // RFC 5545 requires SUMMARY of an ACTION:EMAIL alarm, so this is not an
    // exotic file — it is what a mail reminder looks like.
    const { events } = parseIcs(
      COURSES,
      cal(
        event(
          'UID:def',
          'SUMMARY:Advising appointment',
          'DTSTART:20260919T140000',
          'BEGIN:VALARM',
          'ACTION:EMAIL',
          'SUMMARY:Reminder: Advising appointment',
          'DESCRIPTION:Your event starts in 1 hour',
          'TRIGGER:-PT1H',
          'END:VALARM',
        ),
      ),
    );
    expect(events[0].title).toBe('Advising appointment');
    expect(events[0].note).toBe('');
  });

  it('is not fooled by lower case', () => {
    const { events } = parseIcs(
      COURSES,
      cal(
        event(
          'UID:ghi',
          'SUMMARY:PSCI 1104 seminar',
          'DTSTART:20260920T140000',
          'DESCRIPTION:Read chapter four.',
          'begin:valarm',
          'description:This is an event reminder',
          'end:valarm',
        ),
      ),
    );
    expect(events[0].note).toBe('Read chapter four.');
  });

  it('counts its way back out of a component nested two deep', () => {
    const { events } = parseIcs(
      COURSES,
      cal(
        event(
          'UID:jkl',
          'SUMMARY:BUS 1600 case',
          'DTSTART:20260921T140000',
          'DESCRIPTION:The real note.',
          'BEGIN:VALARM',
          'BEGIN:X-SOMETHING',
          'SUMMARY:Nonsense',
          'END:X-SOMETHING',
          'DESCRIPTION:Still the alarm',
          'END:VALARM',
          'LOCATION:Buttrick 101',
        ),
      ),
    );
    expect(events[0].note).toBe('The real note.');
    expect(events[0].title).toBe('BUS 1600 case');
    // Back at the event's own level, the properties after the alarm are read
    // again — a counter that never came back down would have swallowed this.
    expect(events[0].where).toBe('Buttrick 101');
  });

  it('reads the event after an alarmed one', () => {
    const { events } = parseIcs(
      COURSES,
      cal(
        [
          event(
            'UID:one',
            'SUMMARY:ECON 1020 lecture',
            'DTSTART:20260922T140000',
            'BEGIN:VALARM',
            'DESCRIPTION:This is an event reminder',
            'END:VALARM',
          ),
          event('UID:two', 'SUMMARY:PSCI 1104 lecture', 'DTSTART:20260923T140000', 'DESCRIPTION:Second note.'),
        ].join('\r\n'),
      ),
    );
    expect(events.map((e) => e.title)).toEqual(['ECON 1020 lecture', 'PSCI 1104 lecture']);
    expect(events[1].note).toBe('Second note.');
  });

  it('still reads an event with no nested component at all', () => {
    const { events } = parseIcs(
      COURSES,
      cal(event('UID:mno', 'SUMMARY:ECON 1020 quiz', 'DTSTART:20260924T140000', 'DESCRIPTION:Plain.')),
    );
    expect(events[0]).toMatchObject({ title: 'ECON 1020 quiz', note: 'Plain.' });
  });

  it('keeps the course an alarm would have hidden', () => {
    /*
     * The description is not only read: `toEvents` matches the course on the
     * title, the place and the note together. A generic room booking that says
     * which class it is in its description — which is how a department books
     * one — lost that sentence to the alarm, and with it the only thing tying
     * the entry to a course. It stayed on the calendar, unattributed, out of
     * the course's own list.
     */
    const { events } = parseIcs(
      COURSES,
      cal(
        event(
          'UID:room',
          'SUMMARY:Room booking',
          'DTSTART:20260928T140000',
          'DESCRIPTION:Review session for ECON 1020.',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'DESCRIPTION:This is an event reminder',
          'END:VALARM',
        ),
      ),
    );
    expect(events[0].courseId).toBe('econ');
  });

  it('does not let one truncated event swallow the rest of the file', () => {
    /*
     * A BEGIN with no END — a feed cut off mid-write, or a server that builds
     * its calendar by string concatenation and got it wrong. Counting depth
     * without clearing it at the event boundary would carry that count into
     * every event after this one, and each would lose its DTSTART and be
     * dropped: one malformed entry silently deleting the whole rest of the
     * term. The count belongs to the event, so it ends with the event.
     */
    const { events } = parseIcs(
      COURSES,
      cal(
        [
          event('UID:torn', 'SUMMARY:ECON 1020 lecture', 'DTSTART:20260926T140000', 'BEGIN:VALARM', 'ACTION:DISPLAY'),
          event('UID:after', 'SUMMARY:PSCI 1104 seminar', 'DTSTART:20260927T140000', 'DESCRIPTION:Still here.'),
        ].join('\r\n'),
      ),
    );
    expect(events.map((e) => e.title)).toEqual(['ECON 1020 lecture', 'PSCI 1104 seminar']);
    expect(events[1].note).toBe('Still here.');
  });

  it('takes nothing from a VTIMEZONE standing outside the events', () => {
    const { events, name } = parseIcs(
      COURSES,
      cal(
        [
          ['BEGIN:VTIMEZONE', 'TZID:America/Chicago', 'BEGIN:DAYLIGHT', 'DTSTART:19700308T020000', 'END:DAYLIGHT', 'END:VTIMEZONE'].join('\r\n'),
          event('UID:pqr', 'SUMMARY:ECON 1020 lab', 'DTSTART:20260925T140000'),
        ].join('\r\n'),
      ),
    );
    expect(name).toBe('Brightspace');
    expect(events).toHaveLength(1);
    expect(events[0].date).toBe('2026-09-25');
  });
});

describe('a repeating class that changes', () => {
  const weekly = (...extra: string[]) =>
    cal(
      event(
        'UID:econ1020@vanderbilt.edu',
        'SUMMARY:ECON 1020 lecture',
        'DTSTART:20260907T140000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4',
        ...extra,
      ),
    );

  const days = (ics: string) => parseIcs(COURSES, ics).events.map((e) => e.date);

  it('leaves out a week the calendar cancelled', () => {
    // EXDATE is the only way iCalendar says a single week is off, and every
    // calendar server writes one when an occurrence is deleted. Ignoring it
    // sent a student to a lecture that was not happening.
    expect(days(weekly('EXDATE:20260914T140000'))).toEqual(['2026-09-07', '2026-09-21', '2026-09-28']);
  });

  it('leaves out every cancelled week, however they are written', () => {
    // Google writes one EXDATE line per cancelled week; others put them in one
    // comma-separated line; an all-day series writes bare dates.
    expect(days(weekly('EXDATE:20260914T140000', 'EXDATE:20260921T140000'))).toEqual([
      '2026-09-07',
      '2026-09-28',
    ]);
    expect(days(weekly('EXDATE:20260914T140000,20260921T140000'))).toEqual(['2026-09-07', '2026-09-28']);
    expect(days(weekly('EXDATE;VALUE=DATE:20260914'))).toEqual([
      '2026-09-07',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('draws a moved week on the day it moved to, and not the day it moved from', () => {
    const ics = cal(
      [
        event(
          'UID:econ1020@vanderbilt.edu',
          'SUMMARY:ECON 1020 lecture',
          'DTSTART:20260907T140000',
          'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4',
        ),
        event(
          'UID:econ1020@vanderbilt.edu',
          'RECURRENCE-ID:20260907T140000',
          'SUMMARY:ECON 1020 lecture (moved to Thursday)',
          'DTSTART:20260910T140000',
        ),
      ].join('\r\n'),
    );
    const { events } = parseIcs(COURSES, ics);
    expect(events.map((e) => e.date).sort()).toEqual([
      '2026-09-10',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
    expect(events.find((e) => e.date === '2026-09-10')?.title).toBe('ECON 1020 lecture (moved to Thursday)');
  });

  it('reads a moved week written before the class it moves', () => {
    // A calendar may write the override first, so the rule's own occurrences
    // are not known until the whole file has been read.
    const ics = cal(
      [
        event(
          'UID:econ1020@vanderbilt.edu',
          'RECURRENCE-ID:20260907T140000',
          'SUMMARY:Moved',
          'DTSTART:20260910T140000',
        ),
        event(
          'UID:econ1020@vanderbilt.edu',
          'SUMMARY:ECON 1020 lecture',
          'DTSTART:20260907T140000',
          'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4',
        ),
      ].join('\r\n'),
    );
    expect(parseIcs(COURSES, ics).events.map((e) => e.date).sort()).toEqual([
      '2026-09-10',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
  });

  it('gives the moved week an id of its own, so a sync keeps both', () => {
    /*
     * `${uid}-0` is the first occurrence of the series, and the first week is
     * exactly the one most likely to move. `union` in `lib/merge.ts` keeps one
     * row per id, so two rows sharing one meant the first sync dropped one of
     * them — and re-reading the feed only built the collision again.
     */
    const ics = cal(
      [
        event(
          'UID:econ1020@vanderbilt.edu',
          'SUMMARY:ECON 1020 lecture',
          'DTSTART:20260907T140000',
          'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4',
        ),
        event(
          'UID:econ1020@vanderbilt.edu',
          'RECURRENCE-ID:20260914T140000',
          'SUMMARY:Moved',
          'DTSTART:20260917T140000',
        ),
      ].join('\r\n'),
    );
    const { events } = parseIcs(COURSES, ics);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    expect(union(events, [])).toHaveLength(events.length);
  });

  it('does not renumber the weeks after a cancelled one', () => {
    /*
     * An id is what ties a row to the copy already on another device. Number
     * the weeks after the exclusions are taken out and cancelling one lecture
     * renames every later week of the term, so a sync keeps the old rows as
     * well as the new ones and the class appears twice for the rest of term.
     */
    const whole = parseIcs(COURSES, weekly()).events;
    const short = parseIcs(COURSES, weekly('EXDATE:20260914T140000')).events;
    const idOn = (list: typeof whole, date: string) => list.find((e) => e.date === date)?.id;
    for (const date of ['2026-09-21', '2026-09-28']) {
      expect(idOn(short, date), date).toBe(idOn(whole, date));
    }
  });

  it('draws a moved week whose class is not in the file', () => {
    const ics = cal(
      event('UID:elsewhere@vanderbilt.edu', 'RECURRENCE-ID:20260907T140000', 'SUMMARY:Moved', 'DTSTART:20260910T140000'),
    );
    expect(parseIcs(COURSES, ics).events.map((e) => e.date)).toEqual(['2026-09-10']);
  });

  it('keeps the week when the entry meant to replace it draws nothing', () => {
    /*
     * An override with no DTSTART, or one whose date cannot be read, produces
     * no event. Taking the week back for it deleted the lecture outright
     * rather than failing to move it — a worse answer than the one the reader
     * gave before it knew about overrides at all.
     */
    for (const broken of [
      ['UID:econ1020@vanderbilt.edu', 'RECURRENCE-ID:20260914T140000', 'SUMMARY:Moved'],
      ['UID:econ1020@vanderbilt.edu', 'RECURRENCE-ID:20260914T140000', 'DTSTART:banana', 'SUMMARY:Moved'],
    ]) {
      const ics = cal(
        [
          event(
            'UID:econ1020@vanderbilt.edu',
            'SUMMARY:ECON 1020 lecture',
            'DTSTART:20260907T140000',
            'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=4',
          ),
          event(...broken),
        ].join('\r\n'),
      );
      expect(days(ics), broken.join(' ')).toEqual([
        '2026-09-07',
        '2026-09-14',
        '2026-09-21',
        '2026-09-28',
      ]);
    }
  });

  it('leaves a class with no exceptions exactly as it was', () => {
    expect(days(weekly())).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28']);
    expect(parseIcs(COURSES, weekly()).events.map((e) => e.id)).toEqual([
      'econ1020@vanderbilt.edu-0',
      'econ1020@vanderbilt.edu-1',
      'econ1020@vanderbilt.edu-2',
      'econ1020@vanderbilt.edu-3',
    ]);
  });

  it('ignores an exclusion that is not a date', () => {
    expect(days(weekly('EXDATE:banana'))).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
      '2026-09-28',
    ]);
  });
});
