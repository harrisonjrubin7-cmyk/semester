import { describe, expect, it } from 'vitest';
import { fromSeason, limitOf, logged, weekLine, weekOf, weeks } from './cara';
import { EMPTY_ATHLETICS, readAthletics, type AthleticEvent, type CaraEntry } from './athletics';

const entry = (date: string, hours: number, over: Partial<CaraEntry> = {}): CaraEntry => ({
  id: `${date}-${hours}-${over.kind ?? 'Practice'}`,
  date,
  hours,
  kind: 'Practice',
  note: '',
  ...over,
});

describe('the week an entry belongs to', () => {
  it('runs Monday to Sunday', () => {
    expect(weekOf('2026-09-14')).toBe('2026-09-14'); // a Monday
    expect(weekOf('2026-09-18')).toBe('2026-09-14'); // Friday, same week
  });

  /*
   * The one that is wrong in every naive version. `getDay()` is 0 on Sunday,
   * so subtracting it moves Sunday *forward* to the Monday after — and a
   * Sunday session lands in next week, which is the week an athlete is most
   * likely to be at the limit in.
   */
  it('puts Sunday at the end of the week it finishes, not the start of the next', () => {
    expect(weekOf('2026-09-20')).toBe('2026-09-14');
  });
});

describe('adding the log up', () => {
  it('groups by week, most recent first', () => {
    const out = weeks([entry('2026-09-14', 2), entry('2026-09-21', 3), entry('2026-09-18', 1)]);
    expect(out.map((w) => w.start)).toEqual(['2026-09-21', '2026-09-14']);
    expect(out[1].hours).toBe(3);
  });

  /*
   * Rounded once at the end. Twenty half-hour sessions summed after rounding
   * each to a tenth is 9.8, which is a week disagreeing with itself.
   */
  it('rounds the week rather than each entry', () => {
    const halves = Array.from({ length: 20 }, (_, n) => entry('2026-09-14', 0.5, { id: `h${n}` }));
    expect(weeks(halves)[0].hours).toBe(10);
    expect(logged(halves)).toBe(10);
  });

  it('counts the days with something on them, without judging the rest', () => {
    const out = weeks([entry('2026-09-14', 2), entry('2026-09-14', 1, { kind: 'Competition' }), entry('2026-09-16', 2)]);
    expect(out[0].daysWith).toBe(2);
  });
});

describe('the limit, which is the student’s figure and never the app’s', () => {
  it('reads what people actually type', () => {
    expect(limitOf('20')).toBe(20);
    expect(limitOf(' 20 hours ')).toBe(20);
    expect(limitOf('20/wk')).toBe(20);
    expect(limitOf('8hrs')).toBe(8);
  });

  /*
   * A sentence is not a figure. Parsing "20 in season, 8 out" to 20 would
   * measure every week of the year against the in-season number, silently.
   */
  it('refuses anything it would have to guess at', () => {
    expect(limitOf('')).toBeNull();
    expect(limitOf('20 in season, 8 out')).toBeNull();
    expect(limitOf('about twenty')).toBeNull();
    expect(limitOf('0')).toBeNull();
    expect(limitOf('200')).toBeNull();
  });

  it('says a total and nothing more when no figure was given', () => {
    const w = weeks([entry('2026-09-14', 21)])[0];
    expect(weekLine(w, null)).toBe('21 hours logged · 1 of 7 days');
  });

  /*
   * The sentence this file exists to get right. "Over the limit" is a
   * determination; "above the 20 you entered" is a fact about two numbers the
   * student supplied, and only one of the two is something this app is
   * entitled to say.
   */
  it('never calls a week compliant, or over a limit', () => {
    const w = weeks([entry('2026-09-14', 21)])[0];
    const said = weekLine(w, 20);
    expect(said).toContain('1 above the 20 you entered');
    expect(said).not.toMatch(/violation|compliant|over the limit|exceeded|illegal/i);
    expect(weekLine(weeks([entry('2026-09-14', 12)])[0], 20)).toContain('8 below the 20 you entered');
  });
});

describe('bringing a week of the season into the log', () => {
  const ev = (over: Partial<AthleticEvent>): AthleticEvent => ({
    id: 'e',
    title: 'Session',
    team: 'Track',
    kind: 'Practice',
    start: '2026-09-14T16:00',
    end: '2026-09-14T18:00',
    where: '',
    notes: '',
    steps: [],
    ...over,
  });

  it('offers a session inside the week, with its own hours', () => {
    const out = fromSeason([ev({})], '2026-09-14', '2026-09-20');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ date: '2026-09-14', hours: 2, kind: 'Practice' });
    expect(out[0].note).toContain('From your schedule');
  });

  it('splits a trip across its days rather than banking it on the first', () => {
    const out = fromSeason(
      [ev({ kind: 'Travel', title: 'Away meet', start: '2026-09-18T16:00', end: '2026-09-20T08:00' })],
      '2026-09-14',
      '2026-09-20',
    );
    expect(out.map((e) => [e.date, e.hours])).toEqual([
      ['2026-09-18', 8],
      ['2026-09-19', 24],
      ['2026-09-20', 8],
    ]);
    expect(out[0].kind).toBe('Required travel');
  });

  /*
   * The app cannot know which sessions were required, and a log that claimed
   * a pickup game was countable would be a claim in the student's name. The
   * one kind the screen already calls recreation is left out; everything else
   * arrives as a draft to be checked, which is what the screen says it is.
   */
  it('leaves recreation out entirely', () => {
    expect(fromSeason([ev({ kind: 'Recreation' })], '2026-09-14', '2026-09-20')).toEqual([]);
  });

  it('offers nothing from outside the week asked for', () => {
    expect(fromSeason([ev({})], '2026-09-21', '2026-09-27')).toEqual([]);
  });
});

/**
 * The library grew three fields after people had been keeping seasons in it.
 *
 * `lib/device-library.ts` refuses every write when a record fails its
 * validator — which is right for a corrupt file and catastrophic for a record
 * that is merely old. A student opening Athletics to find their season gone
 * and no way to put anything back is the failure these two tests exist for.
 */
describe('reading a library written before the hours log existed', () => {
  const old = { version: 1, events: [] };

  it('fills in what is missing rather than refusing the record', () => {
    expect(readAthletics(old)).toEqual(EMPTY_ATHLETICS);
  });

  it('still refuses a field that is present and wrong', () => {
    expect(() => readAthletics({ ...old, cara: 'lots' })).toThrow();
    expect(() => readAthletics({ ...old, cara: [{ id: 'a', date: 'Tuesday', hours: 2, kind: 'Practice', note: '' }] })).toThrow();
    expect(() => readAthletics({ ...old, cara: [{ id: 'a', date: '2026-09-14', hours: 30, kind: 'Practice', note: '' }] })).toThrow();
    expect(() => readAthletics({ ...old, cara: [{ id: 'a', date: '2026-09-14', hours: 2, kind: 'Brunch', note: '' }] })).toThrow();
    expect(() => readAthletics({ ...old, eligibility: 'none' })).toThrow();
  });

  it('keeps a well-formed log through a round trip', () => {
    const held = {
      version: 1,
      events: [],
      cara: [{ id: 'a', date: '2026-09-14', hours: 2.5, kind: 'Practice', note: 'Track' }],
      caraLimit: '20',
      eligibility: [],
    };
    expect(readAthletics(held).cara).toEqual(held.cara);
    expect(readAthletics(held).caraLimit).toBe('20');
  });
});
