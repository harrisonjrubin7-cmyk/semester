// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromSheet, parts, type Book } from './xlsx';
import { sheetRef } from './xlsxchart';
import { blankSheet, type Sheet } from './sheet';
import { suggest, type SheetChart } from './chart';

/**
 * A chart inside a real workbook, checked without opening Excel.
 *
 * Every failure in this part of the format is silent and total: an element out
 * of schema order, a missing content type or a relationship pointing at a file
 * that is not there produces "we found a problem with some content", and Excel
 * then throws the chart away — or the whole workbook. None of it is visible in
 * the markup unless you know what to look for, which is what this is.
 */

const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return doc;
};

const MARKS = {
  A1: 'Student', B1: 'Midterm', C1: 'Final',
  A2: 'Ada', B2: '88', C2: '91',
  A3: 'Bo', B3: '74', C3: '69',
  A4: 'Cy', B4: '95', C4: '100',
};

function charted(kind: SheetChart['kind'], title = '', cells = MARKS, range = 'A1:C4'): Sheet {
  return {
    ...blankSheet('Term marks'),
    id: 's1',
    cells,
    charts: [{ ...suggest(cells, range, 1), kind, title }],
  };
}

const bookOf = (sheet: Sheet): Book => ({ tabs: [fromSheet(sheet)] });

describe('the package', () => {
  it('carries a drawing, a chart and the relationships between them', () => {
    const made = parts(bookOf(charted('column')));
    expect(Object.keys(made)).toEqual(
      expect.arrayContaining([
        'xl/charts/chart1.xml',
        'xl/drawings/drawing1.xml',
        'xl/drawings/_rels/drawing1.xml.rels',
        'xl/worksheets/_rels/sheet1.xml.rels',
      ]),
    );
  });

  it('declares a content type for every chart and drawing part', () => {
    const made = parts(bookOf(charted('column')));
    const types = made['[Content_Types].xml'];
    expect(types).toContain('/xl/charts/chart1.xml');
    expect(types).toContain('/xl/drawings/drawing1.xml');
  });

  /*
   * The commonest way to write a broken package: a relationship pointing at a
   * part that was never emitted, or a part nothing points at.
   */
  it('points every relationship at a part that is in the file', () => {
    const made = parts(bookOf(charted('pie')));
    const rels = [
      ['xl/drawings/_rels/drawing1.xml.rels', 'xl/drawings/'],
      ['xl/worksheets/_rels/sheet1.xml.rels', 'xl/worksheets/'],
    ] as const;
    for (const [path, base] of rels) {
      for (const node of [...parse(made[path]).querySelectorAll('Relationship')]) {
        const target = node.getAttribute('Target') ?? '';
        const full = new URL(target, `file:///${base}`).pathname.replace(/^\//, '');
        expect(Object.keys(made), `${path} → ${target}`).toContain(full);
      }
    }
  });

  it('puts the drawing after the data in the worksheet, where the schema wants it', () => {
    const sheet = parts(bookOf(charted('column')))['xl/worksheets/sheet1.xml'];
    expect(sheet.indexOf('<drawing ')).toBeGreaterThan(sheet.indexOf('</sheetData>'));
    expect(parse(sheet).querySelector('drawing')?.getAttribute('r:id')).toBe('rId1');
  });

  it('leaves a workbook with no charts exactly as it was', () => {
    const made = parts(bookOf({ ...blankSheet('Plain'), id: 's1', cells: MARKS }));
    expect(Object.keys(made).some((p) => p.includes('chart'))).toBe(false);
    expect(made['xl/worksheets/sheet1.xml']).not.toContain('<drawing');
  });
});

describe('the chart part', () => {
  it('is well-formed for every kind', () => {
    for (const kind of ['column', 'bar', 'line', 'pie'] as const) {
      expect(() => parse(parts(bookOf(charted(kind)))['xl/charts/chart1.xml'])).not.toThrow();
    }
  });

  /*
   * The whole reason a chart is exported as a reference and not as a copy: the
   * bar has to move when somebody edits the cell in Excel.
   */
  it('points each series at the cells it came from, absolutely and by sheet name', () => {
    const doc = parse(parts(bookOf(charted('column')))['xl/charts/chart1.xml']);
    const refs = [...doc.querySelectorAll('val f')].map((n) => n.textContent);
    expect(refs).toEqual(["'Term marks'!$B$2:$B$4", "'Term marks'!$C$2:$C$4"]);
    expect([...doc.querySelectorAll('cat f')][0]?.textContent).toBe("'Term marks'!$A$2:$A$4");
    expect([...doc.querySelectorAll('tx f')][0]?.textContent).toBe("'Term marks'!$B$1");
  });

  it('caches the values beside the reference, for readers that do not recalculate', () => {
    const doc = parse(parts(bookOf(charted('column')))['xl/charts/chart1.xml']);
    const first = doc.querySelector('numCache');
    expect([...(first?.querySelectorAll('pt v') ?? [])].map((n) => n.textContent)).toEqual([
      '88', '74', '95',
    ]);
  });

  /* A missing mark must not become a zero. See `numCache`. */
  it('writes a gap as no point at that index, and says so', () => {
    const cells = { ...MARKS, B3: '' };
    const part = parts(bookOf(charted('line', '', cells)))['xl/charts/chart1.xml'];
    const doc = parse(part);
    const cache = doc.querySelector('numCache');
    expect(cache?.querySelector('ptCount')?.getAttribute('val')).toBe('3');
    expect(cache?.querySelectorAll('pt').length).toBe(2);
    expect([...(cache?.querySelectorAll('pt') ?? [])].map((n) => n.getAttribute('idx'))).toEqual(['0', '2']);
    expect(part).toContain('<c:dispBlanksAs val="gap"/>');
  });

  /*
   * These schemas are sequences. Each of the three families puts a different
   * element between the series name and its categories, and getting it wrong
   * is a repair notice rather than a parse error — so it has to be asserted
   * rather than merely parsed.
   */
  it('writes each family’s own child order', () => {
    const bar = parts(bookOf(charted('column')))['xl/charts/chart1.xml'];
    expect(bar.indexOf('<c:invertIfNegative')).toBeGreaterThan(bar.indexOf('<c:tx>'));
    expect(bar.indexOf('<c:invertIfNegative')).toBeLessThan(bar.indexOf('<c:cat>'));
    expect(bar.indexOf('<c:cat>')).toBeLessThan(bar.indexOf('<c:val>'));

    const line = parts(bookOf(charted('line')))['xl/charts/chart1.xml'];
    expect(line.indexOf('<c:marker>')).toBeLessThan(line.indexOf('<c:cat>'));
    expect(line).not.toContain('invertIfNegative');

    const pie = parts(bookOf(charted('pie')))['xl/charts/chart1.xml'];
    expect(pie).not.toContain('invertIfNegative');
    expect(pie).not.toContain('<c:marker>');
    expect(pie).not.toContain('<c:catAx>');
  });

  it('draws an axis for everything that has one, on the right side of it', () => {
    const columns = parts(bookOf(charted('column')))['xl/charts/chart1.xml'];
    expect(columns).toContain('<c:barDir val="col"/>');
    expect(columns).toContain('<c:axPos val="b"/>');
    const bars = parts(bookOf(charted('bar')))['xl/charts/chart1.xml'];
    expect(bars).toContain('<c:barDir val="bar"/>');
    // Sideways: the categories run up the left and the values along the foot.
    expect(bars.indexOf('<c:catAx>')).toBeLessThan(bars.indexOf('<c:valAx>'));
    expect(bars).toContain('<c:axPos val="l"/>');
  });

  it('writes the title when there is one and deletes it when there is not', () => {
    expect(parts(bookOf(charted('column', 'How the term went')))['xl/charts/chart1.xml'])
      .toContain('<a:t>How the term went</a:t>');
    expect(parts(bookOf(charted('column')))['xl/charts/chart1.xml'])
      .toContain('<c:autoTitleDeleted val="1"/>');
  });

  it('escapes what somebody typed, in a title and in a name', () => {
    const cells = { ...MARKS, B1: 'Marks & <weights>' };
    const part = parts(bookOf(charted('column', 'A & B', cells)))['xl/charts/chart1.xml'];
    expect(() => parse(part)).not.toThrow();
    expect(part).toContain('A &amp; B');
    expect(part).toContain('Marks &amp; &lt;weights&gt;');
  });
});

describe('a sheet name inside a formula', () => {
  /*
   * "Bo's marks" unquoted is a reference to a sheet called `Bo`. The chart
   * comes up empty, with no error anywhere in the file.
   */
  it('is quoted, and an apostrophe in it is doubled', () => {
    expect(sheetRef('Term marks')).toBe("'Term marks'");
    expect(sheetRef("Bo's marks")).toBe("'Bo''s marks'");
  });

  it('travels into the chart that way', () => {
    const sheet = { ...charted('column'), title: "Bo's marks" };
    const part = parts(bookOf(sheet))['xl/charts/chart1.xml'];
    expect(part).toContain("&apos;Bo&apos;&apos;s marks&apos;!$B$2:$B$4");
  });
});

describe('more than one chart', () => {
  it('numbers the parts and the frames without collision', () => {
    const cells = MARKS;
    const sheet: Sheet = {
      ...blankSheet('Term marks'),
      id: 's1',
      cells,
      charts: [
        { ...suggest(cells, 'A1:C4', 1), id: 'a', kind: 'column' },
        { ...suggest(cells, 'A1:B4', 2), id: 'b', kind: 'pie' },
      ],
    };
    const made = parts(bookOf(sheet));
    expect(made['xl/charts/chart1.xml']).toBeTruthy();
    expect(made['xl/charts/chart2.xml']).toBeTruthy();
    const drawing = parse(made['xl/drawings/drawing1.xml']);
    expect(drawing.querySelectorAll('twoCellAnchor').length).toBe(2);
    const ids = [...drawing.querySelectorAll('cNvPr')].map((n) => n.getAttribute('id'));
    expect(new Set(ids).size).toBe(2);
    // Nothing may claim id 0 or 1 in a drawing.
    expect(ids.every((id) => Number(id) > 1)).toBe(true);
    // And they must not sit on top of each other on the sheet.
    const tops = [...drawing.querySelectorAll('from row')].map((n) => Number(n.textContent));
    expect(tops[1]).toBeGreaterThan(tops[0]);
  });

  it('leaves a chart it cannot read out of the file rather than writing an empty frame', () => {
    const sheet: Sheet = {
      ...blankSheet('Term marks'),
      id: 's1',
      cells: MARKS,
      charts: [
        { ...suggest(MARKS, 'A1:C4', 1), id: 'good', kind: 'column' },
        { id: 'bad', kind: 'column', range: 'ZZ:nonsense', title: '', headers: false, labels: false, created: 2 },
      ],
    };
    const made = parts(bookOf(sheet));
    expect(made['xl/charts/chart1.xml']).toBeTruthy();
    expect(made['xl/charts/chart2.xml']).toBeUndefined();
    expect(parse(made['xl/drawings/drawing1.xml']).querySelectorAll('twoCellAnchor').length).toBe(1);
  });
});

describe('a pie', () => {
  /*
   * The format allows several series in a pie and Excel draws the first. A
   * file holding two is a file that disagrees with the picture on the screen,
   * which says plainly that a pie is one series.
   */
  it('exports the one series it draws', () => {
    const doc = parse(parts(bookOf(charted('pie')))['xl/charts/chart1.xml']);
    expect(doc.querySelectorAll('ser').length).toBe(1);
    expect(doc.querySelector('val f')?.textContent).toBe("'Term marks'!$B$2:$B$4");
  });
});
