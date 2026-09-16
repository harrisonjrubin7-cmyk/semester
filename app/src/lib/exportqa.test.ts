import { describe, expect, it } from 'vitest';
import { blankDoc, type Block, type Doc } from './document';
import { carries, compare, control, fixture, inDocx, inPdf, pageText, stranded, wanted } from './exportqa';
import { parse, plain } from './maths';
import { laid } from './pdfout';

const doc = (blocks: Block[]): Doc => ({ ...blankDoc('D'), id: 'd', blocks });

describe('the two exports of one document', () => {
  it('says the same thing in both, for a document with one of everything', () => {
    expect(compare(fixture())).toEqual([]);
  });

  it('and the control does not, which is the only reason to believe that', () => {
    // A document a working comparison has to fail. If this ever comes back
    // clean the assertion above means nothing — it is what a comparison that
    // has stopped comparing returns too. See the head of `lib/exportqa.ts`.
    const found = compare(control());
    expect(found.length, 'the control must fail').toBeGreaterThan(0);
    expect(found.every((f) => f.side === 'pdf')).toBe(true);
  });

  it('leaves no table stranded from its header', () => {
    expect(stranded(fixture())).toEqual([]);
  });
});

describe('what the PDF was losing', () => {
  const rows = [['Term', 'Definition'], ...Array.from({ length: 60 }, (_, i) => [`T${i}`, `D${i}`])];

  it('writes a table caption, which only the .docx was writing', () => {
    const d = doc([{ kind: 'table', rows: [['a', 'b']], header: true, caption: 'Table 1 — the caption' }]);
    expect(inPdf(d).text).toContain('Table 1 — the caption');
    expect(inDocx(d).text).toContain('Table 1 — the caption');
  });

  it('repeats a header row on every page the table runs on to', () => {
    const d = doc([{ kind: 'table', rows, header: true, caption: '' }]);
    const { pages } = laid(d);
    expect(pages.length, 'this table has to cross a page for the test to mean anything').toBeGreaterThan(1);
    for (const page of pages) {
      const on = pageText(page);
      if (!rows.slice(1).some((r) => carries(on, r[1]))) continue;
      expect(on, 'a page of rows must carry the header').toContain('Definition');
    }
  });

  it('draws an equation as notation rather than as the source somebody typed', () => {
    const d = doc([{ kind: 'equation', latex: '\\frac{a+b}{c^2}', caption: '' }]);
    const said = inPdf(d).text;
    expect(said).toContain(plain(parse('\\frac{a+b}{c^2}')));
    expect(said, 'the reader has not agreed to learn LaTeX').not.toContain('\\frac');
  });

  it('counts a formula in each export, by what each format actually has', () => {
    // Word has an object that says it is an equation; a PDF has placed glyphs
    // and nothing else, so the two are asked different questions about the
    // same obligation.
    const d = doc([{ kind: 'equation', latex: 'E = mc^2', caption: 'Caption' }]);
    expect(inDocx(d).count('formula')).toBe(1);
    expect(inPdf(d).count('formula')).toBe(1);
  });
});

describe('the comparison, which is a claim about itself as well', () => {
  it('obliges an export to carry the words, not the marks around them', () => {
    // Both exports turn `*emphasis*` into an italic word, correctly. The first
    // version of this obliged them to print the asterisks and read both as
    // broken.
    expect(wanted({ kind: 'text', text: 'A word in *italics* here' }).text).toEqual([
      'A word in italics here',
    ]);
  });

  it('reads the text the file will hold, not the text the layout holds', () => {
    // The pages hold what was typed. The file holds one byte per character
    // from a 256-character encoding, and this is the difference the control
    // exists to keep visible.
    const { pages } = laid(doc([{ kind: 'text', text: '日本語' }]));
    expect(pageText(pages[0])).not.toContain('日本語');
  });

  it('does not read a character that survived the encoding as lost', () => {
    // An em dash has a byte in Windows-1252 and is a control character at that
    // code point in Unicode. Reading the byte back as Unicode reported every
    // high character as missing, this fixture's own caption included.
    const { pages } = laid(doc([{ kind: 'text', text: 'one — two' }]));
    expect(pageText(pages[0])).toContain('one — two');
  });

  it('sees an obligation the document makes and neither export was asked about', () => {
    // The shape of every finding this file was written to catch: a block says
    // something, and the exported file does not.
    const found = compare(doc([{ kind: 'text', text: '文字化け' }]));
    expect(found.map((f) => f.side)).toEqual(['pdf']);
    expect(found[0].why).toBe('not in the exported text');
  });
});
