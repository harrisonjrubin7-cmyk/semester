import { describe, expect, it } from 'vitest';
import { MAX_SERIES } from './chart';
import { SERIES_COLOURS, chartShapes, readTable, seriesColour } from './chartlayer';

/**
 * A pasted table, and the shapes it turns into.
 *
 * The geometry underneath — where an axis starts, how a band is split, where a
 * wedge ends — is `lib/chart.ts`'s and is tested there. What is here is what
 * this module adds: reading a block of text somebody pasted, and laying the
 * engine's answers out as marks that the canvas and the exporter both draw.
 */

const TABLE = 'Week\tAttended\tAbsent\n1\t24\t3\n2\t22\t5';

describe('reading a pasted table', () => {
  it('takes a block copied out of a spreadsheet', () => {
    const read = readTable(TABLE);
    expect(read.trouble).toBe('');
    expect(read.labels).toEqual(['1', '2']);
    expect(read.series.map((s) => s.name)).toEqual(['Attended', 'Absent']);
    expect(read.series[0]!.values).toEqual([24, 22]);
    expect(read.series[1]!.values).toEqual([3, 5]);
  });

  /*
   * Tabs when the first line has one, commas otherwise. Sniffed per table
   * rather than settled by a setting: nobody pasting a column of marks wants
   * to answer a question about delimiters first.
   */
  it('takes commas when there are no tabs', () => {
    const read = readTable('Month,Marks\nJan,72\nFeb,81');
    expect(read.labels).toEqual(['Jan', 'Feb']);
    expect(read.series[0]!.values).toEqual([72, 81]);
  });

  it('does not split a tabbed table on the commas inside it', () => {
    // A thousands separator is not a column boundary.
    const read = readTable('City\tPeople\nNashville\t1,350\nMemphis\t620');
    expect(read.series[0]!.values).toEqual([1350, 620]);
  });

  /*
   * A gap is a gap. Zero is a value and would be drawn as one — a missing
   * week plotted as a bar of height zero is a claim nobody made.
   */
  it('reads an empty cell as a gap rather than as zero', () => {
    const read = readTable('Week\tMarks\n1\t70\n2\t\n3\t80');
    expect(read.series[0]!.values).toEqual([70, null, 80]);
  });

  it('reads a cell that is not a number as a gap too', () => {
    const read = readTable('Week\tMarks\n1\t70\n2\tabsent');
    expect(read.series[0]!.values).toEqual([70, null]);
  });

  it('strips the marks a spreadsheet puts on a number', () => {
    const read = readTable('Item\tCost\nBooks\t$42.50\nFees\t£10');
    expect(read.series[0]!.values).toEqual([42.5, 10]);
  });

  it('says so rather than drawing nothing, when there is no table', () => {
    for (const bad of ['', 'Just one line', 'A\nB\nC']) {
      const read = readTable(bad);
      expect(read.trouble, JSON.stringify(bad)).not.toBe('');
    }
  });

  it('says so when the headings have no numbers under them', () => {
    expect(readTable('Week\tGrade\n1\tA\n2\tB').trouble).toMatch(/number/i);
  });

  /*
   * The ninth column is never a generated colour. Held back and named, so the
   * panel can say what is missing — a chart that quietly drew eight of nine
   * would look complete and be wrong.
   */
  it('keeps eight series and names the ones past them', () => {
    const names = Array.from({ length: 10 }, (_, i) => `S${i + 1}`);
    const read = readTable([`Cat\t${names.join('\t')}`, `A\t${names.map(() => '1').join('\t')}`].join('\n'));
    expect(read.series).toHaveLength(MAX_SERIES);
    expect(read.beyond).toEqual(['S9', 'S10']);
  });
});

describe('the palette', () => {
  it('assigns in order and never cycles', () => {
    expect(seriesColour(0)).toBe(SERIES_COLOURS[0]);
    expect(seriesColour(3)).toBe(SERIES_COLOURS[3]);
    // The ninth is not slot one again: a repeated colour is two series a
    // reader cannot tell apart, which is worse than one they cannot reach.
    expect(seriesColour(8)).not.toBe(SERIES_COLOURS[0]);
    expect(seriesColour(8)).toBe(SERIES_COLOURS[SERIES_COLOURS.length - 1]);
  });

  it('is eight concrete colours, because an export has no stylesheet', () => {
    expect(SERIES_COLOURS).toHaveLength(MAX_SERIES);
    for (const c of SERIES_COLOURS) expect(c, c).toMatch(/^#[\da-f]{6}$/i);
  });
});

describe('laying a chart out', () => {
  const box = { x: 0, y: 0, w: 800, h: 400 };
  const marks = (text: string, kind: Parameters<typeof chartShapes>[1] = 'column') =>
    chartShapes(readTable(text), kind, box, '#101418');

  it('draws nothing at all for a table it could not read', () => {
    expect(marks('nonsense')).toEqual([]);
  });

  it('draws a bar per value, and keeps them inside the box', () => {
    const out = marks(TABLE);
    const rects = out.filter((m) => m.t === 'rect');
    // Four bars, plus one swatch per series in the legend.
    expect(rects.length).toBeGreaterThanOrEqual(4);
    for (const m of out) {
      if (m.t !== 'rect') continue;
      expect(m.x).toBeGreaterThanOrEqual(box.x - 0.01);
      expect(m.y).toBeGreaterThanOrEqual(box.y - 0.01);
      expect(m.x + m.w).toBeLessThanOrEqual(box.x + box.w + 0.01);
      expect(m.y + m.h).toBeLessThanOrEqual(box.y + box.h + 0.01);
    }
  });

  /*
   * Words inside the box too, not only bars.
   *
   * The first version of the bounds check above measured rects alone, and a
   * screenshot found what it could not: the top axis number's baseline sat on
   * the top gridline, so the glyph was drawn above the layer and sliced off.
   * A label that leaves the box is as wrong as a bar that does.
   */
  it('keeps every word inside the box, on every picture', () => {
    for (const kind of ['column', 'bar', 'line', 'pie'] as const) {
      for (const m of marks(TABLE, kind)) {
        if (m.t !== 'text') continue;
        const half = m.size * 0.8;
        expect(m.y - half, `${kind}: “${m.s}” above the top`).toBeGreaterThanOrEqual(box.y - 0.01);
        expect(m.y, `${kind}: “${m.s}” below the bottom`).toBeLessThanOrEqual(box.y + box.h + 0.01);
        expect(m.x, `${kind}: “${m.s}” past the left`).toBeGreaterThanOrEqual(box.x - 0.01);
        expect(m.x, `${kind}: “${m.s}” past the right`).toBeLessThanOrEqual(box.x + box.w + 0.01);
      }
    }
  });

  it('skips a gap rather than drawing it as zero', () => {
    const full = marks('Week\tMarks\n1\t70\n2\t80').filter((m) => m.t === 'rect').length;
    const gapped = marks('Week\tMarks\n1\t70\n2\t').filter((m) => m.t === 'rect').length;
    expect(gapped).toBe(full - 1);
  });

  /*
   * Identity is never colour alone. Three of the eight series colours fall
   * under 3:1 against a light ground, so a chart with more than one series
   * carries a legend without exception — and it is drawn in SVG rather than
   * HTML beside the picture, because this one is exported to a file.
   */
  it('draws a legend for more than one series, naming each', () => {
    const out = marks(TABLE);
    const words = out.filter((m) => m.t === 'text').map((m) => (m.t === 'text' ? m.s : ''));
    expect(words).toContain('Attended');
    expect(words).toContain('Absent');
  });

  it('draws no legend for a single series, the title carrying the name', () => {
    const words = marks('Week\tMarks\n1\t70\n2\t80')
      .filter((m) => m.t === 'text')
      .map((m) => (m.t === 'text' ? m.s : ''));
    expect(words).not.toContain('Marks');
  });

  it('writes every word in the ink, never in a series colour', () => {
    // A label that *is* the series colour fails the moment two series are
    // close in hue, or the reader cannot separate them at all.
    for (const m of marks(TABLE)) {
      if (m.t === 'text') expect(m.fill, m.s).toBe('#101418');
    }
    // And the bars are not in the ink, or there would be nothing to read.
    expect(marks(TABLE).some((m) => m.t === 'rect' && m.fill !== '#101418')).toBe(true);
  });

  it('draws a line chart as a polyline rather than as bars', () => {
    const out = marks(TABLE, 'line');
    expect(out.some((m) => m.t === 'poly')).toBe(true);
    // The only rects left are the legend swatches.
    expect(out.filter((m) => m.t === 'rect')).toHaveLength(2);
  });

  it('draws a pie as wedges, and only from the first series', () => {
    const out = marks(TABLE, 'pie');
    const paths = out.filter((m) => m.t === 'path');
    // Two categories in the table, so two wedges — not four.
    expect(paths).toHaveLength(2);
  });

  it('turns a bar chart on its side rather than drawing the same picture', () => {
    /*
     * One series on purpose. With two there is a legend, and its swatches are
     * rects too — square ones, which land in the same set as the bars and made
     * the first version of this read two heights where it meant one. The
     * assertion was right and the sample was wrong.
     */
    const one = 'Week\tMarks\n1\t70\n2\t80\n3\t65';
    const column = marks(one, 'column').filter((m) => m.t === 'rect');
    const bar = marks(one, 'bar').filter((m) => m.t === 'rect');
    expect(column).toHaveLength(3);
    expect(bar).toHaveLength(3);

    // A column's bars share a width and differ in height; a bar chart's the
    // other way round. Comparing both sets is what catches a copied branch.
    const sizes = (ms: typeof column) => ({
      w: new Set(ms.map((m) => (m.t === 'rect' ? Math.round(m.w) : 0))).size,
      h: new Set(ms.map((m) => (m.t === 'rect' ? Math.round(m.h) : 0))).size,
    });
    expect(sizes(column)).toEqual({ w: 1, h: 3 });
    expect(sizes(bar)).toEqual({ w: 3, h: 1 });
  });

  it('draws nothing rather than overflowing when the box is too small to hold one', () => {
    expect(chartShapes(readTable(TABLE), 'column', { x: 0, y: 0, w: 4, h: 4 }, '#101418')).toEqual([]);
  });
});
