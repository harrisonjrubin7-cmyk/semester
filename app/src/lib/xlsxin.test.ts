import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { fromDelimited, fromXlsx, knownFormula, plainNames, readerFor } from './xlsxin';
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

describe('dates at the edges of the 1900 system', () => {
  const styles = '<styleSheet><cellXfs><xf numFmtId="14"/></cellXfs></styleSheet>';
  const at = async (serial: string) =>
    (
      await fromXlsx(
        asFile(
          'e.xlsx',
          workbook({
            styles,
            sheets: [{ name: 'S', rows: [`<row r="1"><c r="A1" s="0"><v>${serial}</v></c></row>`] }],
          }),
        ),
      )
    ).sheets[0].cells.A1;

  /*
   * Excel's 1900 system contains a fiction: serial 60 is 29 February 1900, a
   * date that never happened, kept since 1985 for Lotus compatibility.
   * Everything from 61 on is a day ahead of a naive count because of it.
   */
  it('matches Excel on either side of the day that never happened', async () => {
    expect(await at('1')).toBe('1900-01-01');
    expect(await at('59')).toBe('1900-02-28');
    expect(await at('60')).toBe('1900-02-29');
    expect(await at('61')).toBe('1900-03-01');
  });

  it('still matches Excel on a date anybody actually has', async () => {
    expect(await at('46275')).toBe('2026-09-10');
  });
});

describe('a format that says only "month"', () => {
  const styles =
    '<styleSheet><numFmts><numFmt numFmtId="165" formatCode="mm"/>' +
    '<numFmt numFmtId="166" formatCode="hh:mm"/></numFmts>' +
    '<cellXfs><xf numFmtId="165"/><xf numFmtId="166"/></cellXfs></styleSheet>';
  const cells = async () =>
    (
      await fromXlsx(
        asFile(
          'm.xlsx',
          workbook({
            styles,
            sheets: [
              {
                name: 'S',
                rows: ['<row r="1"><c r="A1" s="0"><v>46275</v></c><c r="B1" s="1"><v>0.5</v></c></row>'],
              },
            ],
          }),
        ),
      )
    ).sheets[0].cells;

  it('is a date, not a number', async () => {
    // The rule wanted three `m`s — a month name — so a bare `mm` was read as a
    // plain number and a column of months imported as five-digit serials.
    expect((await cells()).A1).toBe('2026-09-10');
  });

  it('is still a time when there is an hour beside it', async () => {
    expect((await cells()).B1).toBe('0.5');
  });
});

describe('a workbook whose tags carry a namespace prefix', () => {
  /*
   * `<sheetData>` and `<x:sheetData>` are the same document to an XML parser,
   * and this file is not one. Without the prefix allowed every cell missed,
   * so `fromXlsx` decided the file had no worksheets and threw — on a workbook
   * Excel opens without comment.
   */
  const prefixed = zipSync({
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0"?><x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<x:workbookPr date1904="1"/><x:sheets><x:sheet name="Marks" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0"?><r:Relationships xmlns:r="x">' +
        '<r:Relationship Id="rId1" Target="worksheets/sheet1.xml"/></r:Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0"?><x:styleSheet><x:numFmts><x:numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></x:numFmts>' +
        '<x:cellXfs><x:xf numFmtId="0"/><x:xf numFmtId="165"/></x:cellXfs></x:styleSheet>',
    ),
    'xl/sharedStrings.xml': strToU8(
      '<?xml version="1.0"?><x:sst><x:si><x:t>Essay</x:t></x:si></x:sst>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<?xml version="1.0"?><x:worksheet><x:sheetData><x:row r="1">' +
        '<x:c r="A1" t="s"><x:v>0</x:v></x:c>' +
        '<x:c r="B1"><x:v>88</x:v></x:c>' +
        '<x:c r="C1"><x:f>SUM(B1:B1)</x:f><x:v>88</x:v></x:c>' +
        '<x:c r="D1" s="1"><x:v>44643</x:v></x:c>' +
        '</x:row></x:sheetData></x:worksheet>',
    ),
  });

  it('is imported rather than reported as having no worksheets', async () => {
    const { sheets } = await fromXlsx(asFile('p.xlsx', prefixed));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].title).toBe('Marks');
  });

  it('reads its shared strings, numbers and formulas', async () => {
    const { sheets } = await fromXlsx(asFile('p.xlsx', prefixed));
    expect(sheets[0].cells.A1).toBe('Essay');
    expect(sheets[0].cells.B1).toBe('88');
    expect(sheets[0].cells.C1).toBe('=SUM(B1:B1)');
  });

  it('reads its styles and its epoch, both of which live in prefixed tags too', async () => {
    // 44643 is 2022-03-23 counting from 1900 and 2026-03-24 counting from
    // 1904, so this pins the epoch as well as the custom date format.
    const { sheets } = await fromXlsx(asFile('p.xlsx', prefixed));
    expect(sheets[0].cells.D1).toBe('2026-03-24');
  });

  it('still reads a workbook with no prefixes at all', async () => {
    const plain = workbook({
      shared: ['Essay'],
      sheets: [{ name: 'S', rows: ['<row r="1"><c r="A1" t="s"><v>0</v></c></row>'] }],
    });
    const { sheets } = await fromXlsx(asFile('n.xlsx', plain));
    expect(sheets[0].cells.A1).toBe('Essay');
  });
});

describe('a cell with a phonetic reading beside its text', () => {
  const withRuby = (si: string) =>
    zipSync({
      'xl/workbook.xml': strToU8(
        '<?xml version="1.0"?><workbook><sheets><sheet name="S" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      'xl/sharedStrings.xml': strToU8(`<?xml version="1.0"?><sst>${si}</sst>`),
      'xl/worksheets/sheet1.xml': strToU8(
        '<?xml version="1.0"?><worksheet><sheetData><row r="1">' +
          '<c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>',
      ),
    });
  const read = async (si: string) =>
    (await fromXlsx(asFile('r.xlsx', withRuby(si)))).sheets[0].cells.A1;

  it('leaves the furigana out of the value', async () => {
    // Joining every `<t>` in the `<si>` glued the reading onto the end of the
    // word: 東京 came in as 東京トウキョウ.
    expect(
      await read('<si><t>東京</t><rPh sb="0" eb="2"><t>トウキョウ</t></rPh><phoneticPr fontId="1"/></si>'),
    ).toBe('東京');
  });

  it('does not swallow the text after a self-closing one', async () => {
    // A lazy match for a closing tag that never comes runs on to the next
    // one, taking everything in between with it.
    expect(await read('<si><r><t>a</t></r><rPh sb="0" eb="1"/><r><t>b</t></r></si>')).toBe('ab');
  });

  it('still joins the runs of an ordinary rich-text cell', async () => {
    expect(await read('<si><r><t>Prof. </t></r><r><t>Stromme</t></r></si>')).toBe('Prof. Stromme');
  });
});

describe('a timestamp in the last half-second of a day', () => {
  const styles = '<styleSheet><cellXfs><xf numFmtId="22"/></cellXfs></styleSheet>';
  const at = async (serial: string) =>
    (
      await fromXlsx(
        asFile(
          's.xlsx',
          workbook({
            styles,
            sheets: [{ name: 'S', rows: [`<row r="1"><c r="A1" s="0"><v>${serial}</v></c></row>`] }],
          }),
        ),
      )
    ).sheets[0].cells.A1;

  it('carries into the next day instead of falling back a day', async () => {
    // Rounding the fraction reached 86,400 seconds — a whole day — and the
    // date was computed before that was applied, so midnight landed on the
    // day before the one it belongs to.
    expect(await at('46275.9999999')).toBe('2026-09-11 00:00');
  });

  it('leaves every other time where it was', async () => {
    expect(await at('46275.5')).toBe('2026-09-10 12:00');
    expect(await at('46275')).toBe('2026-09-10 00:00');
    expect(await at('46275.99')).toBe('2026-09-10 23:45');
  });
});

describe('a formula with a quote inside a string', () => {
  it('is kept as its cached value rather than read as a broken formula', async () => {
    // Excel doubles a quote to escape it. `sheet.ts`'s lexer ends the string
    // at the first one, so the formula cannot be read at all and would
    // evaluate to #VALUE! where a cached answer was sitting right there.
    expect(knownFormula('IF(A1="say ""hi""",1,0)')).toBe(false);
    const bytes = workbook({
      sheets: [
        {
          name: 'S',
          rows: [
            '<row r="1"><c r="A1"><f>IF(B1=&quot;a&quot;&quot;b&quot;,1,0)</f><v>7</v></c></row>',
          ],
        },
      ],
    });
    const { sheets, notes } = await fromXlsx(asFile('q.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('7');
    expect(notes.join(' ')).toContain('does not have');
  });
});

describe('a function name inside a string literal', () => {
  it('is text, not a call, so the formula comes across as a formula', async () => {
    // `SUBTOTAL` is not a function this app has, but nothing here calls it.
    expect(knownFormula('IF(B1="SUBTOTAL(",1,0)')).toBe(true);
    const bytes = workbook({
      sheets: [
        {
          name: 'S',
          rows: ['<row r="1"><c r="A1"><f>IF(B1=&quot;SUBTOTAL(&quot;,1,0)</f><v>0</v></c></row>'],
        },
      ],
    });
    const { sheets } = await fromXlsx(asFile('l.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('=IF(B1="SUBTOTAL(",1,0)');
  });

  it('still refuses a real call to something it does not have', () => {
    expect(knownFormula('SUBTOTAL(9,B1:B9)')).toBe(false);
  });
});

describe('a function name written the OOXML way', () => {
  it('loses the _xlfn. that is spelling rather than meaning', () => {
    expect(plainNames('_xlfn.XLOOKUP(A1,B:B,C:C)')).toBe('XLOOKUP(A1,B:B,C:C)');
    expect(plainNames('_xlfn._xlws.FILTER(A:A,B:B)')).toBe('FILTER(A:A,B:B)');
    expect(plainNames('SUM(A1:A9)')).toBe('SUM(A1:A9)');
  });

  it('imports as a formula rather than as #NAME?', async () => {
    const bytes = workbook({
      sheets: [
        {
          name: 'S',
          rows: ['<row r="1"><c r="A1"><f>_xlfn.XLOOKUP(B1,C1:C3,D1:D3)</f><v>5</v></c></row>'],
        },
      ],
    });
    const { sheets } = await fromXlsx(asFile('x.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('=XLOOKUP(B1,C1:C3,D1:D3)');
  });
});

describe('a reference this grid cannot resolve', () => {
  /*
   * Both of these evaluate to `#VALUE!` in `sheet.ts`, measured — the app's
   * worksheets are separate grids with no cross-tab lookup, and `parseRef`
   * wants a cell, so a whole column is not an address it has. Keeping them as
   * live formulas replaced a number Excel had already worked out with an
   * error.
   */
  it('refuses a formula that reaches into another tab', () => {
    expect(knownFormula('Sheet2!A1')).toBe(false);
    expect(knownFormula('SUM(Sheet2!A1:A3)')).toBe(false);
    expect(knownFormula("'My Sheet'!A1")).toBe(false);
  });

  it('refuses a whole column or a whole row', () => {
    expect(knownFormula('SUM(A:A)')).toBe(false);
    expect(knownFormula('SUM($A:$A)')).toBe(false);
    expect(knownFormula('SUM(AA:AB)')).toBe(false);
    expect(knownFormula('SUM(1:1)')).toBe(false);
    expect(knownFormula('VLOOKUP(A1,B:D,2,0)')).toBe(false);
  });

  it('leaves an ordinary cell range alone, which is the shape it must not catch', () => {
    expect(knownFormula('SUM(A1:A9)')).toBe(true);
    expect(knownFormula('SUM($A$1:$A$9)')).toBe(true);
    expect(knownFormula('SUM(AA1:AB9)')).toBe(true);
    expect(knownFormula('ROUND(AVERAGE(A1:A9),2)')).toBe(true);
  });

  it('reads text as text: an exclamation mark in a string is not another tab', () => {
    expect(knownFormula('A1&"!"')).toBe(true);
    expect(knownFormula('IF(A1>0,"yes!","no")')).toBe(true);
  });

  it('keeps the cached value on import, and counts it', async () => {
    const bytes = workbook({
      sheets: [
        {
          name: 'S',
          rows: [
            '<row r="1"><c r="A1"><f>SUM(Sheet2!A1:A9)</f><v>412</v></c>' +
              '<c r="B1"><f>SUM(B:B)</f><v>77</v></c></row>',
          ],
        },
      ],
    });
    const { sheets, notes } = await fromXlsx(asFile('r.xlsx', bytes));
    expect(sheets[0].cells.A1).toBe('412');
    expect(sheets[0].cells.B1).toBe('77');
    expect(notes.join(' ')).toContain('another tab');
  });
});

describe('a relationship id bound to a prefix other than r', () => {
  it('still finds the worksheet it points at', async () => {
    // `r:` is a convention, not a rule — the attribute lives in the
    // relationships namespace and a writer may bind that anywhere. Requiring
    // the literal `r:id` fell through to guessing `sheet1.xml`, so a workbook
    // whose parts are named otherwise reported no worksheets at all.
    const bytes = zipSync({
      'xl/workbook.xml': strToU8(
        '<?xml version="1.0"?><workbook xmlns:rel="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<sheets><sheet name="Marks" sheetId="1" rel:id="rId7"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<?xml version="1.0"?><Relationships>' +
          '<Relationship Id="rId7" Target="worksheets/data1.xml"/></Relationships>',
      ),
      'xl/worksheets/data1.xml': strToU8(
        '<?xml version="1.0"?><worksheet><sheetData><row r="1">' +
          '<c r="A1"><v>91</v></c></row></sheetData></worksheet>',
      ),
    });
    const { sheets } = await fromXlsx(asFile('rel.xlsx', bytes));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].title).toBe('Marks');
    expect(sheets[0].cells.A1).toBe('91');
  });
});

describe('a `_xlfn.` inside a string literal', () => {
  it('is somebody’s data, not a name, and comes through untouched', () => {
    // The first version rewrote the whole formula text, so a cell whose
    // computed *text* was `_xlfn.XLOOKUP` quietly became `XLOOKUP`.
    expect(plainNames('"_xlfn.XLOOKUP"')).toBe('"_xlfn.XLOOKUP"');
    expect(plainNames('CONCAT("a_xlfn.b")')).toBe('CONCAT("a_xlfn.b")');
    expect(plainNames('IF(A1="_xlfn.X","_xlfn.Y",_xlfn.XLOOKUP(A1,B1:B2,C1:C2))')).toBe(
      'IF(A1="_xlfn.X","_xlfn.Y",XLOOKUP(A1,B1:B2,C1:C2))',
    );
  });

  it('still strips the prefix off a real name', () => {
    expect(plainNames('_xlfn.XLOOKUP(A1,B1:B9,C1:C9)')).toBe('XLOOKUP(A1,B1:B9,C1:C9)');
    expect(plainNames('_xlfn._xlws.FILTER(A1:A9,B1:B9)')).toBe('FILTER(A1:A9,B1:B9)');
  });
});

describe('seconds in a timestamp', () => {
  const read = async (styles: string, serial: string) =>
    (
      await fromXlsx(
        asFile(
          'sec.xlsx',
          workbook({
            styles,
            sheets: [{ name: 'S', rows: [`<row r="1"><c r="A1" s="0"><v>${serial}</v></c></row>`] }],
          }),
        ),
      )
    ).sheets[0].cells.A1;

  // 46275 is 2026-09-10; .5242592592592593 is 12:34:56 into the day.
  const noon34 = '46275.5242592592592593';

  it('are kept when the format asks for them', async () => {
    const withSeconds =
      '<styleSheet><numFmts><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts>' +
      '<cellXfs><xf numFmtId="165"/></cellXfs></styleSheet>';
    expect(await read(withSeconds, noon34)).toBe('2026-09-10 12:34:56');
  });

  it('are not invented when it does not', async () => {
    // Built-in 22 is `m/d/yy h:mm`, which Excel itself shows without seconds.
    // Writing `:00` onto every timestamp would be precision the file never had.
    const builtIn = '<styleSheet><cellXfs><xf numFmtId="22"/></cellXfs></styleSheet>';
    expect(await read(builtIn, noon34)).toBe('2026-09-10 12:34');
  });

  it('do not turn a date-only format into a time', async () => {
    const dateOnly = '<styleSheet><cellXfs><xf numFmtId="14"/></cellXfs></styleSheet>';
    expect(await read(dateOnly, noon34)).toBe('2026-09-10');
  });
});
