// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  PAGE_BREAK_MARK,
  blankDoc,
  fromMarkdown,
  hasContent,
  toMarkdown,
  words,
  type Block,
  type Doc,
} from './document';
import { parts } from './docx';
import { glance } from './doctools';

/**
 * A divider and a page break, which this app spelled the same way.
 *
 * `break` wrote `---` to markdown and emitted `<w:br w:type="page"/>` to the
 * `.docx`. `---` is markdown's *thematic break* — a line between sections, on
 * the same page — so the export said one thing and meant another, and the
 * import agreed with it because both ends made the same mistake. Nothing
 * caught it: there was no test of a page break's round trip at all, which is
 * how a conflation like this survives.
 *
 * So the two are separate kinds and the spellings are separate too. Most of
 * what follows is about telling them apart, because that is the whole of what
 * went wrong.
 */

const doc = (blocks: Block[]): Doc => ({ ...blankDoc('Tariffs'), id: 'd1', blocks });
const body = (d: Doc) => parts(d).text['word/document.xml'];

const parse = (text: string): Document => {
  const out = new DOMParser().parseFromString(text, 'application/xml');
  const bad = out.querySelector('parsererror');
  if (bad) throw new Error(bad.textContent ?? 'parse error');
  return out;
};

describe('a divider in markdown', () => {
  it('is written as the thematic break, which is what `---` means', () => {
    expect(toMarkdown(doc([{ kind: 'rule' }]))).toContain('\n---');
  });

  /* All three spellings are one thing in markdown, and a document pasted in
     from anywhere may use any of them. */
  it('is read back from any of the three spellings', () => {
    for (const mark of ['---', '***', '___', '  ---  ']) {
      const back = fromMarkdown(`One${'\n\n'}${mark}${'\n\n'}Two`);
      expect(back.map((b) => b.kind), mark).toEqual(['text', 'rule', 'text']);
    }
  });

  it('survives out and back', () => {
    const back = fromMarkdown(toMarkdown(doc([{ kind: 'text', text: 'Before.' }, { kind: 'rule' }])));
    expect(back.some((b) => b.kind === 'rule')).toBe(true);
    expect(back.some((b) => b.kind === 'break')).toBe(false);
  });
});

describe('a page break in markdown', () => {
  /*
   * The regression this whole change is about. A page break written as `---`
   * came home as a page break only because the reader was wrong in the same
   * direction; anywhere else it was a divider.
   */
  it('is no longer written as a divider', () => {
    const text = toMarkdown(doc([{ kind: 'break' }]));
    expect(text).toContain(PAGE_BREAK_MARK);
    expect(text).not.toContain('\n---');
  });

  it('comes home as a page break and not as a divider', () => {
    const back = fromMarkdown(toMarkdown(doc([{ kind: 'text', text: 'Before.' }, { kind: 'break' }])));
    expect(back.map((b) => b.kind)).toEqual(['heading', 'text', 'break']);
  });

  /* What Pandoc takes, so a document that came from there keeps its breaks.
     Read and not written — what this app writes is the comment. */
  it('reads the two spellings somebody is likely to have typed', () => {
    for (const mark of ['\\pagebreak', '\\newpage', '<!-- page-break -->', '<!-- PageBreak -->']) {
      const back = fromMarkdown(`One${'\n\n'}${mark}${'\n\n'}Two`);
      expect(back.map((b) => b.kind), mark).toEqual(['text', 'break', 'text']);
    }
  });

  /* The mark is a whole line or it is prose. An HTML comment that says
     anything else is somebody's note, and stays on the page as one. */
  it('does not take any old comment for one', () => {
    expect(fromMarkdown('<!-- ask Trounstine about this -->').map((b) => b.kind)).toEqual(['text']);
    expect(fromMarkdown('A line with <!-- pagebreak --> inside it').map((b) => b.kind)).toEqual([
      'text',
    ]);
  });
});

describe('the two of them in a document', () => {
  it('stay in the order they were written, and stay apart', () => {
    const made = doc([
      { kind: 'text', text: 'One.' },
      { kind: 'rule' },
      { kind: 'text', text: 'Two.' },
      { kind: 'break' },
      { kind: 'text', text: 'Three.' },
    ]);
    const back = fromMarkdown(toMarkdown(made));
    expect(back.map((b) => b.kind)).toEqual([
      'heading', 'text', 'rule', 'text', 'break', 'text',
    ]);
  });
});

describe('a divider in the exported .docx', () => {
  /*
   * Word has no horizontal-rule element. What its Borders button draws is a
   * paragraph with its bottom border on, so that is what this writes — the
   * format's own answer rather than a workaround.
   */
  it('is a paragraph with a border under it, not a page break', () => {
    const out = body(doc([{ kind: 'rule' }]));
    expect(out).toContain('<w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/>');
    expect(out).not.toContain('w:type="page"');
  });

  it('leaves the page break as a page break', () => {
    const out = body(doc([{ kind: 'break' }]));
    expect(out).toContain('<w:br w:type="page"/>');
    expect(out).not.toContain('w:pBdr');
  });

  it('stays well-formed with both in it', () => {
    const made = parts(doc([{ kind: 'rule' }, { kind: 'text', text: 'After.' }, { kind: 'break' }]));
    for (const [path, part] of Object.entries(made.text)) {
      expect(() => parse(part), path).not.toThrow();
    }
  });
});

describe('what a divider counts as', () => {
  /* A line is a mark about where other things go, not a thing the document
     holds — the same reading `hasContent` already had for a page break. */
  it('is not content on its own, and adds no words', () => {
    expect(hasContent(doc([{ kind: 'rule' }]))).toBe(false);
    expect(hasContent(doc([{ kind: 'rule' }, { kind: 'text', text: 'Something' }]))).toBe(true);
    expect(words(doc([{ kind: 'rule' }]))).toBe(0);
  });

  /* A line drawn across a four-line thumbnail reads as the end of it. */
  it('takes up none of a thumbnail', () => {
    expect(glance(doc([{ kind: 'rule' }, { kind: 'text', text: 'The opening line.' }]))).toEqual([
      'The opening line.',
    ]);
  });
});
