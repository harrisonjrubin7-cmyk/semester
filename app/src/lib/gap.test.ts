import { describe, expect, it } from 'vitest';
import {
  addSample,
  budgetLine,
  cardSeconds,
  cardsThatFit,
  DEFAULT_SECONDS,
  ENOUGH,
  gapLine,
  gapNow,
  goLine,
  leftOf,
  roomOf,
  runLine,
  walkLine,
  walkTo,
  type NextUp,
} from './gap';

const next = (over: Partial<NextUp> = {}): NextUp => ({
  title: 'ECON 1020',
  where: 'Furman 114',
  inMinutes: 30,
  isTomorrow: false,
  ...over,
});

const known = (minutes: number) => ({ minutes, known: true });
const unknown = { minutes: 0, known: false };

describe('how long you actually have', () => {
  it('takes the walk off the gap', () => {
    const g = gapNow(next({ inMinutes: 30 }), known(7));
    expect(g?.minutes).toBe(23);
    expect(g?.startsIn).toBe(30);
  });

  it('counts the whole gap as yours when it cannot measure the walk', () => {
    // Deducting an invented number would make you late by a margin you never
    // agreed to. Saying so is the honest half of the trade.
    const g = gapNow(next({ inMinutes: 30 }), unknown);
    expect(g?.minutes).toBe(30);
    expect(g?.walkKnown).toBe(false);
  });

  it('says nothing when there is nothing to fill', () => {
    expect(gapNow(null, known(5))).toBeNull();
    expect(gapNow(next({ isTomorrow: true }), known(5))).toBeNull();
    expect(gapNow(next({ inMinutes: -4 }), known(5))).toBeNull();
  });

  it('does not open for a window too short to use', () => {
    expect(gapNow(next({ inMinutes: 9 }), known(6))).toBeNull();
  });

  it('marks a long window as a work window rather than a gap', () => {
    // Ninety minutes free is a thing to sit down for. Spending it on
    // flashcards is the worst available use of it.
    expect(gapNow(next({ inMinutes: 90 }), known(6))?.long).toBe(true);
    expect(gapNow(next({ inMinutes: 30 }), known(6))?.long).toBe(false);
  });
});

describe('how many cards fit', () => {
  it('uses the stated default until it has watched you', () => {
    expect(cardSeconds([])).toEqual({ seconds: DEFAULT_SECONDS, measured: false });
    expect(cardSeconds([8, 9, 7])).toEqual({ seconds: DEFAULT_SECONDS, measured: false });
  });

  it('uses your own median once there are enough runs', () => {
    const samples = Array.from({ length: ENOUGH }, () => 9);
    expect(cardSeconds(samples)).toEqual({ seconds: 9, measured: true });
  });

  it('throws away a mis-tap and a phone that went in a pocket', () => {
    // Either one moves a median built from fifteen samples further than any
    // real answer ever would.
    const samples = [...Array.from({ length: ENOUGH }, () => 9), 0.5, 600];
    expect(cardSeconds(samples).seconds).toBe(9);
    expect(addSample([], 0.5)).toEqual([]);
    expect(addSample([], 600)).toEqual([]);
    expect(addSample([], 9.4)).toEqual([9]);
  });

  it('keeps a bounded window of samples', () => {
    const many = Array.from({ length: 80 }, (_, i) => addSample([], 5)[0] + (i % 3));
    const out = many.reduce<number[]>((acc, s) => addSample(acc, s), []);
    expect(out.length).toBe(60);
  });

  it('turns minutes into a number of cards', () => {
    expect(cardsThatFit(23, [])).toBe(69); // 23 min at 20s
    expect(cardsThatFit(23, Array.from({ length: ENOUGH }, () => 30))).toBe(46);
  });

  it('never offers a window with no cards in it', () => {
    expect(cardsThatFit(0, [])).toBe(1);
  });
});

describe('how far it is to the next thing', () => {
  const place = (label: string, lat: number, lon: number) => ({
    id: label,
    label,
    lat,
    lon,
    radius: 60,
    created: 0,
  });
  // Roughly 400 m apart at this latitude.
  const places = [
    place('Buttrick', 36.1478, -86.803),
    place('Furman', 36.1478, -86.7985),
    place('Branscomb', 36.1478, -86.8005),
  ];
  const rail = [
    { meta: 'Buttrick 101', at: 9 * 60 },
    { meta: 'Furman 114', at: 11 * 60 },
  ];

  it('measures from where you are now to where you are going', () => {
    const w = walkTo(rail, 11 * 60, places);
    expect(w.known).toBe(true);
    expect(w.minutes).toBeGreaterThan(2);
    expect(w.minutes).toBeLessThan(10);
  });

  it('calls two classes in one building a known walk of nothing', () => {
    // Different from an unknown walk, and reported as such: one is a fact
    // and the other is an absence.
    const same = [
      { meta: 'Buttrick 101', at: 9 * 60 },
      { meta: 'Buttrick 206', at: 11 * 60 },
    ];
    expect(walkTo(same, 11 * 60, places)).toEqual({ minutes: 0, known: true });
  });

  it('starts the day at your residence hall when housing knows it', () => {
    // Before the first class the hall is the one place you were: it is where
    // you slept, which is more than the timetable can say.
    const w = walkTo(rail, 9 * 60, places, 'Branscomb');
    expect(w.known).toBe(true);
    expect(w.minutes).toBeGreaterThan(0);
  });

  it('will not measure from a building you are not in', () => {
    // Before the first class of the day the app has no reason to think you
    // are anywhere — bed, the library, breakfast.
    expect(walkTo(rail, 9 * 60, places)).toEqual({ minutes: 0, known: false });
  });

  it('says nothing about a building you have not saved', () => {
    expect(walkTo(rail, 11 * 60, [places[0]])).toEqual({ minutes: 0, known: false });
  });

  it('skips a cancelled class rather than measuring from it', () => {
    const withCancel = [
      { meta: 'Buttrick 101', at: 9 * 60 },
      { meta: 'Furman 114', at: 10 * 60, canceled: true },
      { meta: 'Furman 114', at: 11 * 60 },
    ];
    expect(walkTo(withCancel, 11 * 60, places).known).toBe(true);
    expect(walkTo(withCancel, 11 * 60, places).minutes).toBeGreaterThan(2);
  });
});

describe('what it says', () => {
  it('names the walk it took off', () => {
    const g = gapNow(next({ inMinutes: 30 }), known(7));
    expect(gapLine(g!)).toBe('23 minutes before you set off for ECON 1020.');
    expect(walkLine(g!)).toBe('Furman 114 is a 7 minute walk, already taken off.');
    expect(goLine(g!)).toBe('Set off now. ECON 1020, Furman 114, 7 minutes away.');
  });

  it('does not call staying in one building a nought-minute walk', () => {
    const g = gapNow(next({ inMinutes: 20 }), { minutes: 0, known: true })!;
    expect(walkLine(g)).toBe(
      'ECON 1020 is in the building you are already in, so there is no walk to take off.',
    );
    expect(goLine(g)).toBe('ECON 1020 next, in Furman 114.');
  });

  it('takes the room off a rail entry and leaves the professor out of it', () => {
    expect(roomOf('Garland 162 · Prof. Trounstine')).toBe('Garland 162');
    expect(roomOf('Alumni Hall 201')).toBe('Alumni Hall 201');
  });

  it('says what it does not know, and what would fix it', () => {
    const g = gapNow(next({ inMinutes: 30 }), unknown);
    expect(walkLine(g!)).toContain('has not been told where Furman 114 is');
    expect(walkLine(g!)).toContain('Save the building on the map');
  });

  it('says whose number the budget is', () => {
    expect(budgetLine(34, [])).toBe(
      "34 cards, at 20 seconds each — the app's guess until it has watched you do a few.",
    );
    expect(budgetLine(41, Array.from({ length: ENOUGH }, () => 9))).toBe(
      '41 cards, at the 9 seconds a card you actually take.',
    );
  });

  it('scores what you reached, not the deck you did not', () => {
    expect(runLine(0, 0)).toBe('Nothing this time.');
    expect(runLine(11, 8)).toBe('8 of 11 on the way.');
  });

  it('counts the window down and stops at zero', () => {
    const g = gapNow(next({ inMinutes: 30 }), known(7))!;
    expect(leftOf(g, 0)).toBe(23);
    // The store's clock has its seconds zeroed and a run starts from an
    // unrounded stamp, so the first render can hand this a negative elapsed.
    expect(leftOf(g, -30_000)).toBe(23);
    expect(leftOf(g, 10 * 60_000)).toBe(13);
    expect(leftOf(g, 60 * 60_000)).toBe(0);
  });
});
