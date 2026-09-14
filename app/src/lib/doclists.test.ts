// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  DEEPEST,
  blankDoc,
  fromMarkdown,
  hasContent,
  listed,
  nested,
  toMarkdown,
  words,
  type Block,
  type Doc,
} from './document';
import { parts } from './docx';
import { characters, glance, replaceAll } from './doctools';

/**
 * Lists that nest, and the lists written before they could.
 *
 * The second half is the one that matters. `items` was `string[]` for the
 * whole life of this app before this, so a list in somebody's browser, in a
 * backup they exported in March, and in a document about to arrive over sync
 * is a list of bare strings. Every one of those has to keep working, and the
 * failure if it does not is not a crash — it is a document whose list draws
 * as blank rows, which is the worst kind.
 */

const doc = (blocks: Block[]): Doc => ({ ...blankDoc('Notes'), id: 'd1', blocks });
const body = (d: Doc) => parts(d).text['word/document.xml'];

const list = (items: (string | { text: string; level: number })[], numbered = false): Block => ({
  kind: 'bullets',
  items,
  numbered,
});

describe('a list written before nesting existed', () => {
  it('reads as lines at the left margin', () => {
    expect(listed(['one', 'two'])).toEqual([
      { text: 'one', level: 0 },
      { text: 'two', level: 0 },
    ]);
  });

  /* The shape that will actually be on disk for a while: some documents
     touched since the change, some not, and a backup restored across both. */
  it('reads a list that is half one shape and half the other', () => {
    expect(listed(['one', { text: 'sub', level: 1 }, 'two'])).toEqual([
      { text: 'one', level: 0 },
      { text: 'sub', level: 1 },
      { text: 'two', level: 0 },
    ]);
  });

  it('still counts, still exports, still has content', () => {
    const old = doc([list(['one two', 'three'])]);
    expect(words(old)).toBe(3);
    expect(hasContent(old)).toBe(true);
    expect(characters(old)).toBe('one two'.length + 'three'.length);
    expect(body(old)).toContain('one two');
    expect(glance(old)).toEqual(['• one two', '• three']);
  });

  it('survives a replace-all as lines rather than as strings', () => {
    const { doc: next } = replaceAll(doc([list(['a policy', 'another policy'])]), 'policy', 'rule');
    expect(next.blocks[0]).toMatchObject({
      items: [
        { text: 'a rule', level: 0 },
        { text: 'another rule', level: 0 },
      ],
    });
  });
});

describe('a level that could not be a tree', () => {
  /*
   * `[level 2, level 0]` is not a shape markdown, Word or HTML can draw — all
   * three describe a tree, and a sub-item of nothing is not one. A pasted
   * list is exactly where this turns up, so it is clamped rather than
   * rejected: the nearest real tree beats refusing somebody's paste.
   */
  it('is clamped to one deeper than the line above it', () => {
    expect(listed([{ text: 'a', level: 3 }]).map((l) => l.level)).toEqual([0]);
    expect(
      listed([
        { text: 'a', level: 0 },
        { text: 'b', level: 4 },
      ]).map((l) => l.level),
    ).toEqual([0, 1]);
  });

  it('stops at the deepest level the exporters define', () => {
    const deep = Array.from({ length: 9 }, (_, i) => ({ text: `l${i}`, level: i }));
    expect(Math.max(...listed(deep).map((l) => l.level))).toBe(DEEPEST);
  });

  it('reads a negative or fractional level as something sane', () => {
    expect(listed([{ text: 'a', level: -2 }, { text: 'b', level: 1.7 }]).map((l) => l.level)).toEqual(
      [0, 1],
    );
  });
});

describe('the tree the levels describe', () => {
  it('puts a sub-item under the line above it, not beside it', () => {
    const tree = nested([
      { text: 'one', level: 0 },
      { text: 'one a', level: 1 },
      { text: 'one a i', level: 2 },
      { text: 'two', level: 0 },
    ]);
    expect(tree.map((b) => b.line.text)).toEqual(['one', 'two']);
    expect(tree[0].under.map((b) => b.line.text)).toEqual(['one a']);
    expect(tree[0].under[0].under.map((b) => b.line.text)).toEqual(['one a i']);
    expect(tree[1].under).toEqual([]);
  });

  it('comes back out to the right parent after a deep run', () => {
    const tree = nested([
      { text: 'one', level: 0 },
      { text: 'a', level: 1 },
      { text: 'i', level: 2 },
      { text: 'b', level: 1 },
    ]);
    expect(tree[0].under.map((b) => b.line.text)).toEqual(['a', 'b']);
  });
});

describe('a nested list in markdown', () => {
  it('indents to the content column of the line above', () => {
    const text = toMarkdown(
      doc([list([{ text: 'one', level: 0 }, { text: 'sub', level: 1 }])]),
    );
    expect(text).toContain('- one\n  - sub');
  });

  /*
   * Three spaces for a numbered sub-item, not two: CommonMark wants a nested
   * item at the *content* column of its parent, and `1. ` is three characters
   * wide. Indent it by two and half the renderers on earth fold it into the
   * paragraph above.
   */
  it('indents a numbered sub-item past its parent’s marker', () => {
    const text = toMarkdown(
      doc([list([{ text: 'one', level: 0 }, { text: 'sub', level: 1 }], true)]),
    );
    expect(text).toContain('1. one\n   1. sub');
  });

  it('restarts the numbers inside a sub-list and carries on after it', () => {
    const text = toMarkdown(
      doc([
        list(
          [
            { text: 'one', level: 0 },
            { text: 'a', level: 1 },
            { text: 'b', level: 1 },
            { text: 'two', level: 0 },
          ],
          true,
        ),
      ]),
    );
    expect(text).toContain('1. one\n   1. a\n   2. b\n2. two');
  });

  it('reads two-space and four-space files the same way', () => {
    for (const text of ['- one\n  - sub\n- two', '- one\n    - sub\n- two', '- one\n\t- sub\n- two']) {
      const [block] = fromMarkdown(text);
      expect(block.kind === 'bullets' ? listed(block.items).map((l) => l.level) : null, text).toEqual(
        [0, 1, 0],
      );
    }
  });

  it('carries a nested list out and back unchanged', () => {
    const before = list([
      { text: 'one', level: 0 },
      { text: 'a', level: 1 },
      { text: 'i', level: 2 },
      { text: 'two', level: 0 },
    ]);
    const again = fromMarkdown(toMarkdown(doc([before])).replace(/^# Notes\n\n/, ''));
    expect(again).toEqual([before]);
  });
});

describe('a nested list in the exported .docx', () => {
  it('states each line’s level on the line itself', () => {
    const out = body(doc([list([{ text: 'one', level: 0 }, { text: 'sub', level: 1 }])]));
    expect(out).toContain('<w:ilvl w:val="0"/>');
    expect(out).toContain('<w:ilvl w:val="1"/>');
  });

  /*
   * A `w:ilvl` is a reference into the numbering part. Point at a level that
   * part does not define and Word draws the item at the margin with no marker
   * at all — which reads as a list that lost its bullets rather than as a
   * broken file, and is why this checks the definitions and not just the
   * reference.
   */
  it('defines every level a list is allowed to reach', () => {
    const numbering = parts(doc([])).text['word/numbering.xml'];
    for (let at = 0; at <= DEEPEST; at += 1) {
      expect(numbering, `level ${at}`).toContain(`<w:lvl w:ilvl="${at}">`);
    }
  });

  it('gives each level its own glyph and its own indent', () => {
    const numbering = parts(doc([])).text['word/numbering.xml'];
    expect(numbering).toContain('<w:lvlText w:val="•"/>');
    expect(numbering).toContain('<w:lvlText w:val="○"/>');
    expect(numbering).toContain('<w:numFmt w:val="lowerLetter"/>');
    expect(numbering).toContain('<w:numFmt w:val="lowerRoman"/>');
    expect(numbering).toContain('w:left="720"');
    expect(numbering).toContain('w:left="1440"');
  });

  it('stays well-formed', () => {
    const made = parts(doc([list([{ text: 'one', level: 0 }, { text: 'sub', level: 1 }], true)]));
    for (const [path, part] of Object.entries(made.text)) {
      const parsed = new DOMParser().parseFromString(part, 'application/xml');
      expect(parsed.querySelector('parsererror'), path).toBeNull();
    }
  });
});
