import { describe, expect, it } from 'vitest';
import {
  current,
  forTerm,
  homeLine,
  homeWalk,
  leaveAt,
  moveOutAt,
  moveOutLine,
  moveOutSoon,
  morningLine,
  packLine,
  type Residence,
} from './housing';
import { clock } from './date';

const res = (over: Partial<Residence> = {}): Residence => ({
  id: 'r1',
  hall: 'Branscomb Vaughn',
  room: '214',
  term: '2026FA',
  moveOut: '',
  hoursAfterLastExam: 0,
  created: 1,
  ...over,
});

const NOW = new Date(2026, 11, 10); // Thu 10 Dec 2026

const place = (label: string, lat: number, lon: number) => ({
  id: label,
  label,
  lat,
  lon,
  radius: 60,
  created: 0,
});
// Roughly 400 m apart at this latitude.
const PLACES = [place('Branscomb', 36.1478, -86.803), place('Furman', 36.1478, -86.7985)];

describe('where you live', () => {
  it('keeps one residence per term, newest first', () => {
    const list = [res({ id: 'old', created: 1 }), res({ id: 'new', created: 9 })];
    expect(forTerm(list, '2026FA').map((r) => r.id)).toEqual(['new', 'old']);
    expect(current(list, '2026FA')?.id).toBe('new');
  });

  it('does not hand you another term’s room', () => {
    expect(current([res({ term: '2027SP' })], '2026FA')).toBeNull();
  });

  it('reads as a room, or as a hall where there is no room', () => {
    expect(homeLine(res())).toBe('Branscomb Vaughn 214');
    expect(homeLine(res({ room: '  ' }))).toBe('Branscomb Vaughn');
    expect(homeLine(null)).toBe('');
  });
});

describe('when you have to be out', () => {
  const lastExam = { title: 'PSCI 1104 final', date: new Date(2026, 11, 17, 11, 0) };

  it('counts the stated hours from your last exam', () => {
    // The app is the only thing on the phone that knows when the last exam
    // is, so it is the only thing that can turn the rule into a date.
    const out = moveOutAt(res({ hoursAfterLastExam: 24 }), lastExam);
    expect(out?.from).toBe('exam');
    expect(out?.date.getDate()).toBe(18);
    expect(out?.date.getHours()).toBe(11);
    expect(out?.after).toBe('PSCI 1104 final');
  });

  it('prefers a date housing actually gave you', () => {
    // Somebody who typed a date has been told one; the rule is what you use
    // when you have not.
    const out = moveOutAt(res({ moveOut: '2026-12-19', hoursAfterLastExam: 24 }), lastExam);
    expect(out?.from).toBe('stated');
    expect(out?.date.getDate()).toBe(19);
  });

  it('leaves the rule a rule when there is no exam to count from', () => {
    expect(moveOutAt(res({ hoursAfterLastExam: 24 }), null)).toBeNull();
    expect(moveOutAt(res(), lastExam)).toBeNull();
    expect(moveOutAt(null, lastExam)).toBeNull();
  });

  it('says where the date came from', () => {
    const stated = moveOutAt(res({ moveOut: '2026-12-19' }), null);
    expect(moveOutLine(stated, NOW)).toContain('the date housing gave you');
    const counted = moveOutAt(res({ hoursAfterLastExam: 24 }), lastExam);
    expect(moveOutLine(counted, NOW)).toContain('Counted from PSCI 1104 final');
    expect(moveOutLine(null, NOW)).toBe('No move-out date yet.');
  });

  it('is only worth saying when it is close', () => {
    const soon = moveOutAt(res({ moveOut: '2026-12-19' }), null);
    const far = moveOutAt(res({ moveOut: '2027-05-10' }), null);
    expect(moveOutSoon(soon, NOW)).toBe(true);
    expect(moveOutSoon(far, NOW)).toBe(false);
    expect(moveOutSoon(null, NOW)).toBe(false);
  });
});

describe('what stands between now and it', () => {
  const out = moveOutAt(res({ moveOut: '2026-12-14' }), null);

  it('counts the exams in the way', () => {
    const exams = [
      { date: new Date(2026, 11, 11) },
      { date: new Date(2026, 11, 13) },
      { date: new Date(2026, 11, 20) },
    ];
    expect(packLine(exams, out, NOW)).toBe('2 exams in the 4 days before you have to be out.');
  });

  it('says so plainly when nothing is in the way', () => {
    expect(packLine([{ date: new Date(2026, 11, 20) }], out, NOW)).toBe(
      'Nothing else is due before you have to be out.',
    );
  });

  it('says nothing at all with no date to count against', () => {
    expect(packLine([], null, NOW)).toBe('');
  });

  it('stays quiet until the two are close enough to crowd each other', () => {
    // "6 exams in the 101 days before you have to be out" is arithmetic
    // nobody asked for.
    const far = moveOutAt(res({ moveOut: '2027-05-10' }), null);
    expect(packLine([{ date: new Date(2027, 3, 1) }], far, NOW)).toBe('');
  });

  it('says nothing once it has been and gone', () => {
    const past = moveOutAt(res({ moveOut: '2026-12-01' }), null);
    expect(packLine([], past, NOW)).toBe('');
  });
});

describe('the first walk of the day', () => {
  it('measures from where you live to where you have to be', () => {
    const w = homeWalk(res(), 'Furman 114', PLACES);
    expect(w.known).toBe(true);
    expect(w.minutes).toBeGreaterThan(2);
  });

  it('will not guess about a hall you have not saved', () => {
    expect(homeWalk(res(), 'Furman 114', [PLACES[1]])).toEqual({ minutes: 0, known: false });
    expect(homeWalk(null, 'Furman 114', PLACES)).toEqual({ minutes: 0, known: false });
  });

  it('calls a class in your own building a known walk of nothing', () => {
    expect(homeWalk(res({ hall: 'Furman' }), 'Furman 114', PLACES)).toEqual({
      minutes: 0,
      known: true,
    });
  });

  it('sets off early enough, and never before midnight', () => {
    expect(leaveAt(9 * 60 + 5, 9)).toBe(9 * 60 - 4);
    expect(leaveAt(3, 9)).toBe(0);
  });

  it('says what time to leave, and how it got there', () => {
    const line = morningLine(
      res(),
      { title: 'ECON 1020', room: 'Furman 114', at: 9 * 60 + 5 },
      PLACES,
      clock,
    );
    expect(line).toContain('Leave Branscomb Vaughn by');
    expect(line).toContain('for ECON 1020');
    expect(line).toContain('80 m a minute');
  });

  it('says nothing rather than a line with a hole in it', () => {
    expect(morningLine(null, null, PLACES, clock)).toBe('');
    expect(
      morningLine(res(), { title: 'x', room: 'Nowhere 1', at: 540 }, PLACES, clock),
    ).toBe('');
    // Same building: a real answer, but not one worth a sentence.
    expect(
      morningLine(res({ hall: 'Furman' }), { title: 'x', room: 'Furman 114', at: 540 }, PLACES, clock),
    ).toBe('');
  });
});
