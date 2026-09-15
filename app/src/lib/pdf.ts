/**
 * A PDF, written here rather than by the browser's print dialog.
 *
 * File → "Print, or save as PDF" already exists and is how most people make
 * one. This is the other kind: a file, made without a dialog, identical on
 * every machine. The print route depends on the browser — Chrome and Safari
 * paginate the same HTML differently, a phone often has no print-to-PDF at
 * all, and neither can be attached to an email without a person standing
 * there. This can.
 *
 * Written without a library, for the reason `lib/docx.ts` gives about OOXML:
 * the part of the format this needs is small, and a PDF library is megabytes
 * to lay out a student's essay.
 *
 * ## The one thing a PDF does not do for you
 *
 * It does not wrap text. Nothing in the file says "this paragraph is six
 * inches wide" — the writer decides where every line ends and places each one
 * by hand. That is why `pdfwidths.data.ts` exists, and it is most of what is
 * below: measure, break, place, repeat, and start a page when the next line
 * would fall off this one.
 */

import { layoutOf, lineHeight, pageSize, type Layout } from './doclayout';
import { runs, type Run } from './document';
import { COURIER_WIDTH, WIDTHS, type StandardFont } from './pdfwidths.data';

/** A point is a 72nd of an inch, and is the only unit a PDF page has. */
export const PER_INCH = 72;

/**
 * Which of the two built-in families a chosen font becomes.
 *
 * `lib/doclayout.ts` offers five by name — three serifs and two sans — and a
 * PDF reader has one of each built in. A document set in Garamond prints in
 * Times rather than in something that is not a serif at all, which is the
 * substitution every reader already makes for a font it has not got.
 */
export function family(name: string): 'times' | 'helvetica' {
  return /arial|calibri|helvetica|verdana|tahoma|segoe/i.test(name) ? 'helvetica' : 'times';
}

export function fontFor(name: string, bold: boolean, italic: boolean, mono: boolean): StandardFont {
  if (mono) return 'courier';
  if (family(name) === 'helvetica') {
    if (bold && italic) return 'helveticaBoldOblique';
    if (bold) return 'helveticaBold';
    if (italic) return 'helveticaOblique';
    return 'helvetica';
  }
  if (bold && italic) return 'timesBoldItalic';
  if (bold) return 'timesBold';
  if (italic) return 'timesItalic';
  return 'timesRoman';
}

/**
 * Unicode to the one byte WinAnsi has for it, or the nearest thing it has.
 *
 * WinAnsi is Windows-1252, so the first 128 characters are themselves and the
 * rest is a lookup. The substitutions below are the characters this app
 * writes that the encoding has no room for: a ballot box, and the hollow and
 * square bullets a nested list uses. Each becomes something a reader can
 * still read rather than a `?` — `[x]` says what a ticked box says, and a
 * middle dot is a bullet by another name.
 *
 * ## The ones a course guide actually contains
 *
 * The list started at the characters this app's own *chrome* writes, and the
 * fallback for anything else was a space. Printing a study guide is what
 * showed what that costs. `ε = [(Q₂−Q₁) ÷ ((Q₁+Q₂)/2)]` — ECON's one elasticity
 * formula — printed as `= [(Q −Q ) ÷ ((Q +Q )/2)]`, and `%ΔQ` as `% Q`. Not
 * mangled, which somebody would notice: *silently* short a variable, in the
 * formula the exam is on. The arrow is the same story at 72 uses across the
 * four guides — `play → ritual → sport` is a sentence, `play  ritual  sport`
 * is not.
 *
 * So the ten below are spelled out rather than dropped. A reader has Symbol
 * built in and Symbol has real Greek and a real arrow, which would read
 * better than `delta` — but it is a second encoding and a font switch inside
 * a run, and `deltaQ` is legible today where a missing `Δ` is wrong today.
 */
const HIGH: Record<string, number> = {};
const WINANSI_HIGH =
  '€‚ƒ„…†‡ˆ‰Š‹ŒŽ' +
  '‘’“”•–—˜™š›œžŸ';
for (let i = 0; i < WINANSI_HIGH.length; i += 1) HIGH[WINANSI_HIGH[i]] = 0x80 + i;
for (let code = 0xa0; code <= 0xff; code += 1) HIGH[String.fromCharCode(code)] = code;

/** What a character with no byte of its own becomes instead. */
const INSTEAD: Record<string, string> = {
  '☐': '[ ]',
  '☒': '[x]',
  '☑': '[x]',
  '○': 'o',
  '▪': '·',
  '≤': '<=',
  '≥': '>=',
  '≠': '!=',
  '≈': '~',
  '−': '-',
  '→': '->',
  '√': 'sqrt',
  /* Spelled without a trailing space: `wrap` breaks a line at a space, and
     `delta` at the foot of one line with `Q` at the head of the next is a
     worse reading of `ΔQ` than `deltaQ` is. */
  'Δ': 'delta',
  'Σ': 'sum',
  'ε': 'epsilon',
  'π': 'pi',
  // A subscript becomes what somebody typing the same formula would type.
  '₁': '1',
  '₂': '2',
  ' ': ' ',
};

/** The text as WinAnsi, every character of the result a code below 256. */
export function winAnsi(text: string): string {
  let out = '';
  for (const ch of text) {
    const swap = INSTEAD[ch];
    if (swap !== undefined) {
      out += swap;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code === 9) out += '    ';
    else if (code < 0x80) out += ch;
    else if (HIGH[ch] !== undefined) out += String.fromCharCode(HIGH[ch]);
    /* Anything else has no byte at all. A space keeps the words apart, which
       is more honest than a glyph the reader would draw as a hollow box. */
    else out += ' ';
  }
  return out;
}

/** One PDF string literal, with the three characters that could end one escaped. */
export function literal(text: string): string {
  return `(${winAnsi(text).replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/** How wide a string is at a size, in points. */
export function widthOf(text: string, font: StandardFont, size: number): number {
  const table = font === 'courier' ? null : WIDTHS[font];
  let thousandths = 0;
  for (const ch of winAnsi(text)) {
    const code = ch.charCodeAt(0);
    thousandths += table ? table[code] || table[0x20] : COURIER_WIDTH;
  }
  return (thousandths * size) / 1000;
}

/** A piece of a line: some words, in one style, with one font. */
export interface Piece {
  text: string;
  font: StandardFont;
  size: number;
  link: string;
  strike: boolean;
}

/** A laid-out line: the pieces on it and how wide they came to. */
export interface Placed {
  pieces: Piece[];
  width: number;
}

/**
 * Words broken into lines that fit, greedily.
 *
 * Greedy rather than the paragraph-at-once algorithm TeX uses: the difference
 * shows on justified text with long words, and the cost of the good one is a
 * dynamic program nobody reading this file would thank me for.
 *
 * A word wider than the whole column — a URL, usually — is placed anyway and
 * allowed over the right margin rather than broken at an arbitrary letter.
 * Hyphenating `https://example.com/a/b` produces a line nobody can copy.
 */
export function wrap(pieces: Piece[], width: number, keepLeading = false): Placed[] {
  const lines: Placed[] = [];
  let line: Piece[] = [];
  let at = 0;

  const flush = () => {
    if (line.length) lines.push({ pieces: line, width: at });
    line = [];
    at = 0;
  };

  for (const piece of pieces) {
    /* Split keeping the spaces, so a break can fall on one and that space can
       then be dropped from the end of the line rather than drawn. */
    const words = piece.text.split(/(\s+)/).filter((w) => w !== '');
    for (const word of words) {
      const w = widthOf(word, piece.font, piece.size);
      const blank = /^\s+$/.test(word);
      if (!blank && at + w > width && at > 0) flush();
      /*
       * A space at the start of a line is dropped — it is the space the line
       * broke at, and drawing it would push every line in a centred or
       * justified paragraph off by however wide it is.
       *
       * Except in code, where the spaces at the start of a line are most of
       * what the line means. `keepLeading` is that exception, and it is why
       * a Python body in the PDF is indented at all.
       */
      if (blank && at === 0 && !keepLeading) continue;
      const last = line[line.length - 1];
      const same =
        last !== undefined &&
        last.font === piece.font &&
        last.size === piece.size &&
        last.link === piece.link &&
        last.strike === piece.strike;
      if (same) last.text += word;
      else line.push({ ...piece, text: word });
      at += w;
    }
  }
  flush();

  // A trailing space would push a centred line off centre.
  if (keepLeading) return lines;
  for (const placed of lines) {
    const last = placed.pieces[placed.pieces.length - 1];
    if (last && /\s$/.test(last.text)) {
      const trimmed = last.text.replace(/\s+$/, '');
      placed.width -= widthOf(last.text.slice(trimmed.length), last.font, last.size);
      last.text = trimmed;
    }
  }
  return lines;
}

/** Marked-up text as the pieces it is made of. */
export function piecesOf(text: string, base: { font: string; size: number }): Piece[] {
  return runs(text).map((r: Run) => ({
    text: r.text,
    font: fontFor(base.font, r.bold, r.italic, r.code),
    /* Monospace at the same point size reads a size larger beside a serif,
       which is why every editor sets inline code slightly smaller. */
    size: r.code ? base.size * 0.92 : base.size,
    link: r.link,
    strike: r.strike,
  }));
}

/** The page, and the column of text on it, in points. */
export interface Frame {
  width: number;
  height: number;
  margin: number;
  column: number;
  leading: number;
}

export function frameOf(layout: Layout): Frame {
  const paper = pageSize(layout.paper);
  const margin = layout.margin * PER_INCH;
  return {
    width: paper.width * PER_INCH,
    height: paper.height * PER_INCH,
    margin,
    column: paper.width * PER_INCH - margin * 2,
    leading: layout.size * lineHeight(layout.spacing),
  };
}

export function frameFor(doc: { layout?: Layout }): Frame {
  return frameOf(layoutOf(doc));
}
