// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromSheet, parts, sheetFileName, styleTable, tabName, widthsFor, xml, type Book } from './xlsx';
import { blankSheet, fromRows, type CellStyle, type Sheet } from './sheet';

/**
 * The parts of an Excel file, checked without opening Excel.
 *
 * Every failure here is silent. A workbook with a bad content type opens
 * empty; one with a `t="n"` cell holding letters opens with a repair notice
 * that throws the sheet away; one with two tabs of the same name refuses to
 * open at all. None of those is visible in the markup unless you know to look,
 * which is what this is for.
 */
const sheet = (cells: Record<string, string>, title = 'Marks'): Sheet => ({
  ...blankSheet(title),
  id: 's1',
  cells,
});

const book = (tabs: Book['tabs']): Book => ({ tabs });

/** As in `docx.test.ts`: an unbalanced tag is what no `toContain` can see. */
const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return doc;
};

describe('well-formedness', () => {
  it('parses every part of a workbook with one of every kind of cell', () => {
    const made = parts(
      book([
        {
          name: 'Marks & weights',
          header: true,
          widths: [12, 12, 12],
          rows: [
            [
              { kind: 'text', value: 'Piece' },
              { kind: 'text', value: 'Score' },
              { kind: 'text', value: 'Weight' },
            ],
            [
              { kind: 'text', value: 'Midterm <1>' },
              { kind: 'number', value: 88 },
              { kind: 'percent', value: 0.3, decimals: 0 },
            ],
            [
              { kind: 'blank' },
              { kind: 'formula', source: 'SUM(B2:B2)', value: '88' },
              { kind: 'formula', source: 'IF(B2>80,"yes","no")', value: 'yes' },
            ],
          ],
        },
      ]),
    );
    for (const [path, body] of Object.entries(made)) {
      expect(() => parse(body), path).not.toThrow();
    }
  });
});

describe('the package', () => {
  it('carries every part a reader looks for', () => {
    const made = parts(book([{ name: 'One', rows: [], header: false }]));
    for (const path of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]) {
      expect(Object.keys(made)).toContain(path);
    }
  });

  it('declares a content type for every worksheet, however many there are', () => {
    const made = parts(
      book([
        { name: 'A', rows: [], header: false },
        { name: 'B', rows: [], header: false },
        { name: 'C', rows: [], header: false },
      ]),
    );
    expect(made['[Content_Types].xml']).toContain('/xl/worksheets/sheet3.xml');
    expect(Object.keys(made)).toContain('xl/worksheets/sheet3.xml');
  });

  it('points every relationship at a part that is in the package', () => {
    const made = parts(book([{ name: 'A', rows: [], header: false }]));
    const targets = [...made['xl/_rels/workbook.xml.rels'].matchAll(/Target="([^"]+)"/g)].map(
      (m) => `xl/${m[1]}`,
    );
    for (const target of targets) expect(Object.keys(made)).toContain(target);
  });

  it('is a workbook with one sheet even when given none', () => {
    const made = parts(book([]));
    expect(made['xl/workbook.xml']).toContain('<sheet name="Sheet1"');
  });

  it('asks for a recalculation on load, so a stale total corrects itself', () => {
    expect(parts(book([{ name: 'A', rows: [], header: false }]))['xl/workbook.xml']).toContain(
      'fullCalcOnLoad="1"',
    );
  });
});

describe('tab names', () => {
  it('drops the characters Excel refuses', () => {
    expect(tabName('ECON 1020: problem set 4')).toBe('ECON 1020 problem set 4');
    expect(tabName('a/b\\c[d]e*f?g')).toBe('a b c d e f g');
  });

  it('cuts a long name rather than letting the file be refused', () => {
    expect(tabName('x'.repeat(60))).toHaveLength(31);
  });

  it('names an unnamed sheet', () => {
    expect(tabName('   ')).toBe('Sheet1');
  });

  it('keeps two tabs from sharing a name, which stops the workbook opening', () => {
    const made = parts(
      book([
        { name: 'Marks', rows: [], header: false },
        { name: 'Marks', rows: [], header: false },
      ]),
    );
    const names = [...made['xl/workbook.xml'].matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(names).size).toBe(2);
  });
});

describe('cells', () => {
  const sheetXml = (tab: Book['tabs'][number]) => parts(book([tab]))['xl/worksheets/sheet1.xml'];

  it('writes a number as a number', () => {
    expect(sheetXml({ name: 'A', rows: [[{ kind: 'number', value: 12 }]], header: false })).toContain(
      '<c r="A1"><v>12</v></c>',
    );
  });

  it('writes text as text, so a leading nought survives', () => {
    const out = sheetXml({ name: 'A', rows: [[{ kind: 'text', value: '007' }]], header: false });
    expect(out).toContain('t="inlineStr"');
    expect(out).toContain('>007<');
  });

  it('writes a formula with the value beside it', () => {
    const out = sheetXml({
      name: 'A',
      rows: [[{ kind: 'formula', source: 'SUM(A1:A3)', value: '60' }]],
      header: false,
    });
    expect(out).toContain('<f>SUM(A1:A3)</f>');
    expect(out).toContain('<v>60</v>');
  });

  it('writes a formula whose answer is text as text, not as a broken number', () => {
    const out = sheetXml({
      name: 'A',
      rows: [[{ kind: 'formula', source: 'IF(A1>1,"yes","no")', value: 'yes' }]],
      header: false,
    });
    expect(out).toContain('t="str"');
    expect(out).toContain('<v>yes</v>');
  });

  it('never writes a number that is not one', () => {
    const out = sheetXml({ name: 'A', rows: [[{ kind: 'number', value: NaN }]], header: false });
    expect(out).not.toContain('NaN');
  });

  it('leaves a blank cell out rather than writing an empty one', () => {
    const out = sheetXml({ name: 'A', rows: [[{ kind: 'blank' }]], header: false });
    expect(out).toContain('<sheetData></sheetData>');
  });

  it('escapes, because an ampersand in a heading is a parse error', () => {
    expect(xml('R&D')).toBe('R&amp;D');
    const out = sheetXml({ name: 'A', rows: [[{ kind: 'text', value: 'Cost & benefit' }]], header: false });
    expect(out).toContain('Cost &amp; benefit');
  });

  it('freezes and bolds a header row, and only when there is one', () => {
    const withHeader = sheetXml({
      name: 'A',
      rows: [[{ kind: 'text', value: 'Course' }], [{ kind: 'number', value: 1 }]],
      header: true,
    });
    expect(withHeader).toContain('state="frozen"');
    expect(withHeader).toContain('<c r="A1" s="1"');
    expect(sheetXml({ name: 'A', rows: [], header: false })).not.toContain('frozen');
  });
});

describe('percentages', () => {
  it('is the fraction with a percentage format, not the number eighty', () => {
    // Writing 80 would make every weighted average a hundred times too big.
    const tab = fromSheet(sheet({ A1: 'Weight', A2: '80%' }));
    expect(tab.rows[1][0]).toEqual({ kind: 'percent', value: 0.8, decimals: 0 });
  });

  it('points at a built-in format, so no definition can be missing', () => {
    const made = parts(
      book([{ name: 'A', rows: [[{ kind: 'percent', value: 0.8, decimals: 0 }]], header: false }]),
    );
    expect(made['xl/worksheets/sheet1.xml']).toContain('<c r="A1" s="2"><v>0.8</v></c>');
    expect(made['xl/styles.xml']).toContain('numFmtId="9"');
    expect(made['xl/styles.xml']).toContain('numFmtId="10"');
    // A `numFmts` part would have to be shipped and related; the built-ins
    // need neither.
    expect(made['xl/styles.xml']).not.toContain('<numFmts');
  });

  it('keeps the decimals somebody typed', () => {
    const made = parts(
      book([{ name: 'A', rows: [[{ kind: 'percent', value: 0.125, decimals: 2 }]], header: false }]),
    );
    expect(made['xl/worksheets/sheet1.xml']).toContain('s="3"');
  });
});

describe('a stored sheet as a tab', () => {
  it('writes the formula rather than the answer alone', () => {
    const tab = fromSheet(sheet({ A1: 'Score', A2: '10', A3: '20', A4: '=SUM(A2:A3)' }));
    expect(tab.rows[3][0]).toEqual({ kind: 'formula', source: 'SUM(A2:A3)', value: '30' });
  });

  it('types the body but not the heading', () => {
    const tab = fromSheet({ ...fromRows('Years', [['2026'], ['2026']]), id: 's2' });
    expect(tab.rows[0][0]).toEqual({ kind: 'text', value: '2026' });
    expect(tab.rows[1][0]).toEqual({ kind: 'number', value: 2026 });
  });

  it('is not given a header when there is only one row to be one', () => {
    expect(fromSheet(sheet({ A1: 'Only' })).header).toBe(false);
  });

  it('takes the sheet’s own name, made legal', () => {
    expect(fromSheet(sheet({ A1: 'x' }, 'ECON 1020: marks')).name).toBe('ECON 1020 marks');
  });
});

describe('column widths', () => {
  it('is wide enough for the longest cell', () => {
    expect(widthsFor([['a'], ['a much longer cell here']])[0]).toBe('a much longer cell here'.length + 2);
  });

  it('never goes below a readable minimum or above the cap', () => {
    expect(widthsFor([['a']])[0]).toBe(9);
    expect(widthsFor([['x'.repeat(200)]])[0]).toBe(42);
  });
});

describe('the file name', () => {
  it('is made of the title', () => {
    expect(sheetFileName('Problem Set 4')).toBe('problem-set-4.xlsx');
  });

  it('has a name even when the title has no letters in it', () => {
    expect(sheetFileName('***')).toBe('sheet.xlsx');
  });
});

/**
 * The formatting on the way out.
 *
 * A picture over a number is not decoration: a gradebook shown as percentages
 * and dollars that arrives in Excel as `0.8` and `1234.5` has lost the half of
 * itself that says what the numbers are. These are the checks that it does
 * not.
 */
describe('what an exported sheet looks like', () => {
  const sheet = (cells: Record<string, string>, styles: Record<string, CellStyle>): Sheet => ({
    id: 's',
    title: 'Marks',
    courseId: null,
    cells,
    styles,
    rows: 12,
    cols: 6,
    created: 0,
    updated: 0,
  });

  it('leaves the first four style indices where they were', () => {
    // `sheetXml` writes a header row as 1 and a typed percentage as 2 or 3
    // directly. A table whose indices moved with the contents would make those
    // three numbers mean something different in every file.
    const table = styleTable([{ name: 'S', rows: [], header: false }]);
    expect(table.index({})).toBe(0);
    expect(table.index({ bold: true })).toBe(1);
    expect(table.index({ fmt: '0%' })).toBe(2);
    expect(table.index({ fmt: '0.00%' })).toBe(3);
  });

  it('writes one entry however many cells ask for the same look', () => {
    const tab = fromSheet(
      sheet(
        { A1: 'Weight', A2: '0.4', A3: '0.6' },
        { A2: { num: 'percent' }, A3: { num: 'percent' } },
      ),
      false,
    );
    const table = styleTable([tab]);
    expect(table.index({ fmt: '0%' })).toBe(2);
    expect(table.xml.match(/<xf /g)?.length).toBe(5);
  });

  it('defines a custom format for anything Excel has no built-in id for', () => {
    const tab = fromSheet(sheet({ A1: '1234.5' }, { A1: { num: 'money' } }), false);
    const table = styleTable([tab]);
    expect(table.xml).toContain('formatCode="$#,##0.00"');
    expect(table.xml).toContain('numFmtId="164"');
  });

  it('puts the format on the cell that carries it', () => {
    const files = parts({ tabs: [fromSheet(sheet({ A1: '0.8' }, { A1: { num: 'percent' } }), false)] });
    const at = files['xl/worksheets/sheet1.xml'];
    // The value is the fraction, formatted — not the text off the screen.
    expect(at).toContain('<v>0.8</v>');
    expect(at).toMatch(/<c r="A1" s="2">/);
  });

  it('carries the weights and the alignment', () => {
    const tab = fromSheet(
      sheet({ A1: 'Total' }, { A1: { bold: true, italic: true, align: 'center' } }),
      false,
    );
    const table = styleTable([tab]);
    expect(table.xml).toContain('<b/><i/>');
    expect(table.xml).toContain('<alignment horizontal="center"/>');
  });

  it('lets a picture somebody chose beat the one the typing implied', () => {
    // The cell was typed `80%`, which would be written as a percentage on its
    // own. Somebody then put money over it. What they chose wins.
    const tab = fromSheet(sheet({ A1: '80%' }, { A1: { num: 'money' } }), false);
    const table = styleTable([tab]);
    expect(tab.rows[0][0].look?.fmt).toBe('$#,##0.00');
    expect(table.index(tab.rows[0][0].look)).toBeGreaterThan(3);
  });

  it('writes no look at all for a sheet nobody has formatted', () => {
    const tab = fromSheet(sheet({ A1: '1', B1: 'two' }, {}), false);
    expect(tab.rows[0].every((c) => c.look === undefined)).toBe(true);
    expect(styleTable([tab]).xml.match(/<xf /g)?.length).toBe(5);
  });

  it('carries the underline and the type size', () => {
    const tab = fromSheet(sheet({ A1: 'Total' }, { A1: { under: true, size: 14 } }), false);
    const table = styleTable([tab]);
    expect(table.xml).toContain('<u/>');
    expect(table.xml).toContain('<sz val="14"/>');
  });

  it('translates the colours for paper rather than copying the screen’s', () => {
    // The screen's red is chosen to read on a dark panel; the same hex on
    // Excel's white page is a highlighter.
    const tab = fromSheet(sheet({ A1: 'Late' }, { A1: { ink: 'red', wash: 'amber' } }), false);
    const table = styleTable([tab]);
    expect(table.xml).toContain('<color rgb="FFB03A28"/>');
    expect(table.xml).toContain('<fgColor rgb="FFFCF0D8"/>');
    // Fills 0 and 1 are reserved by the format, so a coloured cell points at 2
    // — pointing at 1 opens the workbook with every such cell striped grey.
    expect(table.xml).toMatch(/fillId="2"[^>]*applyFill="1"/);
  });

  it('rules only the sides the cell asked for, and keeps the five in order', () => {
    const tab = fromSheet(sheet({ A1: '10' }, { A1: { edge: 'tb' } }), false);
    const table = styleTable([tab]);
    expect(table.xml).toContain(
      '<border><left/><right/><top style="thin"><color indexed="64"/></top>' +
        '<bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>',
    );
    expect(table.xml).toMatch(/borderId="1"[^>]*applyBorder="1"/);
  });

  it('is still a well-formed styles part with all of it on at once', () => {
    const files = parts({
      tabs: [
        fromSheet(
          sheet(
            { A1: '0.8', B1: 'Note' },
            {
              A1: { num: 'percent', ink: 'green', wash: 'green', edge: 'tblr', size: 18 },
              B1: { under: true, italic: true, ink: 'violet' },
            },
          ),
          false,
        ),
      ],
    });
    expect(() => parse(files['xl/styles.xml'])).not.toThrow();
  });
});
