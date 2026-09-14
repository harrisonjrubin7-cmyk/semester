import { describe, expect, it } from 'vitest';
import {
  bookOf,
  clock,
  display,
  evaluate,
  readQualifier,
  reading,
  sheetKey,
  writeQualifier,
  type Cells,
} from './sheet';
import { renameIn, shift, shiftIn, sheetsBehind, sheetsNamed, translate } from './sheetedit';
import { tabNames } from './xlsx';
import { readChart, suggest } from './chart';

/**
 * A formula that reaches into another sheet.
 *
 * The engine is one grid in and one value out everywhere else in its tests,
 * and that is what makes this worth its own file: every assertion here is
 * about the *second* grid — that it is found by the right name, that a cell on
 * it is read with its own formulas resolved, that a cycle through it is
 * caught, and above all that the four ways of not finding it all answer
 * `#REF!` rather than a number.
 */

const MARKS: Cells = { A1: 'Midterm', B1: '88', B2: '74', B3: '=B1+B2' };
const TERM: Cells = { A1: '=Marks!B1', A2: "='Q1 marks'!B2", A3: '=SUM(Marks!B1:B2)' };

const SHEETS = [
  { title: 'Marks', cells: MARKS },
  { title: 'Q1 marks', cells: MARKS },
  { title: 'Term', cells: TERM },
];

const AT = Date.parse('2026-09-14T12:00:00Z');
const ctx = () => reading(SHEETS, 'Term', AT);

describe('the qualifier', () => {
  it('reads both spellings, and the doubled apostrophe', () => {
    expect(readQualifier('Marks!B1')).toEqual({ name: 'Marks', length: 6 });
    expect(readQualifier("'Q1 marks'!B1")).toEqual({ name: 'Q1 marks', length: 11 });
    expect(readQualifier("'Bo''s marks'!B1")?.name).toBe("Bo's marks");
  });

  it('is nothing where there is no name in front of a reference', () => {
    expect(readQualifier('B1')).toBeNull();
    expect(readQualifier('SUM(B1:B2)')).toBeNull();
    expect(readQualifier('')).toBeNull();
  });

  it('writes a name bare when it can and quoted when it must', () => {
    expect(writeQualifier('Marks')).toBe('Marks!');
    expect(writeQualifier('Q1 marks')).toBe("'Q1 marks'!");
    expect(writeQualifier("Bo's marks")).toBe("'Bo''s marks'!");
    // A sheet called A1 written bare is indistinguishable from a typo.
    expect(writeQualifier('A1')).toBe("'A1'!");
  });

  it('round-trips whatever it wrote', () => {
    for (const name of ['Marks', 'Q1 marks', "Bo's marks", 'A1', 'a.b_c']) {
      expect(readQualifier(`${writeQualifier(name)}B2`)?.name, name).toBe(name);
    }
  });
});

describe('the book', () => {
  it('finds a sheet however its name is capitalised or spaced', () => {
    expect(sheetKey('  Q1 Marks ')).toBe('q1 marks');
    expect(evaluate({ A1: '=marks!B1' }, 'A1', new Set(), ctx())).toBe(88);
    expect(evaluate({ A1: '=MARKS!B1' }, 'A1', new Set(), ctx())).toBe(88);
  });

  /*
   * Tab names in a workbook are unique; titles here are free text, and two
   * sheets called "Budget" is an accident rather than a thing to forbid.
   * Reading one of them would be a reference that silently takes the wrong
   * grid, which is the fault this engine is arranged against.
   */
  it('resolves an ambiguous name to nothing rather than to one of them', () => {
    const two = bookOf([
      { title: 'Budget', cells: { A1: '1' } },
      { title: 'budget', cells: { A1: '2' } },
    ]);
    expect(two['budget']).toBeNull();
    const over = { now: AT, book: two, here: 'term' };
    expect(evaluate({ A1: '=Budget!A1' }, 'A1', new Set(), over)).toBe('#REF!');
  });

  it('skips a sheet with no name at all', () => {
    expect(Object.keys(bookOf([{ title: '   ', cells: { A1: '1' } }]))).toEqual([]);
  });
});

describe('reading across', () => {
  it('reads a single cell', () => {
    expect(evaluate(TERM, 'A1', new Set(), ctx())).toBe(88);
  });

  it('reads one whose name has a space in it', () => {
    expect(evaluate(TERM, 'A2', new Set(), ctx())).toBe(74);
  });

  it('reads a range', () => {
    expect(evaluate(TERM, 'A3', new Set(), ctx())).toBe(162);
  });

  /* The other sheet's own formulas resolve against the other sheet. */
  it('reads a cell that is itself a formula, in its own grid', () => {
    expect(evaluate({ A1: '=Marks!B3' }, 'A1', new Set(), ctx())).toBe(162);
  });

  it('works inside arithmetic and inside a function', () => {
    expect(evaluate({ A1: '=Marks!B1*2' }, 'A1', new Set(), ctx())).toBe(176);
    expect(evaluate({ A1: '=AVERAGE(Marks!B1:B2)' }, 'A1', new Set(), ctx())).toBe(81);
    expect(evaluate({ A1: '=IF(Marks!B1>80,"yes","no")' }, 'A1', new Set(), ctx())).toBe('yes');
  });

  it('honours the dollar signs it is written with', () => {
    expect(evaluate({ A1: '=Marks!$B$1' }, 'A1', new Set(), ctx())).toBe(88);
  });

  it('shows through display as any other formula does', () => {
    expect(display({ A1: '=Marks!B1' }, 'A1', ctx())).toBe('88');
  });
});

describe('the four ways of not finding it', () => {
  it('says #REF! when there is no book at all', () => {
    // A sheet read on its own: a thumbnail, an export of one tab, a test.
    expect(evaluate({ A1: '=Marks!B1' }, 'A1', new Set(), clock(AT))).toBe('#REF!');
  });

  it('says #REF! for a sheet no name matches', () => {
    expect(evaluate({ A1: '=Nowhere!B1' }, 'A1', new Set(), ctx())).toBe('#REF!');
    expect(evaluate({ A1: '=SUM(Nowhere!B1:B2)' }, 'A1', new Set(), ctx())).toBe('#REF!');
  });

  it('says #REF! for a range whose two ends are on different sheets', () => {
    expect(evaluate({ A1: '=SUM(Marks!B1:Term!A9)' }, 'A1', new Set(), ctx())).toBe('#REF!');
    expect(evaluate({ A1: '=SUM(B1:Marks!B2)' }, 'A1', new Set(), ctx())).toBe('#REF!');
  });

  it('allows the same name repeated on both ends', () => {
    expect(evaluate({ A1: '=SUM(Marks!B1:Marks!B2)' }, 'A1', new Set(), ctx())).toBe(162);
  });

  /*
   * `#VALUE!` and not `#REF!`, which is the honest difference: the reference
   * is not missing, the formula was never understood. A qualifier needs an
   * address after it, so `Marks` falls through to the word rule, `!` is not an
   * operator, and the whole formula is refused exactly as it was before
   * qualifiers existed.
   */
  it('refuses a qualifier with nothing readable after it', () => {
    expect(evaluate({ A1: '=Marks!hello' }, 'A1', new Set(), ctx())).toBe('#VALUE!');
    expect(evaluate({ A1: '=Marks!' }, 'A1', new Set(), ctx())).toBe('#VALUE!');
    // And a reference that is only nearly one: three letters is not a column.
    expect(evaluate({ A1: '=Marks!ABCD1' }, 'A1', new Set(), ctx())).toBe('#VALUE!');
  });
});

describe('a cycle that goes through another sheet', () => {
  it('is caught', () => {
    const a: Cells = { A1: '=Two!A1' };
    const b: Cells = { A1: '=One!A1' };
    const sheets = [
      { title: 'One', cells: a },
      { title: 'Two', cells: b },
    ];
    expect(evaluate(a, 'A1', new Set(), reading(sheets, 'One', AT))).toBe('#CYCLE!');
  });

  /*
   * The reason `here` exists. `A1` on two sheets is two cells, and a path
   * keyed by the address alone reports an ordinary reference as a cycle.
   */
  it('does not mistake the same address on two sheets for one', () => {
    const one: Cells = { A1: '=Two!A1+1' };
    const two: Cells = { A1: '5' };
    const sheets = [
      { title: 'One', cells: one },
      { title: 'Two', cells: two },
    ];
    expect(evaluate(one, 'A1', new Set(), reading(sheets, 'One', AT))).toBe(6);
  });

  it('catches a sheet referring to itself by its own name', () => {
    const one: Cells = { A1: '=One!A1' };
    const sheets = [{ title: 'One', cells: one }];
    expect(evaluate(one, 'A1', new Set(), reading(sheets, 'One', AT))).toBe('#CYCLE!');
  });

  it('catches a longer loop through three sheets', () => {
    const a: Cells = { A1: '=Two!B2' };
    const b: Cells = { B2: '=Three!C3' };
    const c: Cells = { C3: '=One!A1' };
    const sheets = [
      { title: 'One', cells: a },
      { title: 'Two', cells: b },
      { title: 'Three', cells: c },
    ];
    expect(evaluate(a, 'A1', new Set(), reading(sheets, 'One', AT))).toBe('#CYCLE!');
  });
});

describe('what it does not change', () => {
  it('leaves a sheet with no qualifiers in it reading exactly as before', () => {
    const plain: Cells = { A1: '5', A2: '=A1*2', A3: '=SUM(A1:A2)' };
    for (const at of ['A1', 'A2', 'A3']) {
      expect(evaluate(plain, at, new Set(), clock(AT))).toEqual(
        evaluate(plain, at, new Set(), reading([{ title: 'One', cells: plain }], 'One', AT)),
      );
    }
  });

  /* `<>` is the only other place an operator could have eaten the `!`. */
  it('leaves comparison alone', () => {
    expect(evaluate({ A1: '=1<>2' }, 'A1', new Set(), ctx())).toBe(true);
  });
});

// ── Editing a grid that something else points into ────────────────────────

describe('a structural edit in this grid', () => {
  /*
   * The fault this half of the work exists to prevent, and it was real: the
   * word scan saw `Sheet2!A9` as the word `Sheet2`, a `!`, and the word `A9`,
   * and rewrote the last of those. A row inserted here moved a reference into
   * a sheet where nothing had moved — silently, and one row off.
   */
  it('leaves a reference into another sheet exactly where it was', () => {
    expect(shift('=Marks!A9', 'row', 2, 1)).toBe('=Marks!A9');
    expect(shift('=SUM(Marks!A2:A9)', 'row', 2, 1)).toBe('=SUM(Marks!A2:A9)');
    expect(shift("='Q1 marks'!A9+A9", 'row', 2, 1)).toBe("='Q1 marks'!A9+A10");
  });

  it('still moves this grid’s own references beside them', () => {
    expect(shift('=A9+Marks!A9', 'row', 2, 1)).toBe('=A10+Marks!A9');
    // A2 is above the insertion point and stays; A9 is below it and moves.
    expect(shift('=SUM(A2:A9)+SUM(Marks!A2:A9)', 'row', 2, 1)).toBe(
      '=SUM(A2:A10)+SUM(Marks!A2:A9)',
    );
  });

  it('does not turn a cross-sheet reference into #REF! when a row here goes', () => {
    expect(shift('=Marks!A3', 'row', 2, -1)).toBe('=Marks!A3');
    expect(shift('=A3', 'row', 2, -1)).toBe('=#REF!');
  });
});

describe('the same edit, seen from the sheet that was not edited', () => {
  it('moves only the references into the sheet that changed', () => {
    expect(shiftIn('=Marks!A9+Other!A9+A9', 'Marks', 'row', 2, 1)).toBe(
      '=Marks!A10+Other!A9+A9',
    );
  });

  it('matches the name however it was capitalised or quoted', () => {
    expect(shiftIn("='q1 MARKS'!A9", 'Q1 marks', 'row', 2, 1)).toBe("='q1 MARKS'!A10");
  });

  it('shrinks a range when rows inside it are deleted', () => {
    expect(shiftIn('=SUM(Marks!A2:A9)', 'Marks', 'row', 2, -2)).toBe('=SUM(Marks!A2:A7)');
  });

  /* The sheet name comes off, because `Marks!#REF!` is not a thing this
     engine can read back — see `isErrorText`. */
  it('says #REF! without the name when the cells are gone outright', () => {
    expect(shiftIn('=Marks!A3', 'Marks', 'row', 2, -1)).toBe('=#REF!');
  });

  it('leaves a sheet with nothing pointing at the changed one alone', () => {
    expect(shiftIn('=A9+Other!A9', 'Marks', 'row', 2, 1)).toBe('=A9+Other!A9');
  });
});

describe('filling a formula that reaches across', () => {
  /* Excel moves a cross-sheet reference relatively like any other, and `$`
     holds it still on the other sheet exactly as it does on this one. */
  it('moves the address and keeps the sheet', () => {
    expect(translate('=Marks!B2', 1, 0)).toBe('=Marks!B3');
    expect(translate('=Marks!$B$2', 1, 0)).toBe('=Marks!$B$2');
    expect(translate("='Q1 marks'!B2*A1", 1, 0)).toBe("='Q1 marks'!B3*A2");
  });
});

describe('renaming a sheet', () => {
  it('follows the name wherever it is written', () => {
    expect(renameIn('=Marks!B1+Marks!B2', 'Marks', 'Quiz')).toBe('=Quiz!B1+Quiz!B2');
    expect(renameIn('=SUM(Marks!B1:B2)', 'Marks', 'Quiz')).toBe('=SUM(Quiz!B1:B2)');
  });

  /*
   * A tab called `Q1` is an ordinary thing to want and `Q1` is also a cell.
   * Written bare it is `=Q1!B1`, which this reader and Excel both take as the
   * sheet — and which is also exactly what a mistyped `Q1:B1` looks like. The
   * quotes cost nothing and settle it on the page.
   */
  it('quotes a new name that reads as a cell address', () => {
    expect(renameIn('=Marks!B1', 'Marks', 'Q1')).toBe("='Q1'!B1");
  });

  /* A name that gains a space has to gain quotes with it, or the formula
     stops parsing at the space. */
  it('re-quotes a name that can no longer be written bare', () => {
    expect(renameIn('=Marks!B1', 'Marks', 'Q1 marks')).toBe("='Q1 marks'!B1");
    expect(renameIn("='Q1 marks'!B1", 'Q1 marks', 'Marks')).toBe('=Marks!B1');
    expect(renameIn('=Marks!B1', 'Marks', "Bo's")).toBe("='Bo''s'!B1");
    // And what it writes, the engine reads back — which is the whole of what
    // the quoting is for. `Q1 marks` is a real sheet in the fixture, so a
    // value rather than `#REF!` is the proof that the quotes survived.
    expect(evaluate({ A1: renameIn('=Marks!B1', 'Marks', 'Q1 marks') }, 'A1', new Set(), ctx()))
      .toBe(88);
  });

  it('leaves other sheets and this grid’s own references alone', () => {
    expect(renameIn('=Marks!B1+Other!B1+B1', 'Marks', 'Quiz')).toBe('=Quiz!B1+Other!B1+B1');
  });

  it('does nothing for a rename that changes nothing', () => {
    expect(renameIn('=Marks!B1', 'Marks', 'marks')).toBe('=Marks!B1');
    expect(renameIn('=Marks!B1', '', 'Q1')).toBe('=Marks!B1');
  });
});

describe('finding what a formula reaches into', () => {
  it('names each sheet once, in the order it was met', () => {
    expect(sheetsNamed('=Marks!B1+Other!B1+Marks!B2')).toEqual(['Marks', 'Other']);
    expect(sheetsNamed('=A1+B2')).toEqual([]);
  });

  /*
   * Through the same scanner as every rewrite, which is the whole reason it
   * is not a regex: `"Marks!B1"` inside a string is a message, and `LOG10(`
   * in front of a bracket is a call.
   */
  it('is not fooled by a string or by a function name', () => {
    expect(sheetsNamed('=IF(A1>0,"Marks!B1","")')).toEqual([]);
    expect(sheetsNamed('=LOG10(A1)')).toEqual([]);
  });

  it('walks a whole grid', () => {
    expect(sheetsBehind({ A1: '=Marks!B1', A2: 'plain', A3: "='Q1 marks'!B1" })).toEqual([
      'Marks',
      'Q1 marks',
    ]);
  });
});

// ── Out into a real workbook ──────────────────────────────────────────────

/**
 * The step between "right on the screen" and "right in Excel".
 *
 * A tab name is not a sheet title: `Q1: marks` is a legal title here and an
 * illegal tab name there, and two sheets called "Sheet" are an accident here
 * and a workbook that will not open there. A formula naming the *title* lands
 * in a file where nothing answers to it, which is `#REF!` in Excel on a number
 * that was correct where it came from — so the qualifiers are rewritten to the
 * names the tabs will actually carry, through the same function that decides
 * them.
 */
describe('carrying a cross-sheet formula into a workbook', () => {
  it('makes a legal, unique tab name for every title', () => {
    expect(tabNames(['Q1: marks', 'Term'])).toEqual(['Q1 marks', 'Term']);
    // Uniqueness is case-insensitive, as Excel's is; the spelling somebody
    // gave the sheet is kept.
    expect(tabNames(['Sheet', 'Sheet', 'sheet'])).toEqual(['Sheet', 'Sheet 2', 'sheet 3']);
    expect(tabNames(['', ''])).toEqual(['Sheet1', 'Sheet2']);
  });

  it('rewrites a qualifier to the name the tab will carry', () => {
    const [term, marks] = tabNames(['Term', 'Q1: marks']);
    expect(marks).toBe('Q1 marks');
    expect(renameIn("=SUM('Q1: marks'!B2:B3)", 'Q1: marks', marks)).toBe("=SUM('Q1 marks'!B2:B3)");
    expect(term).toBe('Term');
  });

  /*
   * And the rewritten formula still resolves — against a book keyed by the new
   * names, which is what the export reads its cached values under. A formula
   * that named the tab correctly and computed nothing would put a blank beside
   * it in every reader that does not recalculate on open.
   */
  it('still resolves under the renamed book', () => {
    const marks: Cells = { B2: '88', B3: '74' };
    const renamed = renameIn("=SUM('Q1: marks'!B2:B3)", 'Q1: marks', 'Q1 marks');
    const book = [
      { title: 'Term', cells: { A1: renamed } },
      { title: 'Q1 marks', cells: marks },
    ];
    expect(evaluate(book[0].cells, 'A1', new Set(), reading(book, 'Term', AT))).toBe(162);
  });
});

describe('a chart of a cell that reaches across', () => {
  /*
   * A picture that disagrees with the numbers it is a picture of is the worst
   * thing that can be on that screen. The chart is read under the same context
   * as the grid, so both say 88 or both say nothing.
   */
  it('charts the value the grid shows, not a gap', () => {
    const term: Cells = { A1: 'Ada', B1: '=Marks!B1', A2: 'Bo', B2: '=Marks!B2' };
    const sheets = [
      { title: 'Term', cells: term },
      { title: 'Marks', cells: { B1: '88', B2: '74' } },
    ];
    const spec = { ...suggest(term, 'A1:B2', AT, reading(sheets, 'Term', AT)), kind: 'column' as const };
    expect(readChart(term, spec, reading(sheets, 'Term', AT)).series[0].values).toEqual([88, 74]);
    // And on its own, with no book, it is honest about seeing nothing.
    expect(readChart(term, spec, clock(AT)).trouble).toMatch(/is a number/i);
  });
});
