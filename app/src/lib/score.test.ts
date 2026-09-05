import { describe, expect, it } from 'vitest';
import { ACCEPTS, bandFor, interpret, settled } from './score';
import { COMMON_LETTER } from './cutoffs';
import { readScore } from './grades';

const sys = COMMON_LETTER;

describe('the numeric shapes, which the grade code already read', () => {
  it('reads a plain number, a percentage and a proportion', () => {
    expect(interpret('88', sys).pct).toBe(88);
    expect(interpret('88%', sys).pct).toBe(88);
    expect(interpret('0.88', sys).pct).toBeCloseTo(88);
  });

  it('reads a fraction out of anything', () => {
    expect(interpret('17/20', sys).pct).toBe(85);
    expect(readScore('17/20')).toBe(85);
  });

  it('reads a fraction written the way people say it', () => {
    // How a rubric in a PDF writes one, and how somebody types it from memory.
    expect(interpret('17 out of 20', sys).pct).toBe(85);
    expect(interpret('17 of 20', sys).pct).toBe(85);
    expect(interpret('17 OUT OF 20', sys).pct).toBe(85);
  });

  it('says nothing about a plain number, because there is nothing to explain', () => {
    expect(interpret('88', sys).said).toBe('');
    expect(interpret('88%', sys).said).toBe('');
  });

  it('shows its working on anything it had to convert', () => {
    expect(interpret('17 out of 20', sys).said).toContain('85%');
    expect(interpret('0.88', sys).said).toContain('88%');
  });
});

describe('a letter', () => {
  it('is worth the bottom of its band, and says so', () => {
    // A letter is a band, not a point. Any single number is an assertion
    // nobody made, so it takes the low end: a projection that guesses high
    // tells somebody they are fine when they are not.
    const read = interpret('B+', sys);
    expect(read.pct).toBe(87);
    expect(read.how).toBe('letter');
    expect(read.said).toContain('bottom of that band');
    expect(read.said).toContain('never flatters');
  });

  it('does not care about case or which dash was typed', () => {
    // The scale is written with a real minus sign; nobody types one.
    expect(interpret('b-', sys).pct).toBe(80);
    expect(interpret('B−', sys).pct).toBe(80);
    expect(interpret('a−', sys).pct).toBe(90);
    expect(interpret('  A  ', sys).pct).toBe(93);
  });

  it('reads the bottom of the scale as well as the top', () => {
    expect(interpret('F', sys).pct).toBe(0);
  });

  it('says when the scale was assumed rather than stated', () => {
    // A letter read against a guessed scale and one read against the course's
    // own must not look alike on the screen.
    expect(interpret('B+', sys, true).said).toContain('common scale');
    expect(interpret('B+', sys, false).said).not.toContain('common scale');
  });

  it('refuses a letter the scale does not have, rather than guessing', () => {
    const read = interpret('Q', sys);
    expect(read.pct).toBeNull();
    expect(read.said).toContain('Q');
  });

  it('finds a band by its own label', () => {
    expect(bandFor('C+', sys)?.min).toBe(77);
    expect(bandFor('', sys)).toBeNull();
    expect(bandFor('Z', sys)).toBeNull();
  });
});

describe('nothing at all', () => {
  it('is not an error, it is an empty field', () => {
    expect(interpret('', sys)).toEqual({ pct: null, how: 'none', said: '' });
    expect(interpret('   ', sys).said).toBe('');
  });

  it('says so on something that is neither a number nor a letter', () => {
    expect(interpret('!!', sys).pct).toBeNull();
    expect(interpret('!!', sys).said).not.toBe('');
  });
});

describe('what is left in the field', () => {
  it('rewrites what it had to work out, so the projection uses what you can see', () => {
    expect(settled('B+', sys)).toBe('87');
    expect(settled('17 out of 20', sys)).toBe('85');
    expect(settled('17/20', sys)).toBe('85');
    expect(settled('0.88', sys)).toBe('88');
  });

  it('leaves a plain number exactly as typed', () => {
    // Rewriting "88" to "88" only moves the cursor.
    expect(settled('88', sys)).toBe('88');
    expect(settled('88%', sys)).toBe('88%');
    expect(settled('88.5', sys)).toBe('88.5');
  });

  it('leaves alone what it could not read, rather than emptying the field', () => {
    // Somebody mid-type has not made a mistake yet.
    expect(settled('B', sys)).toBe('83');
    expect(settled('nonsense', sys)).toBe('nonsense');
    expect(settled('', sys)).toBe('');
  });

  it('says what it takes rather than leaving it to be discovered', () => {
    expect(ACCEPTS).toContain('17 out of 20');
    expect(ACCEPTS).toContain('letter');
  });
});
