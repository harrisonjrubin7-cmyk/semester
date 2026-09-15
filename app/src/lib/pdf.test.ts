import { describe, expect, it } from 'vitest';
import { blankDoc, type Block, type Doc } from './document';
import { adjusted, fromStyle } from './doclayout';
import { fontFor, literal, widthOf, winAnsi, wrap, type Piece } from './pdf';
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
        expect(words.some((w) => /^Q\d+$/.test(w)), `filler ${filler}, page ${i + 1}`).toBe(true);
      }
    }
    // The guard against the assertion above never running at all.
    expect(seen).toBe(39);
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
