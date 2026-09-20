import { describe, expect, it } from 'vitest';
import { fromDocx } from './docxin';
import { docx, type Picture } from './docx';
import { blankDoc, listed, type Block, type Doc } from './document';
import { sizeOf } from './imagesize';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reading a .docx back into blocks.
 *
 * Almost every test here goes out through `lib/docx.ts` and back in through
 * this reader, and compares the blocks with the ones that went out. That is
 * the property worth having — a document can leave this app and come home —
 * and it is a far better test than asserting against XML I would be writing
 * on both sides of.
 *
 * It is not the *only* test worth having, because a round trip through my own
 * writer proves nothing about a file Word made. The fixtures below cover the
 * shapes Word writes differently: bold turned off with `w:val="0"`, a
 * sentence split into runs mid-phrase, a numbered list whose `numId` is not
 * this app's.
 */

const doc = (blocks: Block[], title = 'Paper'): Doc => ({ ...blankDoc(title), id: 'd1', blocks });

const pix = (name: string): Picture => {
  const bytes = new Uint8Array(readFileSync(join(__dirname, '__pix', name)));
  return { bytes, size: sizeOf(bytes)! };
};

/** Out through the writer, in through the reader. */
async function round(blocks: Block[], found: (id: string) => Picture | undefined = () => undefined) {
  const blob = await docx(doc(blocks), found);
  const file = new File([await blob.arrayBuffer()], 'Paper.docx');
  return fromDocx(file);
}

describe('a document this app wrote', () => {
  it('comes home with its headings and paragraphs', async () => {
    const blocks: Block[] = [
      { kind: 'heading', level: 1, text: 'Findings' },
      { kind: 'text', text: 'The opening paragraph.' },
      { kind: 'heading', level: 2, text: 'Method' },
      { kind: 'text', text: 'And another.' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps the title and subtitle as the document’s own, not as paragraphs', async () => {
    const made = await docx({ ...blankDoc('Tariffs'), id: 'd', subtitle: 'A memo', blocks: [
      { kind: 'text', text: 'Body.' },
    ] });
    const read = await fromDocx(new File([await made.arrayBuffer()], 'whatever.docx'));
    expect(read.doc.title).toBe('Tariffs');
    expect(read.doc.subtitle).toBe('A memo');
    expect(read.doc.blocks).toEqual([{ kind: 'text', text: 'Body.' }]);
  });

  it('keeps the marks inside a line', async () => {
    const blocks: Block[] = [
      { kind: 'text', text: 'Some **bold** and some *italic* and some ~~struck~~ and `code`.' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  /*
   * The whole point of a round trip, for the two marks Word has and markdown
   * does not: they go out as `<w:u>` and `<w:highlight>` and have to come back
   * as the markers the editor understands, not as the words with the emphasis
   * quietly gone. Both exports and both readers, in one claim.
   */
  it('keeps an underline and a highlight through Word and back', async () => {
    const blocks: Block[] = [
      { kind: 'text', text: 'The ++signed++ copy is ==the one that counts==.' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps an underlined link underlined once, and still a link', async () => {
    const blocks: Block[] = [
      { kind: 'text', text: 'See [the syllabus](https://example.com/s.pdf) and ++sign it++.' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps a link as a link, not as the words with the address lost', async () => {
    const blocks: Block[] = [
      { kind: 'text', text: 'See [the syllabus](https://example.com/s.pdf) for dates.' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps a list, its kind and its nesting', async () => {
    const blocks: Block[] = [
      {
        kind: 'bullets',
        numbered: true,
        items: [
          { text: 'One', level: 0 },
          { text: 'One a', level: 1 },
          { text: 'One a i', level: 2 },
          { text: 'Two', level: 0 },
        ],
      },
    ];
    const back = await round(blocks);
    const list = back.doc.blocks[0];
    expect(list.kind).toBe('bullets');
    if (list.kind !== 'bullets') throw new Error('not a list');
    expect(list.numbered).toBe(true);
    expect(listed(list.items)).toEqual([
      { text: 'One', level: 0 },
      { text: 'One a', level: 1 },
      { text: 'One a i', level: 2 },
      { text: 'Two', level: 0 },
    ]);
  });

  it('knows a bulleted list from a numbered one', async () => {
    const back = await round([
      { kind: 'bullets', numbered: false, items: [{ text: 'One', level: 0 }] },
    ]);
    expect(back.doc.blocks[0]).toMatchObject({ kind: 'bullets', numbered: false });
  });

  it('keeps a checklist and which of it is done', async () => {
    const blocks: Block[] = [
      {
        kind: 'checks',
        items: [
          { text: 'Pull the returns', done: true },
          { text: 'Redraw the map', done: false },
        ],
      },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps a table and its header row', async () => {
    const blocks: Block[] = [
      { kind: 'table', rows: [['Ward', 'Turnout'], ['1', '62%']], header: true, caption: '' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps a quotation with the attribution as its source', async () => {
    const blocks: Block[] = [{ kind: 'quote', text: 'A passage.', source: 'Keynes, 1936' }];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps a code block as one block, with its indentation', async () => {
    const blocks: Block[] = [
      { kind: 'code', text: 'def gini(x):\n    return 1 - sum(p * p for p in x)', language: '' },
    ];
    const back = await round(blocks);
    expect(back.doc.blocks[0]).toEqual(blocks[0]);
  });

  it('keeps a page break and a divider, and tells them apart', async () => {
    const blocks: Block[] = [
      { kind: 'text', text: 'One.' },
      { kind: 'rule' },
      { kind: 'text', text: 'Two.' },
      { kind: 'break' },
      { kind: 'text', text: 'Three.' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('keeps each alignment', async () => {
    const blocks: Block[] = [
      { kind: 'heading', level: 2, text: 'Centred', align: 'center' },
      { kind: 'text', text: 'Right.', align: 'right' },
      { kind: 'text', text: 'Justified.', align: 'justify' },
      { kind: 'text', text: 'Nothing set.' },
    ];
    expect((await round(blocks)).doc.blocks).toEqual(blocks);
  });

  it('brings a picture back with its bytes and its alt text', async () => {
    const back = await round(
      [{ kind: 'image', fileId: 'f1', name: 'chart.png', alt: 'Turnout by ward', caption: '' }],
      () => pix('eleven-by-four.png'),
    );
    const block = back.doc.blocks[0];
    expect(block.kind).toBe('image');
    if (block.kind !== 'image') throw new Error('not a picture');
    expect(block.alt).toBe('Turnout by ward');
    // Not filed here — the caller puts it in the drive and fills the id in.
    expect(block.fileId).toBe('');
    expect(back.media).toHaveLength(1);
    expect(back.media[0].name).toBe(block.name);
    expect(back.media[0].bytes).toEqual(new Uint8Array(readFileSync(join(__dirname, '__pix', 'eleven-by-four.png'))));
  });

  it('carries a whole document of everything home in one piece', async () => {
    const blocks: Block[] = [
      { kind: 'heading', level: 1, text: 'Turnout' },
      { kind: 'text', text: 'Opening, with **emphasis**.' },
      { kind: 'bullets', numbered: false, items: [{ text: 'A point', level: 0 }, { text: 'Under it', level: 1 }] },
      { kind: 'quote', text: 'A passage.', source: 'Keynes' },
      { kind: 'table', rows: [['a', 'b'], ['1', '2']], header: true, caption: '' },
      { kind: 'code', text: 'x = 1', language: '' },
      { kind: 'rule' },
      { kind: 'checks', items: [{ text: 'Done thing', done: true }] },
      { kind: 'break' },
      { kind: 'text', text: 'The end.' },
    ];
    const back = await round(blocks);
    expect(back.doc.blocks.map((b) => b.kind)).toEqual(blocks.map((b) => b.kind));
  });
});

/**
 * What Word writes that this app does not, as the XML rather than through the
 * writer — a round trip through my own exporter cannot prove any of these.
 */
describe('a document Word wrote', () => {
  const wrap = (body: string) =>
    new File(
      [
        new Uint8Array(zipped({
          'word/document.xml':
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
            `<w:body>${body}</w:body></w:document>`,
        })),
      ],
      'Word.docx',
    );

  it('reads bold turned off by a run, rather than as bold', async () => {
    const back = await fromDocx(
      wrap(
        '<w:p><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>plain</w:t></w:r></w:p>',
      ),
    );
    expect(back.doc.blocks[0]).toEqual({ kind: 'text', text: 'plain' });
  });

  /*
   * Word splits a sentence into runs wherever a property changes, so a bold
   * phrase in the middle arrives as three runs and the spaces sit at their
   * edges. `** important **` is not emphasis in markdown — it is four
   * asterisks and a word — so the markers have to go inside the spaces.
   */
  it('puts the markers inside the spaces when a phrase is split across runs', async () => {
    const back = await fromDocx(
      wrap(
        '<w:p><w:r><w:t xml:space="preserve">the </w:t></w:r>' +
          '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">important </w:t></w:r>' +
          '<w:r><w:t>bit</w:t></w:r></w:p>',
      ),
    );
    expect(back.doc.blocks[0]).toEqual({ kind: 'text', text: 'the **important** bit' });
  });

  it('reads an underline and a highlight back as the marks the editor uses', async () => {
    const back = await fromDocx(
      wrap(
        '<w:p><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>signed</w:t></w:r>' +
          '<w:r><w:t xml:space="preserve"> and </w:t></w:r>' +
          '<w:r><w:rPr><w:highlight w:val="cyan"/></w:rPr><w:t>marked</w:t></w:r></w:p>',
      ),
    );
    /* Any of Word's seventeen pens comes back as the one mark this app has.
       The alternative is seventeen markers nobody typed. */
    expect(back.doc.blocks[0]).toEqual({ kind: 'text', text: '++signed++ and ==marked==' });
  });

  it('reads the pen lifted as no highlight, not as a highlight', async () => {
    const back = await fromDocx(
      wrap('<w:p><w:r><w:rPr><w:highlight w:val="none"/></w:rPr><w:t>plain</w:t></w:r></w:p>'),
    );
    expect(back.doc.blocks[0]).toEqual({ kind: 'text', text: 'plain' });
  });

  /*
   * The trap, and the reason it matters more than it looks: every word
   * processor underlines a hyperlink, and none of them means it as emphasis.
   * Read naively, one trip through Word turns `[words](url)` into
   * `[++words++](url)` — and because the app writes what it read, the next
   * trip adds another pair, and the one after that another.
   */
  it('does not read a link\'s own underline as emphasis the writer typed', async () => {
    const file = new File(
      [
        new Uint8Array(zipped({
          'word/_rels/document.xml.rels':
            '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
            '<Relationship Id="rId9" Target="https://example.edu/paper"/></Relationships>',
          'word/document.xml':
            '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
            '<w:body><w:p><w:hyperlink r:id="rId9"><w:r><w:rPr>' +
            '<w:color w:val="0563C1"/><w:u w:val="single"/>' +
            '</w:rPr><w:t>the paper</w:t></w:r></w:hyperlink></w:p></w:body></w:document>',
        })),
      ],
      'Word.docx',
    );
    const back = await fromDocx(file);
    expect(back.doc.blocks[0]).toEqual({
      kind: 'text',
      text: '[the paper](https://example.edu/paper)',
    });
  });

  it('reads a heading below level 3 as level 3, and says so', async () => {
    const back = await fromDocx(
      wrap('<w:p><w:pPr><w:pStyle w:val="Heading5"/></w:pPr><w:r><w:t>Deep</w:t></w:r></w:p>'),
    );
    expect(back.doc.blocks[0]).toEqual({ kind: 'heading', level: 3, text: 'Deep' });
    expect(back.notes.join(' ')).toContain('level 3');
  });

  it('reads a table whose cells hold several paragraphs', async () => {
    const back = await fromDocx(
      wrap(
        '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>one</w:t></w:r></w:p>' +
          '<w:p><w:r><w:t>two</w:t></w:r></w:p></w:tc>' +
          '<w:tc><w:p><w:r><w:t>three</w:t></w:r></w:p></w:tc></w:tr></w:tbl>',
      ),
    );
    expect(back.doc.blocks[0]).toMatchObject({ kind: 'table', rows: [['one two', 'three']] });
  });

  /* The reason `chunks` scans rather than matching: `</w:p>` inside the first
     cell would otherwise close the table from the inside. */
  it('does not let a table’s own paragraphs escape it', async () => {
    const back = await fromDocx(
      wrap(
        '<w:p><w:r><w:t>before</w:t></w:r></w:p>' +
          '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>inside</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
          '<w:p><w:r><w:t>after</w:t></w:r></w:p>',
      ),
    );
    expect(back.doc.blocks.map((b) => b.kind)).toEqual(['text', 'table', 'text']);
  });

  it('keeps an ampersand and an angle bracket as the characters they are', async () => {
    const back = await fromDocx(
      wrap('<w:p><w:r><w:t>Supply &amp; demand &lt;1930&gt;</w:t></w:r></w:p>'),
    );
    expect(back.doc.blocks[0]).toEqual({ kind: 'text', text: 'Supply & demand <1930>' });
  });

  it('names the file as the title when the document has none', async () => {
    const back = await fromDocx(wrap('<w:p><w:r><w:t>Body.</w:t></w:r></w:p>'));
    expect(back.doc.title).toBe('Word');
  });

  /* Comments themselves now come in — see `docnotes.test.ts`. This is the
     case where one refers to an entry that is not in the file, which is a
     comment that did not arrive and is worth saying so about. */
  it('says what it left behind rather than dropping it in silence', async () => {
    const back = await fromDocx(
      wrap('<w:p><w:commentReference w:id="1"/><w:r><w:t>Body.</w:t></w:r></w:p>'),
    );
    expect(back.notes.join(' ')).toContain('comment could not be placed');
  });

  it('refuses a file that is not a zip, in words that say what to do', async () => {
    await expect(fromDocx(new File([new Uint8Array([1, 2, 3])], 'old.docx'))).rejects.toThrow(
      /older \.doc/,
    );
  });

  it('refuses a zip with no document in it', async () => {
    await expect(
      fromDocx(new File([new Uint8Array(zipped({ 'a.txt': 'hello' }))], 'empty.docx')),
    ).rejects.toThrow(/no document/);
  });
});

/**
 * A file this codebase did not write.
 *
 * Made by python-docx on Word's own default template, which is the only way
 * to be sure the reader is not just agreeing with the writer. It caught the
 * thing that mattered most: Word does not put `<w:numPr>` on a list paragraph
 * it styled with *List Bullet* — the numbering is in the style — so every
 * list in every Word-made document arrived as a run of ordinary paragraphs,
 * silently, because all the words were still there.
 */
describe('a file made outside this app entirely', () => {
  const opened = async () => {
    const bytes = new Uint8Array(readFileSync(join(__dirname, '__docs', 'word-styles.docx')));
    return fromDocx(new File([bytes], 'word-styles.docx'));
  };

  it('reads its headings, its marks and its quotation', async () => {
    const read = await opened();
    expect(read.doc.blocks[0]).toEqual({
      kind: 'heading',
      level: 1,
      text: 'Turnout in Davidson County',
    });
    expect(read.doc.blocks[1]).toEqual({
      kind: 'text',
      text: 'An opening paragraph with **bold** and *italic* in it.',
    });
    expect(read.doc.blocks.some((b) => b.kind === 'quote')).toBe(true);
  });

  it('reads a list whose numbering lives in the style, not on the paragraph', async () => {
    const read = await opened();
    const lists = read.doc.blocks.filter((b) => b.kind === 'bullets');
    expect(lists).toHaveLength(2);
    if (lists[0].kind !== 'bullets' || lists[1].kind !== 'bullets') throw new Error('not lists');
    expect(lists[0].numbered).toBe(false);
    expect(listed(lists[0].items)).toEqual([
      { text: 'A bulleted point', level: 0 },
      { text: 'A nested point', level: 1 },
      { text: 'Back out again', level: 0 },
    ]);
    expect(lists[1].numbered).toBe(true);
  });

  it('reads its table, its alignment and its page break', async () => {
    const read = await opened();
    expect(read.doc.blocks.find((b) => b.kind === 'table')).toMatchObject({
      rows: [
        ['Ward', 'Turnout'],
        ['1', '62%'],
      ],
    });
    expect(read.doc.blocks.find((b) => b.kind === 'text' && b.align === 'center')).toBeDefined();
    expect(read.doc.blocks.some((b) => b.kind === 'break')).toBe(true);
  });
});

/** A .docx is a zip; this makes one without going through the writer. */
function zipped(files: Record<string, string>): Uint8Array {
  const { zipSync, strToU8 } = require('fflate') as typeof import('fflate');
  const out: Record<string, Uint8Array> = {};
  for (const [name, body] of Object.entries(files)) out[name] = strToU8(body);
  return zipSync(out);
}
