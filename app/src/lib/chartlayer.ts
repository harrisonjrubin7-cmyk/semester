import { MAX_SERIES, baselineFor, bands, scaleFor, slices, wedge, axisText, type ChartKind, type ChartRead } from './chart';
import type { DesignLayer } from './creations';

/**
 * A chart as a layer on a design, drawn from a table somebody pasted.
 *
 * ## Nothing here draws a chart twice
 *
 * `lib/chart.ts` is this app's chart engine and it already knows how to pick an
 * axis, step it, band a category, cut a pie and say when a legend is owed.
 * None of that is repeated below: this module turns a *pasted table* into the
 * `ChartRead` that engine consumes, and turns the engine's answers into flat
 * shapes the canvas and the exporter can each draw in their own way.
 *
 * `components/SheetChart.tsx` is the other caller. It reads a spreadsheet; this
 * reads text. They share every decision that is about charts and none that is
 * about where the numbers came from.
 *
 * ## Why the data is text, and lives in `text`
 *
 * A chart layer holds its table in the `text` field every layer already has,
 * as tab- or comma-separated rows. Three things follow, and all three are the
 * reason:
 *
 * - **Pasting a block out of a spreadsheet just works.** That is how the
 *   numbers get onto a poster at eleven at night, and it needs no import
 *   dialog, no file picker and no column mapping.
 * - **The reader already validates it.** `text` is checked for length like any
 *   other layer's; a nested `{labels, series}` object would need a new and
 *   deeper validator, and a malformed one is a project the app could save and
 *   then refuse to reopen.
 * - **The design stays self-contained.** A chart bound to a Semester
 *   spreadsheet by id would break the moment the design was exported and
 *   opened somewhere that sheet is not — the same trap `lib/files.ts` already
 *   documents for pictures, and the one thing a poster cannot afford.
 *
 * The 2,000-character cap on `text` caps the table, which is the right size:
 * past a couple of dozen rows a chart on a poster is a smear anyway.
 *
 * ## The colours are fixed, and that is the divergence worth naming
 *
 * Everywhere else in this app, series colours are hues spread around the
 * reader's own accent — a chart on Parchment and the same chart on Ink are one
 * family each. That is right for a screen and wrong here, for two reasons: a
 * design layer is *artwork*, and a poster exported to PNG last week must not
 * change because somebody moved their accent this week; and an export is a
 * standalone file, so every colour in it has to be a literal rather than a
 * token resolved out of the app's stylesheet.
 *
 * So the palette below is fixed, concrete and validated rather than chosen by
 * eye — eight slots, assigned in order and never cycled, which is also why the
 * engine's own `MAX_SERIES` of eight is the cap here rather than a coincidence.
 */

/**
 * The eight series colours, in assignment order.
 *
 * Validated rather than picked: all eight sit inside the lightness band, clear
 * the chroma floor, and keep every adjacent pair separable under simulated
 * colour-blindness (worst adjacent ΔE 9.1 protan, against a ≥8 target) and
 * under normal vision (worst adjacent ΔE 19.6, against a ≥15 floor).
 *
 * Three of them fall under 3:1 against a light ground, which is not
 * dismissable: it is why {@link chartShapes} always draws a legend for more
 * than one series rather than leaving identity to colour alone.
 */
export const SERIES_COLOURS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#9d5c0d',
] as const;

/** Slot `i`, assigned in order and never cycled past the eighth. */
export const seriesColour = (i: number): string => SERIES_COLOURS[i] ?? SERIES_COLOURS[SERIES_COLOURS.length - 1]!;

/**
 * A pasted table as the engine's `ChartRead`.
 *
 * Splits on tabs when the first line has one and on commas otherwise, which is
 * the difference between a block copied out of a spreadsheet and a line typed
 * by hand. Sniffed per table rather than settled by a setting, because nobody
 * pasting a column of marks wants to answer a question about delimiters first.
 *
 * The first row names the series and the first column names the categories —
 * always, rather than by a pair of switches as the sheet chart has them. A
 * pasted block has no surrounding grid to disagree with, and two more toggles
 * on a design panel buys less than it costs.
 *
 * A cell that is not a number becomes `null` rather than zero. Zero is a
 * value and would be drawn as one; a gap is a gap, and every drawing below
 * skips it.
 */
export function readTable(text: string): ChartRead {
  const empty: ChartRead = {
    labels: [],
    series: [],
    trouble: '',
    dropped: [],
    at: { firstRow: 0, lastRow: 0, headerRow: null, labelColumn: null },
    beyond: [],
  };

  const lines = text
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { ...empty, trouble: 'Paste a table: a row of names, then a row per category.' };
  }

  const tabbed = lines[0]!.includes('\t');
  const cut = (line: string) => line.split(tabbed ? '\t' : ',').map((c) => c.trim());

  const head = cut(lines[0]!);
  if (head.length < 2) {
    return { ...empty, trouble: 'Each row needs at least two columns — a name, then a number.' };
  }

  const names = head.slice(1);
  const labels: string[] = [];
  const columns: (number | null)[][] = names.map(() => []);

  for (const line of lines.slice(1)) {
    const cells = cut(line);
    labels.push(cells[0] ?? '');
    names.forEach((_, i) => {
      const raw = (cells[i + 1] ?? '').replace(/[,£$€%\s]/g, '');
      const n = raw === '' ? Number.NaN : Number(raw);
      columns[i]!.push(Number.isFinite(n) ? n : null);
    });
  }

  // Past the eighth is not a generated colour. Held back and named, so the
  // screen can say what is missing rather than quietly drawing seven of nine.
  const beyond = names.slice(MAX_SERIES);

  const series = names.slice(0, MAX_SERIES).map((name, i) => ({ name, values: columns[i]!, column: i + 1 }));
  const anyNumber = series.some((s) => s.values.some((v) => v !== null));
  if (!anyNumber) {
    return { ...empty, trouble: 'No numbers found under those headings.' };
  }

  return {
    labels,
    series,
    trouble: '',
    dropped: [],
    at: { firstRow: 1, lastRow: labels.length, headerRow: 0, labelColumn: 0 },
    beyond,
  };
}

/** One thing to draw. Deliberately dumb — see {@link chartShapes}. */
export type Mark =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }
  | { t: 'poly'; points: string; stroke: string; width: number }
  | { t: 'path'; d: string; fill: string }
  | { t: 'text'; x: number; y: number; s: string; fill: string; size: number; anchor: 'start' | 'middle' | 'end' };

/** The box a chart is drawn into, in canvas units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A chart as a flat list of things to draw.
 *
 * Flat, and that is the point: the editor's canvas renders these as JSX and
 * `designSvg` renders them as a string, so the two cannot drift into drawing
 * different charts from the same numbers. It is the same trick
 * `trianglePoints` and `gradientEnds` already use, one size up.
 *
 * `ink` is the layer's own colour, and every word here is drawn in it —
 * category names, axis numbers, legend labels. Text never wears a series
 * colour: the swatch beside a name carries identity, and a label that *is* the
 * series colour is a label that fails the moment two series are close in hue,
 * or the reader cannot separate them at all.
 */
export function chartShapes(read: ChartRead, kind: ChartKind, box: Box, ink: string): Mark[] {
  if (read.trouble || read.labels.length === 0) return [];

  const marks: Mark[] = [];
  const type = Math.max(8, Math.min(28, box.h * 0.045));
  const legendH = read.series.length > 1 || kind === 'pie' ? type * 1.9 : 0;

  /* ── Pie ─────────────────────────────────────────────────────────────── */
  if (kind === 'pie') {
    const cut = slices(read.labels, read.series[0]?.values ?? []);
    const r = Math.min(box.w, box.h - legendH) / 2 - type * 0.3;
    const cx = box.x + box.w / 2;
    const cy = box.y + (box.h - legendH) / 2;
    if (r <= 0) return [];
    for (const [i, s] of cut.entries()) {
      marks.push({ t: 'path', d: wedge(cx, cy, r, s.from, s.to), fill: seriesColour(i) });
    }
    legend(marks, cut.map((s) => s.label), box, legendH, type, ink, (i) => seriesColour(i));
    return marks;
  }

  /* ── Axes ────────────────────────────────────────────────────────────── */
  const flat = read.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const scale = scaleFor(flat, baselineFor(kind));
  const span = scale.max - scale.min || 1;

  // Room for the axis numbers, which are along the left for a column or line
  // chart and along the bottom for a bar chart — a bar chart is a column chart
  // on its side, and its category names are the ones that need the width.
  const gutter = kind === 'bar' ? box.w * 0.28 : type * 2.6;
  const footer = type * 1.8;
  /*
   * Room at the top for the highest axis number.
   *
   * Its baseline sits on the top gridline, so without this the glyph is drawn
   * *above* the layer's box and is clipped by whatever is behind it — which is
   * exactly what the first screenshot of this showed, a "30" sliced in half on
   * the box edge. Nothing in the tests saw it: they measured the bars.
   */
  const headroom = type * 0.7;
  const plot: Box = {
    x: box.x + (kind === 'bar' ? gutter : type * 2.6),
    y: box.y + headroom,
    w: box.w - (kind === 'bar' ? gutter : type * 2.6),
    h: box.h - footer - legendH - headroom,
  };
  if (plot.w <= 0 || plot.h <= 0) return [];

  const at = (v: number) => (v - scale.min) / span;

  if (kind === 'bar') {
    // Ticks run along the bottom; categories down the left.
    for (const t of scale.ticks) {
      const x = plot.x + at(t) * plot.w;
      marks.push({ t: 'line', x1: x, y1: plot.y, x2: x, y2: plot.y + plot.h, stroke: ink, width: Math.max(0.5, type * 0.04) });
      marks.push({ t: 'text', x, y: plot.y + plot.h + type * 1.2, s: axisText(t), fill: ink, size: type * 0.8, anchor: 'middle' });
    }
    const band = bands(plot.h, read.labels.length, read.series.length);
    read.labels.forEach((label, c) => {
      marks.push({
        t: 'text',
        x: plot.x - type * 0.4,
        y: plot.y + band.band * c + band.band / 2 + type * 0.3,
        s: label,
        fill: ink,
        size: type * 0.8,
        anchor: 'end',
      });
      read.series.forEach((s, si) => {
        const v = s.values[c];
        if (v === null || v === undefined) return;
        const zero = plot.x + at(Math.max(scale.min, Math.min(0, scale.max))) * plot.w;
        const end = plot.x + at(v) * plot.w;
        marks.push({
          t: 'rect',
          x: Math.min(zero, end),
          y: plot.y + band.band * c + band.offset(si),
          w: Math.abs(end - zero),
          h: band.width,
          fill: seriesColour(si),
        });
      });
    });
  } else {
    for (const t of scale.ticks) {
      const y = plot.y + plot.h - at(t) * plot.h;
      marks.push({ t: 'line', x1: plot.x, y1: y, x2: plot.x + plot.w, y2: y, stroke: ink, width: Math.max(0.5, type * 0.04) });
      marks.push({ t: 'text', x: plot.x - type * 0.4, y: y + type * 0.3, s: axisText(t), fill: ink, size: type * 0.8, anchor: 'end' });
    }

    const band = bands(plot.w, read.labels.length, read.series.length);
    read.labels.forEach((label, c) => {
      marks.push({
        t: 'text',
        x: plot.x + band.band * c + band.band / 2,
        y: plot.y + plot.h + type * 1.2,
        s: label,
        fill: ink,
        size: type * 0.8,
        anchor: 'middle',
      });
    });

    if (kind === 'line') {
      read.series.forEach((s, si) => {
        const points = s.values
          .map((v, c) =>
            v === null || v === undefined
              ? ''
              : `${plot.x + band.band * c + band.band / 2},${plot.y + plot.h - at(v) * plot.h}`,
          )
          .filter(Boolean)
          .join(' ');
        if (points) marks.push({ t: 'poly', points, stroke: seriesColour(si), width: Math.max(1.5, type * 0.16) });
      });
    } else {
      read.labels.forEach((_, c) => {
        read.series.forEach((s, si) => {
          const v = s.values[c];
          if (v === null || v === undefined) return;
          const zero = plot.y + plot.h - at(Math.max(scale.min, Math.min(0, scale.max))) * plot.h;
          const end = plot.y + plot.h - at(v) * plot.h;
          marks.push({
            t: 'rect',
            x: plot.x + band.band * c + band.offset(si),
            y: Math.min(zero, end),
            w: band.width,
            h: Math.abs(end - zero),
            fill: seriesColour(si),
          });
        });
      });
    }
  }

  if (legendH) legend(marks, read.series.map((s) => s.name), box, legendH, type, ink, (i) => seriesColour(i));
  return marks;
}

/**
 * The legend, in SVG rather than in HTML beside the drawing.
 *
 * `components/SheetChart.tsx` puts its legend in HTML for a good reason — SVG
 * text does not wrap and does not take the app's type scale. That reason does
 * not survive here: this chart is exported to a standalone `.svg` and
 * rasterised to a `.png`, and an HTML legend would simply not be in the file.
 * A poster whose key vanished on export is worse than one whose key is a
 * single unwrapped line.
 *
 * It is drawn for every chart with more than one series and for every pie,
 * without exception — three of the eight series colours fall under 3:1 against
 * a light ground, and a chart that left identity to colour alone would be one
 * some readers cannot read at all.
 */
function legend(
  marks: Mark[],
  names: string[],
  box: Box,
  height: number,
  type: number,
  ink: string,
  colour: (i: number) => string,
): void {
  if (names.length < 2) return;
  const swatch = type * 0.7;
  const each = box.w / names.length;
  const y = box.y + box.h - height + type * 0.6;
  names.forEach((name, i) => {
    const x = box.x + each * i;
    marks.push({ t: 'rect', x, y, w: swatch, h: swatch, fill: colour(i) });
    marks.push({
      t: 'text',
      x: x + swatch * 1.4,
      y: y + swatch * 0.85,
      s: name,
      fill: ink,
      size: type * 0.8,
      anchor: 'start',
    });
  });
}

/** The box a chart layer draws into. Its own, so both renderers agree. */
export const chartBox = (l: Pick<DesignLayer, 'x' | 'y' | 'w' | 'h'>): Box => ({ x: l.x, y: l.y, w: l.w, h: l.h });
