// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fromSheet, parts, type Book } from './xlsx';
import { conditionalFor, dxfFor } from './xlsxcond';
import { blankRule, type CondRule } from './condfmt';
import { blankFilter } from './filter';
import { blankSheet, type Sheet } from './sheet';

/**
 * A filter and a colour rule, in a real workbook.
 *
 * Both could have been exported as their effect — the rows that survived, the
 * colour painted onto each cell — and both would then stop being true the
 * moment somebody edited the file. So what is asserted is that they went in as
 * what they are, and that the two things the format gets silently wrong are
 * right: the order of the elements, and which colour slot in a `dxf` actually
 * paints.
 */
const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return doc;
};

const MARKS = {
  A1: 'Student', B1: 'Course', C1: 'Mark',
  A2: 'Ada', B2: 'ECON', C2: '88',
  A3: 'Bo', B3: 'PSCI', C3: '45',
  A4: 'Cy', B4: 'ECON', C4: '95',
};

function sheetWith(over: Partial<Sheet>): Sheet {
  return { ...blankSheet('Marks'), id: 's1', cells: MARKS, ...over };
}

const bookOf = (sheet: Sheet): Book => ({ tabs: [fromSheet(sheet)] });

const rule = (over: Partial<CondRule> = {}): CondRule => ({
  ...blankRule('C2:C4', 1),
  id: 'r1',
  test: 'less',
  value: '60',
  ...over,
});

describe('a filtered sheet', () => {
  const filtered = sheetWith({
    filter: { ...blankFilter('A1:C4'), rules: [{ column: 1, test: 'is', value: 'ECON' }] },
  });

  /* Hidden, never dropped: taking the filter off in Excel has to bring the
     row back, and it cannot bring back a row that is not in the file. */
  it('hides the row rather than leaving it out', () => {
    const sheet = parts(bookOf(filtered))['xl/worksheets/sheet1.xml'];
    const rows = [...parse(sheet).querySelectorAll('row')];
    expect(rows.map((r) => r.getAttribute('r'))).toEqual(['1', '2', '3', '4']);
    expect(rows.find((r) => r.getAttribute('r') === '3')?.getAttribute('hidden')).toBe('1');
    expect(rows.find((r) => r.getAttribute('r') === '2')?.getAttribute('hidden')).toBeNull();
  });

  it('draws Excel its own arrows over the same block', () => {
    const sheet = parts(bookOf(filtered))['xl/worksheets/sheet1.xml'];
    expect(parse(sheet).querySelector('autoFilter')?.getAttribute('ref')).toBe('A1:C4');
  });

  it('puts the autoFilter after the data, where the sequence wants it', () => {
    const sheet = parts(bookOf(filtered))['xl/worksheets/sheet1.xml'];
    expect(sheet.indexOf('<autoFilter')).toBeGreaterThan(sheet.indexOf('</sheetData>'));
  });

  it('leaves an unfiltered sheet exactly as it was', () => {
    const sheet = parts(bookOf(sheetWith({})))['xl/worksheets/sheet1.xml'];
    expect(sheet).not.toContain('autoFilter');
    expect(sheet).not.toContain('hidden="1"');
  });
});

describe('a colour rule', () => {
  it('goes in as a rule, with a format beside it', () => {
    const made = parts(bookOf(sheetWith({ rules: [rule()] })));
    const sheet = parse(made['xl/worksheets/sheet1.xml']);
    const block = sheet.querySelector('conditionalFormatting');
    expect(block?.getAttribute('sqref')).toBe('C2:C4');
    const cf = block?.querySelector('cfRule');
    expect(cf?.getAttribute('type')).toBe('cellIs');
    expect(cf?.getAttribute('operator')).toBe('lessThan');
    expect(cf?.querySelector('formula')?.textContent).toBe('60');
    expect(parse(made['xl/styles.xml']).querySelectorAll('dxf').length).toBe(1);
  });

  it('writes each test as the operator the format calls it', () => {
    const of = (over: Partial<CondRule>) =>
      parse(parts(bookOf(sheetWith({ rules: [rule(over)] })))['xl/worksheets/sheet1.xml']);
    expect(of({ test: 'greater', value: '90' }).querySelector('cfRule')?.getAttribute('operator'))
      .toBe('greaterThan');
    expect(of({ test: 'equal', value: '88' }).querySelector('cfRule')?.getAttribute('operator'))
      .toBe('equal');
    expect(of({ test: 'between', value: '60', value2: '79' }).querySelectorAll('formula').length)
      .toBe(2);
    expect(of({ test: 'contains', value: 'late' }).querySelector('cfRule')?.getAttribute('type'))
      .toBe('containsText');
    expect(of({ test: 'empty' }).querySelector('cfRule')?.getAttribute('type'))
      .toBe('containsBlanks');
    expect(of({ test: 'error' }).querySelector('cfRule')?.getAttribute('type'))
      .toBe('containsErrors');
  });

  it('quotes a word and leaves a number bare', () => {
    const words = parse(
      parts(bookOf(sheetWith({ rules: [rule({ test: 'equal', value: 'A' })] })))[
        'xl/worksheets/sheet1.xml'
      ],
    );
    expect(words.querySelector('formula')?.textContent).toBe('"A"');
  });

  /*
   * In an ordinary fill the pattern's *foreground* is the colour; in a `dxf`
   * it is the background. The wrong one produces a cell that is not coloured
   * at all, with nothing wrong anywhere in the file.
   */
  it('paints a wash through bgColor, which is the one that works in a dxf', () => {
    expect(dxfFor(rule({ as: 'wash', ink: 'red' }))).toContain('<bgColor');
    expect(dxfFor(rule({ as: 'wash', ink: 'red' }))).not.toContain('<fgColor');
    expect(dxfFor(rule({ as: 'ink', ink: 'red' }))).toContain('<font><color');
  });

  /*
   * Excel reads a lower priority as stronger; this app reads a later rule as
   * stronger. Written the other way round, the first rule somebody set would
   * quietly beat every rule they set afterwards.
   */
  it('counts priority down, so the last rule wins in Excel as it does here', () => {
    const two = conditionalFor([rule({ id: 'a' }), rule({ id: 'b', value: '40' })]);
    const priorities = [...parse(`<r>${two.blocks}</r>`).querySelectorAll('cfRule')].map((n) =>
      Number(n.getAttribute('priority')),
    );
    expect(priorities).toEqual([2, 1]);
  });

  it('numbers the formats from where the caller says, for a second tab', () => {
    const second = conditionalFor([rule()], 3);
    expect(parse(`<r>${second.blocks}</r>`).querySelector('cfRule')?.getAttribute('dxfId')).toBe('3');
  });

  it('leaves a rule nobody finished out of the file', () => {
    const made = parts(bookOf(sheetWith({ rules: [rule({ value: '' })] })));
    expect(made['xl/worksheets/sheet1.xml']).not.toContain('conditionalFormatting');
    expect(made['xl/styles.xml']).not.toContain('<dxfs');
  });

  it('puts the rules after the data and before any drawing', () => {
    const sheet = parts(bookOf(sheetWith({ rules: [rule()] })))['xl/worksheets/sheet1.xml'];
    expect(sheet.indexOf('<conditionalFormatting')).toBeGreaterThan(sheet.indexOf('</sheetData>'));
  });

  it('stays well-formed with a filter and rules and a chart at once', () => {
    const all = sheetWith({
      filter: { ...blankFilter('A1:C4'), rules: [{ column: 1, test: 'is', value: 'ECON' }] },
      rules: [rule(), rule({ id: 'r2', test: 'greater', value: '90', ink: 'green' })],
      charts: [
        { id: 'c1', kind: 'column', range: 'A1:C4', title: '', headers: true, labels: true, created: 1 },
      ],
    });
    const made = parts(bookOf(all));
    for (const path of Object.keys(made)) expect(() => parse(made[path]), path).not.toThrow();
    const sheet = made['xl/worksheets/sheet1.xml'];
    expect(sheet.indexOf('<autoFilter')).toBeLessThan(sheet.indexOf('<conditionalFormatting'));
    expect(sheet.indexOf('<conditionalFormatting')).toBeLessThan(sheet.indexOf('<drawing '));
    expect(parse(made['xl/styles.xml']).querySelectorAll('dxf').length).toBe(2);
  });
});
