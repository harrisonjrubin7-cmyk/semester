import { describe, expect, it } from 'vitest';
import {
  activityKind,
  blocksOn,
  clashes,
  clock,
  guessKind,
  hoursOf,
  load,
  loadLine,
  readInvolvement,
  showHours,
  weeklyHours,
  type Commitment,
} from './activities';

const c = (over: Partial<Commitment> = {}): Commitment => ({
  id: 'a',
  name: 'Vanderbilt Political Review',
  kind: 'club',
  role: 'Member',
  where: 'Sarratt',
  url: '',
  note: '',
  days: [2],
  at: 18 * 60,
  minutes: 60,
  hours: 0,
  active: true,
  created: 0,
  ...over,
});

describe('hoursOf', () => {
  it('is arithmetic when it has days and a time', () => {
    expect(hoursOf(c({ days: [1, 3], minutes: 90 }))).toBe(3);
  });

  it('is what you said when it has no fixed time', () => {
    // Estimating this from a meeting time would be inventing a number about
    // somebody's own life, and it is the number the whole screen turns on.
    expect(hoursOf(c({ days: [], at: null, hours: 12 }))).toBe(12);
  });

  it('ignores a stated figure when the schedule can be measured', () => {
    expect(hoursOf(c({ days: [1], minutes: 60, hours: 99 }))).toBe(1);
  });

  it('never returns a negative', () => {
    expect(hoursOf(c({ days: [], at: null, hours: -5 }))).toBe(0);
  });
});

describe('weeklyHours', () => {
  it('adds up only what is active', () => {
    expect(weeklyHours([c({ days: [1], minutes: 60 }), c({ id: 'b', active: false })])).toBe(1);
  });

  it('is zero for nothing', () => {
    expect(weeklyHours([])).toBe(0);
  });
});

describe('showHours', () => {
  it('reads the way a person would say it', () => {
    expect(showHours(0)).toBe('none');
    expect(showHours(0.5)).toBe('30 min');
    expect(showHours(1)).toBe('1 hour');
    expect(showHours(3.5)).toBe('3.5 hours');
  });
});

describe('load', () => {
  it('separates what is measured from what is a rule of thumb', () => {
    const l = load(12, 8);
    expect(l.classHours).toBe(12);
    expect(l.activityHours).toBe(8);
    expect(l.studyEstimate).toBe(24);
    expect(l.total).toBe(44);
  });
});

describe('loadLine', () => {
  it('labels the estimate as an estimate rather than a measurement', () => {
    // The app does not know your job, your health or how fast you read.
    const said = loadLine(load(12, 8));
    expect(said).toContain('rule of thumb');
    expect(said).toContain('not a measurement of you');
  });

  it('gives no verdict, only the arithmetic', () => {
    const said = loadLine(load(18, 20));
    expect(said).not.toMatch(/too much|overloaded|drop|unsustainable/i);
  });

  it('says something useful when there is nothing yet', () => {
    expect(loadLine(load(0, 0))).toContain('add a course or a commitment');
  });
});

describe('blocksOn', () => {
  it('draws a commitment on the days it meets and no others', () => {
    const tuesday = new Date(2026, 8, 8);
    const wednesday = new Date(2026, 8, 9);
    expect(blocksOn([c()], tuesday)).toHaveLength(1);
    expect(blocksOn([c()], wednesday)).toHaveLength(0);
  });

  it('leaves out anything with no fixed time, which cannot be placed', () => {
    expect(blocksOn([c({ days: [2], at: null })], new Date(2026, 8, 8))).toEqual([]);
  });

  it('leaves out what is switched off', () => {
    expect(blocksOn([c({ active: false })], new Date(2026, 8, 8))).toEqual([]);
  });

  it('borrows an existing event colour rather than inventing one', () => {
    const [block] = blocksOn([c({ kind: 'job' })], new Date(2026, 8, 8));
    expect(block.kind).toBe('work');
  });

  it('comes back in time order', () => {
    const list = [c({ id: 'late', at: 20 * 60 }), c({ id: 'early', at: 9 * 60 })];
    expect(blocksOn(list, new Date(2026, 8, 8)).map((b) => b.at)).toEqual([540, 1200]);
  });
});

describe('clock', () => {
  it('writes the form the rest of the app uses', () => {
    expect(clock(18 * 60)).toBe('6:00p');
    expect(clock(9 * 60 + 5)).toBe('9:05a');
    expect(clock(12 * 60)).toBe('12:00p');
    expect(clock(0)).toBe('12:00a');
  });
});

describe('clashes', () => {
  const classes = (day: number) =>
    day === 2 ? [{ title: 'ECON 1020', at: 13 * 60 + 15, minutes: 75 }] : [];

  it('finds an overlap and says which day', () => {
    const found = clashes([c({ at: 13 * 60, minutes: 60 })], classes);
    expect(found).toHaveLength(1);
    expect(found[0].classTitle).toBe('ECON 1020');
    expect(found[0].day).toBe(2);
  });

  it('does not call touching ends a clash', () => {
    // A commitment that starts exactly when class ends is not a conflict.
    expect(clashes([c({ at: 14 * 60 + 30, minutes: 60 })], classes)).toEqual([]);
    expect(clashes([c({ at: 12 * 60 + 15, minutes: 60 })], classes)).toEqual([]);
  });

  it('ignores a commitment with no time, which cannot clash with anything', () => {
    expect(clashes([c({ at: null, days: [2] })], classes)).toEqual([]);
  });

  it('reports rather than prevents, so a known clash can be kept', () => {
    // Leaving lecture early on match days is a real thing people do.
    expect(clashes([c({ at: 13 * 60 })], classes)).toHaveLength(1);
  });
});

describe('readInvolvement', () => {
  it('takes names out of a pasted list', () => {
    const found = readInvolvement('Vanderbilt Political Review\nHabitat for Humanity\n');
    expect(found.map((f) => f.name)).toEqual(['Vanderbilt Political Review', 'Habitat for Humanity']);
  });

  it('splits a role off a tab-separated row', () => {
    const [found] = readInvolvement('Vanderbilt Political Review\tTreasurer');
    expect(found.name).toBe('Vanderbilt Political Review');
    expect(found.role).toBe('Treasurer');
  });

  it('drops navigation rather than filing it as a club', () => {
    const found = readInvolvement(
      ['Home', 'Organizations', 'My Involvement', 'Search', 'Vanderbilt Political Review'].join('\n'),
    );
    expect(found.map((f) => f.name)).toEqual(['Vanderbilt Political Review']);
  });

  it('drops a URL and a bare count', () => {
    expect(readInvolvement('https://anchorlink.vanderbilt.edu/org/vpr\n42\n')).toEqual([]);
  });

  it('does not list the same organisation twice', () => {
    expect(readInvolvement('Club Soccer\nclub soccer\n')).toHaveLength(1);
  });

  it('returns nothing for an empty paste rather than throwing', () => {
    expect(readInvolvement('')).toEqual([]);
    expect(readInvolvement('   \n\n ')).toEqual([]);
  });
});

describe('guessKind', () => {
  it('recognises the obvious ones', () => {
    expect(guessKind('Sigma Chi Fraternity')).toBe('greek');
    expect(guessKind('Torres Colón Lab')).toBe('research');
    expect(guessKind('Club Soccer')).toBe('clubsport');
    expect(guessKind('Vanderbilt Symphonic Choir')).toBe('arts');
    expect(guessKind('Habitat for Humanity — volunteer')).toBe('service');
  });

  it('falls back to a club rather than to "other"', () => {
    // Most things on an involvement page are clubs, and the guess is offered
    // for you to change rather than applied silently.
    expect(guessKind('Vanderbilt Political Review')).toBe('club');
  });
});

describe('activityKind', () => {
  it('falls back rather than crashing on something unknown', () => {
    expect(activityKind('nonsense').id).toBe('other');
    expect(activityKind(undefined).id).toBe('other');
  });
});
