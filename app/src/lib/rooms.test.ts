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

describe('a block that states its own place', () => {
  // Only a class block's `meta` is shaped "room first". Everything else on the
  // rail puts something that is not a place there, and reading it as prose sent
  // a student walking to things that are not buildings.
  const at = (title: string, meta: string, where: string | undefined, when: number) =>
    where === undefined ? { title, meta, at: when } : { title, meta, at: when, where };

  it('walks to the place, not to the kind of thing it is', () => {
    // A commitment's line reads "Club sport · Boathouse" — its kind first.
    const day = [
      at('CORE 2500', 'Garland 162 · Prof. Torres Colón', undefined, 795),
      at('Rowing squad', 'Club sport · Boathouse', 'Boathouse', 1020),
    ];
    const [hop] = hops(day, []);
    expect(hop.toPlace).toBe('Boathouse');
  });

  it('leaves out a commitment with nowhere stated', () => {
    // Its line reads just "Club or organisation", which is not somewhere to be.
    const day = [
      at('CORE 2500', 'Garland 162 · Prof. Torres Colón', undefined, 795),
      at('Debate society', 'Club or organisation', '', 1140),
    ];
    expect(hops(day, [])).toEqual([]);
  });

  it('leaves out an appointment with nowhere stated', () => {
    // Its line reads "Added by you".
    const day = [
      at('CORE 2500', 'Garland 162 · Prof. Torres Colón', undefined, 795),
      at('Coffee with Sam', 'Added by you', '', 960),
    ];
    expect(hops(day, [])).toEqual([]);
  });

  it('leaves out a deadline, which is an hour rather than a room', () => {
    // Its line names the course, which read as prose became a building.
    const day = [
      at('Garland 162', 'Garland 162 · Prof. Torres Colón', undefined, 795),
      at('Reflection #2', 'CORE 2500 · Reflection', '', 795),
    ];
    expect(hops(day, [])).toEqual([]);
  });

  it('still reads the room off a class, which states no place of its own', () => {
    const day = [
      at('Buttrick 101', 'Buttrick 101 · Dr. Hogue', undefined, 600),
      at('Garland 162', 'Garland 162 · Prof. Torres Colón', undefined, 795),
    ];
    const [hop] = hops(day, []);
    expect([hop.fromPlace, hop.toPlace]).toEqual(['Buttrick', 'Garland']);
  });

  it('measures a stated place against the ones you saved', () => {
    const day = [
      at('CORE 2500', 'Garland Hall 162 · Prof. Torres Colón', undefined, 795),
      at('Study group', 'Study · Buttrick 101', 'Buttrick 101', 900),
    ];
    const [hop] = hops(day, [BUTTRICK, GARLAND]);
    expect(hop.known).toBe(true);
    expect(hop.metres).toBeGreaterThan(300);
  });
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

describe('how much of the gap is actually free', () => {
  // `tight` and `hopLine` each subtracted a `classMinutes` that defaulted to
  // fifty, and the only caller took the default. A seventy-five minute
  // seminar was therefore treated as fifty, and the walk after it looked
  // twenty-five minutes roomier than it was.
  const block = (title: string, at: number, minutes?: number) =>
    minutes === undefined
      ? { title, meta: `${title} 101`, at }
      : { title, meta: `${title} 101`, at, minutes };

  const between = (from: ReturnType<typeof block>, to: ReturnType<typeof block>) =>
    hops([from, to], [BUTTRICK, GARLAND])[0];

  it('takes the length off the gap, not a flat fifty', () => {
    // Two starts ninety minutes apart, the first running seventy-five.
    const h = between(block('Buttrick', 600, 75), block('Garland Hall', 690));
    expect(h.apart).toBe(90);
    expect(h.spare).toBe(15);
  });

  it('does not call a walk you cannot make comfortable', () => {
    // ~400 m at eighty metres a minute is about five minutes; make the gap
    // leave less than that once the seminar has had its seventy-five.
    const h = between(block('Buttrick', 600, 75), block('Garland Hall', 678));
    expect(h.spare).toBe(3);
    expect(tight(h)).toBe(true);
    expect(hopLine(h)).toContain('there are 3 between them');
  });

  it('says the same as before for a class that really is fifty', () => {
    const stated = between(block('Buttrick', 600, 50), block('Garland Hall', 690));
    const unstated = between(block('Buttrick', 600), block('Garland Hall', 690));
    expect(stated.spare).toBe(unstated.spare);
    expect(unstated.spare).toBe(40);
  });

  it('never says a gap is negative', () => {
    const h = between(block('Buttrick', 600, 200), block('Garland Hall', 660));
    expect(h.spare).toBe(0);
    expect(tight(h)).toBe(true);
  });

  it('measures against the one you are leaving, not the one you are going to', () => {
    const leavingLong = between(block('Buttrick', 600, 75), block('Garland Hall', 690));
    const arrivingLong = between(block('Buttrick', 600, 50), block('Garland Hall', 690, 75));
    expect(leavingLong.spare).toBe(15);
    expect(arrivingLong.spare).toBe(40);
  });
});
