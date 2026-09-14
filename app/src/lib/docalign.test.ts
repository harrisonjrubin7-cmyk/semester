// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blankDoc, fromMarkdown, toMarkdown, words, type Align, type Block, type Doc } from './document';
import { parts } from './docx';

/**
 * Alignment, which is a property of one paragraph rather than of the page.
 *
 * The document-wide half of page setup — font, size, line spacing, margins —
 * already lives in `lib/doclayout.ts`. This is the other kind: a centred
 * heading in a left-aligned paper, a date line against the right margin, a
 * justified body. It is stored per block for that reason.
 */

const doc = (blocks: Block[]): Doc => ({ ...blankDoc('Paper'), id: 'd1', blocks });
const body = (d: Doc) => parts(d).text['word/document.xml'];

describe('what reaches the Word file', () => {
  it('writes each alignment as the property Word reads', () => {
    const cases: [Align, string][] = [
      ['left', 'left'],
      ['center', 'center'],
      ['right', 'right'],
      // OOXML calls it `both` — the two edges — where the button says Justify.
      ['justify', 'both'],
    ];
    for (const [align, val] of cases) {
      expect(body(doc([{ kind: 'text', text: 'A line.', align }])), align).toContain(
        `<w:jc w:val="${val}"/>`,
      );
    }
  });

  /* A block with nothing set follows the document. Writing `left` for it
     would override a justified style with something that only looks like the
     absence of a choice. */
  it('writes nothing at all for a paragraph that was never aligned', () => {
    expect(body(doc([{ kind: 'text', text: 'A line.' }]))).not.toContain('<w:jc');
  });

  it('aligns a heading, a paragraph and a quotation', () => {
    expect(body(doc([{ kind: 'heading', level: 2, text: 'Findings', align: 'center' }]))).toContain(
      '<w:jc w:val="center"/>',
    );
    expect(
      body(doc([{ kind: 'quote', text: 'A passage.', source: 'Keynes', align: 'right' }])),
    ).toContain('<w:jc w:val="right"/>');
  });

  /*
   * The attribution takes the quotation's alignment too. They are one block
   * on screen and one thing on the page; a centred passage with its source
   * hard against the left margin reads as a mistake rather than as a choice.
   */
  it('carries a quotation’s alignment onto its attribution', () => {
    const out = body(doc([{ kind: 'quote', text: 'A passage.', source: 'Keynes', align: 'center' }]));
    expect(out.match(/<w:jc w:val="center"\/>/g)?.length).toBe(2);
  });

  it('keeps the paragraph style beside the alignment rather than instead of it', () => {
    const out = body(doc([{ kind: 'heading', level: 1, text: 'One', align: 'center' }]));
    expect(out).toContain('<w:pStyle w:val="Heading1"/><w:jc w:val="center"/>');
  });

  it('stays well-formed', () => {
    const made = parts(
      doc([
        { kind: 'heading', level: 1, text: 'One', align: 'right' },
        { kind: 'text', text: 'Two & three', align: 'justify' },
        { kind: 'quote', text: 'Four', source: 'Five', align: 'center' },
      ]),
    );
    for (const [path, part] of Object.entries(made.text)) {
      const parsed = new DOMParser().parseFromString(part, 'application/xml');
      expect(parsed.querySelector('parsererror'), path).toBeNull();
    }
  });
});

describe('what markdown can carry', () => {
  /*
   * Nothing. Markdown describes a document's *structure* and has no concept
   * of a centred paragraph — the nearest thing is raw HTML, which would mean
   * inventing a spelling that means something in this app and nothing
   * anywhere else.
   *
   * So alignment is a `.docx` and print property, and the Markdown export
   * drops it. That is a real loss and it is pinned here rather than left to
   * be discovered: what must not happen is the words going with it.
   */
  it('drops the alignment and keeps every word', () => {
    const text = toMarkdown(
      doc([
        { kind: 'heading', level: 2, text: 'Findings', align: 'center' },
        { kind: 'text', text: 'The argument.', align: 'justify' },
      ]),
    );
    expect(text).toContain('## Findings');
    expect(text).toContain('The argument.');
    expect(text).not.toContain('center');
    expect(text).not.toContain('justify');
  });

  it('reads back as the same words, unaligned', () => {
    const again = fromMarkdown(
      toMarkdown(doc([{ kind: 'text', text: 'The argument.', align: 'center' }])).replace(
        /^# Paper\n\n/,
        '',
      ),
    );
    expect(again).toEqual([{ kind: 'text', text: 'The argument.' }]);
  });
});

describe('what alignment is not', () => {
  it('does not change the word count', () => {
    expect(words(doc([{ kind: 'text', text: 'one two three', align: 'center' }]))).toBe(3);
  });
});
