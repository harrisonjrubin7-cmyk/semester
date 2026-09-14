import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FN_GROUPS, FUNCTIONS, findFunctions, fnDoc, inGroup, skeleton } from './functions';
import { clock, evaluate, isError, show, type Cells } from './sheet';

/**
 * The catalogue and the calculator, held together.
 *
 * A function list is a list of promises, and the two ways it breaks are both
 * silent. A name in the catalogue the engine has never heard of is a student
 * typing what the app told them to and getting `#NAME?`. A function in the
 * engine that is in no list is a capability nobody can find — which is how
 * this app came to have `XLOOKUP`, `NETWORKDAYS` and `EFFECT` while its
 * ribbon offered nineteen names and a sentence saying "and the scientific
 * ones".
 *
 * Both directions are checked here, and the second one is the one that will
 * actually fire: adding a function and describing it are two different
 * afternoons, and without this the second afternoon never comes.
 */

/** The `case` labels out of `apply()` — the engine's own list, read from it. */
function engineNames(): string[] {
  const source = readFileSync(new URL('./sheet.ts', import.meta.url), 'utf8');
  const from = source.indexOf('function apply(');
  const to = source.indexOf('export function weighted(');
  const body = source.slice(from, to);
  return [...new Set([...body.matchAll(/case '([A-Z][A-Z0-9.]*)':/g)].map((m) => m[1]))];
}

const sheet = (cells: Cells) => cells;
/** A fixed instant, so `TODAY()` is the same on every machine on every day. */
const at = clock(Date.UTC(2026, 8, 14, 15, 30));
const value = (formula: string, cells: Cells = {}) =>
  evaluate({ ...cells, Z99: formula }, 'Z99', new Set(), at);
const text = (formula: string, cells: Cells = {}) => show(value(formula, cells));
const near = (formula: string, cells: Cells = {}) => {
  const v = value(formula, cells);
  return typeof v === 'number' ? v : Number.NaN;
};

describe('the catalogue and the engine', () => {
  it('describes every function the engine knows', () => {
    const missing = engineNames().filter((name) => !fnDoc(name));
    expect(missing).toEqual([]);
  });

  it('promises nothing the engine cannot do', () => {
    const known = new Set(engineNames());
    expect(FUNCTIONS.filter((f) => !known.has(f.name)).map((f) => f.name)).toEqual([]);
  });

  it('names each function once', () => {
    expect(new Set(FUNCTIONS.map((f) => f.name)).size).toBe(FUNCTIONS.length);
  });

  it('files every function on a shelf that exists', () => {
    const shelves = new Set(FN_GROUPS.map((g) => g.id));
    expect(FUNCTIONS.filter((f) => !shelves.has(f.group))).toEqual([]);
    for (const g of FN_GROUPS) expect(inGroup(g.id).length).toBeGreaterThan(0);
  });

  /*
   * The example is the part a catalogue gets wrong, because nothing reads it.
   *
   * What can be checked without a fixture per function is the half that
   * actually bites: the name in the example is spelled the way the engine
   * spells it, and it is the function the entry claims to describe. A
   * misspelt name is `#NAME?`, and a `#NAME?` arrived at by copying the app's
   * own example is the worst answer this screen could give.
   *
   * The arguments are checked the other way round — by the behaviour tests
   * below, which run real formulas over real cells.
   */
  it('gives an example that names its own function, spelled the way the engine spells it', () => {
    const wrong: string[] = [];
    for (const fn of FUNCTIONS) {
      if (!fn.example.startsWith('=')) wrong.push(`${fn.name}: ${fn.example} is not a formula`);
      if (!fn.example.includes(`${fn.name}(`)) wrong.push(`${fn.name}: ${fn.example} does not call it`);
      for (const called of fn.example.matchAll(/\b([A-Z][A-Z0-9.]{1,})\(/g)) {
        if (!fnDoc(called[1])) wrong.push(`${fn.name}: ${fn.example} calls ${called[1]}, which is not a function`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('never leaves an example that the engine cannot even parse', () => {
    const unknown = FUNCTIONS.filter((f) => value(f.example, { A2: '1', B2: '2' }) === '#NAME?');
    expect(unknown.map((f) => f.name)).toEqual([]);
  });

  it('puts an exact name first when it is searched for', () => {
    expect(findFunctions('sum')[0].name).toBe('SUM');
    expect(findFunctions('XLOOKUP')[0].name).toBe('XLOOKUP');
  });

  it('finds a function by what it is for rather than by its name', () => {
    expect(findFunctions('interest').map((f) => f.name)).toContain('IPMT');
    expect(findFunctions('working days').map((f) => f.name)).toContain('NETWORKDAYS');
  });

  it('gives everything when nothing is typed, so the box browses as well as searches', () => {
    expect(findFunctions('  ')).toHaveLength(FUNCTIONS.length);
  });

  it('writes the name and its brackets, and nothing inside them', () => {
    expect(skeleton(fnDoc('XLOOKUP')!)).toBe('=XLOOKUP()');
  });
});

describe('asking what a cell holds', () => {
  it('answers about an error rather than passing it on', () => {
    expect(value('=ISERROR(1/0)')).toBe(true);
    expect(value('=ISERR(1/0)')).toBe(true);
    // A missing lookup is a fact about the data, not a fault in the formula,
    // which is the whole of the difference between ISERR and ISERROR.
    expect(value('=ISERR(NA())')).toBe(false);
    expect(value('=ISNA(NA())')).toBe(true);
  });

  it('tells a blank from a zero, which no arithmetic can', () => {
    expect(value('=ISBLANK(A1)', { A1: '' })).toBe(true);
    expect(value('=ISBLANK(A1)', { A1: '0' })).toBe(false);
  });

  it('sorts numbers from text from booleans', () => {
    expect(value('=ISNUMBER(A1)', { A1: '12' })).toBe(true);
    expect(value('=ISTEXT(A1)', { A1: 'Essay' })).toBe(true);
    expect(value('=ISTEXT(A1)', { A1: '12' })).toBe(false);
    expect(value('=ISLOGICAL(A1)', { A1: 'TRUE' })).toBe(true);
  });

  it('catches only the missing lookup when asked to', () => {
    expect(text('=IFNA(NA(),"not listed")')).toBe('not listed');
    // The division is still wrong and still says so — which is the point.
    expect(value('=IFNA(1/0,"not listed")')).toBe('#DIV/0!');
  });
});

describe('branching', () => {
  it('reads a switch down its pairs and stops at the first that holds', () => {
    expect(text('=SWITCH(A1,"Mon","Rand 308","Wed","Buttrick 101")', { A1: 'Wed' })).toBe(
      'Buttrick 101',
    );
  });

  it('takes the odd last argument as the fallback', () => {
    expect(text('=SWITCH(A1,"Mon","Rand 308","—")', { A1: 'Fri' })).toBe('—');
  });

  it('says so rather than going blank when nothing matches and there is no fallback', () => {
    expect(value('=SWITCH(A1,"Mon","Rand 308")', { A1: 'Fri' })).toBe('#N/A');
  });

  it('chooses the nth, one-based, and refuses a position it has not got', () => {
    expect(text('=CHOOSE(2,"first","second","third")')).toBe('second');
    expect(value('=CHOOSE(4,"first","second")')).toBe('#VALUE!');
  });

  it('counts an odd number of trues as an exclusive or', () => {
    expect(value('=XOR(TRUE,FALSE)')).toBe(true);
    expect(value('=XOR(TRUE,TRUE)')).toBe(false);
    expect(value('=XOR(TRUE,TRUE,TRUE)')).toBe(true);
  });

  it('measures a range without being told where it is', () => {
    expect(value('=ROWS(A1:B4)')).toBe(4);
    expect(value('=COLUMNS(A1:B4)')).toBe(2);
  });
});

describe('text', () => {
  it('swaps by what is there and by where it is, and keeps the two apart', () => {
    expect(text('=SUBSTITUTE(A1,"  "," ")', { A1: 'a  b  c' })).toBe('a b c');
    expect(text('=SUBSTITUTE(A1,"a","X",2)', { A1: 'a-a-a' })).toBe('a-X-a');
    expect(text('=REPLACE(A1,1,4,"2026")', { A1: '2025-12-11' })).toBe('2026-12-11');
  });

  it('finds with capitals and without', () => {
    expect(value('=FIND("E",A1)', { A1: 'Essay' })).toBe(1);
    expect(value('=FIND("e",A1)', { A1: 'Essay' })).toBe('#VALUE!');
    expect(value('=SEARCH("e",A1)', { A1: 'Essay' })).toBe(1);
  });

  it('title-cases a name without breaking an apostrophe', () => {
    expect(text('=PROPER(A1)', { A1: "maría o'brien" })).toBe("María O'Brien");
    // Excel writes "Don'T" here, and a name list run through that reads as
    // broken software rather than as a convention.
    expect(text('=PROPER(A1)', { A1: "don't panic" })).toBe("Don't Panic");
  });

  it('joins a column into a sentence, skipping the gaps when asked', () => {
    const rows = sheet({ A1: 'Essay', A2: '', A3: 'Exam' });
    expect(text('=TEXTJOIN(", ",TRUE,A1:A3)', rows)).toBe('Essay, Exam');
    expect(text('=TEXTJOIN(", ",FALSE,A1:A3)', rows)).toBe('Essay, , Exam');
  });

  it('repeats, and refuses to build a cell nobody can hold', () => {
    expect(text('=REPT("▮",3)')).toBe('▮▮▮');
    expect(value('=REPT("ab",99999)')).toBe('#VALUE!');
  });

  it('compares exactly only when asked to', () => {
    expect(value('=EXACT("Essay","essay")')).toBe(false);
    expect(value('="Essay"="essay"')).toBe(true);
  });

  it('reads a number that arrived as text, and says so when it did not', () => {
    expect(value('=VALUE(A1)', { A1: ' 1,200 ' })).toBe(1200);
    expect(value('=VALUE(A1)', { A1: 'Essay' })).toBe('#VALUE!');
  });

  it('goes to a character and back', () => {
    expect(text('=CHAR(65)')).toBe('A');
    expect(value('=CODE("A")')).toBe(65);
  });
});

describe('dates', () => {
  const twelfth = 'DATE(2026,12,11)';

  it('pulls a date apart', () => {
    expect(value(`=YEAR(${twelfth})`)).toBe(2026);
    expect(value(`=MONTH(${twelfth})`)).toBe(12);
    expect(value(`=DAY(${twelfth})`)).toBe(11);
  });

  it('reads the clock out of the fraction without losing a second to floating point', () => {
    expect(value('=HOUR(TIME(9,35,20))')).toBe(9);
    expect(value('=MINUTE(TIME(9,35,20))')).toBe(35);
    expect(value('=SECOND(TIME(9,35,20))')).toBe(20);
  });

  it('counts days between two dates', () => {
    expect(value(`=DAYS(${twelfth},DATE(2026,12,1))`)).toBe(10);
  });

  it('steps a month without spilling into the next one', () => {
    expect(value('=DAY(EDATE(DATE(2026,1,31),1))')).toBe(28);
    expect(value('=MONTH(EDATE(DATE(2026,1,31),1))')).toBe(2);
  });

  it('numbers the weeks the way a timetable does', () => {
    // 1 January 2026 is a Thursday, so it is in week 1 of 2026; the Monday
    // before it is in the same week and still December.
    expect(value('=ISOWEEKNUM(DATE(2026,1,1))')).toBe(1);
    expect(value('=ISOWEEKNUM(DATE(2025,12,29))')).toBe(1);
  });

  it('counts working days, and skips the days off it is given', () => {
    // Monday 7 December to Friday 11 December 2026 — five working days.
    expect(value('=NETWORKDAYS(DATE(2026,12,7),DATE(2026,12,11))')).toBe(5);
    expect(
      value('=NETWORKDAYS(DATE(2026,12,7),DATE(2026,12,11),A1:A1)', { A1: '=DATE(2026,12,9)' }),
    ).toBe(4);
    expect(value('=NETWORKDAYS(DATE(2026,12,11),DATE(2026,12,7))')).toBe(-5);
  });

  it('walks forward a number of working days, over the weekend', () => {
    // Friday plus one working day is the Monday.
    expect(value('=WEEKDAY(WORKDAY(DATE(2026,12,11),1))')).toBe(2);
    expect(value('=DAY(WORKDAY(DATE(2026,12,11),1))')).toBe(14);
  });

  it('refuses a span no student meant to ask for rather than walking it', () => {
    expect(value('=NETWORKDAYS(0,900000)')).toBe('#VALUE!');
    expect(value('=WORKDAY(TODAY(),900000)')).toBe('#VALUE!');
  });

  it('gives a year fraction on each day count a finance question names', () => {
    // Half a year, 30/360: six whole months.
    expect(near('=YEARFRAC(DATE(2026,1,1),DATE(2026,7,1),0)')).toBeCloseTo(0.5, 6);
    expect(near('=YEARFRAC(DATE(2026,1,1),DATE(2026,7,1),3)')).toBeCloseTo(181 / 365, 6);
    expect(near('=YEARFRAC(DATE(2026,1,1),DATE(2026,7,1),2)')).toBeCloseTo(181 / 360, 6);
    expect(near('=YEARFRAC(DATE(2026,1,1),DATE(2027,1,1),1)')).toBeCloseTo(1, 6);
  });
});

describe('conditions over a gradebook', () => {
  const book = sheet({
    A1: 'ECON', B1: 'Essay', C1: '72',
    A2: 'ECON', B2: 'Exam', C2: '88',
    A3: 'HIST', B3: 'Essay', C3: '64',
    A4: 'ECON', B4: 'Essay', C4: '91',
  });

  it('averages, maxes and mins under several tests at once', () => {
    expect(near('=AVERAGEIFS(C1:C4,A1:A4,"ECON",B1:B4,"Essay")', book)).toBeCloseTo(81.5, 6);
    expect(value('=MAXIFS(C1:C4,A1:A4,"ECON")', book)).toBe(91);
    expect(value('=MINIFS(C1:C4,A1:A4,"ECON")', book)).toBe(72);
  });

  it('gives nought for a max over nothing and says so for a mean over nothing', () => {
    expect(value('=MAXIFS(C1:C4,A1:A4,"PHYS")', book)).toBe(0);
    expect(value('=AVERAGEIFS(C1:C4,A1:A4,"PHYS")', book)).toBe('#DIV/0!');
  });

  it('counts what is still empty and how many different things are there', () => {
    expect(value('=COUNTBLANK(A1:C5)', book)).toBe(3);
    expect(value('=COUNTUNIQUE(A1:A4)', book)).toBe(2);
  });

  it('ranks a mark in the class, with ties sharing the better place', () => {
    const marks = sheet({ A1: '90', A2: '90', A3: '70', A4: '60' });
    expect(value('=RANK(A1,A1:A4)', marks)).toBe(1);
    expect(value('=RANK(A3,A1:A4)', marks)).toBe(3);
    expect(value('=RANK(A3,A1:A4,TRUE)', marks)).toBe(2);
    expect(value('=RANK(55,A1:A4)', marks)).toBe('#N/A');
  });

  it('gives the same answer as a share, and refuses one outside the class', () => {
    const marks = sheet({ A1: '10', A2: '20', A3: '30', A4: '40', A5: '50' });
    expect(near('=PERCENTRANK(A1:A5,30)', marks)).toBeCloseTo(0.5, 6);
    expect(near('=PERCENTRANK(A1:A5,25)', marks)).toBeCloseTo(0.375, 6);
    expect(value('=PERCENTRANK(A1:A5,60)', marks)).toBe('#N/A');
  });

  it('trims the same number off each end', () => {
    const marks = sheet({ A1: '1', A2: '50', A3: '51', A4: '52', A5: '99' });
    expect(near('=TRIMMEAN(A1:A5,0.4)', marks)).toBeCloseTo(51, 6);
  });
});

describe('more arithmetic', () => {
  it('averages compounding things geometrically', () => {
    expect(near('=GEOMEAN(A1:A3)', { A1: '1', A2: '4', A3: '16' })).toBeCloseTo(4, 6);
    expect(value('=GEOMEAN(A1:A2)', { A1: '1', A2: '-1' })).toBe('#VALUE!');
  });

  it('averages rates harmonically', () => {
    expect(near('=HARMEAN(A1:A2)', { A1: '30', A2: '60' })).toBeCloseTo(40, 6);
  });

  it('measures spread with and without the square', () => {
    const xs = sheet({ A1: '2', A2: '4', A3: '4', A4: '4', A5: '5', A6: '5', A7: '7', A8: '9' });
    expect(near('=AVEDEV(A1:A8)', xs)).toBeCloseTo(1.5, 6);
    expect(near('=DEVSQ(A1:A8)', xs)).toBeCloseTo(32, 6);
    expect(near('=SUMSQ(A1:A2)', xs)).toBeCloseTo(20, 6);
  });

  it('rounds to a step that is not a power of ten', () => {
    expect(value('=MROUND(17,5)')).toBe(15);
    expect(value('=MROUND(18,5)')).toBe(20);
    // Excel refuses a step pointing the other way rather than guessing.
    expect(value('=MROUND(-17,5)')).toBe('#VALUE!');
  });

  it('divides whole and finds common factors', () => {
    expect(value('=QUOTIENT(17,5)')).toBe(3);
    expect(value('=QUOTIENT(17,0)')).toBe('#DIV/0!');
    expect(value('=GCD(A1:A3)', { A1: '24', A2: '36', A3: '60' })).toBe(12);
    expect(value('=LCM(A1:A3)', { A1: '4', A2: '6', A3: '10' })).toBe(60);
  });
});

describe('money', () => {
  it('says how long a loan runs for', () => {
    // £10,000 at 5% a period, paying 1,000 back each time.
    expect(near('=NPER(0.05,-1000,10000)')).toBeCloseTo(14.2067, 3);
  });

  it('refuses rather than inventing a number when the payment never clears the interest', () => {
    expect(value('=NPER(0.05,-100,10000)')).toBe('#VALUE!');
  });

  it('splits one payment into its interest and its principal', () => {
    const interest = near('=IPMT(0.05,1,10,10000)');
    const principal = near('=PPMT(0.05,1,10,10000)');
    expect(interest).toBeCloseTo(-500, 6);
    expect(near('=IPMT(0.05,2,10,10000)')).toBeCloseTo(-460.2475, 3);
    // The two halves add back up to the instalment, which is the only thing
    // an amortisation table has to be true for it to balance.
    expect(interest + principal).toBeCloseTo(near('=PMT(0.05,10,10000)'), 6);
  });

  it('refuses a period outside the loan', () => {
    expect(value('=IPMT(0.05,11,10,10000)')).toBe('#VALUE!');
  });

  it('turns an advertised rate into what a year actually costs, and back', () => {
    expect(near('=EFFECT(0.24,12)')).toBeCloseTo(0.268241, 5);
    expect(near('=NOMINAL(EFFECT(0.24,12),12)')).toBeCloseTo(0.24, 6);
  });

  it('depreciates in a straight line', () => {
    expect(value('=SLN(9000,1000,5)')).toBe(1600);
  });
});

describe('errors still arrive', () => {
  it('passes one out of the new functions rather than swallowing it', () => {
    for (const formula of ['=PROPER(1/0)', '=TEXTJOIN(",",TRUE,A1:A1)', '=RANK(1/0,A1:A1)']) {
      expect(isError(value(formula, { A1: '=1/0' }))).toBe(true);
    }
  });
});
