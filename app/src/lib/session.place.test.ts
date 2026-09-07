import { describe, expect, it } from 'vitest';
import { nameFor, sessionIn, slotFor, unitNumber } from './session.place';

describe('reading a session number out of what a thing is called', () => {
  it('takes the named forms a professor actually uses', () => {
    for (const [text, n] of [
      ['Session 7 slides', 7],
      ['Week 6 reading', 6],
      ['Unit 3 handout', 3],
      ['Chapter 12', 12],
      ['Ch. 4 notes', 4],
      ['Lecture 9 — externalities', 9],
      ['class 2 recap', 2],
      ['Module 5', 5],
      ['session7.pdf', 7],
    ] as const) {
      expect(sessionIn(text), text).toBe(n);
    }
  });

  it('takes a leading number, the way the guides write their own units', () => {
    expect(sessionIn('7 · Externalities')).toBe(7);
    expect(sessionIn('07 - Externalities')).toBe(7);
    expect(sessionIn('3 Market failure')).toBe(3);
  });

  it('is not fooled by the other numbers a filename is full of', () => {
    // Dates, years, versions and page counts all look like numbers and none of
    // them is a session. Two digits is the whole guard, and it is deliberate.
    for (const text of [
      'Reading 2026',
      'notes-20261007.pdf',
      'Externalities v2 final',
      'ECON 1020 handout',
    ]) {
      const got = sessionIn(text);
      expect(got === null || got < 100, `${text} → ${got}`).toBe(true);
    }
    expect(sessionIn('Reading 2026')).toBeNull();
    expect(sessionIn('ECON 1020 handout')).toBeNull();
  });

  it('is null for a title that names no session at all', () => {
    expect(sessionIn('Posted reading')).toBeNull();
    expect(sessionIn('')).toBeNull();
    expect(sessionIn(undefined)).toBeNull();
  });

  it('prefers the named form over a stray leading number', () => {
    expect(sessionIn('2026 syllabus, session 4')).toBe(4);
  });
});

describe('the number a unit carries', () => {
  it('reads the guides’ own naming', () => {
    expect(unitNumber('3 · Optimization & Opportunity Cost')).toBe(3);
    expect(unitNumber('0 · How to actually pass this class')).toBe(0);
  });

  it('takes the first of a span, because that is where it sits', () => {
    expect(unitNumber('3/4 · Market failure')).toBe(3);
  });

  it('is null for a guide that does not number its units', () => {
    expect(unitNumber('Market failure')).toBeNull();
    expect(unitNumber('Supply')).toBeNull();
  });
});

describe('where an added unit goes', () => {
  const guide = [
    { name: '0 · How to actually pass this class' },
    { name: '3 · Optimization' },
    { name: '4 · Supply and demand' },
    { name: '7 · Externalities' },
    { name: '9 · Monopoly' },
  ];

  it('lands behind the guide’s own unit for that session', () => {
    // The guide's is the lecture; yours is what you read afterwards.
    expect(slotFor(guide, 7)).toBe(4);
    expect(slotFor(guide, 4)).toBe(3);
    expect(slotFor(guide, 0)).toBe(1);
  });

  it('lands after the last lower unit when the guide skips that number', () => {
    // The guide has no unit 5 or 6, so a Session 6 reading goes after unit 4.
    expect(slotFor(guide, 5)).toBe(3);
    expect(slotFor(guide, 6)).toBe(3);
    expect(slotFor(guide, 8)).toBe(4);
  });

  it('goes on the end when it is later than everything', () => {
    expect(slotFor(guide, 12)).toBe(5);
  });

  it('goes in front when it is earlier than everything numbered', () => {
    // Not on the end. A Session 1 reading in a guide that starts at 3 comes
    // first, and appending it would be the exact bug this replaces.
    expect(slotFor([{ name: '3 · Optimization' }, { name: '4 · Supply' }], 1)).toBe(0);
  });

  it('goes on the end when there is no number to place it by', () => {
    expect(slotFor(guide, null)).toBe(5);
  });

  it('goes on the end when the guide does not number its units', () => {
    // Nothing to match against, so the old behaviour, which is the right
    // answer when nothing is known.
    expect(slotFor([{ name: 'Supply' }, { name: 'Demand' }], 7)).toBe(2);
  });

  it('handles an empty guide', () => {
    expect(slotFor([], 7)).toBe(0);
    expect(slotFor([], null)).toBe(0);
  });
});

describe('what an added unit is called', () => {
  it('takes the guide’s numbering, so the contents list does not break stride', () => {
    expect(nameFor('Session 7 slides', 7, true)).toBe('7 · Session 7 slides');
  });

  it('leaves it alone when the guide does not number', () => {
    expect(nameFor('Session 7 slides', 7, false)).toBe('Session 7 slides');
  });

  it('does not number it twice', () => {
    expect(nameFor('7 · Externalities', 7, true)).toBe('7 · Externalities');
  });

  it('leaves it alone when there is no number', () => {
    expect(nameFor('Posted reading', null, true)).toBe('Posted reading');
  });

  it('names an untitled one rather than leaving a blank heading', () => {
    expect(nameFor('', null, true)).toBe('Added material');
    expect(nameFor('   ', 7, true)).toBe('7 · Added material');
  });
});
