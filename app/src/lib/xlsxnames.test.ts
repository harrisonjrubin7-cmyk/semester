// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromSheet, parts, type Book } from './xlsx';
import { blankSheet, type Sheet } from './sheet';

/**
 * A defined name in a real workbook.
 *
 * The step between "works on the screen" and "works in Excel", and the place
 * it goes wrong is the same one cross-sheet formulas went wrong: a name stores
 * the sheet's *title*, and the file has *tab names*, which are not the same
 * string. A name pointing at a tab that is not there is a broken workbook
 * rather than a missing name.
 */
const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return doc;
};

const MARKS = { B1: 'Mark', B2: '88', B3: '74', F1: '0.5' };

function named(title: string, names: { name: string; ref: string }[]): Sheet {
  return {
    ...blankSheet(title),
    id: title,
    cells: MARKS,
    names: names.map((n) => ({ ...n, created: 1 })),
  };
}

const book = (tabs: Sheet[]): Book => ({ tabs: tabs.map((s) => fromSheet(s)) });

describe('defined names in the file', () => {
  it('writes one, absolute and qualified', () => {
    const made = parts(book([named('Marks', [{ name: 'Mark', ref: 'B2:B3' }])]));
    const doc = parse(made['xl/workbook.xml']);
    const one = doc.querySelector('definedName');
    expect(one?.getAttribute('name')).toBe('Mark');
    expect(one?.textContent).toBe('Marks!$B$2:$B$3');
  });

  it('writes a single cell as a block of one', () => {
    const made = parts(book([named('Marks', [{ name: 'Rate', ref: 'F1' }])]));
    expect(parse(made['xl/workbook.xml']).querySelector('definedName')?.textContent)
      .toBe('Marks!$F$1');
  });

  /* A title is not a tab name. `Q1: marks` is legal here and illegal there. */
  it('points at the tab name, not at the sheet title', () => {
    const made = parts(book([named('Q1: marks', [{ name: 'Mark', ref: 'B2:B3' }])]));
    const doc = parse(made['xl/workbook.xml']);
    expect(doc.querySelector('sheet')?.getAttribute('name')).toBe('Q1 marks');
    expect(doc.querySelector('definedName')?.textContent).toBe("'Q1 marks'!$B$2:$B$3");
  });

  it('follows a name across to the sheet it actually covers', () => {
    const marks = named('Marks', []);
    const term = named('Term', [{ name: 'Mark', ref: 'Marks!B2:B3' }]);
    const made = parts(book([term, marks]));
    expect(parse(made['xl/workbook.xml']).querySelector('definedName')?.textContent)
      .toBe('Marks!$B$2:$B$3');
  });

  /* Rather than a reference to a tab that is not in the file, which Excel
     reports as a broken workbook rather than as a missing name. */
  it('leaves out a name whose sheet did not come with it', () => {
    const term = named('Term', [{ name: 'Mark', ref: 'Elsewhere!B2:B3' }]);
    expect(parts(book([term]))['xl/workbook.xml']).not.toContain('definedName');
  });

  it('leaves out a name whose reference does not parse', () => {
    const made = parts(book([named('Marks', [{ name: 'Bad', ref: 'oops' }])]));
    expect(made['xl/workbook.xml']).not.toContain('definedName');
  });

  it('writes nothing at all for a workbook with no names', () => {
    const made = parts(book([{ ...blankSheet('Marks'), id: 'm', cells: MARKS }]));
    expect(made['xl/workbook.xml']).not.toContain('definedNames');
    expect(() => parse(made['xl/workbook.xml'])).not.toThrow();
  });

  /* `CT_Workbook` is a sequence: sheets, then definedNames, then calcPr. */
  it('puts them where the sequence wants them', () => {
    const made = parts(book([named('Marks', [{ name: 'Mark', ref: 'B2:B3' }])]))['xl/workbook.xml'];
    expect(made.indexOf('<definedNames>')).toBeGreaterThan(made.indexOf('</sheets>'));
    expect(made.indexOf('<definedNames>')).toBeLessThan(made.indexOf('<calcPr'));
  });

  it('escapes a name and a sheet with an ampersand in them, and stays well-formed', () => {
    const made = parts(book([named('R&D', [{ name: 'Spend', ref: 'B2:B3' }])]));
    expect(() => parse(made['xl/workbook.xml'])).not.toThrow();
    expect(parse(made['xl/workbook.xml']).querySelector('definedName')?.textContent)
      .toBe("'R&D'!$B$2:$B$3");
  });
});
