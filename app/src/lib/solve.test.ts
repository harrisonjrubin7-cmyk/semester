import { describe, expect, it } from 'vitest';
import { APPROACHES, brief, READ_SYSTEM, SYSTEM, approach, type Ask } from './solve';

const ask = (over: Partial<Ask> = {}): Ask => ({
  approach: approach('method'),
  problem: 'Price rises from $4 to $5; quantity falls from 100 to 80. Find the elasticity.',
  work: '',
  expected: '',
  course: 'ECON 1020 — Principles of Macroeconomics',
  ...over,
});

describe('SYSTEM', () => {
  it('says the line once and forbids repeating it', () => {
    expect(SYSTEM).toContain('without lecturing');
    expect(SYSTEM).toContain('Never repeat the point twice');
  });

  it('forbids inventing a missing value', () => {
    expect(SYSTEM).toContain('Never invent a number');
  });

  it('asks for Unicode rather than LaTeX, which would not be rendered', () => {
    expect(SYSTEM).toContain('not LaTeX');
  });

  it('forbids claiming a check that did not happen', () => {
    expect(SYSTEM).toContain('Never claim a result was checked');
  });
});

describe('APPROACHES', () => {
  it('offers a way in whether or not you have tried yet', () => {
    expect(APPROACHES.some((a) => a.wantsWork)).toBe(true);
    expect(APPROACHES.some((a) => !a.wantsWork)).toBe(true);
  });

  it('has unique ids, so the picker cannot select two things', () => {
    expect(new Set(APPROACHES.map((a) => a.id)).size).toBe(APPROACHES.length);
  });

  it('falls back rather than crashing on an id it does not know', () => {
    expect(approach('nonsense').id).toBe(APPROACHES[0].id);
  });
});

describe('the method approach', () => {
  it('works a parallel problem instead of handing over the answer', () => {
    expect(approach('method').brief).toContain('PARALLEL problem');
    expect(approach('method').brief).toContain('different numbers');
  });
});

describe('the check approach', () => {
  it('stops at the first error rather than listing five', () => {
    // A later error is usually a consequence of the first, and a list of them
    // makes one mistake look like hopelessness.
    expect(approach('check').brief).toContain('FIRST step that is wrong');
  });

  it('forbids manufacturing a criticism of correct working', () => {
    expect(approach('check').brief).toContain('do not manufacture a criticism');
  });
});

describe('brief', () => {
  it('carries the problem and the course', () => {
    const text = brief(ask());
    expect(text).toContain('elasticity');
    expect(text).toContain('ECON 1020');
  });

  it('includes the working only when there is some', () => {
    expect(brief(ask())).not.toContain('What the student did');
    expect(brief(ask({ work: '(80-100)/100 = -0.2' }))).toContain('(80-100)/100 = -0.2');
  });

  it('includes the expected answer for a disagreement', () => {
    expect(brief(ask({ approach: approach('wrong'), expected: '-0.9' }))).toContain('-0.9');
  });

  it('asks for the working when the approach needs it and there is none', () => {
    const text = brief(ask({ approach: approach('check') }));
    expect(text).toContain('Ask for it in one line');
  });

  it('does not ask for working when the approach does not need it', () => {
    expect(brief(ask({ approach: approach('concept') }))).not.toContain('Ask for it in one line');
  });

  it('says plainly when no problem was given, rather than leaving a blank', () => {
    expect(brief(ask({ problem: '' }))).toContain('(none given)');
  });
});

describe('READ_SYSTEM', () => {
  it('marks what it cannot read instead of guessing it', () => {
    // A guessed exponent silently turns the problem into a different one.
    expect(READ_SYSTEM).toContain('[?]');
    expect(READ_SYSTEM).toContain('rather than guessing');
  });
});
