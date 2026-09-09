import { describe, expect, it } from 'vitest';
import { nowAt, readBlock, readDay, worthMarking } from './rail';

// A Tuesday: BUS at 11:00 for fifty minutes, a quiz due at 1:15, CORE at 1:15
// for seventy-five, PSCI at 2:45 for seventy-five.
const day = [
  { at: 660, length: 50 },
  { at: 795, length: 0 },
  { at: 795, length: 75 },
  { at: 885, length: 75 },
];
const at = (b: { at: number }) => b.at;
const length = (b: { length: number }) => b.length;

describe('readBlock', () => {
  it('counts down only the one that is next', () => {
    expect(readBlock(660, 50, 647, true)).toMatchObject({ when: 'next', said: 'in 13 min' });
    expect(readBlock(660, 50, 647, false)).toMatchObject({ when: 'later', said: '' });
  });

  it('says how much of the one you are in is left', () => {
    const s = readBlock(660, 50, 675, false);
    expect(s.when).toBe('now');
    expect(s.leftMinutes).toBe(35);
    expect(s.said).toBe('On now · 35 min left');
  });

  it('never says nought minutes left of a class still running', () => {
    expect(readBlock(660, 50, 709.5, false).leftMinutes).toBe(1);
  });

  it('is past once it has ended, not once it has begun', () => {
    expect(readBlock(660, 50, 709, false).when).toBe('now');
    expect(readBlock(660, 50, 710, false).when).toBe('past');
  });

  it('treats a deadline as a moment rather than an hour', () => {
    // No length: it is never "on now", and it is past the minute it arrives.
    expect(readBlock(795, 0, 795, false).when).toBe('past');
    expect(readBlock(795, 0, 794, true).when).toBe('next');
  });
});

describe('readDay', () => {
  it('marks one next, whatever else is running', () => {
    // 11:20 — inside BUS, with the quiz next.
    const read = readDay(day, 680, at, length);
    expect(read.map((s) => s.when)).toEqual(['now', 'next', 'later', 'later']);
  });

  it('gives the label to the first of two blocks sharing a minute', () => {
    // 11:52 — BUS has ended, and the quiz and CORE both sit at 1:15.
    const read = readDay(day, 712, at, length);
    expect(read.map((s) => s.when)).toEqual(['past', 'next', 'later', 'later']);
  });

  it('has nothing next once the day is done', () => {
    const read = readDay(day, 1400, at, length);
    expect(read.every((s) => s.when === 'past')).toBe(true);
  });

  it('puts everything ahead of a morning', () => {
    const read = readDay(day, 480, at, length);
    expect(read.map((s) => s.when)).toEqual(['next', 'later', 'later', 'later']);
  });
});

describe('nowAt', () => {
  it('counts what has started, which is where the line goes', () => {
    expect(nowAt(day, 480, at)).toBe(0);
    expect(nowAt(day, 680, at)).toBe(1);
    expect(nowAt(day, 800, at)).toBe(3);
    expect(nowAt(day, 1400, at)).toBe(4);
  });
});

describe('worthMarking', () => {
  it('says nothing about the present on an empty day', () => {
    expect(worthMarking([], 600, at)).toBe(false);
  });

  it('marks a day with a sequence in it', () => {
    expect(worthMarking(day, 800, at)).toBe(true);
  });

  it('still marks a single block that has not happened yet', () => {
    expect(worthMarking([day[0]], 600, at)).toBe(true);
    // One block, already begun: the line would sit under everything and say
    // nothing the dimming has not already said.
    expect(worthMarking([day[0]], 700, at)).toBe(false);
  });
});
