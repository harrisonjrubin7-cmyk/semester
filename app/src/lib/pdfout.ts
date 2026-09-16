/**
 * The document laid onto pages, and the pages written out as a PDF file.
 *
 * `lib/pdf.ts` is the measuring half — how wide a string is, where a line
 * breaks. This is the half that decides what goes where and then turns it
 * into the objects a PDF is made of.
 *
 * ## One pass, because a PDF has no idea what a page break is
 *
 * Blocks become *drawings* — a line of text at a point, a rule, a rectangle —
 * and the list is cut into pages as it is built: when the next line would
 * fall below the bottom margin, the page ends. Nothing reflows afterwards,
 * which is what makes the file identical on every machine. That determinism
 * is the whole reason this exists beside the browser's print dialog.
 *
 * Every placement goes through `spend`, which is the only thing that knows
 * where the pen is. A block that measured its own height and moved the pen
 * itself is how a table ends up half on one page and half on the next.
 *
 * ## What it cannot carry
 *
 * An equation, as an equation. The app holds LaTeX, and turning that into
 * placed glyphs is a typesetting engine: no fraction bar is drawn, no limit
 * sits over a sum. What comes out is `lib/maths.ts`'s Unicode rendering of the
 * same notation — `(a+b)/(c²)`, not `\\frac{a+b}{c^2}`. That is a reading of
 * the formula rather than a picture of it, and it is what the `.docx` beside
 * it has always had in its own way.
 *
 * A picture does come, and did not until `lib/exportqa.ts` pointed out that
 * the `.docx` of the same document had one. Its bytes are in IndexedDB and
 * this is a pure function of the document, so they are handed in — the same
 * split `parts()` keeps in `lib/docx.ts` — and `lib/pdfimage.ts` turns them
 * into a stream without decoding anything. Where they are not handed in, or
 * where that file refuses the format, the alt text prints as before: visibly
 * not here rather than silently missing. Notes in the margin never print,
 * which is the rule `Paper` already keeps.
 */

import { layoutOf, type Layout } from './doclayout';
import { figureTable, listed, type Block, type Doc } from './document';
import { parse, plain } from './maths';
import {
  PER_INCH,
  fontFor,
  frameOf,
  literal,
  piecesOf,
  widthOf,
  wrap,
  type Frame,
  type Piece,
  type Placed,
} from './pdf';
import { encode, type Encoded } from './pdfimage';
import { PS_NAME, type StandardFont } from './pdfwidths.data';

/** One thing drawn on a page, in PDF coordinates — y counts up from the foot. */
export type Drawing =
  | { at: 'text'; x: number; y: number; pieces: Piece[]; extra: number }
  | { at: 'rule'; x: number; y: number; width: number; weight: number }
  | { at: 'box'; x: number; y: number; width: number; height: number }
  /** A picture, by the file id the document names it with. */
  | { at: 'picture'; x: number; y: number; width: number; height: number; id: string };

/**
 * A picture's bytes, looked up by the id the block carries.
 *
 * The same shape `lib/docx.ts` takes, and for the same reason: a picture lives
 * in IndexedDB, and laying a document out is a pure function of the document.
 * Whoever is exporting fetches the bytes first and hands them in — or does
 * not, and the picture prints as its alt text, exactly as it always did.
 */
export type Pictures = (fileId: string) => { bytes: Uint8Array } | undefined;

/**
 * How wide a picture may be drawn, as a share of the text column.
 *
 * The whole column, and no wider: `lib/docx.ts` makes the same choice in
 * inches for the same reason — a picture that overruns the margin is drawn
 * exactly as told, off the edge of the paper.
 */
const PICTURE_WIDTH = 1;

/** And no taller than this much of the page, so one never needs two. */
const PICTURE_HEIGHT = 0.8;

export interface Link {
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
}

export interface Page {
  drawings: Drawing[];
  links: Link[];
}

/** How much bigger a heading is than the body, by level. */
const HEADING_SCALE = [1.55, 1.3, 1.12];

/** Half an inch a level, the step Word's own lists use. */
const INDENT = 0.5 * PER_INCH;

/** The marker a list line carries, cycling the way Word's own lists do. */
const BULLETS = ['•', '○', '▪', '•', '○'];

interface Options {
  indent?: number;
  /** Keep the spaces at the start of a line — code, and only code. */
  keepLeading?: boolean;
  align?: string;
  leading?: number;
  after?: number;
  hanging?: string;
  bold?: boolean;
  italic?: boolean;
}

/** A point in the page, for taking back what was drawn after it. */
interface Mark {
  page: number;
  from: number;
  links: number;
  y: number;
}

/**
 * The pen: where it is, what page it is on, and the only ways to move it.
 */
class Pen {
  readonly frame: Frame;
  readonly layout: Layout;
  readonly pages: Page[] = [];
  private page: Page = { drawings: [], links: [] };
  private y: number;
  /** A heading just drawn, waiting for something to fit under it. */
  private held: Mark | null = null;

  constructor(layout: Layout) {
    this.layout = layout;
    this.frame = frameOf(layout);
    this.y = this.frame.height - this.frame.margin;
  }

  /**
   * Reserve vertical space and return the top of it.
   *
   * Turns the page first when what is asked for will not fit — so a table row
   * asks for its whole height at once and is never cut in half, which is the
   * thing that makes a printed table unreadable.
   *
   * `withNext` is space that must fit too but is not taken: what the caller
   * is about to place *under* this and will not be parted from. A heading
   * keeps two lines of what it heads, and a table's header row keeps its
   * first real row — because a heading alone at the foot of a page, or a
   * `Question | Answer` strip with nothing under it, is a page break put in
   * the one place a reader reads as a mistake. It is only ever a request:
   * asking for more than a whole page turns one page and then places anyway,
   * which is right, since nothing would ever fit.
   */
  spend(height: number, withNext = 0): number {
    /* Whatever is about to be placed goes under the held heading, so the
       heading is no longer alone whether or not the page turns. */
    const held = this.held;
    this.held = null;
    const wanted = height + withNext;
    // `held.from` is how much was on the page before the heading: if it is
    // zero the heading is already at the top of a fresh page, and carrying it
    // to another one would only leave that page blank as well.
    const room = held ? held.from > 0 : this.page.drawings.length > 0;
    if (this.y - wanted < this.frame.margin && room) {
      if (held) this.carry(held);
      else this.turn();
    }
    const top = this.y;
    this.y -= height;
    return top;
  }

  /**
   * Whether something of this height would fit without turning the page.
   *
   * The same question `spend` asks itself, asked out loud. A table's rows need
   * the answer *before* the turn happens, so that a repeated header can be
   * drawn at the top of the new page ahead of the row that caused it.
   */
  fits(height: number): boolean {
    return this.y - height >= this.frame.margin || this.page.drawings.length === 0;
  }

  gap(points: number) {
    this.y -= points;
  }

  /** Where the page stands, so what is drawn next can be taken back. */
  mark(): Mark {
    return { page: this.pages.length, from: this.page.drawings.length, links: this.page.links.length, y: this.y };
  }

  /**
   * Everything drawn since `mark` is a heading, and must not stand alone.
   *
   * Word calls this *keep with next*, and it is the rule that stops a page
   * ending on a section title with its first line overleaf. It is armed after
   * the heading is drawn rather than reserved before it, because reserving
   * means guessing how tall the thing under it will be — two lines of prose
   * and a table's first row are not the same guess, and a study guide is
   * headings over tables the whole way down, which is where the guess was
   * wrong and this is not.
   *
   * It disarms on the next `spend`: once one line has fitted under it the
   * heading is not alone, and the rest of a paragraph breaking across the
   * page is what every document does.
   */
  hold(mark: Mark) {
    this.held = mark.page === this.pages.length ? mark : null;
  }

  /** Turn the page, taking the held heading across with it. */
  private carry(held: Mark) {
    const used = held.y - this.y;
    const drawings = this.page.drawings.splice(held.from);
    const links = this.page.links.splice(held.links);
    this.turn();
    const shift = this.y - held.y;
    for (const d of drawings) this.page.drawings.push({ ...d, y: d.y + shift });
    for (const l of links) this.page.links.push({ ...l, y: l.y + shift });
    this.y -= used;
  }

  turn() {
    this.held = null;
    this.pages.push(this.page);
    this.page = { drawings: [], links: [] };
    this.y = this.frame.height - this.frame.margin;
  }

  draw(drawing: Drawing) {
    this.page.drawings.push(drawing);
  }

  link(link: Link) {
    this.page.links.push(link);
  }

  drawn(): boolean {
    return this.page.drawings.length > 0;
  }

  finish(): Page[] {
    this.pages.push(this.page);
    return this.pages;
  }
}

function countSpaces(line: Placed): number {
  return line.pieces.reduce((n, p) => n + (p.text.match(/ /g)?.length ?? 0), 0);
}

/**
 * One wrapped paragraph, placed.
 *
 * `align` moves each line inside the column; `justify` stretches the spaces
 * of every line but the last, which is what justification is — and the last
 * line is what gives it away when it is done wrong.
 */
function paragraph(pen: Pen, base: { font: string; size: number }, pieces: Piece[], opts: Options = {}) {
  const indent = opts.indent ?? 0;
  const width = pen.frame.column - indent;
  const shaped =
    opts.bold || opts.italic
      ? pieces.map((p) => ({
          ...p,
          font: fontFor(base.font, opts.bold ?? false, opts.italic ?? false, p.font === 'courier'),
        }))
      : pieces;
  const lines = wrap(shaped, width, opts.keepLeading);
  const leading = opts.leading ?? pen.frame.leading;

  lines.forEach((line, i) => {
    const top = pen.spend(leading);
    const baseline = top - leading * 0.8;
    const left = pen.frame.margin + indent;
    let x = left;
    if (opts.align === 'center') x = left + (width - line.width) / 2;
    if (opts.align === 'right') x = left + (width - line.width);
    const spaces = countSpaces(line);
    const extra =
      opts.align === 'justify' && i < lines.length - 1 && spaces > 0
        ? (width - line.width) / spaces
        : 0;

    if (i === 0 && opts.hanging) {
      const font = fontFor(base.font, false, false, false);
      pen.draw({
        at: 'text',
        x: left - widthOf(`${opts.hanging}  `, font, base.size),
        y: baseline,
        pieces: [{ text: opts.hanging, font, size: base.size, link: '', strike: false }],
        extra: 0,
      });
    }
    pen.draw({ at: 'text', x, y: baseline, pieces: line.pieces, extra });

    let at = x;
    for (const piece of line.pieces) {
      const w =
        widthOf(piece.text, piece.font, piece.size) + extra * (piece.text.match(/ /g)?.length ?? 0);
      if (piece.link) {
        pen.link({
          x: at,
          y: baseline - piece.size * 0.22,
          width: w,
          height: piece.size * 1.15,
          href: piece.link,
        });
      }
      at += w;
    }
  });

  if (opts.after) pen.gap(opts.after);
}

function marker(level: number, numbered: boolean, counts: number[]): string {
  if (!numbered) return BULLETS[level] ?? '•';
  const n = counts[level];
  if (level % 3 === 1) return `${String.fromCharCode(96 + ((n - 1) % 26) + 1)}.`;
  if (level % 3 === 2) return `${roman(n)}.`;
  return `${n}.`;
}

function roman(n: number): string {
  const parts: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
    [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let left = n;
  let out = '';
  for (const [value, numeral] of parts) {
    while (left >= value) {
      out += numeral;
      left -= value;
    }
  }
  return out;
}

/**
 * A table, drawn as rectangles and strings placed inside them.
 *
 * A PDF has no table. The row height therefore has to be known before the row
 * is drawn, so every cell is wrapped first and the tallest decides — and the
 * whole row is spent at once so a page break cannot fall inside it.
 */
function table(pen: Pen, base: { font: string; size: number }, block: Extract<Block, { kind: 'table' }>) {
  const width = block.rows.reduce((n, r) => Math.max(n, r.length), 0);
  if (width === 0) return;
  const cell = pen.frame.column / width;
  const pad = 4;
  const size = pen.layout.size * 0.92;
  const leading = size * 1.25;

  /*
   * Every row wrapped before any of it is drawn.
   *
   * Because the header row has to know how tall the row under it is: it is
   * spent with that height held back, so a `Question | Answer` strip is never
   * left alone at the foot of a page with its first answer overleaf. Nothing
   * else here needs the second pass — it is the price of that one question.
   */
  const measured = block.rows.map((row, r) => {
    const heading = block.header && r === 0;
    const wrapped = Array.from({ length: width }, (_, c) =>
      wrap(
        piecesOf(row[c] ?? '', { ...base, size }).map((p) => ({
          ...p,
          font: fontFor(base.font, heading || /Bold/.test(p.font), false, p.font === 'courier'),
        })),
        cell - pad * 2,
      ),
    );
    return {
      wrapped,
      height: Math.max(leading, ...wrapped.map((lines) => lines.length * leading)) + pad * 2,
    };
  });

  /** One measured row, drawn at the top the pen just gave out. */
  const place = (row: (typeof measured)[number], top: number) => {
    for (let c = 0; c < width; c += 1) {
      const x = pen.frame.margin + cell * c;
      pen.draw({ at: 'box', x, y: top - row.height, width: cell, height: row.height });
      row.wrapped[c].forEach((line, i) => {
        pen.draw({
          at: 'text',
          x: x + pad,
          y: top - pad - leading * (i + 0.8),
          pieces: line.pieces,
          extra: 0,
        });
      });
    }
  };

  const head = block.header ? measured[0] : null;
  for (const [r, row] of measured.entries()) {
    /*
     * The header row again at the top of every page the table runs on to.
     *
     * `lib/docx.ts` sets `w:tblHeader` and Word repeats the row for free, so
     * the same table exported both ways had its `Term | Definition` strip on
     * every page in Word and on page one only in the PDF. Three pages of
     * unlabelled cells is not a rendering difference; it is the table not
     * being readable.
     *
     * The turn is taken here rather than left to `spend`, because the header
     * has to be drawn on the new page *before* the row that caused the turn
     * — and by the time `spend` has turned, the pen is past the place the
     * header would go.
     */
    if (head && r > 0 && !pen.fits(row.height)) {
      pen.turn();
      place(head, pen.spend(head.height));
    }
    place(row, pen.spend(row.height, block.header && r === 0 ? (measured[1]?.height ?? 0) : 0));
  }

  // The caption, which the `.docx` has written in Word's own Caption style
  // since tables existed here and this side wrote nowhere at all.
  if (block.caption.trim()) {
    pen.gap(pen.layout.size * 0.2);
    paragraph(pen, base, piecesOf(block.caption, { ...base, size: pen.layout.size * 0.9 }), {
      align: 'center',
      italic: true,
    });
  }
  pen.gap(pen.layout.size * 0.4);
}

function block(pen: Pen, base: { font: string; size: number }, b: Block, pictures?: Pictures) {
  const { layout } = pen;
  switch (b.kind) {
    case 'heading': {
      const size = layout.size * HEADING_SCALE[b.level - 1];
      pen.gap(layout.size * 0.4);
      const before = pen.mark();
      paragraph(pen, base, piecesOf(b.text, { ...base, size }), {
        align: b.align,
        bold: true,
        leading: size * 1.25,
        after: layout.size * 0.2,
      });
      pen.hold(before);
      return;
    }
    case 'text':
      paragraph(pen, base, piecesOf(b.text, base), { align: b.align, after: layout.size * 0.35 });
      return;
    case 'bullets': {
      const counts: number[] = [];
      for (const line of listed(b.items)) {
        if (!line.text.trim()) continue;
        counts.length = line.level + 1;
        counts[line.level] = (counts[line.level] ?? 0) + 1;
        paragraph(pen, base, piecesOf(line.text, base), {
          indent: INDENT * (line.level + 1),
          hanging: marker(line.level, b.numbered, counts),
        });
      }
      pen.gap(layout.size * 0.35);
      return;
    }
    case 'checks': {
      for (const item of b.items) {
        if (!item.text.trim()) continue;
        paragraph(pen, base, piecesOf(item.text, base), {
          indent: INDENT,
          hanging: item.done ? '☒' : '☐',
        });
      }
      pen.gap(layout.size * 0.35);
      return;
    }
    case 'quote': {
      paragraph(pen, base, piecesOf(b.text, base), { indent: INDENT, align: b.align });
      if (b.source.trim()) {
        paragraph(
          pen,
          base,
          piecesOf(`— ${b.source}`, { ...base, size: layout.size * 0.92 }),
          { indent: INDENT, align: b.align, italic: true },
        );
      }
      pen.gap(layout.size * 0.4);
      return;
    }
    case 'code': {
      const size = layout.size * 0.9;
      for (const line of b.text.split('\n')) {
        paragraph(
          pen,
          base,
          [{ text: line || ' ', font: 'courier', size, link: '', strike: false }],
          { indent: INDENT * 0.5, leading: size * 1.3, keepLeading: true },
        );
      }
      pen.gap(layout.size * 0.4);
      return;
    }
    case 'table':
      table(pen, base, b);
      return;
    /*
     * An equation, as notation rather than as the source somebody typed.
     *
     * This drew `b.latex`. A `.docx` of the same document gets
     * `omml(parse(...))` and therefore a real Word equation object, so one
     * export read `(a+b)/(c²)` and the other read `\\frac{a+b}{c^2}` — the
     * second being a thing a reader has to already know LaTeX to read, in the
     * file that goes to the submission portal.
     *
     * `lib/maths.ts` has rendered the notation in Unicode for everywhere that
     * is neither a screen nor Word since it was written. It was never wired to
     * this one. Found by `lib/exportqa.ts` comparing the two exports of one
     * document, which is what that file is for.
     */
    case 'equation': {
      const said = b.latex.trim() ? plain(parse(b.latex)) : '';
      paragraph(
        pen,
        base,
        [{ text: said, font: 'courier', size: layout.size * 0.9, link: '', strike: false }],
        { align: 'center' },
      );
      if (b.caption.trim()) {
        paragraph(pen, base, piecesOf(b.caption, { ...base, size: layout.size * 0.9 }), {
          align: 'center',
          italic: true,
        });
      }
      pen.gap(layout.size * 0.4);
      return;
    }
    /*
     * A picture, drawn where one was added.
     *
     * This printed `[Alt text]` in italics and nothing else, while
     * `lib/docx.ts` embedded the real thing — the fifth and last of the
     * differences `lib/exportqa.ts` found between the two exports of one
     * document, and the reason a figure was in the Word file and not in the
     * PDF that went to the portal.
     *
     * The italic line is still here and is still the right answer twice over:
     * when the caller handed in no bytes (laying out is a pure function of the
     * document, so somebody has to fetch them), and when `lib/pdfimage.ts`
     * refuses the format — a PNG with an alpha channel, most often. Visibly
     * not here beats silently wrong.
     */
    case 'image': {
      const held = b.fileId ? pictures?.(b.fileId) : undefined;
      const picture = held ? encode(held.bytes) : null;
      if (picture) {
        const wide = Math.min(
          pen.frame.column * PICTURE_WIDTH,
          (picture.width * PER_INCH) / 96,
        );
        const room = (pen.frame.height - pen.frame.margin * 2) * PICTURE_HEIGHT;
        const scale = Math.min(wide / picture.width, room / picture.height);
        const width = picture.width * scale;
        const height = picture.height * scale;
        pen.gap(layout.size * 0.3);
        const top = pen.spend(height);
        pen.draw({
          at: 'picture',
          x: pen.frame.margin + (pen.frame.column - width) / 2,
          y: top - height,
          width,
          height,
          id: b.fileId,
        });
        if (b.caption.trim()) {
          paragraph(pen, base, piecesOf(b.caption, { ...base, size: layout.size * 0.9 }), {
            align: 'center',
            italic: true,
          });
        }
        pen.gap(layout.size * 0.3);
        return;
      }
      const said = `[${b.alt.trim() || 'Picture'}]${b.caption.trim() ? ` ${b.caption}` : ''}`;
      paragraph(pen, base, piecesOf(said, { ...base, size: layout.size * 0.9 }), {
        align: 'center',
        italic: true,
        after: layout.size * 0.3,
      });
      return;
    }
    case 'toc': {
      const size = layout.size * HEADING_SCALE[0];
      paragraph(pen, base, piecesOf(b.title || 'Contents', { ...base, size }), {
        bold: true,
        leading: size * 1.25,
        after: layout.size * 0.3,
      });
      return;
    }
    case 'rule': {
      pen.gap(pen.frame.leading * 0.4);
      const top = pen.spend(pen.frame.leading * 0.6);
      pen.draw({
        at: 'rule',
        x: pen.frame.margin,
        y: top - pen.frame.leading * 0.3,
        width: pen.frame.column,
        weight: 0.75,
      });
      return;
    }
    case 'break':
      if (pen.drawn()) pen.turn();
      return;
    /*
     * One of the app's own figures.
     *
     * Through `figureTable` and then through the same `table` above, which is
     * how a figure long enough to cross a page gets the repeated header row
     * without this writing it a second time — and, more to the point, how
     * this and `lib/docx.ts` are stopped from drifting apart on a figure the
     * way they had on an equation. Both call the one reduction.
     */
    case 'figure': {
      const figure = b.figure;
      const small = { ...base, size: layout.size * 0.9 };
      if (figure.title.trim()) {
        paragraph(pen, base, piecesOf(figure.title, small), { align: 'center', italic: true });
      }
      if (figure.type === 'image') {
        block(pen, base, { kind: 'image', fileId: figure.fileId, name: figure.title, alt: figure.title, caption: '' }, pictures);
      } else {
        const made = figureTable(figure);
        if (made) table(pen, base, { kind: 'table', rows: made.rows, header: true, caption: '' });
      }
      if (figure.caption.trim()) {
        paragraph(pen, base, piecesOf(figure.caption, small), { align: 'center', italic: true });
      }
      pen.gap(layout.size * 0.3);
      return;
    }
  }
  /*
   * Every kind, asserted rather than assumed.
   *
   * This function returns nothing, so a kind with no case above falls out of
   * the switch and draws *nothing at all* — in a file whose whole job is to
   * be what the document says. `lib/docx.ts` and `lib/find.ts` both fail the
   * typecheck on a new kind because both return a value; this one could not,
   * and the `figure` block was added to all three at once only because the
   * other two complained.
   */
  const missed: never = b;
  void missed;
}

/**
 * The document, laid out.
 *
 * Exported so the tests can ask where things landed rather than re-parsing a
 * PDF with a parser they would then be trusting instead of the writer.
 */
export function laid(doc: Doc, pictures?: Pictures): { pages: Page[]; frame: Frame; layout: Layout } {
  const layout = layoutOf(doc);
  const pen = new Pen(layout);
  const base = { font: layout.font, size: layout.size };

  if (doc.title.trim()) {
    paragraph(pen, base, piecesOf(doc.title, { ...base, size: layout.size * 1.7 }), {
      align: 'center',
      bold: true,
      leading: layout.size * 1.7 * 1.2,
      after: layout.size * 0.4,
    });
  }
  if (doc.subtitle.trim()) {
    paragraph(pen, base, piecesOf(doc.subtitle, { ...base, size: layout.size * 1.12 }), {
      align: 'center',
      italic: true,
      leading: layout.size * 1.12 * 1.3,
      after: layout.size * 0.6,
    });
  }
  if (layout.titlePage && doc.title.trim() && pen.drawn()) pen.turn();

  for (const b of doc.blocks) block(pen, base, b, pictures);

  const pages = pen.finish();
  runningHead(pages, pen.frame, layout);
  return { pages, frame: pen.frame, layout };
}

/**
 * The surname and the page number, in the top right of every page.
 *
 * Added after the pages are cut rather than while they are being filled, for
 * the obvious reason: "page 3 of 7" cannot be written until there are seven.
 */
function runningHead(pages: Page[], frame: Frame, layout: Layout) {
  if (!layout.numbers && !layout.runningHead.trim()) return;
  const font = fontFor(layout.font, false, false, false);
  const size = layout.size * 0.92;
  pages.forEach((page, i) => {
    const said = [layout.runningHead.trim(), layout.numbers ? String(i + 1) : '']
      .filter(Boolean)
      .join(' ');
    if (!said) return;
    page.drawings.push({
      at: 'text',
      x: frame.width - frame.margin - widthOf(said, font, size),
      y: frame.height - frame.margin * 0.55,
      pieces: [{ text: said, font, size, link: '', strike: false }],
      extra: 0,
    });
  });
}

// ── The file itself ───────────────────────────────────────────────────────

/** Latin-1, not UTF-8: every byte offset in the cross-reference depends on it. */
function bytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/** One page's drawing operators. */
function stream(page: Page, fonts: Map<StandardFont, string>, images: Map<string, string>): string {
  const out: string[] = [];
  for (const drawing of page.drawings) {
    if (drawing.at === 'picture') {
      const name = images.get(drawing.id);
      if (!name) continue;
      /*
       * A PDF image is always drawn into the unit square, so the matrix is the
       * size: `w 0 0 h x y cm` scales it and moves its bottom-left corner
       * there. `q`/`Q` are there because that matrix would otherwise stay in
       * force for everything drawn after it on this page.
       */
      out.push(
        `q ${round(drawing.width)} 0 0 ${round(drawing.height)} ` +
          `${round(drawing.x)} ${round(drawing.y)} cm /${name} Do Q`,
      );
      continue;
    }
    if (drawing.at === 'rule') {
      out.push(
        `${round(drawing.weight)} w ${round(drawing.x)} ${round(drawing.y)} m ` +
          `${round(drawing.x + drawing.width)} ${round(drawing.y)} l S`,
      );
      continue;
    }
    if (drawing.at === 'box') {
      out.push(
        `0.75 w ${round(drawing.x)} ${round(drawing.y)} ${round(drawing.width)} ` +
          `${round(drawing.height)} re S`,
      );
      continue;
    }
    let x = drawing.x;
    for (const piece of drawing.pieces) {
      const name = fonts.get(piece.font);
      const w =
        widthOf(piece.text, piece.font, piece.size) +
        drawing.extra * (piece.text.match(/ /g)?.length ?? 0);
      out.push(
        `BT /${name} ${round(piece.size)} Tf ${round(drawing.extra)} Tw ` +
          `${round(x)} ${round(drawing.y)} Td ${literal(piece.text)} Tj ET`,
      );
      if (piece.strike) {
        const middle = drawing.y + piece.size * 0.28;
        out.push(
          `0.6 w ${round(x)} ${round(middle)} m ${round(x + w)} ${round(middle)} l S`,
        );
      }
      if (piece.link) {
        const under = drawing.y - piece.size * 0.11;
        out.push(`0.6 w ${round(x)} ${round(under)} m ${round(x + w)} ${round(under)} l S`);
      }
      x += w;
    }
  }
  return out.join('\n');
}

/**
 * The file.
 *
 * Objects in order, then a cross-reference table of where each one starts —
 * which is why every string goes through `bytes` as Latin-1. Encode one of
 * them as UTF-8 and every offset after it is wrong by however many bytes the
 * accents took, and a reader rejects the file rather than showing it slightly
 * out of place.
 */
export function pdfBytes(doc: Doc, pictures?: Pictures): Uint8Array {
  const { pages, frame } = laid(doc, pictures);

  /*
   * Every picture on the pages, encoded once each.
   *
   * Once, not once per use: the same figure placed twice is one stream with
   * two references to it, which is what a PDF's resource dictionary is for and
   * the difference between a file and twice a file.
   */
  const drawn = new Map<string, Encoded>();
  for (const page of pages) {
    for (const drawing of page.drawings) {
      if (drawing.at !== 'picture' || drawn.has(drawing.id)) continue;
      const held = pictures?.(drawing.id);
      const encoded = held ? encode(held.bytes) : null;
      if (encoded) drawn.set(drawing.id, encoded);
    }
  }

  const used = new Map<StandardFont, string>();
  for (const page of pages) {
    for (const drawing of page.drawings) {
      if (drawing.at !== 'text') continue;
      for (const piece of drawing.pieces) {
        if (!used.has(piece.font)) used.set(piece.font, `F${used.size + 1}`);
      }
    }
  }
  if (used.size === 0) used.set('timesRoman', 'F1');

  /*
   * An object is markup, or markup wrapped round bytes.
   *
   * Every other object in this file is a string, written out as Latin-1, and
   * the first version of this said an image stream had to be kept apart
   * because that encoder would mangle it. It would not: `bytes` is
   * `charCodeAt & 0xff` and `String.fromCharCode` is its inverse for every
   * value a byte can hold, so the two routes agree exactly — which a mutation
   * reverting this proved by passing every test in the suite.
   *
   * The real reason is size. Turning bytes into a string means spreading the
   * array as arguments, and measured here that throws
   * `RangeError: Maximum call stack size exceeded` somewhere between 60,000
   * and 130,000 of them. A picture is bigger than that before it is worth
   * putting in a document, so the string route is not a slower way to write a
   * PDF with a photograph in it; it is no way to write one.
   */
  type Object_ = string | { head: string; data: Uint8Array; tail: string };
  const objects: Object_[] = [];
  const add = (body: Object_) => {
    objects.push(body);
    return objects.length;
  };

  // 1 is the catalogue and 2 the page tree; both are written last and their
  // numbers reserved here, because a page has to name its parent.
  const CATALOG = add('');
  const TREE = add('');

  const fontIds = new Map<StandardFont, number>();
  for (const [font] of used) {
    fontIds.set(
      font,
      add(`<< /Type /Font /Subtype /Type1 /BaseFont /${PS_NAME[font]} /Encoding /WinAnsiEncoding >>`),
    );
  }

  const imageNames = new Map<string, string>();
  const imageIds = new Map<string, number>();
  for (const [id, picture] of drawn) {
    const name = `Im${imageNames.size + 1}`;
    imageNames.set(id, name);
    imageIds.set(
      id,
      add({
        head:
          `<< /Type /XObject /Subtype /Image /Width ${picture.width} /Height ${picture.height} ` +
          `/ColorSpace ${picture.space} /BitsPerComponent 8 ${picture.filter} ` +
          `/Length ${picture.data.length} >>\nstream\n`,
        data: picture.data,
        tail: '\nendstream',
      }),
    );
  }

  const pageIds: number[] = [];
  for (const page of pages) {
    const body = stream(page, used, imageNames);
    const contents = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    const annots = page.links.length
      ? ` /Annots [ ${page.links
          .map(
            (l) =>
              '<< /Type /Annot /Subtype /Link /Border [0 0 0] ' +
              `/Rect [ ${round(l.x)} ${round(l.y)} ${round(l.x + l.width)} ${round(l.y + l.height)} ] ` +
              `/A << /S /URI /URI ${literal(l.href)} >> >>`,
          )
          .join(' ')} ]`
      : '';
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${TREE} 0 R /MediaBox [0 0 ${round(frame.width)} ${round(frame.height)}] ` +
          `/Resources << /Font << ${[...used]
            .map(([font, name]) => `/${name} ${fontIds.get(font)} 0 R`)
            .join(' ')} >>${
            imageNames.size
              ? ` /XObject << ${[...imageNames]
                  .map(([id, name]) => `/${name} ${imageIds.get(id)} 0 R`)
                  .join(' ')} >>`
              : ''
          } >> /Contents ${contents} 0 R${annots} >>`,
      ),
    );
  }

  objects[CATALOG - 1] = `<< /Type /Catalog /Pages ${TREE} 0 R >>`;
  objects[TREE - 1] =
    `<< /Type /Pages /Count ${pageIds.length} /Kids [ ${pageIds
      .map((id) => `${id} 0 R`)
      .join(' ')} ] >>`;

  const parts: Uint8Array[] = [];
  let at = 0;
  const push = (text: string) => {
    const piece = bytes(text);
    parts.push(piece);
    at += piece.length;
  };

  push('%PDF-1.7\n%âãÏÓ\n');
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(at);
    if (typeof body === 'string') {
      push(`${i + 1} 0 obj\n${body}\nendobj\n`);
      return;
    }
    push(`${i + 1} 0 obj\n${body.head}`);
    parts.push(body.data);
    at += body.data.length;
    push(`${body.tail}\nendobj\n`);
  });

  const xref = at;
  const rows = [
    '0000000000 65535 f \n',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`),
  ].join('');
  push(`xref\n0 ${objects.length + 1}\n${rows}`);
  push(`trailer\n<< /Size ${objects.length + 1} /Root ${CATALOG} 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const total = parts.reduce((n, p) => n + p.length, 0);
  const file = new Uint8Array(total);
  let cursor = 0;
  for (const piece of parts) {
    file.set(piece, cursor);
    cursor += piece.length;
  }
  return file;
}

export function pdfFile(doc: Doc, pictures?: Pictures): Blob {
  return new Blob([pdfBytes(doc, pictures) as unknown as BlobPart], { type: 'application/pdf' });
}
