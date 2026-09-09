import { describe, expect, it } from 'vitest';
import {
  asNumber,
  asPercent,
  blankSheet,
  colIndex,
  colName,
  display,
  evaluate,
  expand,
  filled,
  fromRows,
  numericColumns,
  parseRef,
  readTable,
  ref,
  show,
  toCsv,
  toMarkdown,
  weighted,
  type Cells,
} from './sheet';

/**
 * The calculator, held to arithmetic.
 *
 * Every other test in this app checks that a screen says the right thing. This
 * one checks a number, which is a different kind of promise: a total that is
 * wrong by one is not a visible bug, it is a mark lost in three weeks' time,
 * and nobody re-adds a column the app has already added.
 *
 * So the cases here are the ones that produce a plausible wrong answer rather
 * than an obvious one — a cycle that would recurse forever, a range with text
 * in it, a division that should say so rather than return infinity, and the
 * floating-point tail that makes a right answer look wrong.
 */
const sheet = (cells: Cells) => cells;

describe('addresses', () => {
  it('names columns the way a spreadsheet does', () => {
    expect(colName(0)).toBe('A');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
    expect(colName(51)).toBe('AZ');
  });

  it('reads them back', () => {
    for (const i of [0, 3, 25, 26, 51, 100]) expect(colIndex(colName(i))).toBe(i);
  });

  it('takes a held reference as the same place', () => {
    expect(parseRef('$B$3')).toEqual({ row: 2, col: 1 });
    expect(parseRef('b3')).toEqual({ row: 2, col: 1 });
  });

  it('refuses what is not an address', () => {
    expect(parseRef('SUM')).toBeNull();
    expect(parseRef('A0')).toBeNull();
    expect(parseRef('')).toBeNull();
  });

  it('expands a range in reading order', () => {
    expect(expand('A1', 'B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('expands a range written backwards', () => {
    expect(expand('B2', 'A1')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });
});

describe('what a cell comes to', () => {
  it('reads a number as a number and a word as a word', () => {
    expect(evaluate(sheet({ A1: '12' }), 'A1')).toBe(12);
    expect(evaluate(sheet({ A1: 'Midterm' }), 'A1')).toBe('Midterm');
  });

  it('reads money and percentages, because that is how a column gets typed', () => {
    expect(asNumber('$12.50')).toBe(12.5);
    expect(asNumber('1,200')).toBe(1200);
    expect(asNumber('40%')).toBeCloseTo(0.4);
    expect(asNumber('twelve')).toBeNull();
  });

  it('is blank where nothing was typed', () => {
    expect(evaluate(sheet({}), 'C9')).toBe('');
  });

  it('adds a column up', () => {
    const s = sheet({ A1: '10', A2: '20', A3: '30', B1: '=SUM(A1:A3)' });
    expect(evaluate(s, 'B1')).toBe(60);
  });

  it('skips the words in a range rather than failing on them', () => {
    const s = sheet({ A1: 'Score', A2: '10', A3: '20', B1: '=SUM(A1:A3)', B2: '=COUNT(A1:A3)' });
    expect(evaluate(s, 'B1')).toBe(30);
    expect(evaluate(s, 'B2')).toBe(2);
  });

  it('follows a formula through another formula', () => {
    const s = sheet({ A1: '2', B1: '=A1*3', C1: '=B1+4' });
    expect(evaluate(s, 'C1')).toBe(10);
  });

  it('says a cycle is a cycle rather than hanging', () => {
    expect(evaluate(sheet({ A1: '=B1', B1: '=A1' }), 'A1')).toBe('#CYCLE!');
    expect(evaluate(sheet({ A1: '=A1+1' }), 'A1')).toBe('#CYCLE!');
  });

  it('refuses to divide by zero rather than returning infinity', () => {
    expect(evaluate(sheet({ A1: '=1/0' }), 'A1')).toBe('#DIV/0!');
  });

  it('names an unknown function rather than guessing at it', () => {
    expect(evaluate(sheet({ A1: '=VLOOKUP(A2,B2,2)' }), 'A1')).toBe('#NAME?');
    // A whole-column range is not supported, and says so rather than reading
    // as a subtraction of two things that are not numbers.
    expect(evaluate(sheet({ A1: '=SUM(B:C)' }), 'A1')).toBe('#VALUE!');
  });

  it('refuses a formula it only half understood', () => {
    expect(evaluate(sheet({ A1: '=1 2' }), 'A1')).toBe('#VALUE!');
    expect(evaluate(sheet({ A1: '=(1+2' }), 'A1')).toBe('#VALUE!');
  });

  it('carries an error out through the sum it is in', () => {
    const s = sheet({ A1: '=1/0', B1: '=A1+1' });
    expect(evaluate(s, 'B1')).toBe('#DIV/0!');
  });

  it('is right about precedence and association', () => {
    expect(evaluate(sheet({ A1: '=2+3*4' }), 'A1')).toBe(14);
    expect(evaluate(sheet({ A1: '=(2+3)*4' }), 'A1')).toBe(20);
    // Right-associative, as every spreadsheet has it.
    expect(evaluate(sheet({ A1: '=2^3^2' }), 'A1')).toBe(512);
    expect(evaluate(sheet({ A1: '=-3^2' }), 'A1')).toBe(9);
  });

  it('takes a percentage sign as a hundredth', () => {
    expect(evaluate(sheet({ A1: '=50%' }), 'A1')).toBe(0.5);
    expect(evaluate(sheet({ A1: '=200*15%' }), 'A1')).toBe(30);
  });

  it('answers a comparison with a yes or a no', () => {
    expect(evaluate(sheet({ A1: '90', B1: '=A1>=90' }), 'B1')).toBe(true);
    expect(evaluate(sheet({ A1: '89', B1: '=IF(A1>=90,"A","B")' }), 'B1')).toBe('B');
  });

  it('does the statistics a problem set asks for', () => {
    const s = sheet({
      A1: '2',
      A2: '4',
      A3: '4',
      A4: '4',
      A5: '5',
      A6: '5',
      A7: '7',
      A8: '9',
      B1: '=AVERAGE(A1:A8)',
      B2: '=MEDIAN(A1:A8)',
      B3: '=STDEVP(A1:A8)',
      B4: '=STDEV(A1:A8)',
    });
    expect(evaluate(s, 'B1')).toBe(5);
    expect(evaluate(s, 'B2')).toBe(4.5);
    expect(evaluate(s, 'B3')).toBe(2);
    expect(evaluate(s, 'B4')).toBeCloseTo(2.13809, 4);
  });

  it('will not average nothing', () => {
    expect(evaluate(sheet({ A1: '=AVERAGE(B1:B4)' }), 'A1')).toBe('#DIV/0!');
  });

  it('weights a gradebook', () => {
    const s = sheet({
      A1: '88',
      A2: '94',
      A3: '71',
      B1: '0.3',
      B2: '0.3',
      B3: '0.4',
      C1: weighted('A1:A3', 'B1:B3'),
    });
    expect(evaluate(s, 'C1')).toBeCloseTo(83, 6);
  });

  it('refuses a weighted average whose columns are different lengths', () => {
    const s = sheet({ A1: '1', A2: '2', B1: '1', C1: '=SUMPRODUCT(A1:A2,B1:B1)' });
    expect(evaluate(s, 'C1')).toBe('#VALUE!');
  });

  it('joins text', () => {
    const s = sheet({ A1: 'ECON', B1: '1020', C1: '=A1&" "&B1' });
    expect(evaluate(s, 'C1')).toBe('ECON 1020');
  });

  it('refuses a bare range, which has no single value', () => {
    expect(evaluate(sheet({ A1: '=B1:B4' }), 'A1')).toBe('#VALUE!');
  });
});

describe('what a cell shows', () => {
  it('shows a literal exactly as typed, however it reads as a number', () => {
    // The loss this fixes: `evaluate` reads `80%` as 0.8 so a SUM is right,
    // and a display that went through it showed 0.8 in a cell somebody typed
    // `80%` into.
    const s = sheet({ A1: '80%', A2: '$12.50', A3: '007', A4: '1,200' });
    expect(display(s, 'A1')).toBe('80%');
    expect(display(s, 'A2')).toBe('$12.50');
    expect(display(s, 'A3')).toBe('007');
    expect(display(s, 'A4')).toBe('1,200');
  });

  it('still reads those as numbers for the arithmetic', () => {
    const s = sheet({ A1: '80%', A2: '20%', B1: '=SUM(A1:A2)' });
    expect(evaluate(s, 'B1')).toBeCloseTo(1, 10);
  });

  it('shows a formula’s answer rather than the formula', () => {
    expect(display(sheet({ A1: '2', A2: '=A1*3' }), 'A2')).toBe('6');
  });

  it('is empty where nothing was typed', () => {
    expect(display(sheet({}), 'Z9')).toBe('');
  });
});

describe('a percentage, for a writer', () => {
  it('gives the fraction and how many decimals were typed', () => {
    expect(asPercent('80%')).toEqual({ value: 0.8, decimals: 0 });
    expect(asPercent('12.50%')).toEqual({ value: 0.125, decimals: 2 });
  });

  it('is nothing for anything that is not one', () => {
    expect(asPercent('80')).toBeNull();
    expect(asPercent('eighty%')).toBeNull();
  });
});

describe('showing a value', () => {
  it('hides the floating-point tail a right answer has', () => {
    expect(show(0.1 + 0.2)).toBe('0.3');
    expect(display(sheet({ A1: '=0.1+0.2' }), 'A1')).toBe('0.3');
  });

  it('keeps the precision a third needs', () => {
    expect(show(1 / 3)).toBe('0.333333333333');
  });

  it('says TRUE the way a sheet says it', () => {
    expect(show(true)).toBe('TRUE');
  });
});

describe('reading a table somebody pasted', () => {
  it('reads a copy out of a spreadsheet', () => {
    expect(readTable('Course\tScore\nECON\t88')).toEqual([
      ['Course', 'Score'],
      ['ECON', '88'],
    ]);
  });

  it('reads a markdown table and drops its rule', () => {
    const text = '| Course | Score |\n| --- | --- |\n| ECON | 88 |';
    expect(readTable(text)).toEqual([
      ['Course', 'Score'],
      ['ECON', '88'],
    ]);
  });

  it('reads a CSV, honouring a quoted comma', () => {
    expect(readTable('Title,Weight\n"Problem set, week 4",10')).toEqual([
      ['Title', 'Weight'],
      ['Problem set, week 4', '10'],
    ]);
  });

  it('decides the separator over the whole paste, not per line', () => {
    // One line has a comma inside a cell; every line has tabs. Deciding per
    // line would split that row differently from all the others.
    const rows = readTable('a\tb\nc, still c\td');
    expect(rows).toEqual([
      ['a', 'b'],
      ['c, still c', 'd'],
    ]);
  });

  it('reads nothing out of nothing', () => {
    expect(readTable('   \n\n')).toEqual([]);
  });
});

describe('a sheet as a whole', () => {
  it('trims an export to what is filled in', () => {
    const s = { ...blankSheet('Marks'), id: 'x', cells: { A1: 'Course', B1: '88' } };
    expect(filled(s)).toEqual([['Course', '88']]);
  });

  it('exports what a formula came to, not the formula', () => {
    const s = { ...blankSheet('Marks'), id: 'x', cells: { A1: '2', A2: '3', A3: '=A1+A2' } };
    expect(filled(s)).toEqual([['2'], ['3'], ['5']]);
  });

  it('is empty when nothing has been typed', () => {
    expect(filled({ ...blankSheet('Empty'), id: 'x' })).toEqual([]);
  });

  it('builds a sheet from rows and keeps the grid big enough to hold them', () => {
    const s = fromRows('Marks', [['Course', 'Score'], ['ECON', '88']]);
    expect(s.cells).toEqual({ A1: 'Course', B1: 'Score', A2: 'ECON', B2: '88' });
    expect(s.rows).toBeGreaterThanOrEqual(2);
    expect(s.cols).toBeGreaterThanOrEqual(2);
  });

  it('gives an untitled sheet a name rather than an empty header', () => {
    expect(blankSheet('   ').title).toBe('Untitled sheet');
  });
});

describe('writing a table out', () => {
  it('escapes a pipe rather than breaking the markdown row', () => {
    expect(toMarkdown([['a|b']])).toContain('a\\|b');
  });

  it('pads a short row so the columns line up', () => {
    const md = toMarkdown([['a', 'b'], ['c']]);
    expect(md.split('\n')[2]).toBe('| c |  |');
  });

  it('quotes a CSV cell that would otherwise shift a column', () => {
    expect(toCsv([['a,b', 'c']])).toBe('"a,b",c');
  });
});

describe('which columns are numbers', () => {
  it('reads past the header', () => {
    const rows = [
      ['Course', 'Score'],
      ['ECON', '88'],
      ['PSCI', '91'],
    ];
    expect(numericColumns(rows)).toEqual([false, true]);
  });

  it('does not call an empty column numeric', () => {
    expect(numericColumns([['A', 'B'], ['1', '']])).toEqual([true, false]);
  });
});

describe('an address round-trips', () => {
  it('is the same place read either way', () => {
    for (const [r, c] of [[0, 0], [4, 2], [99, 25]] as const) {
      expect(parseRef(ref(r, c))).toEqual({ row: r, col: c });
    }
  });
});
