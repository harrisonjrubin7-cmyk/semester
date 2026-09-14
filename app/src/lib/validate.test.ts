import { describe, expect, it } from 'vitest';
import {
  CHECKS,
  allows,
  blankRule,
  checksOf,
  choicesOf,
  ready,
  saysRule,
  whyNot,
  type DataRule,
} from './validate';
import { clock, evaluate, type Cells } from './sheet';

/**
 * What a cell is allowed to hold.
 *
 * The one thing to keep hold of while reading these: a rule here **marks**.
 * It never refuses an entry and never changes one, so every test below is
 * about what is *said* about a value, never about what happened to it. See
 * the head of `lib/validate.ts` for why — the grid writes on every keystroke,
 * so a rule that could refuse would refuse the `8` on the way to `85`.
 */

const ctx = clock(0);

const rule = (over: Partial<DataRule> = {}): DataRule => ({
  ...blankRule('B2:B9', 1),
  check: 'between',
  min: '0',
  max: '100',
  ...over,
});

/** A value the way the grid has it: computed, with the text beside it. */
const value = (cells: Cells, address: string) =>
  [evaluate(cells, address, new Set(), ctx), cells[address] ?? ''] as const;

describe('a number between two bounds', () => {
  it('allows one inside', () => {
    expect(allows(rule(), 85, '85')).toBe(true);
  });

  it('allows one exactly on the bound, because "from 0 to 100" includes both', () => {
    expect(allows(rule(), 0, '0')).toBe(true);
    expect(allows(rule(), 100, '100')).toBe(true);
  });

  it('refuses one outside', () => {
    expect(allows(rule(), 101, '101')).toBe(false);
    expect(allows(rule(), -1, '-1')).toBe(false);
  });

  it('refuses text, which is the commonest thing a marks column collects', () => {
    expect(allows(rule(), 'absent', 'absent')).toBe(false);
  });

  /*
   * The rule is about what the cell *is*, not what was typed into it. A
   * gradebook column half typed and half computed is one column, and a rule
   * that only checked the text would have nothing to say about the half of it
   * that matters most.
   */
  it('checks a formula by its answer', () => {
    const cells: Cells = { B2: '=40+45', B3: '=40+80' };
    expect(allows(rule(), ...value(cells, 'B2'))).toBe(true);
    expect(allows(rule(), ...value(cells, 'B3'))).toBe(false);
  });

  it('counts an error as breaking the rule rather than as a value', () => {
    const cells: Cells = { B2: '=1/0' };
    expect(allows(rule(), ...value(cells, 'B2'))).toBe(false);
  });
});

describe('an empty cell', () => {
  /*
   * A column is filled in over a term. A blank that is going to be a mark next
   * week is not a mistake, and a sheet that says it is about forty cells has
   * said nothing about any of them.
   */
  it('is fine by default', () => {
    expect(allows(rule(), '', '')).toBe(true);
  });

  it('is not, where somebody has said so', () => {
    expect(allows(rule({ blankOk: false }), '', '')).toBe(false);
  });
});

describe('one of a list', () => {
  const list = rule({ check: 'list', values: 'ECON, PSCI, BUS' });

  it('allows a value on it', () => {
    expect(allows(list, 'PSCI', 'PSCI')).toBe(true);
  });

  it('allows it whatever the case, because nobody types course codes twice the same way', () => {
    expect(allows(list, 'econ', 'econ')).toBe(true);
  });

  it('refuses one that is not on it', () => {
    expect(allows(list, 'HIST', 'HIST')).toBe(false);
  });

  it('reads the values without the spaces around them', () => {
    expect(choicesOf(list)).toEqual(['ECON', 'PSCI', 'BUS']);
  });

  it('drops the empties, so a trailing comma is not a choice of nothing', () => {
    expect(choicesOf(rule({ check: 'list', values: 'A, ,B,' }))).toEqual(['A', 'B']);
  });

  it('keeps one of each, so a repeated value is offered once', () => {
    expect(choicesOf(rule({ check: 'list', values: 'A,B,A' }))).toEqual(['A', 'B']);
  });
});

describe('a whole number', () => {
  const whole = rule({ check: 'whole', min: '', max: '' });

  it('allows one', () => {
    expect(allows(whole, 3, '3')).toBe(true);
  });

  it('refuses a fraction', () => {
    expect(allows(whole, 3.5, '3.5')).toBe(false);
  });

  it('takes bounds when they are given', () => {
    expect(allows(rule({ check: 'whole', min: '1', max: '5' }), 9, '9')).toBe(false);
  });
});

describe('text length', () => {
  const short = rule({ check: 'length', max: '4' });

  it('allows text up to it', () => {
    expect(allows(short, 'ECON', 'ECON')).toBe(true);
  });

  it('refuses text past it', () => {
    expect(allows(short, 'ECONOMICS', 'ECONOMICS')).toBe(false);
  });
});

/**
 * An unfinished rule says nothing.
 *
 * Somebody halfway through typing the list of course codes has not yet said
 * that every cell in the column is wrong — and the panel is a text field, so
 * every rule passes through being unfinished on the way to being set.
 */
describe('a rule that is not finished yet', () => {
  it('marks nothing at all', () => {
    const half = rule({ check: 'list', values: '' });
    expect(ready(half)).toBe(false);
    expect(allows(half, 'anything', 'anything')).toBe(true);
  });

  it('is unfinished until a band has both ends', () => {
    expect(ready(rule({ min: '0', max: '' }))).toBe(false);
    expect(ready(rule({ min: '0', max: '100' }))).toBe(true);
  });

  it('is finished at once for a plain number, which needs nothing said about it', () => {
    expect(ready(rule({ check: 'decimal', min: '', max: '' }))).toBe(true);
  });
});

describe('what it says when a cell breaks it', () => {
  it('names the values a list wanted', () => {
    expect(whyNot(rule({ check: 'list', values: 'A,B' }))).toBe('Should be one of: A, B.');
  });

  it('does not recite a hundred of them', () => {
    const many = rule({ check: 'list', values: 'a,b,c,d,e,f,g' });
    expect(whyNot(many)).toBe('Should be one of: a, b, c, d and 3 more.');
  });

  it('names the band', () => {
    expect(whyNot(rule())).toBe('Should be a number from 0 to 100.');
  });

  it('names one end where there is only one', () => {
    expect(whyNot(rule({ check: 'decimal', min: '0', max: '' }))).toBe(
      'Should be a number, 0 or more.',
    );
  });

  it('says a whole number is a whole number', () => {
    expect(whyNot(rule({ check: 'whole', min: '', max: '' }))).toBe('Should be a whole number.');
  });

  it('reads as a row in the list of rules', () => {
    expect(saysRule(rule())).toBe('B2:B9 · a number from 0 to 100');
  });
});

describe('reading the rules off a stored sheet', () => {
  it('finds them', () => {
    const got = checksOf({ checks: [rule({ id: 'a' })] });
    expect(got).toHaveLength(1);
    expect(got[0].range).toBe('B2:B9');
  });

  it('answers with none for a sheet that has never had one', () => {
    expect(checksOf({})).toEqual([]);
  });

  /*
   * Stored state is whatever was last written to this device, including by a
   * version of the app that did not have this feature or had a different one.
   * The same promise `rulesOf` and `chartsOf` make.
   */
  it('drops a rule whose check is not one this version has', () => {
    expect(checksOf({ checks: [{ ...rule(), check: 'colour' }] })).toEqual([]);
  });

  it('drops anything that is not a rule at all', () => {
    expect(checksOf({ checks: [null, 7, 'hello', {}] })).toEqual([]);
  });

  it('survives a sheet whose checks are not even a list', () => {
    expect(checksOf({ checks: 'yes' })).toEqual([]);
  });

  it('fills in a missing blankOk as allowed, which is the gentler reading', () => {
    const got = checksOf({ checks: [{ id: 'a', range: 'A1', check: 'decimal' }] });
    expect(got[0].blankOk).toBe(true);
  });
});

/**
 * The count and the grid have to be making the same claim.
 *
 * An empty cell is not a key in `cells`, so a count that walked the cells that
 * *exist* would find none of the blanks a `blankOk: false` rule objects to —
 * while the grid, which asks the question per cell it draws, underlines every
 * one of them. `Grid` walks each rule's own range for exactly this reason;
 * this pins the property the walk is there to keep.
 */
describe('a cell that is empty and not allowed to be', () => {
  it('breaks its rule even though nothing was ever typed in it', () => {
    const strict = rule({ check: 'decimal', min: '', max: '', blankOk: false });
    const cells: Cells = {};
    expect(allows(strict, ...value(cells, 'B5'))).toBe(false);
  });

  it('and is fine again the moment a value is in it', () => {
    const strict = rule({ check: 'decimal', min: '', max: '', blankOk: false });
    expect(allows(strict, ...value({ B5: '12' }, 'B5'))).toBe(true);
  });
});

it('has a label for every check it offers, so none can reach a menu unnamed', () => {
  for (const check of CHECKS) {
    expect(whyNot(rule({ check, values: 'A', min: '1', max: '9' })).length).toBeGreaterThan(0);
  }
});
