// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blankDoc, toMarkdown, words, type Block, type Doc, type Note } from './document';
import { parts } from './docx';
import { fromDocx } from './docxin';
import { docx } from './docx';

/**
 * Notes in the margin, and the Word comments they become.
 *
 * A comment is four things in four places — a range start, a range end and a
 * reference in the body, an entry in `comments.xml`, a content type and a
 * relationship — and the failure when one is missing is not a missing
 * comment. Word reports the whole document as unreadable, after it has been
 * emailed. So most of this checks the four agree.
 */

const note = (over: Partial<Note> = {}): Note => ({
  id: 'n1',
  text: 'Check this citation.',
  at: Date.UTC(2026, 8, 14, 12),
  done: false,
  ...over,
});

const doc = (blocks: Block[]): Doc => ({ ...blankDoc('Paper'), id: 'd1', blocks });
const made = (blocks: Block[]) => parts(doc(blocks));

describe('a note in the exported .docx', () => {
  it('writes the four things a comment is, and no more', () => {
    const out = made([{ kind: 'text', text: 'A claim.', notes: [note()] }]);
    expect(out.text['word/document.xml']).toContain('<w:commentRangeStart w:id="0"/>');
    expect(out.text['word/document.xml']).toContain('<w:commentRangeEnd w:id="0"/>');
    expect(out.text['word/document.xml']).toContain('<w:commentReference w:id="0"/>');
    expect(out.text['word/comments.xml']).toContain('Check this citation.');
    expect(out.text['[Content_Types].xml']).toContain('/word/comments.xml');
    expect(out.text['word/_rels/document.xml.rels']).toContain('Target="comments.xml"');
  });

  /* The whole part, the type and the relationship arrive together or not at
     all — which is the thing that makes Word refuse a file outright. */
  it('writes none of them for a document with no notes', () => {
    const out = made([{ kind: 'text', text: 'A claim.' }]);
    expect(out.text['word/comments.xml']).toBeUndefined();
    expect(out.text['[Content_Types].xml']).not.toContain('comments.xml');
    expect(out.text['word/_rels/document.xml.rels']).not.toContain('comments.xml');
    expect(out.text['word/document.xml']).not.toContain('commentRange');
  });

  /*
   * Inside the paragraph, not around it. A range that opens before `<w:p>`
   * and closes after it covers a paragraph mark, which Word draws as a
   * comment anchored to nothing.
   */
  it('puts the range inside the paragraph it is about', () => {
    const body = made([{ kind: 'text', text: 'A claim.', notes: [note()] }]).text[
      'word/document.xml'
    ];
    const start = body.indexOf('<w:commentRangeStart');
    const para = body.indexOf('<w:p>', body.indexOf('<w:body>'));
    expect(start).toBeGreaterThan(para);
    expect(body.indexOf('<w:commentRangeEnd')).toBeLessThan(body.indexOf('</w:body>'));
  });

  it('spans a whole list, from its first item to its last', () => {
    const body = made([
      {
        kind: 'bullets',
        numbered: false,
        items: [
          { text: 'One', level: 0 },
          { text: 'Two', level: 0 },
        ],
        notes: [note()],
      },
    ]).text['word/document.xml'];
    expect(body.indexOf('<w:commentRangeStart')).toBeLessThan(body.indexOf('One'));
    expect(body.indexOf('<w:commentRangeEnd')).toBeGreaterThan(body.indexOf('Two'));
  });

  it('numbers several notes apart, on one block and across blocks', () => {
    const body = made([
      { kind: 'text', text: 'One.', notes: [note({ id: 'a' }), note({ id: 'b', text: 'And.' })] },
      { kind: 'text', text: 'Two.', notes: [note({ id: 'c', text: 'Third.' })] },
    ]).text['word/document.xml'];
    const ids = [...body.matchAll(/<w:commentReference w:id="(\d+)"\/>/g)].map((m) => m[1]);
    expect(ids).toEqual(['0', '1', '2']);
  });

  /* A resolved note goes out resolved, which Word keeps in a second part
     that finds a comment by its paragraph's id rather than the comment's. */
  it('carries a resolved note out as resolved', () => {
    const out = made([{ kind: 'text', text: 'A claim.', notes: [note({ done: true })] }]);
    const extended = out.text['word/commentsExtended.xml'];
    expect(extended).toContain('w15:done="1"');
    const paraId = /w14:paraId="([0-9A-F]{8})"/.exec(out.text['word/comments.xml'])?.[1];
    expect(paraId).toBeDefined();
    expect(paraId).not.toBe('00000000');
    expect(extended).toContain(`w15:paraId="${paraId}"`);
    expect(out.text['[Content_Types].xml']).toContain('commentsExtended');
  });

  it('leaves the second part out entirely when nothing is resolved', () => {
    const out = made([{ kind: 'text', text: 'A claim.', notes: [note()] }]);
    expect(out.text['word/commentsExtended.xml']).toBeUndefined();
    expect(out.text['[Content_Types].xml']).not.toContain('commentsExtended');
  });

  it('anchors nothing to a block that wrote nothing', () => {
    const out = made([{ kind: 'text', text: '   ', notes: [note()] }]);
    expect(out.text['word/document.xml']).not.toContain('commentRange');
    expect(out.text['word/comments.xml']).toBeUndefined();
  });

  it('defines the two styles a comment names', () => {
    const styles = made([{ kind: 'text', text: 'A.', notes: [note()] }]).text['word/styles.xml'];
    expect(styles).toContain('w:styleId="CommentText"');
    expect(styles).toContain('w:styleId="CommentReference"');
  });

  it('escapes a note with markup characters in it, and stays well-formed', () => {
    const out = made([
      { kind: 'text', text: 'A claim.', notes: [note({ text: 'R&D <1930> "really"?' })] },
    ]);
    for (const [path, part] of Object.entries(out.text)) {
      const parsed = new DOMParser().parseFromString(part, 'application/xml');
      expect(parsed.querySelector('parsererror'), path).toBeNull();
    }
    expect(out.text['word/comments.xml']).toContain('R&amp;D &lt;1930&gt;');
  });

  it('does not take a relationship id a link or a picture is using', () => {
    const out = made([
      { kind: 'text', text: 'See [it](https://a.com).', notes: [note()] },
    ]);
    const ids = [
      ...out.text['word/_rels/document.xml.rels'].matchAll(/Id="(rId\d+)"/g),
    ].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('a note through Word and back', () => {
  const round = async (blocks: Block[]) => {
    const blob = await docx(doc(blocks));
    return fromDocx(new File([await blob.arrayBuffer()], 'Paper.docx'));
  };

  it('comes home on the block it was against', async () => {
    const back = await round([
      { kind: 'text', text: 'First.' },
      { kind: 'text', text: 'A claim.', notes: [note()] },
    ]);
    expect(back.doc.blocks[0].notes ?? []).toEqual([]);
    expect(back.doc.blocks[1].notes?.map((n) => n.text)).toEqual(['Check this citation.']);
  });

  it('comes home resolved when it went out resolved', async () => {
    const back = await round([{ kind: 'text', text: 'A claim.', notes: [note({ done: true })] }]);
    expect(back.doc.blocks[0].notes?.[0].done).toBe(true);
  });

  it('keeps two notes on one block as two', async () => {
    const back = await round([
      { kind: 'text', text: 'A claim.', notes: [note({ id: 'a' }), note({ id: 'b', text: 'And.' })] },
    ]);
    expect(back.doc.blocks[0].notes).toHaveLength(2);
  });

  it('says nothing about comments when there were none to leave behind', async () => {
    const back = await round([{ kind: 'text', text: 'A claim.' }]);
    expect(back.notes.join(' ')).not.toContain('Comments');
  });
});

describe('what a note is not', () => {
  it('is not words in the document, and not content on its own', () => {
    expect(words(doc([{ kind: 'text', text: 'one two', notes: [note()] }]))).toBe(2);
  });

  /* Markdown has no margin. The note stays in the app rather than being
     written into the prose, where it would read as something the author
     meant to say. */
  it('is left out of the markdown, and takes none of the words with it', () => {
    const text = toMarkdown(doc([{ kind: 'text', text: 'A claim.', notes: [note()] }]));
    expect(text).toContain('A claim.');
    expect(text).not.toContain('Check this citation');
  });
});
