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
 * An equation. The app holds LaTeX and draws it with KaTeX, and turning that
 * into placed glyphs is a typesetting engine — it comes out as the LaTeX as
 * typed, which is at least what was written. A picture does not come either:
 * its bytes are in IndexedDB and this is a pure function of the document, the
 * same split `parts()` keeps in `lib/docx.ts`. Its caption still prints, so a
 * figure is visibly not here rather than silently missing. Notes in the
 * margin never print, which is the rule `Paper` already keeps.
 */

import { layoutOf, type Layout } from './doclayout';
import { listed, type Block, type Doc } from './document';
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
import { PS_NAME, type StandardFont } from './pdfwidths.data';

/** One thing drawn on a page, in PDF coordinates — y counts up from the foot. */
export type Drawing =
  | { at: 'text'; x: number; y: number; pieces: Piece[]; extra: number }
  | { at: 'rule'; x: number; y: number; width: number; weight: number }
  | { at: 'box'; x: number; y: number; width: number; height: number };

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

/**
 * The pen: where it is, what page it is on, and the only ways to move it.
 */
class Pen {
  readonly frame: Frame;
  readonly layout: Layout;
  readonly pages: Page[] = [];
  private page: Page = { drawings: [], links: [] };
  private y: number;

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
   */
  spend(height: number): number {
    if (this.y - height < this.frame.margin && this.page.drawings.length > 0) this.turn();
    const top = this.y;
    this.y -= height;
    return top;
  }

  gap(points: number) {
    this.y -= points;
  }

  turn() {
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

  for (const [r, row] of block.rows.entries()) {
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
    const height = Math.max(leading, ...wrapped.map((lines) => lines.length * leading)) + pad * 2;
    const top = pen.spend(height);
    for (let c = 0; c < width; c += 1) {
      const x = pen.frame.margin + cell * c;
      pen.draw({ at: 'box', x, y: top - height, width: cell, height });
      wrapped[c].forEach((line, i) => {
        pen.draw({
          at: 'text',
          x: x + pad,
          y: top - pad - leading * (i + 0.8),
          pieces: line.pieces,
          extra: 0,
        });
      });
    }
  }
  pen.gap(pen.layout.size * 0.4);
}

function block(pen: Pen, base: { font: string; size: number }, b: Block) {
  const { layout } = pen;
  switch (b.kind) {
    case 'heading': {
      const size = layout.size * HEADING_SCALE[b.level - 1];
      pen.gap(layout.size * 0.4);
      paragraph(pen, base, piecesOf(b.text, { ...base, size }), {
        align: b.align,
        bold: true,
        leading: size * 1.25,
        after: layout.size * 0.2,
      });
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
    case 'equation': {
      paragraph(
        pen,
        base,
        [{ text: b.latex, font: 'courier', size: layout.size * 0.9, link: '', strike: false }],
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
    case 'image': {
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
  }
}

/**
 * The document, laid out.
 *
 * Exported so the tests can ask where things landed rather than re-parsing a
 * PDF with a parser they would then be trusting instead of the writer.
 */
export function laid(doc: Doc): { pages: Page[]; frame: Frame; layout: Layout } {
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

  for (const b of doc.blocks) block(pen, base, b);

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
function stream(page: Page, fonts: Map<StandardFont, string>): string {
  const out: string[] = [];
  for (const drawing of page.drawings) {
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
export function pdfBytes(doc: Doc): Uint8Array {
  const { pages, frame } = laid(doc);

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

  const objects: string[] = [];
  const add = (body: string) => {
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

  const pageIds: number[] = [];
  for (const page of pages) {
    const body = stream(page, used);
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
            .join(' ')} >> >> /Contents ${contents} 0 R${annots} >>`,
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
    push(`${i + 1} 0 obj\n${body}\nendobj\n`);
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

export function pdfFile(doc: Doc): Blob {
  return new Blob([pdfBytes(doc) as unknown as BlobPart], { type: 'application/pdf' });
}
