import { describe, expect, it } from 'vitest';
import { blankDoc, type Block, type Doc } from './document';
import { adjusted, fromStyle } from './doclayout';
import {
  asPdf,
  fontFor,
  fromWinAnsi,
  literal,
  type Piece,
  widthOf,
  winAnsi,
  wrap,
} from './pdf';
import { laid, pdfBytes } from './pdfout';
import { WIDTHS } from './pdfwidths.data';

/**
 * A PDF written by hand, and the two things that makes hard.
 *
 * The first is that nothing in a PDF wraps text: the writer decides where
 * every line ends, so the measuring has to be right or the lines are wrong.
 * The second is that the cross-reference table is a list of *byte offsets* —
 * get one wrong and a reader refuses the file outright rather than showing it
 * slightly out of place.
 *
 * So most of this is about those two, and `pdfread.test.ts` is the other half:
 * a real reader opening what this writes.
 */

const doc = (blocks: Block[], over: Partial<Doc> = {}): Doc => ({
  ...blankDoc('Paper'),
  id: 'd1',
  blocks,
  ...over,
});

const text = (t: string, size = 12): Piece[] => [
  { text: t, font: 'timesRoman', size, link: '', strike: false },
];

describe('measuring a string', () => {
  /*
   * Against Adobe's published numbers, which is what a reader's built-in font
   * *is*. A capital A in Helvetica is 667 thousandths of the point size, so
   * at 12pt it is 8.004 points — and if this app thought otherwise, every
   * line in every paragraph would end in the wrong place.
   */
  it('agrees with the published metrics, character by character', () => {
    expect(widthOf('A', 'helvetica', 1000)).toBe(WIDTHS.helvetica[65]);
    expect(widthOf('A', 'helvetica', 12)).toBeCloseTo((667 * 12) / 1000, 5);
    expect(widthOf('AA', 'helvetica', 12)).toBeCloseTo(widthOf('A', 'helvetica', 12) * 2, 5);
  });

  it('knows courier is the same width all the way along', () => {
    expect(widthOf('iiii', 'courier', 12)).toBe(widthOf('MMMM', 'courier', 12));
    expect(widthOf('iiii', 'timesRoman', 12)).not.toBe(widthOf('MMMM', 'timesRoman', 12));
  });

  it('measures bold wider than regular, which is the point of bold', () => {
    expect(widthOf('Findings', 'timesBold', 12)).toBeGreaterThan(
      widthOf('Findings', 'timesRoman', 12),
    );
  });

  it('measures the empty string as nothing', () => {
    expect(widthOf('', 'timesRoman', 12)).toBe(0);
  });
});

describe('the one byte WinAnsi has', () => {
  it('leaves ASCII alone and finds a byte for the punctuation this app writes', () => {
    expect(winAnsi('Hello')).toBe('Hello');
    // A bullet, an em dash and a curly quote all have a place in WinAnsi.
    expect(winAnsi('•').charCodeAt(0)).toBe(0x95);
    expect(winAnsi('—').charCodeAt(0)).toBe(0x97);
    expect(winAnsi('“').charCodeAt(0)).toBe(0x93);
    expect(winAnsi('é').charCodeAt(0)).toBe(0xe9);
  });

  /*
   * A ballot box has no byte at all, and drawing it as the hollow rectangle a
   * reader falls back to would say the opposite of what a ticked box says.
   */
  it('says what a character it cannot draw meant', () => {
    expect(winAnsi('☒ done')).toBe('[x] done');
    expect(winAnsi('☐ not yet')).toBe('[ ] not yet');
    expect(winAnsi('○ sub')).toBe('o sub');
  });

  /*
   * Found by printing a study guide rather than by reading this file. These
   * ten are what the four shipped courses actually contain, and every one of
   * them used to come out as a space — so ECON's one elasticity formula
   * printed as `= [(Q −Q ) ÷ …]`: not mangled, which somebody would notice,
   * but silently short a variable.
   */
  it('spells out the maths a course guide is written in', () => {
    expect(winAnsi('ε = [(Q₂−Q₁) ÷ ((Q₁+Q₂)/2)]')).toBe('epsilon = [(Q2-Q1) ÷ ((Q1+Q2)/2)]');
    expect(winAnsi('%ΔQ ÷ %ΔP')).toBe('%deltaQ ÷ %deltaP');
    expect(winAnsi('play → ritual → sport')).toBe('play -> ritual -> sport');
    expect(winAnsi('≈ 1 ÷ √n')).toBe('~ 1 ÷ sqrtn');
    expect(winAnsi('p ≠ 0, p ≤ .05, p ≥ .05')).toBe('p != 0, p <= .05, p >= .05');
    expect(winAnsi('Σ and π')).toBe('sum and pi');
  });

  it('leaves a space rather than a box for anything else', () => {
    expect(winAnsi('a中b')).toBe('a b');
  });

  it('never produces a character a byte cannot hold', () => {
    const out = winAnsi('• — ☒ 中 café €');
    for (const ch of out) expect(ch.charCodeAt(0)).toBeLessThan(256);
  });

  /* The three characters that would otherwise end the string early. */
  it('escapes the brackets and the backslash in a literal', () => {
    expect(literal('a (b) c\\d')).toBe('(a \\(b\\) c\\\\d)');
  });
});

describe('breaking a paragraph into lines', () => {
  it('breaks at a space before the column runs out', () => {
    const lines = wrap(text('aaa bbb ccc ddd'), widthOf('aaa bbb', 'timesRoman', 12) + 1);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(widthOf('aaa bbb', 'timesRoman', 12) + 1.001);
    }
  });

  /* A URL longer than the column is placed and allowed over the margin.
     Hyphenating it produces a line nobody can copy. */
  it('does not break a word that is wider than the whole column', () => {
    const lines = wrap(text('https://example.com/a/very/long/path'), 20);
    expect(lines).toHaveLength(1);
    expect(lines[0].pieces[0].text).toBe('https://example.com/a/very/long/path');
  });

  it('drops the space it broke at rather than drawing it', () => {
    const lines = wrap(text('aaa bbb'), widthOf('aaa', 'timesRoman', 12) + 1);
    expect(lines[0].pieces.map((p) => p.text).join('')).toBe('aaa');
    expect(lines[1].pieces.map((p) => p.text).join('')).toBe('bbb');
  });

  /*
   * Except in code, where the spaces at the start of a line are most of what
   * the line means — an indented Python body drawn flush left is a different
   * program.
   */
  it('keeps the spaces in front of a line of code', () => {
    const mono: Piece[] = [
      { text: '    return x', font: 'courier', size: 10, link: '', strike: false },
    ];
    expect(wrap(mono, 400, true)[0].pieces[0].text).toBe('    return x');
    expect(wrap(mono, 400, false)[0].pieces[0].text).toBe('return x');
  });

  it('keeps a bold phrase on its own piece so it keeps its font', () => {
    const pieces: Piece[] = [
      { text: 'the ', font: 'timesRoman', size: 12, link: '', strike: false },
      { text: 'important', font: 'timesBold', size: 12, link: '', strike: false },
      { text: ' bit', font: 'timesRoman', size: 12, link: '', strike: false },
    ];
    const [line] = wrap(pieces, 400);
    expect(line.pieces.map((p) => p.font)).toEqual(['timesRoman', 'timesBold', 'timesRoman']);
  });
});

describe('which built-in font a chosen one becomes', () => {
  /* A reader has one serif, one sans and one monospace built in. Garamond is
     a serif, so it prints as one rather than as something that is not. */
  it('maps the five the app offers onto the two it has', () => {
    expect(fontFor('Times New Roman', false, false, false)).toBe('timesRoman');
    expect(fontFor('Garamond', false, false, false)).toBe('timesRoman');
    expect(fontFor('Georgia', true, false, false)).toBe('timesBold');
    expect(fontFor('Calibri', false, false, false)).toBe('helvetica');
    expect(fontFor('Arial', true, true, false)).toBe('helveticaBoldOblique');
    expect(fontFor('Times New Roman', true, true, true)).toBe('courier');
  });
});

describe('laying the document onto pages', () => {
  it('puts the page at the size the layout asked for', () => {
    const letter = laid(doc([{ kind: 'text', text: 'One.' }]));
    expect(letter.frame.width).toBeCloseTo(8.5 * 72, 3);
    const a4 = laid(
      doc([{ kind: 'text', text: 'One.' }], { layout: adjusted(fromStyle('own'), { paper: 'a4' }) }),
    );
    expect(a4.frame.width).toBeCloseTo(8.27 * 72, 3);
  });

  it('starts a new page when the text runs off the bottom', () => {
    const many: Block[] = Array.from({ length: 120 }, (_, i) => ({
      kind: 'text' as const,
      text: `Paragraph number ${i + 1}, with enough words in it to take a line of its own.`,
    }));
    expect(laid(doc(many)).pages.length).toBeGreaterThan(1);
  });

  it('starts a new page for a page break, and not for one at the very top', () => {
    expect(laid(doc([{ kind: 'text', text: 'A.' }, { kind: 'break' }, { kind: 'text', text: 'B.' }])).pages)
      .toHaveLength(2);
    // Nothing drawn yet, so there is no page to end.
    expect(laid(doc([{ kind: 'break' }, { kind: 'text', text: 'B.' }], { title: '' })).pages)
      .toHaveLength(1);
  });

  /*
   * A row half at the foot of one page and half at the head of the next is
   * the thing that makes a printed table unreadable, so a row asks for its
   * whole height at once.
   */
  it('never splits a table row across a page', () => {
    const rows = Array.from({ length: 60 }, (_, i) => [`Row ${i + 1}`, 'A cell with a few words in it']);
    const { pages, frame } = laid(doc([{ kind: 'table', rows, header: true, caption: '' }]));
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      for (const drawing of page.drawings) {
        if (drawing.at !== 'box') continue;
        expect(drawing.y).toBeGreaterThanOrEqual(frame.margin - 0.001);
        expect(drawing.y + drawing.height).toBeLessThanOrEqual(frame.height - frame.margin + 0.001);
      }
    }
  });

  /*
   * The other half of what `spend` is for. A row is never cut in two; a
   * heading is never left alone at the foot of a page either, and neither is
   * a table's `Question | Answer` strip with its first answer overleaf —
   * which is what printing a fourteen-unit study guide put on page nine.
   */
  it('never leaves a heading alone at the foot of a page', () => {
    const last = (page: (typeof pages)[number]) => {
      const drawn = page.drawings.filter((d) => d.at === 'text');
      const line = drawn[drawn.length - 1];
      return line && line.at === 'text' ? line.pieces.map((x) => x.text).join('') : '';
    };
    const blocks: Block[] = [];
    for (let i = 0; i < 40; i += 1) {
      blocks.push({ kind: 'heading', level: 2, text: `Section ${i + 1}` });
      blocks.push({ kind: 'text', text: `Body ${i + 1}. `.repeat(12) });
    }
    const { pages } = laid(doc(blocks));
    expect(pages.length).toBeGreaterThan(3);
    for (const page of pages) expect(last(page), 'last line on a page').not.toMatch(/^Section \d+$/);
  });

  /*
   * The same rule where reserving a fixed amount under the heading would get
   * it wrong: a table's first row is far taller than a line of prose, and a
   * study guide is a heading over a table the whole way down. So the heading
   * is carried across after the fact rather than measured for in advance.
   */
  it('carries a heading across rather than stranding it over a table', () => {
    const rows = [
      ['Question', 'Answer'],
      ...Array.from({ length: 8 }, (_, i) => [`Q${i + 1}`, 'An answer long enough to take three or four lines in a narrow column of a printed page']),
    ];
    let checked = 0;
    for (let filler = 1; filler < 40; filler += 1) {
      const blocks: Block[] = Array.from({ length: filler }, (_, i) => ({
        kind: 'text' as const,
        text: `Filler ${i}. `.repeat(10),
      }));
      blocks.push({ kind: 'heading', level: 2, text: 'A unit heading' });
      blocks.push({ kind: 'table', rows, header: true, caption: '' });
      for (const [i, page] of laid(doc(blocks)).pages.entries()) {
        const words = page.drawings
          .filter((d) => d.at === 'text')
          .flatMap((d) => (d.at === 'text' ? d.pieces.map((x) => x.text) : []));
        if (!words.includes('A unit heading')) continue;
        checked += 1;
        expect(words, `filler ${filler}, page ${i + 1}`).toContain('Question');
      }
    }
    expect(checked).toBe(39);
  });

  it('never leaves a table’s header row alone at the foot of a page', () => {
    const rows = [
      ['Question', 'Answer'],
      ...Array.from({ length: 10 }, (_, i) => [`Q${i + 1}`, 'An answer with a few words in it']),
    ];
    let seen = 0;
    const ran = new Set<number>();
    for (let filler = 1; filler < 40; filler += 1) {
      const blocks: Block[] = Array.from({ length: filler }, (_, i) => ({
        kind: 'text' as const,
        text: `Filler ${i}. `.repeat(10),
      }));
      blocks.push({ kind: 'table', rows, header: true, caption: '' });
      for (const [i, page] of laid(doc(blocks)).pages.entries()) {
        const words = page.drawings
          .filter((d) => d.at === 'text')
          .flatMap((d) => (d.at === 'text' ? d.pieces.map((x) => x.text) : []));
        if (!words.includes('Question')) continue;
        seen += 1;
        ran.add(filler);
        expect(words.some((w) => /^Q\d+$/.test(w)), `filler ${filler}, page ${i + 1}`).toBe(true);
      }
    }
    /*
     * The guard against the assertion above never running at all. Every one of
     * the thirty-nine arrangements must put the header on a page somewhere,
     * which is the claim, and it is asserted on the arrangements rather than
     * on the pages now.
     *
     * The page count is no longer the same number. It was, while the header
     * appeared exactly once per document; a header that repeats at the top of
     * every page its table runs on to appears twelve more times across these
     * thirty-nine runs, and every one of those pages is a page that has rows
     * on it. That is the change, stated rather than absorbed.
     */
    expect(ran.size).toBe(39);
    expect(seen).toBe(51);
  });

  it('numbers every page when the layout asks for numbers', () => {
    const many: Block[] = Array.from({ length: 120 }, () => ({
      kind: 'text' as const,
      text: 'A paragraph long enough to take a line of its own on the page.',
    }));
    const { pages } = laid(doc(many, { layout: fromStyle('apa') }));
    const numbers = pages.map((p) =>
      p.drawings
        .filter((d) => d.at === 'text')
        .flatMap((d) => (d.at === 'text' ? d.pieces : []))
        .map((piece) => piece.text),
    );
    expect(numbers[0]).toContain('1');
    expect(numbers[numbers.length - 1]).toContain(String(pages.length));
  });

  it('keeps every line inside the margins', () => {
    const { pages, frame } = laid(
      doc([
        { kind: 'heading', level: 1, text: 'A heading that is quite long indeed, long enough to wrap' },
        { kind: 'text', text: 'A paragraph. '.repeat(40) },
        { kind: 'text', text: 'Right.', align: 'right' },
      ]),
    );
    for (const page of pages) {
      for (const drawing of page.drawings) {
        if (drawing.at !== 'text') continue;
        expect(drawing.y).toBeGreaterThanOrEqual(0);
        expect(drawing.y).toBeLessThanOrEqual(frame.height);
      }
    }
  });

  /* Justification stretches the spaces of every line but the last. The last
     line is what gives it away when it is done wrong. */
  it('stretches every line of a justified paragraph but the last', () => {
    const { pages } = laid(
      doc([{ kind: 'text', text: 'A justified paragraph. '.repeat(20), align: 'justify' }]),
    );
    const spread = pages[0].drawings.filter((d) => d.at === 'text' && d.extra > 0);
    const flat = pages[0].drawings.filter((d) => d.at === 'text' && d.extra === 0);
    expect(spread.length).toBeGreaterThan(1);
    expect(flat.length).toBeGreaterThan(0);
  });

  it('gives a link a rectangle a reader can click', () => {
    const { pages } = laid(doc([{ kind: 'text', text: 'See [the syllabus](https://example.com/s.pdf).' }]));
    expect(pages[0].links).toHaveLength(1);
    expect(pages[0].links[0].href).toBe('https://example.com/s.pdf');
    expect(pages[0].links[0].width).toBeGreaterThan(0);
  });

  /* Notes never print, which is the rule the page view already keeps. */
  it('leaves a note in the margin out of the file entirely', () => {
    const { pages } = laid(
      doc([
        {
          kind: 'text',
          text: 'A claim.',
          notes: [{ id: 'n', text: 'Check this citation.', at: 1, done: false }],
        },
      ]),
    );
    const said = pages
      .flatMap((p) => p.drawings)
      .flatMap((d) => (d.at === 'text' ? d.pieces.map((piece) => piece.text) : []))
      .join(' ');
    expect(said).toContain('A claim.');
    expect(said).not.toContain('citation');
  });
});

describe('the file itself', () => {
  const file = () => new TextDecoder('latin1').decode(pdfBytes(doc([{ kind: 'text', text: 'One.' }])));

  it('begins and ends the way a reader looks for', () => {
    const out = file();
    expect(out.startsWith('%PDF-1.7')).toBe(true);
    expect(out.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  /*
   * The cross-reference table is a list of byte offsets. Every one is checked
   * against what is actually at that offset, because a table that is wrong is
   * a file a reader refuses outright — and nothing about the bytes says so.
   */
  it('has a cross-reference table whose every offset lands on its object', () => {
    const out = file();
    const table = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(out);
    expect(table).not.toBeNull();
    const rows = (table?.[2] ?? '').trim().split('\n');
    expect(rows).toHaveLength(Number(table?.[1]));
    rows.slice(1).forEach((row, i) => {
      const offset = Number(row.slice(0, 10));
      expect(out.slice(offset, offset + `${i + 1} 0 obj`.length), `object ${i + 1}`).toBe(
        `${i + 1} 0 obj`,
      );
    });
  });

  /*
   * The highlighter is the only colour this writer has ever put in a file, so
   * the thing to check is not that the box is there but that it is closed:
   * PDF has no scoping, and a fill colour left set is inherited by whatever
   * is drawn next — which would be the following paragraph's text, in yellow.
   */
  it('lays the highlighter down before the words and puts the colour back', () => {
    const out = new TextDecoder('latin1').decode(
      pdfBytes(doc([{ kind: 'text', text: 'read ==this== now' }])),
    );
    const box = out.indexOf('1 1 0 rg');
    expect(box).toBeGreaterThan(-1);
    expect(out.slice(box, box + 120)).toMatch(/re f 0 g/);
    // The fill is drawn, then the text — the other order paints over it.
    expect(out.indexOf('re f 0 g')).toBeLessThan(out.indexOf('Tj ET', box));
  });

  it('rules a line under underlined words', () => {
    const plain = new TextDecoder('latin1').decode(
      pdfBytes(doc([{ kind: 'text', text: 'a word' }])),
    );
    const lined = new TextDecoder('latin1').decode(
      pdfBytes(doc([{ kind: 'text', text: 'a ++word++' }])),
    );
    expect((plain.match(/0\.6 w /g) ?? []).length).toBe(0);
    expect((lined.match(/0\.6 w /g) ?? []).length).toBe(1);
  });

  it('points startxref at the table', () => {
    const out = file();
    const at = Number(/startxref\n(\d+)/.exec(out)?.[1]);
    expect(out.slice(at, at + 4)).toBe('xref');
  });

  /* The app's own layout is Calibri, which a reader has not got and which is
     a sans — so it prints as Helvetica. An MLA paper asks for Times New Roman
     and gets Times. Neither font is embedded; both are already in the reader. */
  it('names only the fonts it actually used, after the substitution', () => {
    const plain = new TextDecoder('latin1').decode(
      pdfBytes(doc([{ kind: 'text', text: 'Plain words.' }])),
    );
    expect(plain).toContain('/Helvetica');
    expect(plain).not.toContain('/Courier');
    const mla = new TextDecoder('latin1').decode(
      pdfBytes(doc([{ kind: 'text', text: 'Plain words.' }], { layout: fromStyle('mla') })),
    );
    expect(mla).toContain('/Times-Roman');
    const coded = new TextDecoder('latin1').decode(
      pdfBytes(doc([{ kind: 'code', text: 'x = 1', language: '' }])),
    );
    expect(coded).toContain('/Courier');
  });

  it('declares every stream at the length it really is', () => {
    const out = new TextDecoder('latin1').decode(
      pdfBytes(doc([{ kind: 'text', text: 'Some words to draw.' }])),
    );
    for (const m of out.matchAll(/<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
      expect(m[2].length).toBe(Number(m[1]));
    }
  });

  /*
   * Latin-1, not UTF-8. An accented character encoded as two bytes would push
   * every offset after it out by one, and the file would be refused — by
   * which point it has been emailed.
   */
  it('writes an accented character as one byte, so the offsets hold', () => {
    const bytes = pdfBytes(doc([{ kind: 'text', text: 'café crème' }]));
    const out = new TextDecoder('latin1').decode(bytes);
    expect(out).toContain('café crème');
    const at = Number(/startxref\n(\d+)/.exec(out)?.[1]);
    expect(out.slice(at, at + 4)).toBe('xref');
  });

  it('is not empty for a document with nothing in it', () => {
    expect(pdfBytes(doc([])).length).toBeGreaterThan(200);
  });
});

describe('the characters a formula is made of', () => {
  /*
   * `lib/maths.ts` renders notation in Unicode for everywhere that is neither
   * a screen nor Word, and the PDF is that everywhere. Until the table below
   * grew, `∫₀¹ x² dx` was written into a PDF as ` ¹ x² dx` and
   * `α + β ≤ γ` as `+  <= ` — not mangled, which somebody would notice, but
   * silently shortened, in the one place a formula is the whole content.
   *
   * The same argument the arrow and `%ΔQ` won when a study guide was printed;
   * this is that list finishing the job for the maths.
   */
  it('spells out Greek, which the encoding has one letter of', () => {
    expect(winAnsi('α + β ≤ γ')).toBe('alpha + beta <= gamma');
    expect(winAnsi('Ω')).toBe('Omega');
  });

  it('spells out the operators, which are the formula and not decoration', () => {
    expect(winAnsi('∫')).toBe('integral');
    expect(winAnsi('∑')).toBe('sum');
    expect(winAnsi('∞')).toBe('infinity');
    expect(winAnsi('x ∈ ℝ')).toBe('x  in  R');
  });

  it('brings a raised or lowered character down to the one somebody types', () => {
    expect(winAnsi('x₁ + x₂')).toBe('x1 + x2');
    expect(winAnsi('∑ᵢ₌₁ⁿ')).toBe('sumi=1n');
  });

  it('never spells out a character the encoding has a byte for', () => {
    // The rule that matters, because `INSTEAD` is read before the byte table
    // is: a superscript two has been in Windows-1252 all along, and spelling
    // it turned `E = mc²` into `E = mc2` in a PDF that had just been taught
    // to write equations. `lib/exportqa.ts` is what caught it.
    expect(winAnsi('E = mc²')).toBe('E = mc²');
    expect(winAnsi('x³ ± µ ÷ ×')).toBe('x³ ± µ ÷ ×');
  });

  it('keeps the four spellings that were chosen against a real document', () => {
    // `Δ` is `delta` and not `Delta` because the thing it was measured on was
    // `%ΔQ`. Adding the rest of the alphabet must not quietly recase these.
    expect(winAnsi('%ΔQ')).toBe('%deltaQ');
    expect(winAnsi('Σ')).toBe('sum');
    expect(winAnsi('ε')).toBe('epsilon');
    expect(winAnsi('π')).toBe('pi');
  });

  it('drops an overline rather than leaving a space where it was', () => {
    // A combining macron has no byte and no spelling. A space would let a
    // line break between a variable and nothing at all.
    expect(winAnsi('x̄')).toBe('x');
  });
});

describe('reading a PDF string back', () => {
  it('turns the encoding’s own bytes back into the characters they mean', () => {
    expect(fromWinAnsi(winAnsi('one — two “three”'))).toBe('one — two “three”');
  });

  it('leaves a character the encoding could not carry as the space it became', () => {
    expect(asPdf('日本語')).toBe('   ');
  });
});

describe('a picture in the file', () => {
  /*
   * The last of the five differences `lib/exportqa.ts` found between a `.docx`
   * and a `.pdf` of one document: Word had the figure and the PDF had the
   * words `[Alt text]` where it should have been.
   */
  const crc = (buf: number[]) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (tag: string, body: number[]) => {
    const name = [...tag].map((c) => c.charCodeAt(0));
    const n = body.length;
    const sum = crc([...name, ...body]);
    return [
      (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255,
      ...name, ...body,
      (sum >>> 24) & 255, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255,
    ];
  };
  const IDAT = [0x78, 0x9c, 0x01, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01];
  const picture = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [0, 0, 0, 200, 0, 0, 0, 100, 8, 2, 0, 0, 0]),
    ...chunk('IDAT', IDAT),
    ...chunk('IEND', []),
  ]);
  const held = (id: string) => (id === 'pic' ? { bytes: picture } : undefined);
  const withPicture = doc([
    { kind: 'image', fileId: 'pic', name: 'chart.png', alt: 'A chart', caption: 'Figure 1' },
  ]);

  it('draws the picture rather than the words for it', () => {
    const { pages } = laid(withPicture, held);
    const drawn = pages[0].drawings.filter((d) => d.at === 'picture');
    expect(drawn).toHaveLength(1);
    expect(drawn[0].at === 'picture' && drawn[0].id).toBe('pic');
    const words = pages[0].drawings
      .filter((d) => d.at === 'text')
      .flatMap((d) => (d.at === 'text' ? d.pieces.map((p) => p.text) : []))
      .join(' ');
    expect(words).not.toContain('[A chart]');
    expect(words, 'the caption still prints under it').toContain('Figure 1');
  });

  it('keeps the aspect ratio and stays inside the column', () => {
    const { pages, frame } = laid(withPicture, held);
    const drawn = pages[0].drawings.find((d) => d.at === 'picture');
    if (drawn?.at !== 'picture') throw new Error('no picture drawn');
    expect(drawn.width).toBeLessThanOrEqual(frame.column);
    expect(drawn.height / drawn.width).toBeCloseTo(100 / 200, 5);
    expect(drawn.x).toBeGreaterThanOrEqual(frame.margin);
  });

  it('writes the bytes into the file, uncompressed and unconverted', () => {
    const out = pdfBytes(withPicture, held);
    const text = new TextDecoder('latin1').decode(out);
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Width 200');
    expect(text).toContain('/Height 100');
    expect(text).toContain('/ColorSpace /DeviceRGB');
    expect(text).toContain('/Predictor 15');
    expect(text).toContain('/XObject << /Im1');
    expect(text).toMatch(/\/Im1 Do Q/);
    // The stream is the IDAT, byte for byte, sitting in a file whose every
    // other object is Latin-1 text.
    const from = text.indexOf('stream\n', text.indexOf('/Subtype /Image')) + 'stream\n'.length;
    expect([...out.subarray(from, from + IDAT.length)]).toEqual(IDAT);
  });

  it('keeps the cross-reference table right either side of the bytes', () => {
    // A PDF is found by byte offset. A stream written even one byte adrift
    // makes every object after it unreachable, and a reader rejects the file
    // rather than showing it slightly out of place.
    const out = pdfBytes(withPicture, held);
    const text = new TextDecoder('latin1').decode(out);
    const start = text.lastIndexOf('startxref');
    const xref = Number(text.slice(start + 9).trim().split('\n')[0]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const rows = text.slice(xref).split('\n').slice(2);
    for (const row of rows.slice(0, 6)) {
      const offset = Number(row.slice(0, 10));
      if (!row.trim() || Number.isNaN(offset) || offset === 0) continue;
      expect(text.slice(offset), `object at ${offset}`).toMatch(/^\d+ 0 obj/);
    }
  });

  it('writes a picture too big to go through a string', () => {
    /*
     * The reason an image object is kept out of the string path, measured
     * rather than assumed. The encoder and its inverse agree on every value a
     * byte can hold, so a small picture comes out identical either way — a
     * mutation taking the byte path away passed the whole suite until this
     * existed. What does not survive is the size: turning bytes into a string
     * spreads the array as arguments, and that throws `RangeError` somewhere
     * between 60,000 and 130,000 of them. A photograph is larger than that
     * before it is worth putting in a document.
     */
    const big = new Uint8Array(200_000).fill(0x42);
    const heavy = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk('IHDR', [0, 0, 0, 200, 0, 0, 0, 100, 8, 2, 0, 0, 0]),
      ...chunk('IDAT', [...big]),
      ...chunk('IEND', []),
    ]);
    const out = pdfBytes(withPicture, () => ({ bytes: heavy }));
    const text = new TextDecoder('latin1').decode(out);
    expect(text).toContain(`/Length ${big.length}`);
    const from = text.indexOf('stream\n', text.indexOf('/Subtype /Image')) + 'stream\n'.length;
    expect(out.subarray(from, from + big.length)).toEqual(big);
  });

  it('encodes one picture once however many times it is placed', () => {
    const twice = doc([
      { kind: 'image', fileId: 'pic', name: 'a.png', alt: 'A', caption: '' },
      { kind: 'image', fileId: 'pic', name: 'a.png', alt: 'A', caption: '' },
    ]);
    const text = new TextDecoder('latin1').decode(pdfBytes(twice, held));
    expect(text.split('/Subtype /Image').length - 1).toBe(1);
    expect(text.split('/Im1 Do').length - 1).toBe(2);
  });

  it('prints the alt text when nobody handed in the bytes', () => {
    // Laying out is a pure function of the document, so a caller that did not
    // fetch gets what this always drew rather than a gap.
    const { pages } = laid(withPicture);
    expect(pages[0].drawings.some((d) => d.at === 'picture')).toBe(false);
    const words = pages[0].drawings
      .filter((d) => d.at === 'text')
      .flatMap((d) => (d.at === 'text' ? d.pieces.map((p) => p.text) : []))
      .join(' ');
    expect(words).toContain('[A chart]');
  });

  it('prints the alt text when the format is one it will not encode', () => {
    const alpha = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk('IHDR', [0, 0, 0, 8, 0, 0, 0, 8, 8, 6, 0, 0, 0]),
      ...chunk('IDAT', IDAT),
      ...chunk('IEND', []),
    ]);
    const { pages } = laid(withPicture, () => ({ bytes: alpha }));
    expect(pages[0].drawings.some((d) => d.at === 'picture')).toBe(false);
    const words = pages[0].drawings
      .filter((d) => d.at === 'text')
      .flatMap((d) => (d.at === 'text' ? d.pieces.map((p) => p.text) : []))
      .join(' ');
    expect(words).toContain('[A chart]');
  });
});
