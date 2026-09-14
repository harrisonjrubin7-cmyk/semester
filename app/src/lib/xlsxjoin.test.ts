import { describe, expect, it } from 'vitest';
import { parts } from './xlsx';

/**
 * Joined blocks and wrapped text, carried into the file.
 *
 * Both are things the screen *draws*, and both have a real counterpart in the
 * format, so both go in as what they are. A joined heading exported without
 * its `mergeCell` is three cells again, two of them empty, with the title
 * sitting in the corner of the first.
 */

const sheet = (over: Record<string, unknown> = {}) =>
  parts({
    tabs: [
      {
        name: 'Marks',
        rows: [
          [{ kind: 'text' as const, value: 'Term one' }],
          [{ kind: 'number' as const, value: 88 }],
        ],
        header: true,
        ...over,
      },
    ],
  })['xl/worksheets/sheet1.xml'];

describe('a joined block', () => {
  it('is written as one Excel draws', () => {
    const made = sheet({ joins: ['A1:C1'] });
    expect(made).toContain('<mergeCells count="1">');
    expect(made).toContain('<mergeCell ref="A1:C1"/>');
  });

  it('counts them, because the attribute is not optional', () => {
    expect(sheet({ joins: ['A1:C1', 'A5:A9'] })).toContain('<mergeCells count="2">');
  });

  /*
   * A `mergeCells` element with no children is invalid rather than empty, so
   * the whole element goes rather than an empty one being written — which is
   * every sheet nobody has joined anything on.
   */
  it('is absent entirely where nothing is joined', () => {
    expect(sheet()).not.toContain('mergeCells');
    expect(sheet({ joins: [] })).not.toContain('mergeCells');
  });

  it('leaves out anything that is not a block', () => {
    expect(sheet({ joins: ['A1', 'nonsense'] })).not.toContain('mergeCells');
  });

  /**
   * `CT_Worksheet` is a sequence: `mergeCells` after `sheetData` and before
   * `conditionalFormatting`. Out of order is a repair notice naming nothing,
   * so the position is pinned rather than trusted to stay where it was put.
   */
  it('lands after the sheet data and before the conditional formatting', () => {
    const made = sheet({
      joins: ['A1:C1'],
      rules: [
        { id: 'r', range: 'A2:A9', test: 'less', value: '60', ink: 'red', as: 'wash', created: 1 },
      ],
    });
    expect(made.indexOf('</sheetData>')).toBeLessThan(made.indexOf('<mergeCells'));
    expect(made.indexOf('<mergeCells')).toBeLessThan(made.indexOf('<conditionalFormatting'));
  });
});

describe('wrapped text', () => {
  const styles = () =>
    parts({
      tabs: [
        {
          name: 'Marks',
          rows: [
            [{ kind: 'text' as const, value: 'A long heading', look: { wrap: true } }],
            [{ kind: 'text' as const, value: 'plain' }],
          ],
          header: false,
        },
      ],
    })['xl/styles.xml'];

  it('is written as the alignment it is', () => {
    expect(styles()).toContain('wrapText="1"');
  });

  it('is applied, or Excel reads the alignment and ignores it', () => {
    expect(styles()).toContain('applyAlignment="1"');
  });

  /*
   * Wrapping shares the one `<alignment>` child with `horizontal`, so a cell
   * that wraps *and* is aligned has to produce one element carrying both —
   * two would be invalid, and dropping either loses what somebody set.
   */
  it('shares its element with the alignment beside it', () => {
    const made = parts({
      tabs: [
        {
          name: 'Marks',
          rows: [[{ kind: 'text' as const, value: 'x', look: { wrap: true, align: 'center' } }]],
          header: false,
        },
      ],
    })['xl/styles.xml'];
    expect(made).toContain('<alignment horizontal="center" wrapText="1"/>');
  });

  /*
   * Two cells differing only in whether they wrap are two formats. Without
   * `wrap` in the key they would share one, and the second cell seen would
   * quietly take the first one's wrapping.
   */
  it('is part of what makes one format different from another', () => {
    const made = parts({
      tabs: [
        {
          name: 'Marks',
          rows: [
            [
              { kind: 'text' as const, value: 'a', look: { wrap: true } },
              { kind: 'text' as const, value: 'b' },
            ],
          ],
          header: false,
        },
      ],
    })['xl/styles.xml'];
    // The wrapped one and the plain one cannot be the same `xf`.
    const wrapped = (made.match(/wrapText="1"/g) ?? []).length;
    expect(wrapped).toBe(1);
  });
});
