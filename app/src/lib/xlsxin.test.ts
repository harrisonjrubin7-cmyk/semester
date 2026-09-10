import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { fromDelimited, fromXlsx, knownFormula, readerFor } from './xlsxin';
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
  /** Raw XML inside <workbook>, for things like <workbookPr date1904="1"/>. */
  props?: string;
}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook>${opts.props ?? ''}<sheets>${opts.sheets
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

/*
 * Seven findings from a review of this file. Six were right; the seventh —
 * that `Math.round` in `isoDate` pushed an afternoon into the next day — was
 * not, and the test at the end of this block is the evidence.
 */
describe('dates, times, and which is which', () => {
  const styles =
    '<styleSheet><numFmts>' +
    '<numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>' +
    '<numFmt numFmtId="166" formatCode="[$-409]h:mm AM/PM"/>' +
    '<numFmt numFmtId="167" formatCode="yyyy-mm-dd hh:mm"/>' +
    '</numFmts><cellXfs>' +
    '<xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="20"/><xf numFmtId="47"/>' +
    '<xf numFmtId="165"/><xf numFmtId="166"/><xf numFmtId="167"/><xf numFmtId="22"/>' +
    '</cellXfs></styleSheet>';

  const cells = async (row: string, props?: string) =>
    (await fromXlsx(asFile('x.xlsx', workbook({ styles, props, sheets: [{ name: 'S', rows: [row] }] }))))
      .sheets[0].cells;

  it('keeps a time-formatted cell as a number rather than inventing a date', async () => {
    // 20 is `h:mm` and 47 is `mmss.0`. Both are times — a fraction of a day
    // with no date in it — and both used to import as 1899-12-30: the time
    // thrown away and a date nobody entered put in its place.
    const c = await cells('<row r="1"><c r="A1" s="2"><v>0.5</v></c><c r="B1" s="3"><v>0.5</v></c></row>');
    expect(c.A1).toBe('0.5');
    expect(c.B1).toBe('0.5');
  });

  it('still reads a real date format as a date', async () => {
    const c = await cells('<row r="1"><c r="A1" s="1"><v>46275</v></c><c r="B1" s="4"><v>46275</v></c></row>');
    expect(c.A1).toBe('2026-09-10');
    expect(c.B1).toBe('2026-09-10');
  });

  it('treats a custom time-only code as a time', async () => {
    expect((await cells('<row r="1"><c r="A1" s="5"><v>0.75</v></c></row>')).A1).toBe('0.75');
  });

  it('keeps the time when the format carries both', async () => {
    // 22 is `m/d/yy h:mm`, and 167 is a custom date-time. Dropping the time
    // silently would lose the half of the cell that says when.
    const c = await cells('<row r="1"><c r="A1" s="7"><v>46275.75</v></c><c r="B1" s="6"><v>46275.75</v></c></row>');
    expect(c.A1).toBe('2026-09-10 18:00');
    expect(c.B1).toBe('2026-09-10 18:00');
  });

  it('counts days from 1904 when the workbook says to', async () => {
    // Excel for Mac's epoch, still in files today. Assuming 1900 puts every
    // date 1,462 days early — a 2026 due date importing as 2022.
    const c = await cells(
      '<row r="1"><c r="A1" s="1"><v>44813</v></c></row>',
      '<workbookPr date1904="1"/>',
    );
    expect(c.A1).toBe('2026-09-10');
  });

  it('does NOT push an afternoon into the next day', async () => {
    // The one finding that was wrong. `Math.round` rounded milliseconds, not
    // days, so this was always right — and it is still right now that the day
    // and the time are taken apart.
    const c = await cells('<row r="1"><c r="A1" s="1"><v>46275.75</v></c></row>');
    expect(c.A1).toBe('2026-09-10');
    expect((await cells('<row r="1"><c r="A1" s="1"><v>46275.999</v></c></row>')).A1).toBe('2026-09-10');
  });
});

describe('character references', () => {
  it('decodes the numeric ones, so a line break arrives as a line break', async () => {
    const bytes = workbook({
      shared: ['First&#10;Second', '&#x41;lpha'],
      sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'] }],
    });
    const { sheets } = await fromXlsx(asFile('e.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('First\nSecond');
    expect(sheets[0].cells.B1).toBe('Alpha');
  });

  it('leaves an escaped reference alone', async () => {
    // `&amp;#10;` is somebody's literal text, not a newline. Decoding numeric
    // references after the &amp; pass would turn it into one.
    const bytes = workbook({
      shared: ['a &amp;#10; b'],
      sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1" t="s"><v>0</v></c></row>'] }],
    });
    expect((await fromXlsx(asFile('e.xlsx', bytes))).sheets[0].cells.A1).toBe('a &#10; b');
  });
});

describe('a formula filled down', () => {
  const bytes = workbook({
    sheets: [
      {
        name: 'S',
        rows: [
          '<row r="1"><c r="A1"><f t="shared" ref="A1:A2" si="0">B1*2</f><v>2</v></c>' +
            '<c r="B1"><v>1</v></c></row>',
          '<row r="2"><c r="A2"><f t="shared" si="0"/><v>4</v></c></row>',
        ],
      },
    ],
  });

  it('keeps the first cell live and the follower as its last value', async () => {
    const { sheets } = await fromXlsx(asFile('s.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('=B1*2');
    expect(sheets[0].cells.A2).toBe('4');
  });

  it('says so, rather than leaving it to be found in a total that stopped moving', async () => {
    const { notes } = await fromXlsx(asFile('s.xlsx', bytes));
    expect(notes.join(' ')).toContain('filled down');
    expect(notes.join(' ')).toContain('will not move');
  });

  it('says nothing when no cell inherited one', async () => {
    const plain = workbook({ sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1"><v>1</v></c></row>'] }] });
    expect((await fromXlsx(asFile('p.xlsx', plain))).notes.join(' ')).not.toContain('filled down');
  });
});

describe('a CSV bigger than the grid', () => {
  const big = Array.from({ length: 205 }, (_, r) =>
    Array.from({ length: 30 }, (_, c) => `${r}-${c}`).join(','),
  ).join('\n');

  it('is cut to the grid rather than hiding cells outside it', async () => {
    // `fromRows` caps rows and cols but writes every cell it is given, so the
    // overflow used to sit outside the grid: not drawn, not editable, and
    // dropped by every export — silently, on a sheet that looked complete.
    const { sheets } = await fromDelimited(asFile('big.csv', big));
    expect(sheets[0].cells.A201).toBeUndefined();
    expect(sheets[0].cells.AB1).toBeUndefined();
    expect(Object.keys(sheets[0].cells)).toHaveLength(200 * 26);
  });

  it('says what it left out', async () => {
    expect((await fromDelimited(asFile('big.csv', big))).notes.join(' ')).toContain('left out');
  });

  it('says nothing about a file that fits', async () => {
    expect((await fromDelimited(asFile('s.csv', 'a,b\n1,2\n'))).notes).toEqual([]);
  });
});

describe('a CSV field with a newline in it', () => {
  it('survives, instead of being cut in half', async () => {
    // The round trip through this app's own `toCsv` hit this the moment a cell
    // held a note with a line break: the field halved and the next column was
    // swallowed into it.
    const { sheets } = await fromDelimited(asFile('n.csv', 'a,b\n"one\ntwo",2\n'));
    expect(sheets[0].cells).toEqual({ A1: 'a', B1: 'b', A2: 'one\ntwo', B2: '2' });
  });
});

describe('a formula this app cannot evaluate', () => {
  const bytes = workbook({
    sheets: [
      {
        name: 'S',
        rows: [
          '<row r="1"><c r="A1"><f>SUBTOTAL(9,B1:B9)</f><v>412</v></c>' +
            '<c r="A2"><f>SUM(B1:B9)</f><v>412</v></c></row>',
        ],
      },
    ],
  });

  it('keeps the number Excel worked out rather than turning it into #NAME?', () => {
    // Replacing a real total with an error throws away the only copy of it:
    // the app cannot compute SUBTOTAL, but Excel already did.
    expect(knownFormula('SUBTOTAL(9,B1:B9)')).toBe(false);
    expect(knownFormula('SUM(B1:B9)')).toBe(true);
    expect(knownFormula('ROUND(AVERAGE(A1:A9),2)')).toBe(true);
  });

  it('imports the one it knows as a formula and the other as its value', async () => {
    const { sheets } = await fromXlsx(asFile('s.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('412');
    expect(sheets[0].cells.A2).toBe('=SUM(B1:B9)');
  });

  it('says how many came in that way', async () => {
    expect((await fromXlsx(asFile('s.xlsx', bytes))).notes.join(' ')).toContain('does not have');
  });

  it('keeps an unknown formula with no cached value as a formula', async () => {
    // Nothing better to fall back to, and a #NAME? in the cell is at least
    // visible — which is what a typed one would do too.
    const none = workbook({
      sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1"><f>SUBTOTAL(9,B1:B9)</f></c></row>'] }],
    });
    expect((await fromXlsx(asFile('n.xlsx', none))).sheets[0].cells.A1).toBe('=SUBTOTAL(9,B1:B9)');
  });
});

describe('a file claiming to be far larger than a spreadsheet', () => {
  it('is refused before it is unpacked', async () => {
    const huge = { name: 'huge.xlsx', size: 200 * 1024 * 1024 } as File;
    await expect(fromXlsx(huge)).rejects.toThrow(/too large/);
  });
});

describe('parts named the long way round', () => {
  /** A workbook whose relationship target is written however `target` says. */
  const withTarget = (target: string, part: string) =>
    zipSync({
      'xl/workbook.xml': strToU8(
        '<?xml version="1.0"?><workbook><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="${target}"/></Relationships>`,
      ),
      [part]: strToU8(
        '<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1"><v>42</v></c></row></sheetData></worksheet>',
      ),
    });

  it('follows a target that climbs out of xl/ and back in', async () => {
    // `xl/` + `../worksheets/sheet1.xml` is the literal key
    // `xl/../worksheets/sheet1.xml`, which matches nothing — so the worksheet
    // was skipped and the workbook reported as having none at all.
    const { sheets } = await fromXlsx(
      asFile('a.xlsx', withTarget('../worksheets/sheet1.xml', 'worksheets/sheet1.xml')),
    );
    expect(sheets[0].cells.A1).toBe('42');
  });

  it('follows a plain relative target', async () => {
    const { sheets } = await fromXlsx(
      asFile('b.xlsx', withTarget('worksheets/sheet1.xml', 'xl/worksheets/sheet1.xml')),
    );
    expect(sheets[0].cells.A1).toBe('42');
  });

  it('follows one written from the package root', async () => {
    const { sheets } = await fromXlsx(
      asFile('c.xlsx', withTarget('/xl/worksheets/sheet1.xml', 'xl/worksheets/sheet1.xml')),
    );
    expect(sheets[0].cells.A1).toBe('42');
  });

  it('follows one with a ./ in front', async () => {
    const { sheets } = await fromXlsx(
      asFile('d.xlsx', withTarget('./worksheets/sheet1.xml', 'xl/worksheets/sheet1.xml')),
    );
    expect(sheets[0].cells.A1).toBe('42');
  });
});

describe('attributes in single quotes', () => {
  it('reads a worksheet written that way, which is valid XML', async () => {
    const bytes = zipSync({
      'xl/workbook.xml': strToU8(
        "<?xml version='1.0'?><workbook><sheets><sheet name='S' sheetId='1' r:id='rId1'/></sheets></workbook>",
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        "<?xml version='1.0'?><Relationships><Relationship Id='rId1' Target='worksheets/sheet1.xml'/></Relationships>",
      ),
      'xl/worksheets/sheet1.xml': strToU8(
        "<?xml version='1.0'?><worksheet><sheetData><row r='1'>" +
          "<c r='A1'><v>42</v></c><c r='B1' t='str'><v>hi</v></c></row></sheetData></worksheet>",
      ),
    });
    const { sheets } = await fromXlsx(asFile('sq.xlsx', bytes));
    expect(sheets[0].title).toBe('S');
    expect(sheets[0].cells).toEqual({ A1: '42', B1: 'hi' });
  });
});

describe('attributes in whichever order the writer chose', () => {
  it('reads a custom date format declared formatCode-first', () => {
    // XML does not order attributes. Wanting numFmtId first meant a writer
    // emitting them the other way round had every custom date format ignored,
    // and its due dates imported as five-digit serials.
    const styles =
      '<styleSheet><numFmts><numFmt formatCode="yyyy-mm-dd" numFmtId="165"/></numFmts>' +
      '<cellXfs><xf numFmtId="0"/><xf numFmtId="165"/></cellXfs></styleSheet>';
    const bytes = workbook({
      styles,
      sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1" s="1"><v>46275</v></c></row>'] }],
    });
    return expect(
      fromXlsx(asFile('o.xlsx', bytes)).then((r) => r.sheets[0].cells.A1),
    ).resolves.toBe('2026-09-10');
  });
});

describe('a delimited file far larger than the grid', () => {
  it('is refused before it is read into memory', async () => {
    // `file.text()` materialises the whole thing and `readTable` walks every
    // character before the 200×26 cut happens.
    const huge = { name: 'huge.csv', size: 200 * 1024 * 1024 } as File;
    await expect(fromDelimited(huge)).rejects.toThrow(/too large/);
  });
});
