import { describe, expect, it } from 'vitest';
import { PACE, buildingOf, daySummary, hopLine, hops, matchPlace, tight, walkMinutes } from './rooms';
import type { SavedPlace } from './place';

const place = (label: string, lat: number, lon: number): SavedPlace => ({
  id: label,
  label,
  lat,
  lon,
  radius: 80,
  created: 1,
});

// Two points about 400 m apart, which is a real campus distance.
const BUTTRICK = place('Buttrick', 36.1447, -86.8027);
const GARLAND = place('Garland Hall', 36.1447, -86.7982);

const block = (title: string, meta: string, at: number, canceled = false) => ({
  title,
  meta,
  at,
  canceled,
});

describe('reading a building out of a room', () => {
  it('drops the room number', () => {
    expect(buildingOf('Buttrick 101')).toBe('Buttrick');
    expect(buildingOf('Commons 363A')).toBe('Commons');
    expect(buildingOf('Featheringill Hall 134')).toBe('Featheringill Hall');
  });

  it('keeps a room that is all building', () => {
    expect(buildingOf("The Wond'ry")).toBe("The Wond'ry");
    expect(buildingOf('Online')).toBe('Online');
  });

  it('stops at the professor, which shares the field', () => {
    expect(buildingOf('Garland 162 · Prof. Trounstine')).toBe('Garland');
  });

  it('survives an empty room', () => {
    expect(buildingOf('')).toBe('');
    expect(buildingOf('   ')).toBe('');
  });
});

describe('matching a room to a place you saved', () => {
  const places = [BUTTRICK, GARLAND];

  it('matches a short label to a long room', () => {
    expect(matchPlace('Buttrick 101', places)?.label).toBe('Buttrick');
  });

  it('matches a long label to a short room', () => {
    expect(matchPlace('Garland 162', places)?.label).toBe('Garland Hall');
  });

  it('does not care about case', () => {
    expect(matchPlace('BUTTRICK 101', places)?.label).toBe('Buttrick');
  });

  it('gives nothing rather than a near miss', () => {
    // A wrong match here would put a walk between two buildings that are not
    // the ones being walked between.
    expect(matchPlace('Stevenson 4327', places)).toBeNull();
    expect(matchPlace('', places)).toBeNull();
  });
});

describe('how long a walk takes', () => {
  it('is the pace, rounded up to the minute', () => {
    expect(walkMinutes(PACE)).toBe(1);
    expect(walkMinutes(PACE * 3)).toBe(3);
    expect(walkMinutes(PACE * 3 + 1)).toBe(4);
  });

  it('is never less than a minute', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(5)).toBe(1);
  });
});

describe('the walks in a day', () => {
  const places = [BUTTRICK, GARLAND];

  it('finds a move between two buildings', () => {
    const day = [block('ECON 1020', 'Buttrick 101', 9 * 60), block('PSCI 1104', 'Garland 162', 11 * 60)];
    const [hop] = hops(day, places);
    expect([hop.fromPlace, hop.toPlace]).toEqual(['Buttrick', 'Garland']);
    expect(hop.apart).toBe(120);
    expect(hop.known).toBe(true);
    expect(hop.metres).toBeGreaterThan(300);
  });

  it('says nothing about two classes in the same building', () => {
    const day = [block('A', 'Buttrick 101', 9 * 60), block('B', 'Buttrick 205', 11 * 60)];
    expect(hops(day, places)).toEqual([]);
  });

  it('skips a cancelled class rather than walking to it', () => {
    const day = [
      block('A', 'Buttrick 101', 9 * 60),
      block('Gone', 'Garland 162', 10 * 60, true),
      block('C', 'Buttrick 205', 11 * 60),
    ];
    expect(hops(day, places)).toEqual([]);
  });

  it('keeps a move it cannot measure, and marks it', () => {
    const day = [block('A', 'Buttrick 101', 9 * 60), block('B', 'Stevenson 4327', 10 * 60)];
    const [hop] = hops(day, places);
    expect(hop.known).toBe(false);
    expect(hop.walk).toBe(0);
    expect(hopLine(hop)).toMatch(/no saved place for one of them/);
  });

  it('ignores a block with no room at all', () => {
    const day = [block('A', 'Buttrick 101', 9 * 60), block('B', '', 10 * 60)];
    expect(hops(day, places)).toEqual([]);
  });
});

describe('whether a gap is enough', () => {
  const places = [BUTTRICK, GARLAND];
  const day = (apartMinutes: number) => [
    block('A', 'Buttrick 101', 9 * 60),
    block('B', 'Garland 162', 9 * 60 + apartMinutes),
  ];

  it('is tight when the walk outlasts what is left after the class', () => {
    // Two classes 55 minutes apart leave 5 minutes after a 50-minute class,
    // and the walk is longer than that.
    const [hop] = hops(day(55), places);
    expect(tight(hop)).toBe(true);
    expect(hopLine(hop)).toMatch(/and there are 5 between them\./);
  });

  it('is fine when there is room', () => {
    const [hop] = hops(day(120), places);
    expect(tight(hop)).toBe(false);
    expect(hopLine(hop)).toMatch(/inside the 70 you have\./);
  });

  it('never calls a walk it cannot measure tight', () => {
    const [hop] = hops(
      [block('A', 'Buttrick 101', 9 * 60), block('B', 'Stevenson 4327', 9 * 60 + 55)],
      places,
    );
    expect(tight(hop)).toBe(false);
  });
});

describe('the day in one line', () => {
  const places = [BUTTRICK, GARLAND];

  it('says nothing about a day with no moves', () => {
    expect(daySummary([])).toBe('');
  });

  it('counts the tight ones when there are any', () => {
    const list = hops(
      [block('A', 'Buttrick 101', 9 * 60), block('B', 'Garland 162', 9 * 60 + 55)],
      places,
    );
    expect(daySummary(list)).toBe("1 of today's 1 walks is tighter than the gap.");
  });

  it('says so plainly when they all fit', () => {
    const list = hops(
      [block('A', 'Buttrick 101', 9 * 60), block('B', 'Garland 162', 11 * 60)],
      places,
    );
    expect(daySummary(list)).toBe('1 walk between buildings today, all of them inside the gap.');
  });

  it('admits when it has no places to measure with', () => {
    const list = hops(
      [block('A', 'Buttrick 101', 9 * 60), block('B', 'Garland 162', 11 * 60)],
      [],
    );
    expect(daySummary(list)).toMatch(/no saved places to measure them/);
  });
});
