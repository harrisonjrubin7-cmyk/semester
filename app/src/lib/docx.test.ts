// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parts } from './docx';
import { xml } from './ooxml';
import { blankDoc, type Block, type Doc } from './document';
import { fromStyle } from './doclayout';

/** The relationship-type prefix, as the package writes it. */
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/**
 * The parts of a Word file, checked without opening Word.
 *
 * A .docx fails in exactly one way that matters: it opens as "we found a
 * problem with some content", with no location and no cause, and the person
 * has already emailed it. So what is checked here is the small number of
 * things that produce that, each of which is invisible in the markup unless
 * you are looking for it — an unescaped ampersand, a relationship pointing at
 * nothing, a content type left off a part, a style used but never defined.
 */
const doc = (blocks: Block[], title = 'Memo'): Doc => ({ ...blankDoc(title), id: 'd1', blocks });

const documentXml = (d: Doc) => parts(d).text['word/document.xml'];

/**
 * Every part, through a real XML parser.
 *
 * The string assertions below check that the right things are present; this
 * checks that what surrounds them is well-formed. An unbalanced tag is the one
 * mistake in this file that no `toContain` can see, and it is exactly what
 * Word reports as "we found a problem with some content" — with no location,
 * after the document has already been sent.
 */
const parse = (text: string): Document => {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const bad = doc.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return doc;
};

describe('well-formedness', () => {
  it('parses every part of a document with one of everything in it', () => {
    const made = parts(
      doc(
        [
          { kind: 'heading', level: 1, text: 'Findings & method' },
          { kind: 'text', text: 'Some **bold** and some *italic*.\nA second line.' },
          { kind: 'bullets', items: ['one', 'two'], numbered: true },
          { kind: 'quote', text: 'A passage.', source: 'Keynes, 1936' },
          { kind: 'table', rows: [['a', 'b'], ['1', '2']], header: true, caption: 'Table 1' },
          { kind: 'equation', latex: '\\sum_{i=1}^{n} \\frac{x_i}{n}', caption: 'The mean' },
          { kind: 'break' },
        ],
        'R&D <notes>',
      ),
    ).text;
    for (const [path, body] of Object.entries(made)) {
      expect(() => parse(body), path).not.toThrow();
    }
  });
});

describe('the package', () => {
  it('carries every part a reader looks for', () => {
    const made = parts(doc([])).text;
    for (const path of [
      '[Content_Types].xml',
      '_rels/.rels',
      'word/document.xml',
      'word/_rels/document.xml.rels',
      'word/styles.xml',
      'word/numbering.xml',
      'docProps/core.xml',
      'docProps/app.xml',
    ]) {
      expect(Object.keys(made)).toContain(path);
    }
  });

  it('declares a content type for every part that needs one', () => {
    const made = parts(doc([])).text;
    const types = made['[Content_Types].xml'];
    for (const path of Object.keys(made)) {
      if (path.endsWith('.rels') || path === '[Content_Types].xml') continue;
      expect(types, path).toContain(`PartName="/${path}"`);
    }
  });

  it('points every relationship at a part that is in the package', () => {
    const made = parts(doc([])).text;
    const targets = [
      ...made['_rels/.rels'].matchAll(/Target="([^"]+)"/g),
    ].map((m) => m[1]);
    for (const target of targets) expect(Object.keys(made)).toContain(target);

    const inWord = [...made['word/_rels/document.xml.rels'].matchAll(/Target="([^"]+)"/g)].map(
      (m) => `word/${m[1]}`,
    );
    for (const target of inWord) expect(Object.keys(made)).toContain(target);
  });

  it('declares the maths namespace, or every equation is unreadable markup', () => {
    expect(documentXml(doc([]))).toContain('xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"');
  });

  it('defines every paragraph style it uses', () => {
    const made = parts(
      doc([
        { kind: 'heading', level: 1, text: 'One' },
        { kind: 'heading', level: 2, text: 'Two' },
        { kind: 'heading', level: 3, text: 'Three' },
        { kind: 'bullets', items: ['a'], numbered: false },
        { kind: 'quote', text: 'q', source: 's' },
        { kind: 'table', rows: [['a']], header: true, caption: 'c' },
      ]),
    ).text;
    const used = [...made['word/document.xml'].matchAll(/<w:pStyle w:val="([^"]+)"\/>/g)].map(
      (m) => m[1],
    );
    expect(used.length).toBeGreaterThan(0);
    for (const style of new Set(used)) {
      expect(made['word/styles.xml'], style).toContain(`w:styleId="${style}"`);
    }
  });

  it('points a list at a numbering definition that exists', () => {
    const made = parts(doc([{ kind: 'bullets', items: ['a'], numbered: true }])).text;
    const ids = [...made['word/document.xml'].matchAll(/<w:numId w:val="(\d+)"\/>/g)].map((m) => m[1]);
    expect(ids).toContain('2');
    for (const id of ids) expect(made['word/numbering.xml']).toContain(`<w:num w:numId="${id}">`);
  });
});

describe('escaping', () => {
  it('escapes the character that makes Word call the file unreadable', () => {
    expect(xml('Cost & benefit')).toBe('Cost &amp; benefit');
    expect(documentXml(doc([{ kind: 'text', text: 'Supply & demand' }]))).toContain(
      'Supply &amp; demand',
    );
  });

  it('escapes the title too, which is the one nobody remembers', () => {
    const made = parts(doc([], 'R&D <notes>')).text;
    expect(made['word/document.xml']).toContain('R&amp;D &lt;notes&gt;');
    expect(made['docProps/core.xml']).toContain('R&amp;D &lt;notes&gt;');
  });

  it('drops control characters, which are legal in a string and not in XML', () => {
    expect(xml('a\x07b')).toBe('ab');
  });

  /*
   * And half of a character, which is the same problem one level down.
   *
   * A JS string is UTF-16, so an emoji is two code units. Any cap counted in
   * characters can cut between them, and what is left ends in a lone
   * surrogate — legal in a JS string, not a character at all in XML, and
   * rejected outright by a parser. Checked against one at the time: a
   * `<t>` holding U+D83C alone is not well-formed.
   *
   * `tabName` in `lib/xlsx.ts` is where it was reachable; this is the
   * backstop for every other way a half could arrive.
   */
  const C = String.fromCharCode;

  it('keeps a real emoji whole', () => {
    expect(xml('Done ' + C(0xd83c, 0xdf89))).toBe('Done ' + C(0xd83c, 0xdf89));
  });

  it('drops a surrogate with no partner, either half', () => {
    expect(xml('Done ' + C(0xd83c))).toBe('Done ');
    expect(xml(C(0xdf89) + ' done')).toBe(' done');
    // And a pair still reads as a pair with a loose half beside it.
    expect(xml(C(0xd83c, 0xdf89) + C(0xd83c))).toBe(C(0xd83c, 0xdf89));
  });

  it('drops the two code points XML excludes by name', () => {
    expect(xml('a' + C(0xfffe) + 'b' + C(0xffff))).toBe('ab');
  });
});

describe('what each block becomes', () => {
  it('keeps the space beside an emphasised word', () => {
    // Without `xml:space="preserve"` this reads as a typo in the writing.
    const out = documentXml(doc([{ kind: 'text', text: '**Bold** then more' }]));
    expect(out).toContain('xml:space="preserve"');
    expect(out).toContain('<w:b/>');
    expect(out).toContain('> then more<');
  });

  it('writes a heading at the level it was given', () => {
    expect(documentXml(doc([{ kind: 'heading', level: 3, text: 'Deep' }]))).toContain(
      '<w:pStyle w:val="Heading3"/>',
    );
  });

  it('writes a table with a header row that repeats over a page', () => {
    const out = documentXml(
      doc([{ kind: 'table', rows: [['a', 'b'], ['1', '2']], header: true, caption: '' }]),
    );
    expect(out).toContain('<w:tbl>');
    expect(out).toContain('<w:tblHeader/>');
    expect((out.match(/<w:tr>/g) ?? []).length).toBe(2);
  });

  it('pads a short row so the table is not ragged', () => {
    const out = documentXml(
      doc([{ kind: 'table', rows: [['a', 'b'], ['1']], header: false, caption: '' }]),
    );
    expect((out.match(/<w:tc>/g) ?? []).length).toBe(4);
  });

  it('writes an equation as an equation rather than as a picture of one', () => {
    const out = documentXml(doc([{ kind: 'equation', latex: '\\frac{a}{b}', caption: 'Ratio' }]));
    expect(out).toContain('<m:oMath>');
    expect(out).toContain('<m:f>');
    expect(out).toContain('Ratio');
  });

  it('leaves an empty block out rather than writing a blank paragraph', () => {
    const out = documentXml(doc([{ kind: 'text', text: '   ' }, { kind: 'equation', latex: '', caption: '' }]));
    expect(out).not.toContain('<m:oMath>');
  });

  it('writes a page break as a break', () => {
    expect(documentXml(doc([{ kind: 'break' }]))).toContain('<w:br w:type="page"/>');
  });

  it('sets the page up, or Word decides for itself', () => {
    expect(documentXml(doc([]))).toContain('<w:sectPr>');
    expect(documentXml(doc([]))).toContain('<w:pgSz');
  });
});

/**
 * The three things a .docx could not carry before, and the one that would
 * corrupt the file if it were carried wrong.
 *
 * A hyperlink is the interesting one. It is not a run property — Word holds
 * it as an element pointing at a relationship in a second file — so a link
 * written with the id and without the relationship, or with the relationship
 * and without `TargetMode="External"`, produces a document Word reports as
 * unreadable rather than as a broken link. Both halves are asserted together
 * for that reason.
 */
describe('the marks that are not just a run property', () => {
  /*
   * A link's id is counted from the relationships the part already has, and
   * that number stops being a constant the moment a page header exists:
   * styles and numbering are always there, and `header1.xml` is a third.
   *
   * Hand a link the header's own id and Word does not report a broken link —
   * it reports the document as unreadable. Both shapes are asserted here
   * because the bug only appears when the two features meet, which is
   * exactly the case neither of them tests on its own.
   */
  it('numbers a link above the header, when there is one', () => {
    const plain = parts(doc([{ kind: 'text', text: '[x](https://e.edu/a)' }])).text;
    expect(plain['word/document.xml']).toContain('<w:hyperlink r:id="rId3">');

    const headed = parts({
      ...doc([{ kind: 'text', text: '[x](https://e.edu/a)' }]),
      layout: fromStyle('apa'),
    }).text;
    expect(headed['word/document.xml']).toContain('<w:hyperlink r:id="rId4">');
    const rels = headed['word/_rels/document.xml.rels'];
    expect(rels).toContain('<Relationship Id="rId3" Type="' + REL + '/header"');
    expect(rels).toContain('Id="rId4"');
    expect(rels).toContain('TargetMode="External"');
  });

  it('writes strike-through and monospace as run properties', () => {
    const made = parts(doc([{ kind: 'text', text: 'keep ~~cut~~ and `code`' }])).text[
      'word/document.xml'
    ];
    expect(made).toContain('<w:strike/>');
    expect(made).toContain('w:val="CodeChar"');
  });

  it('puts a box in front of each line of a checklist', () => {
    const made = parts(
      doc([
        {
          kind: 'checks',
          items: [
            { text: 'Read the chapter', done: true },
            { text: 'Write the memo', done: false },
          ],
        },
      ]),
    ).text['word/document.xml'];
    expect(made).toContain('☒ Read the chapter');
    expect(made).toContain('☐ Write the memo');
  });

  it('leaves a code block exactly as typed, marks and all', () => {
    const made = parts(doc([{ kind: 'code', text: 'a <- b * c * d', language: 'R' }])).text[
      'word/document.xml'
    ];
    expect(made).toContain('a &lt;- b * c * d');
    expect(made).not.toContain('<w:i/>');
  });

  /*
   * A contents page is written out as real paragraphs rather than as Word's
   * TOC field, which arrives unpopulated and reads "Right-click to update
   * field" until somebody does — which is what gets handed in.
   */
  it('writes the contents as the headings themselves', () => {
    const made = parts(
      doc([
        { kind: 'toc', title: 'Contents' },
        { kind: 'heading', level: 1, text: 'The tariff' },
        { kind: 'heading', level: 2, text: 'The vote' },
      ]),
    ).text['word/document.xml'];
    expect(made).toContain('w:val="TOC1"');
    expect(made).toContain('The tariff');
    expect(made).not.toContain('instrText xml:space="preserve"> TOC');
  });
});
