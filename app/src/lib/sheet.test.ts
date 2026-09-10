import { describe, expect, it } from 'vitest';
import {
  asNumber,
  clock,
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
    // VLOOKUP used to stand here, as the example of a function the engine did
    // not have. It has one now, so the example has to be a name no sheet will
    // ever grow — the assertion is about unknown names, not about that one.
    expect(evaluate(sheet({ A1: '=FROBNICATE(A2,B2,2)' }), 'A1')).toBe('#NAME?');
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

// ── The wider function table ─────────────────────────────────────────────
//
// Every expected value below is one Excel produces for the same formula. That
// is the point of them: a formula engine is only worth having if a student can
// check their answer against a classmate's spreadsheet and get the same number.

const at = (cells: Record<string, string>, a = 'Z1') => evaluate(cells, a);
const v = (formula: string, rest: Record<string, string> = {}) => at({ ...rest, Z1: formula });


// A gradebook: item, score, weight
const book = {
  A1: 'Item', B1: 'Score', C1: 'Weight',
  A2: 'PS1', B2: '92', C2: '0.15',
  A3: 'Midterm', B3: '78', C3: '0.25',
  A4: 'Final', B4: '88', C4: '0.35',
  A5: 'Paper', B5: '95', C5: '0.25',
};

describe('lookups', () => {
  it('VLOOKUP exact', () => expect(v('=VLOOKUP("Final",A2:C5,2)', book)).toBe(88));
  it('VLOOKUP weight column', () => expect(v('=VLOOKUP("PS1",A2:C5,3)', book)).toBe(0.15));
  it('VLOOKUP missing is #N/A', () => expect(v('=VLOOKUP("Quiz",A2:C5,2)', book)).toBe('#N/A'));
  it('VLOOKUP bad index', () => expect(v('=VLOOKUP("PS1",A2:C5,9)', book)).toBe('#REF!'));
  it('XLOOKUP', () => expect(v('=XLOOKUP("Midterm",A2:A5,B2:B5)', book)).toBe(78));
  it('XLOOKUP fallback', () => expect(v('=XLOOKUP("Nope",A2:A5,B2:B5,"none")', book)).toBe('none'));
  it('MATCH', () => expect(v('=MATCH("Final",A2:A5)', book)).toBe(3));
  it('MATCH missing', () => expect(v('=MATCH("x",A2:A5)', book)).toBe('#N/A'));
  it('INDEX 2d', () => expect(v('=INDEX(A2:C5,2,2)', book)).toBe(78));
  it('INDEX 1d', () => expect(v('=INDEX(B2:B5,4)', book)).toBe(95));
  it('INDEX+MATCH', () => expect(v('=INDEX(B2:B5,MATCH("Paper",A2:A5))', book)).toBe(95));
  it('HLOOKUP', () => expect(v('=HLOOKUP("Score",B1:C5,3)', book)).toBe(78));
});

describe('conditional counting', () => {
  it('COUNTIF >=', () => expect(v('=COUNTIF(B2:B5,">=88")', book)).toBe(3));
  it('COUNTIF text', () => expect(v('=COUNTIF(A2:A5,"Final")', book)).toBe(1));
  it('COUNTIF wildcard', () => expect(v('=COUNTIF(A2:A5,"P*")', book)).toBe(2));
  it('SUMIF over another column', () => expect(v('=SUMIF(B2:B5,">=90",C2:C5)', book)).toBeCloseTo(0.40));
  it('AVERAGEIF', () => expect(v('=AVERAGEIF(B2:B5,">=88")', book)).toBeCloseTo((92+88+95)/3));
  it('COUNTIFS two conditions', () => expect(v('=COUNTIFS(B2:B5,">=80",C2:C5,">=0.25")', book)).toBe(2));
  it('SUMIFS', () => expect(v('=SUMIFS(B2:B5,C2:C5,">=0.25")', book)).toBe(78+88+95));

  /*
   * The rule a half-finished gradebook depends on. `SUM` reads a blank as
   * zero; a criterion must not, or every row nobody has been graded on counts
   * as a row scoring nothing.
   */
  it('does not let a blank cell match a criterion', () => {
    const half = { ...book, B4: '', B5: '' };
    expect(v('=COUNTIF(B2:B5,">=0")', half)).toBe(2);
    expect(v('=SUMIF(B2:B5,">=0",C2:C5)', half)).toBeCloseTo(0.4, 10);
    expect(v('=COUNTIF(B2:B5,"<1000")', half)).toBe(2);
    expect(v('=COUNTIF(A2:A5,"<>x")', half)).toBe(4);
  });

  it('counts blanks when blank is what was asked for', () => {
    expect(v('=COUNTIF(B2:B5,"")', { ...book, B4: '', B5: '' })).toBe(2);
  });
});

describe('logic', () => {
  it('IFS first hit', () => expect(v('=IFS(B2>=90,"A",B2>=80,"B",TRUE,"C")', book)).toBe('A'));
  it('IFS falls through', () => expect(v('=IFS(B3>=90,"A",B3>=80,"B",TRUE,"C")', book)).toBe('C'));
  it('IFS no match', () => expect(v('=IFS(1=2,"x")')).toBe('#N/A'));
  it('IFERROR catches', () => expect(v('=IFERROR(1/0,"safe")')).toBe('safe'));
  it('IFERROR passes through', () => expect(v('=IFERROR(2+2,"safe")')).toBe(4));
});

describe('text', () => {
  it('LEFT', () => expect(v('=LEFT("ECON 1020",4)')).toBe('ECON'));
  it('RIGHT', () => expect(v('=RIGHT("ECON 1020",4)')).toBe('1020'));
  it('MID', () => expect(v('=MID("ECON 1020",6,4)')).toBe('1020'));
  it('SPLIT piece', () => expect(v('=SPLIT("ECON 1020"," ",2)')).toBe('1020'));
  it('TEXT percent', () => expect(v('=TEXT(0.8734,"0.0%")')).toBe('87.3%'));
  it('TEXT money', () => expect(v('=TEXT(1234.5,"$#,##0.00")')).toBe('$1,234.50'));
});

describe('dates', () => {
  const ctx = clock(Date.UTC(2026, 8, 10, 12, 0, 0));
  const d = (f: string) => evaluate({ Z1: f }, 'Z1', new Set(), ctx);
  it('DATE is an Excel serial', () => expect(d('=DATE(2026,9,10)')).toBe(46275));
  it('DATEDIF days to the final', () => expect(d('=DATEDIF(DATE(2026,9,10),DATE(2026,12,15),"D")')).toBe(96));
  it('DATEDIF months', () => expect(d('=DATEDIF(DATE(2026,1,15),DATE(2026,9,10),"M")')).toBe(7));
  it('DATEDIF backwards refuses', () => expect(d('=DATEDIF(DATE(2026,12,1),DATE(2026,1,1),"D")')).toBe('#VALUE!'));
  it('WEEKDAY', () => expect(d('=WEEKDAY(DATE(2026,9,10))')).toBe(5)); // Thursday
  it('EOMONTH', () => expect(d('=TEXT(EOMONTH(DATE(2026,9,10),0),"yyyy-mm-dd")')).toBe('2026-09-30'));
  it('EOMONTH forward', () => expect(d('=TEXT(EOMONTH(DATE(2026,9,10),3),"yyyy-mm-dd")')).toBe('2026-12-31'));
  it('TEXT month name', () => expect(d('=TEXT(DATE(2026,9,10),"ddd d mmm yyyy")')).toBe('Thu 10 Sep 2026'));
});

describe('finance', () => {
  it('PMT on a loan', () => expect(Number(v('=PMT(0.05/12,60,20000)'))).toBeCloseTo(-377.42, 2));
  it('PMT zero rate', () => expect(v('=PMT(0,10,1000)')).toBe(-100));
  it('FV of savings', () => expect(Number(v('=FV(0.04,10,-1000,0)'))).toBeCloseTo(12006.11, 2));
  it('PV', () => expect(Number(v('=PV(0.06,5,0,-1000)'))).toBeCloseTo(747.26, 2));
  it('NPV matches Excel convention', () =>
    expect(Number(v('=NPV(0.1,100,200,300)'))).toBeCloseTo(481.59, 2));
  it('IRR', () => {
    const cells = { A1: '-1000', A2: '400', A3: '400', A4: '400', Z1: '=IRR(A1:A4)' };
    expect(Number(at(cells))).toBeCloseTo(0.09701, 4);
  });
  it('RATE', () => expect(Number(v('=RATE(60,-377.42,20000)'))).toBeCloseTo(0.05/12, 5));
});

describe('stats', () => {
  it('MODE', () => {
    expect(at({ A1: '3', A2: '5', A3: '5', A4: '9', Z1: '=MODE(A1:A4)' })).toBe(5);
  });
  it('MODE with no repeat is #N/A', () => {
    expect(at({ A1: '1', A2: '2', A3: '3', Z1: '=MODE(A1:A3)' })).toBe('#N/A');
  });
  it('CORREL', () => {
    const cells = { A1:'1',A2:'2',A3:'3',A4:'4', B1:'2',B2:'4',B3:'6',B4:'8', Z1:'=CORREL(A1:A4,B1:B4)' };
    expect(Number(at(cells))).toBeCloseTo(1, 10);
  });
});

describe('nothing that existed changed', () => {
  it('SUM still sums', () => expect(v('=SUM(B2:B5)', book)).toBe(353));
  it('weighted gradebook still works', () =>
    expect(Number(v('=SUMPRODUCT(B2:B5,C2:C5)/SUM(C2:C5)', book))).toBeCloseTo(87.85, 6));
  it('cycles still caught', () => expect(evaluate({ A1: '=A1+1' }, 'A1')).toBe('#CYCLE!'));
  it('unknown name still #NAME?', () => expect(v('=FROBNICATE(1)')).toBe('#NAME?'));
  it('display leaves typed text alone', () => expect(display({ A1: '80%' }, 'A1')).toBe('80%'));
  it('but evaluates it as a number', () => expect(evaluate({ A1: '80%' }, 'A1')).toBe(0.8));
});
