import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { fromDelimited, fromXlsx, readerFor } from './xlsxin';
import { display, evaluate } from './sheet';
import { fromSheet, parts, type Book } from './xlsx';

/** A File over some bytes, which is all the readers take. */
const asFile = (name: string, body: Uint8Array | string): File =>
  new File([body as BlobPart], name);

/** A minimal but real .xlsx, written the way Excel writes one. */
function workbook(opts: {
  sheets: { name: string; rows: string[] }[];
  shared?: string[];
  styles?: string;
}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook><sheets>${opts.sheets
        .map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0"?><Relationships>${opts.sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}</Relationships>`,
    ),
  };
  if (opts.shared) {
    files['xl/sharedStrings.xml'] = strToU8(
      `<?xml version="1.0"?><sst>${opts.shared.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`,
    );
  }
  if (opts.styles) files['xl/styles.xml'] = strToU8(opts.styles);
  opts.sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(
      `<?xml version="1.0"?><worksheet><sheetData>${s.rows.join('')}</sheetData></worksheet>`,
    );
  });
  return zipSync(files);
}

describe('reading a .xlsx', () => {
  it('brings numbers, strings and booleans across', async () => {
    const bytes = workbook({
      shared: ['Midterm', 'Final'],
      sheets: [
        {
          name: 'Marks',
          rows: [
            '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>78</v></c></row>',
            '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>88</v></c><c r="C2" t="b"><v>1</v></c></row>',
          ],
        },
      ],
    });
    const { sheets } = await fromXlsx(asFile('marks.xlsx', bytes));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].title).toBe('Marks');
    expect(sheets[0].cells).toEqual({ A1: 'Midterm', B1: '78', A2: 'Final', B2: '88', C2: 'TRUE' });
  });

  it('keeps the formula, not the number it happened to show', async () => {
    const bytes = workbook({
      sheets: [
        {
          name: 'Sheet1',
          rows: [
            '<row r="1"><c r="A1"><v>2</v></c><c r="A2"><v>3</v></c></row>',
            '<row r="3"><c r="A3"><f>SUM(A1:A2)</f><v>5</v></c></row>',
          ],
        },
      ],
    });
    const { sheets } = await fromXlsx(asFile('x.xlsx', bytes));
    expect(sheets[0].cells.A3).toBe('=SUM(A1:A2)');
    // And it is live: change an input and the total moves.
    const cells = { ...sheets[0].cells, A1: '10' };
    expect(evaluate(cells, 'A3')).toBe(13);
  });

  it('falls back to the cached value for a shared formula with no body', async () => {
    const bytes = workbook({
      sheets: [
        { name: 'S', rows: ['<row r="1"><c r="A1"><f t="shared" si="0"/><v>42</v></c></row>'] },
      ],
    });
    const { sheets } = await fromXlsx(asFile('x.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('42');
  });

  it('reads an inline string', async () => {
    const bytes = workbook({
      sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1" t="inlineStr"><is><t>Hello</t></is></c></row>'] }],
    });
    const { sheets } = await fromXlsx(asFile('x.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('Hello');
  });

  it('turns a date-formatted number into a date rather than a five-digit count', async () => {
    const styles =
      '<styleSheet><numFmts><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts>' +
      '<cellXfs><xf numFmtId="0"/><xf numFmtId="165"/><xf numFmtId="14"/></cellXfs></styleSheet>';
    const bytes = workbook({
      styles,
      sheets: [
        {
          name: 'Dates',
          rows: [
            '<row r="1"><c r="A1" s="1"><v>46275</v></c><c r="B1" s="2"><v>46275</v></c><c r="C1" s="0"><v>46275</v></c></row>',
          ],
        },
      ],
    });
    const { sheets } = await fromXlsx(asFile('d.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('2026-09-10');
    expect(sheets[0].cells.B1).toBe('2026-09-10');
    // No date format on this one, so it stays the number it is.
    expect(sheets[0].cells.C1).toBe('46275');
  });

  it('brings every worksheet across rather than dropping the extras', async () => {
    const bytes = workbook({
      sheets: [
        { name: 'Autumn', rows: ['<row r="1"><c r="A1"><v>1</v></c></row>'] },
        { name: 'Spring', rows: ['<row r="1"><c r="A1"><v>2</v></c></row>'] },
      ],
    });
    const { sheets, notes } = await fromXlsx(asFile('year.xlsx', bytes));
    expect(sheets.map((s) => s.title)).toEqual(['Autumn', 'Spring']);
    expect(notes.join(' ')).toContain('2 worksheets');
    expect(notes.join(' ')).toContain('across tabs');
  });

  it('says what it left behind', async () => {
    const bytes = workbook({ sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1"><v>1</v></c></row>'] }] });
    const { notes } = await fromXlsx(asFile('s.xlsx', bytes));
    expect(notes.join(' ')).toContain('Charts, pivot tables');
    expect(notes.join(' ')).toContain('file itself is untouched');
  });

  it('leaves out what will not fit, and says so', async () => {
    const bytes = workbook({
      sheets: [
        {
          name: 'Big',
          rows: [
            '<row r="1"><c r="A1"><v>1</v></c><c r="AB1"><v>2</v></c></row>',
            '<row r="5000"><c r="A5000"><v>3</v></c></row>',
          ],
        },
      ],
    });
    const { sheets, notes } = await fromXlsx(asFile('big.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('1');
    expect(sheets[0].cells.AB1).toBeUndefined();
    expect(sheets[0].cells.A5000).toBeUndefined();
    expect(notes.join(' ')).toContain('left out');
  });

  it('tells somebody what to do about a file that is not a zip', async () => {
    await expect(fromXlsx(asFile('old.xlsx', 'this is not a zip'))).rejects.toThrow(/older \.xls/);
  });

  it('refuses a zip that is not a workbook', async () => {
    const bytes = zipSync({ 'hello.txt': strToU8('hi') });
    await expect(fromXlsx(asFile('n.xlsx', bytes))).rejects.toThrow(/no workbook/);
  });
});

describe('xlsx in, edit, xlsx out', () => {
  it('preserves the data and the formulas through a whole round trip', async () => {
    // Start from a sheet the app itself would write.
    const original = {
      id: 'x',
      title: 'Gradebook',
      courseId: null,
      cells: {
        A1: 'Item', B1: 'Score', C1: 'Weight',
        A2: 'PS1', B2: '92', C2: '20',
        A3: 'Final', B3: '78', C3: '80',
        B5: '=SUMPRODUCT(B2:B3,C2:C3)/SUM(C2:C3)',
      },
      rows: 6,
      cols: 3,
      created: 0,
      updated: 0,
    };
    const before = evaluate(original.cells, 'B5');
    expect(before).toBeCloseTo((92 * 20 + 78 * 80) / 100, 10);

    // Out, through the app's own writer.
    const tab = fromSheet(original);
    const book: Book = { tabs: [tab] };
    const written = zipSync(
      Object.fromEntries(Object.entries(parts(book)).map(([k, v]) => [k, strToU8(v)])),
    );

    // And back in.
    const { sheets } = await fromXlsx(asFile('Gradebook.xlsx', written));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].cells.A2).toBe('PS1');
    expect(sheets[0].cells.B2).toBe('92');
    expect(sheets[0].cells.B5).toBe('=SUMPRODUCT(B2:B3,C2:C3)/SUM(C2:C3)');

    // The formula is still live: edit an input, the total follows.
    const edited = { ...sheets[0].cells, B3: '88' };
    expect(evaluate(edited, 'B5')).toBeCloseTo((92 * 20 + 88 * 80) / 100, 10);
    expect(display(edited, 'B5')).toBe(String((92 * 20 + 88 * 80) / 100));
  });
});

describe('reading a CSV', () => {
  it('reads one from a file the same way a paste is read', async () => {
    const { sheets } = await fromDelimited(asFile('marks.csv', 'Item,Score\nPS1,92\nFinal,78\n'));
    expect(sheets[0].title).toBe('marks');
    expect(sheets[0].cells.A1).toBe('Item');
    expect(sheets[0].cells.B3).toBe('78');
  });

  it('refuses an empty one', async () => {
    await expect(fromDelimited(asFile('empty.csv', '   '))).rejects.toThrow(/no rows/);
  });
});

describe('picking the reader', () => {
  it('knows which files it can take', () => {
    expect(readerFor(asFile('a.xlsx', ''))).toBe('xlsx');
    expect(readerFor(asFile('a.XLSX', ''))).toBe('xlsx');
    expect(readerFor(asFile('a.csv', ''))).toBe('delimited');
    expect(readerFor(asFile('a.tsv', ''))).toBe('delimited');
    expect(readerFor(asFile('a.pdf', ''))).toBeNull();
    expect(readerFor(asFile('a.numbers', ''))).toBeNull();
  });
});
