// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parts, xml } from './docx';
import { blankDoc, type Block, type Doc } from './document';

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

const documentXml = (d: Doc) => parts(d)['word/document.xml'];

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
    );
    for (const [path, body] of Object.entries(made)) {
      expect(() => parse(body), path).not.toThrow();
    }
  });
});

describe('the package', () => {
  it('carries every part a reader looks for', () => {
    const made = parts(doc([]));
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
    const made = parts(doc([]));
    const types = made['[Content_Types].xml'];
    for (const path of Object.keys(made)) {
      if (path.endsWith('.rels') || path === '[Content_Types].xml') continue;
      expect(types, path).toContain(`PartName="/${path}"`);
    }
  });

  it('points every relationship at a part that is in the package', () => {
    const made = parts(doc([]));
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
    );
    const used = [...made['word/document.xml'].matchAll(/<w:pStyle w:val="([^"]+)"\/>/g)].map(
      (m) => m[1],
    );
    expect(used.length).toBeGreaterThan(0);
    for (const style of new Set(used)) {
      expect(made['word/styles.xml'], style).toContain(`w:styleId="${style}"`);
    }
  });

  it('points a list at a numbering definition that exists', () => {
    const made = parts(doc([{ kind: 'bullets', items: ['a'], numbered: true }]));
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
    const made = parts(doc([], 'R&D <notes>'));
    expect(made['word/document.xml']).toContain('R&amp;D &lt;notes&gt;');
    expect(made['docProps/core.xml']).toContain('R&amp;D &lt;notes&gt;');
  });

  it('drops control characters, which are legal in a string and not in XML', () => {
    expect(xml('ab')).toBe('ab');
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
