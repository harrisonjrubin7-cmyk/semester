import { describe, expect, it } from 'vitest';
import { blankRule, painted, paints, ready, rulesOf, saysRule, type CondRule } from './condfmt';
import { INKS } from './sheet';

/**
 * A colour that follows the number.
 *
 * Every test here is a way the naive version paints something it should not.
 * The worst is the empty cell: "less than 60" over a column of marks, read
 * with a blank as zero, colours every row that has not been marked yet — and
 * red on an empty cell is a claim about a figure nobody has entered.
 */
const rule = (over: Partial<CondRule> = {}): CondRule => ({
  ...blankRule('B2:B20', 1),
  id: 'r1',
  ...over,
});

describe('what a rule paints', () => {
  it('compares numbers as numbers', () => {
    expect(paints(rule({ test: 'less', value: '60' }), 45)).toBe(true);
    expect(paints(rule({ test: 'less', value: '60' }), 88)).toBe(false);
    expect(paints(rule({ test: 'greater', value: '90' }), 95)).toBe(true);
    expect(paints(rule({ test: 'greater', value: '90' }), 90)).toBe(false);
  });

  it('reads a typed percentage and a typed price as the number they are', () => {
    expect(paints(rule({ test: 'less', value: '0.6' }), '55%')).toBe(true);
    expect(paints(rule({ test: 'greater', value: '100' }), '$240')).toBe(true);
  });

  /*
   * The one that matters. A blank is not a zero, and a rule meant for the
   * marks must not colour the rows nobody has marked yet.
   */
  it('leaves an empty cell alone unless the rule is about emptiness', () => {
    expect(paints(rule({ test: 'less', value: '60' }), '')).toBe(false);
    expect(paints(rule({ test: 'greater', value: '-1' }), '')).toBe(false);
    expect(paints(rule({ test: 'empty' }), '')).toBe(true);
    expect(paints(rule({ test: 'empty' }), 0)).toBe(false);
  });

  it('leaves a word alone under a numeric test', () => {
    expect(paints(rule({ test: 'less', value: '60' }), 'Ada')).toBe(false);
  });

  it('paints an error only where the rule asks for one', () => {
    expect(paints(rule({ test: 'error' }), '#DIV/0!')).toBe(true);
    expect(paints(rule({ test: 'less', value: '60' }), '#DIV/0!')).toBe(false);
    expect(paints(rule({ test: 'error' }), 45)).toBe(false);
  });

  it('takes either end of a between, in either order', () => {
    const band = rule({ test: 'between', value: '60', value2: '79' });
    expect(paints(band, 60)).toBe(true);
    expect(paints(band, 79)).toBe(true);
    expect(paints(band, 80)).toBe(false);
    expect(paints({ ...band, value: '79', value2: '60' }, 70)).toBe(true);
  });

  it('matches text without minding the case', () => {
    expect(paints(rule({ test: 'contains', value: 'late' }), 'Handed in LATE')).toBe(true);
    expect(paints(rule({ test: 'contains', value: 'late' }), 'on time')).toBe(false);
  });

  /* "Equal to A" over a column of letter grades is a thing people want. */
  it('lets equal be about a word as well as a number', () => {
    expect(paints(rule({ test: 'equal', value: 'A' }), 'a')).toBe(true);
    expect(paints(rule({ test: 'equal', value: '80' }), 80)).toBe(true);
    expect(paints(rule({ test: 'equal', value: '80' }), 80.0)).toBe(true);
    expect(paints(rule({ test: 'equal', value: 'A' }), 'B')).toBe(false);
  });

  it('counts a boolean as one and nothing', () => {
    expect(paints(rule({ test: 'equal', value: '1' }), true)).toBe(true);
    expect(paints(rule({ test: 'equal', value: '0' }), false)).toBe(true);
  });
});

describe('a rule somebody has not finished', () => {
  /* An empty "less than" read as zero would paint every negative the moment
     the row appeared, before anybody had said what they meant. */
  it('paints nothing', () => {
    expect(ready(rule({ test: 'less', value: '' }))).toBe(false);
    expect(ready(rule({ test: 'contains', value: '  ' }))).toBe(false);
    expect(ready(rule({ test: 'between', value: '60', value2: '' }))).toBe(false);
    expect(paints(rule({ test: 'contains', value: '' }), 'anything')).toBe(false);
  });

  it('is ready the moment it says something', () => {
    expect(ready(rule({ test: 'less', value: '60' }))).toBe(true);
    expect(ready(rule({ test: 'empty' }))).toBe(true);
    expect(ready(rule({ test: 'error' }))).toBe(true);
    expect(ready(rule({ test: 'between', value: '60', value2: '79' }))).toBe(true);
  });
});

describe('laying the rules over a cell', () => {
  const inRange = () => true;

  it('is nothing when no rule matches', () => {
    expect(painted([rule({ test: 'less', value: '60' })], inRange, 88)).toBeUndefined();
    expect(painted([], inRange, 88)).toBeUndefined();
  });

  it('sets only the property the rule is about', () => {
    expect(painted([rule({ test: 'less', value: '60', as: 'wash', ink: 'red' })], inRange, 45))
      .toEqual({ wash: 'red' });
    expect(painted([rule({ test: 'less', value: '60', as: 'ink', ink: 'amber' })], inRange, 45))
      .toEqual({ ink: 'amber' });
  });

  it('lets a later rule win, because adding one is saying "and this too"', () => {
    const first = rule({ id: 'a', test: 'less', value: '100', ink: 'amber', as: 'wash' });
    const then = rule({ id: 'b', test: 'less', value: '60', ink: 'red', as: 'wash' });
    expect(painted([first, then], inRange, 45)).toEqual({ wash: 'red' });
    expect(painted([first, then], inRange, 70)).toEqual({ wash: 'amber' });
  });

  it('combines two rules that paint different things', () => {
    const wash = rule({ id: 'a', test: 'less', value: '60', ink: 'red', as: 'wash' });
    const ink = rule({ id: 'b', test: 'less', value: '60', ink: 'grey', as: 'ink' });
    expect(painted([wash, ink], inRange, 45)).toEqual({ wash: 'red', ink: 'grey' });
  });

  it('skips a rule whose range this cell is outside', () => {
    const only = (range: string) => range === 'B2:B20';
    expect(painted([rule({ range: 'C2:C20', test: 'less', value: '60' })], only, 45)).toBeUndefined();
  });

  it('skips one that is not finished', () => {
    expect(painted([rule({ test: 'less', value: '' })], inRange, -5)).toBeUndefined();
  });
});

describe('reading them back off a stored sheet', () => {
  it('drops anything malformed rather than taking the screen down', () => {
    const stored = {
      rules: [
        { id: 'a', range: 'B2:B9', test: 'less', value: '60', ink: 'red', as: 'wash', created: 1 },
        null,
        'nonsense',
        { id: 'b', range: 'B2:B9', test: 'from-the-future', value: '', ink: 'red', as: 'wash' },
        { id: 'c', range: 'B2:B9', test: 'less', value: '1', ink: 'chartreuse', as: 'wash' },
        { range: 'B2:B9', test: 'less', value: '1', ink: 'red', as: 'wash' },
      ],
    };
    const out = rulesOf(stored, INKS);
    expect(out.map((r) => r.id)).toEqual(['a']);
  });

  it('is empty for a sheet nobody has put a rule on', () => {
    expect(rulesOf({}, INKS)).toEqual([]);
    expect(rulesOf({ rules: 'no' }, INKS)).toEqual([]);
  });

  it('falls back to a wash for a paint it does not recognise', () => {
    const out = rulesOf(
      { rules: [{ id: 'a', range: 'B2:B9', test: 'less', value: '1', ink: 'red', as: 'sideways' }] },
      INKS,
    );
    expect(out[0].as).toBe('wash');
  });
});

describe('how a rule reads on the screen', () => {
  it('says the range, the test and the figure', () => {
    expect(saysRule(rule({ test: 'less', value: '60' }))).toBe('B2:B20 · less than 60');
    expect(saysRule(rule({ test: 'between', value: '60', value2: '79' })))
      .toBe('B2:B20 · between 60 and 79');
    expect(saysRule(rule({ test: 'empty' }))).toBe('B2:B20 · empty');
  });
});
