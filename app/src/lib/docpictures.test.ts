// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { blankDoc, fromMarkdown, hasContent, summary, toMarkdown, words, type Block, type Doc } from './document';
import { parts, type Picture } from './docx';
import { EMU_PER_INCH, emus, sizeOf } from './imagesize';
import { findEverything } from './find';
import { fromStyle } from './doclayout';
import { buildCatalog } from '../data/catalog';

/**
 * A picture in a document, from the block to the bytes in the package.
 *
 * The fixtures are the real files from `__pix/` — the same ones `imagesize`
 * reads — because the thing being checked is that the size written into the
 * drawing is the size the picture actually is. A fake two-byte "picture"
 * would let a drawing that says 1×1 pass.
 */

const pix = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, '__pix', name)));

const picture = (name: string): Picture => {
  const bytes = pix(name);
  const size = sizeOf(bytes);
  if (!size) throw new Error(`${name} is not a picture this reads`);
  return { bytes, size };
};

const doc = (blocks: Block[]): Doc => ({ ...blankDoc('T'), id: 'd', blocks });

const image = (over: Partial<Extract<Block, { kind: 'image' }>> = {}): Block => ({
  kind: 'image',
  fileId: 'f1',
  name: 'chart.png',
  alt: 'Turnout by ward, 2020',
  caption: 'Figure 1. Turnout.',
  ...over,
});

const parse = (text: string): Document => {
  const out = new DOMParser().parseFromString(text, 'application/xml');
  const bad = out.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return out;
};

/** The resolver the screen hands `parts`, standing in for the drive. */
const drive = (at: Record<string, string>) => (id: string) =>
  at[id] ? picture(at[id]) : undefined;

describe('the block itself', () => {
  it('is not content until it points at a file', () => {
    expect(hasContent(doc([image({ fileId: '', caption: 'A caption alone' })]))).toBe(false);
    expect(hasContent(doc([image({ fileId: 'f1', caption: '', alt: '' })]))).toBe(true);
  });

  /*
   * A caption is a sentence somebody wrote and the alt text is a description
   * of a picture. Neither is prose in the document's argument, which is what
   * the word count is for — the same reading as a table's caption.
   */
  it('does not count towards the words', () => {
    expect(words(doc([image()]))).toBe(0);
  });

  /*
   * Search reads a document's blocks, and a picture's only words are the
   * three it carries. A student looking for the turnout chart types
   * "turnout", not the title of the paper it ended up in.
   */
  it('is findable by what it is of, and by its caption', () => {
    const found = (q: string) =>
      findEverything(buildCatalog([]), new Date(), q, [], [], undefined, [], {}, [], {
        documents: [doc([image()])],
      })
        .flatMap((g) => g.hits)
        .filter((h) => h.kind === 'document')
        .map((h) => h.id);
    expect(found('turnout by ward')).toContain('d');
    expect(found('Figure 1')).toContain('d');
  });

  it('is named in what the document says it holds', () => {
    expect(summary([image()])).toContain('1 picture');
  });
});

describe('the markdown round trip', () => {
  it('writes the picture and its caption in a form markdown readers know', () => {
    const text = toMarkdown(doc([image()]));
    expect(text).toContain('![Turnout by ward, 2020](chart.png)');
    expect(text).toContain('Figure 1. Turnout.');
  });

  /*
   * What comes back has no file: markdown carries a *path*, and this app's
   * pictures are ids into IndexedDB. Inventing a file id from a filename
   * would produce a block pointing at nothing while claiming to point at
   * something, so the block comes back empty and the editor asks.
   */
  it('reads a picture back with its words but without a file', () => {
    const back = fromMarkdown('![A scanned page](scan.png)');
    const found = back.find((b) => b.kind === 'image');
    expect(found).toBeDefined();
    if (found?.kind !== 'image') throw new Error('not an image block');
    expect(found.alt).toBe('A scanned page');
    expect(found.name).toBe('scan.png');
    expect(found.fileId).toBe('');
  });
});

describe('the picture in the exported .docx', () => {
  it('files the bytes, declares the type, and embeds the relationship', () => {
    const made = parts(doc([image()]), drive({ f1: 'eleven-by-four.png' }));
    expect(made.media['word/media/image1.png']).toEqual(pix('eleven-by-four.png'));
    expect(made.text['[Content_Types].xml']).toContain(
      '<Default Extension="png" ContentType="image/png"/>',
    );
    const rels = parse(made.text['word/_rels/document.xml.rels']);
    const rel = [...rels.querySelectorAll('Relationship')].find(
      (r) => r.getAttribute('Target') === 'media/image1.png',
    );
    expect(rel).toBeDefined();
    expect(made.text['word/document.xml']).toContain(`<a:blip r:embed="${rel?.getAttribute('Id')}"/>`);
  });

  it('draws it at the size it really is', () => {
    const made = parts(doc([image()]), drive({ f1: 'eleven-by-four.png' }));
    expect(made.text['word/document.xml']).toContain(
      `<wp:extent cx="${emus(11)}" cy="${emus(4)}"/>`,
    );
  });

  /*
   * The one that matters on a real screenshot: 1200 pixels is 12.5 inches at
   * 96 to the inch, and Word draws exactly what it is told — so a drawing
   * written at its natural size runs off the paper rather than being scaled
   * to fit by the reader.
   */
  it('brings a picture wider than the text column down to it, keeping its shape', () => {
    const made = parts(doc([image()]), drive({ f1: 'wide-1200-by-300.png' }));
    const found = made.text['word/document.xml'].match(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/);
    expect(found).not.toBeNull();
    const cx = Number(found?.[1]);
    const cy = Number(found?.[2]);
    expect(cx).toBe(Math.round(6.5 * EMU_PER_INCH));
    // 1200×300 is four to one, and it still is.
    expect(Math.round((cx / cy) * 100) / 100).toBe(4);
  });

  it('carries the alt text, which is what a screen reader in Word reads out', () => {
    const body = parts(doc([image()]), drive({ f1: 'eleven-by-four.png' })).text['word/document.xml'];
    expect([...body.matchAll(/descr="([^"]*)"/g)].map((m) => m[1])).toEqual([
      'Turnout by ward, 2020',
      'Turnout by ward, 2020',
    ]);
  });

  it('writes the caption as a caption, under the picture', () => {
    const body = parts(doc([image()]), drive({ f1: 'eleven-by-four.png' })).text['word/document.xml'];
    expect(body.indexOf('<w:drawing>')).toBeLessThan(body.indexOf('Figure 1. Turnout.'));
    expect(body).toContain('<w:pStyle w:val="Caption"/>');
  });

  /* What Word writes: one part per picture, however many times it is placed. */
  it('files a picture used twice once', () => {
    const made = parts(
      doc([image(), image({ caption: 'Figure 2. The same chart again.' })]),
      drive({ f1: 'eleven-by-four.png' }),
    );
    expect(Object.keys(made.media)).toEqual(['word/media/image1.png']);
    expect(made.text['word/document.xml'].match(/<a:blip /g)?.length).toBe(2);
    expect(
      made.text['[Content_Types].xml'].match(/<Default Extension="png"/g)?.length,
    ).toBe(1);
  });

  it('files two different pictures separately, each with its own type declared', () => {
    const made = parts(
      doc([image(), image({ fileId: 'f2', name: 'scan.jpg' })]),
      drive({ f1: 'eleven-by-four.png', f2: 'three-by-seven.jpg' }),
    );
    expect(Object.keys(made.media).sort()).toEqual([
      'word/media/image1.png',
      'word/media/image2.jpeg',
    ]);
    expect(made.text['[Content_Types].xml']).toContain('ContentType="image/jpeg"');
  });

  /*
   * Pictures and links share one relationship namespace, and an id used twice
   * is a document Word offers to repair. The picture must therefore number
   * after every link in the document, including one that comes *after* it.
   */
  it('does not reuse a relationship id a link further down has taken', () => {
    const made = parts(
      doc([image(), { kind: 'text', text: 'As set out in [the brief](https://a.com).' }]),
      drive({ f1: 'eleven-by-four.png' }),
    );
    const ids = [...parse(made.text['word/_rels/document.xml.rels']).querySelectorAll('Relationship')]
      .map((r) => r.getAttribute('Id'));
    expect(new Set(ids).size).toBe(ids.length);
    // Four distinct ids, not four in a particular order: the relationships
    // are written links-then-pictures and read by id, so the picture holding
    // rId3 while the link after it holds rId4 is exactly right.
    expect([...ids].sort()).toEqual(['rId1', 'rId2', 'rId3', 'rId4']);
  });

  /*
   * A page header is a third fixed relationship, and it is written before the
   * body is walked — so a picture that numbered from two would take the
   * header's own id. Word opens a document whose relationship points at the
   * wrong part as unreadable, not as a missing picture, which is why this is
   * checked on the header case specifically and not left to the plain one.
   */
  it('numbers above the page header, when the layout asks for one', () => {
    const made = parts(
      {
        ...doc([image(), { kind: 'text', text: 'See [the brief](https://a.com).' }]),
        layout: fromStyle('apa'),
      },
      drive({ f1: 'eleven-by-four.png' }),
    );
    expect(made.text['word/header1.xml']).toBeDefined();
    const rels = [...parse(made.text['word/_rels/document.xml.rels']).querySelectorAll('Relationship')];
    const ids = rels.map((r) => r.getAttribute('Id'));
    expect(new Set(ids).size).toBe(ids.length);
    const header = rels.find((r) => r.getAttribute('Target') === 'header1.xml');
    const picture = rels.find((r) => r.getAttribute('Target') === 'media/image1.png');
    expect(header?.getAttribute('Id')).toBe('rId3');
    expect(picture?.getAttribute('Id')).not.toBe('rId3');
  });

  /*
   * A file binned from the drive is an ordinary thing, not a corrupt
   * document. The caption survives, there is no drawing, and nothing is
   * declared or filed that is not there.
   */
  it('writes the caption and no picture when the file has gone', () => {
    const made = parts(doc([image()]), drive({}));
    expect(made.text['word/document.xml']).not.toContain('<w:drawing>');
    expect(made.text['word/document.xml']).toContain('Figure 1. Turnout.');
    expect(made.media).toEqual({});
    expect(made.text['[Content_Types].xml']).not.toContain('Extension="png"');
    expect(
      parse(made.text['word/_rels/document.xml.rels']).querySelectorAll('Relationship').length,
    ).toBe(2);
  });

  it('leaves nothing behind for an image block that was never given a file', () => {
    const made = parts(doc([image({ fileId: '', caption: '' })]), drive({}));
    expect(made.text['word/document.xml']).not.toContain('<w:drawing>');
    expect(made.media).toEqual({});
  });

  it('stays well-formed, and escapes alt text with markup characters in it', () => {
    const made = parts(
      doc([image({ alt: 'Growth & "shock" <1990>', caption: 'R&D' })]),
      drive({ f1: 'eleven-by-four.png' }),
    );
    for (const [path, body] of Object.entries(made.text)) {
      expect(() => parse(body), path).not.toThrow();
    }
    expect(made.text['word/document.xml']).toContain('descr="Growth &amp; &quot;shock&quot; &lt;1990&gt;"');
  });
});
