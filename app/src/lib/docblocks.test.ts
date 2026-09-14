import { describe, expect, it } from 'vitest';
import { KINDS } from '../screens/Write';
import {
  BLOCK_LABEL,
  blankBlock,
  blankDoc,
  fromMarkdown,
  hasContent,
  summary,
  toMarkdown,
  words,
  type Block,
  type BlockKind,
  type Doc,
} from './document';

/**
 * Code blocks and checklists.
 *
 * The two of these that are easy to get wrong are both about *precedence*:
 * a snippet may contain anything, including the fence that ends it and lines
 * that look like markdown, and `- [ ] thing` is a perfectly good bullet until
 * something looks closer.
 */

/*
 * Built from the real constructor rather than cast into shape. The first
 * version of this was an object literal with `as Doc` on it, which compiled
 * happily while missing `subtitle` — and every test here failed on a `trim`
 * of undefined rather than on anything it was written to check.
 */
const doc = (blocks: Block[]): Doc => ({ ...blankDoc('T'), id: 'd', blocks });

/**
 * Out to markdown and back, which is how a document leaves and returns.
 *
 * The title comes back as a level-1 heading, because `toMarkdown` writes it as
 * `# Title` and `fromMarkdown` has no way to tell that one `#` from any other
 * — see the note beside the heading branch. That is the existing round trip,
 * not something these blocks do, so it is dropped here rather than asserted
 * against in every test below.
 */
const round = (blocks: Block[]): Block[] => {
  const back = fromMarkdown(toMarkdown(doc(blocks)));
  expect(back[0]).toEqual({ kind: 'heading', level: 1, text: 'T' });
  return back.slice(1);
};

describe('a code block', () => {
  it('starts empty, with no language chosen', () => {
    expect(blankBlock('code')).toEqual({ kind: 'code', text: '', language: '' });
  });

  it('is written as a fenced block, carrying its language', () => {
    const md = toMarkdown(doc([{ kind: 'code', text: 'print(1)', language: 'python' }]));
    expect(md).toContain('```python\nprint(1)\n```');
  });

  it('comes back as code, with the language and the text intact', () => {
    const [block] = round([{ kind: 'code', text: 'print(1)\nprint(2)', language: 'python' }]);
    expect(block).toEqual({ kind: 'code', text: 'print(1)\nprint(2)', language: 'python' });
  });

  /*
   * The whole point of the kind. `**` in a shell glob or a Python power
   * operator is two asterisks somebody typed, and the markdown writer must not
   * be able to eat them.
   */
  it('keeps markdown characters as the characters they are', () => {
    const source = 'x = a ** b   # **not bold**\nls *.md';
    const [block] = round([{ kind: 'code', text: source, language: '' }]);
    expect(block).toEqual({ kind: 'code', text: source, language: '' });
  });

  it('keeps its indentation, which is the half of code that means something', () => {
    const source = 'def f():\n    if x:\n        return 1';
    const [block] = round([{ kind: 'code', text: source, language: 'python' }]);
    expect((block as { text: string }).text).toBe(source);
  });

  /*
   * A snippet about markdown contains three backticks. A three-backtick fence
   * would end the block there and leave the rest as prose — silently, and only
   * for the documents whose subject is markdown.
   */
  it('uses a longer fence when the code contains one', () => {
    const source = '```\nnested\n```';
    const md = toMarkdown(doc([{ kind: 'code', text: source, language: '' }]));
    expect(md).toContain('````\n```\nnested\n```\n````');
    const [block] = round([{ kind: 'code', text: source, language: '' }]);
    expect((block as { text: string }).text).toBe(source);
  });

  it('is read back from a tilde fence too, which is the other way to write one', () => {
    const [block] = fromMarkdown('~~~js\nlet a = 1;\n~~~');
    expect(block).toEqual({ kind: 'code', text: 'let a = 1;', language: 'js' });
  });

  /*
   * Inside a fence, a line that looks like a heading or a bullet is a line of
   * code. Reading it as markdown would shred the snippet into blocks.
   */
  it('takes markdown-shaped lines inside it literally', () => {
    const source = '# not a heading\n- not a bullet\n| not | a table |';
    const [block, ...rest] = round([{ kind: 'code', text: source, language: '' }]);
    expect(block).toEqual({ kind: 'code', text: source, language: '' });
    expect(rest).toEqual([]);
  });

  it('is left out of the word count, as tables and equations already are', () => {
    const n = words(doc([
      { kind: 'text', text: 'three words here' },
      { kind: 'code', text: 'one two three four five six', language: '' },
    ]));
    expect(n).toBe(3);
  });

  it('counts as something in the document, once it holds anything', () => {
    expect(hasContent(doc([{ kind: 'code', text: '', language: '' }]))).toBe(false);
    expect(hasContent(doc([{ kind: 'code', text: 'x', language: '' }]))).toBe(true);
  });
});

describe('a checklist', () => {
  it('starts with one unticked item', () => {
    expect(blankBlock('checks')).toEqual({ kind: 'checks', items: [{ text: '', done: false }] });
  });

  it('is written the way a task list is written', () => {
    const md = toMarkdown(doc([
      { kind: 'checks', items: [{ text: 'read it', done: true }, { text: 'write it', done: false }] },
    ]));
    expect(md).toContain('- [x] read it\n- [ ] write it');
  });

  it('comes back with each item still ticked or not', () => {
    const items = [{ text: 'read it', done: true }, { text: 'write it', done: false }];
    const [block] = round([{ kind: 'checks', items }]);
    expect(block).toEqual({ kind: 'checks', items });
  });

  it('reads an upper-case X as ticked, because people type both', () => {
    const [block] = fromMarkdown('- [X] done');
    expect(block).toEqual({ kind: 'checks', items: [{ text: 'done', done: true }] });
  });

  /*
   * The precedence that matters. `- [ ] thing` matches the bullet pattern, and
   * read as one it becomes a bullet whose text starts with a literal `[ ]` —
   * the ticks quietly demoted to punctuation.
   */
  it('is not read as a bullet, which it also looks like', () => {
    const [block] = fromMarkdown('- [ ] a task');
    expect(block.kind).toBe('checks');
  });

  it('leaves an ordinary bullet alone', () => {
    const [block] = fromMarkdown('- a bullet');
    expect(block.kind).toBe('bullets');
  });

  it('keeps a bracket that is not a tick box as text', () => {
    const [block] = fromMarkdown('- [see appendix] for the rest');
    expect(block.kind).toBe('bullets');
  });

  it('counts its words, because a checklist is prose somebody wrote', () => {
    expect(words(doc([{ kind: 'checks', items: [{ text: 'two words', done: false }] }]))).toBe(2);
  });

  /*
   * `hasContent` falls through to `b.text`, which a checklist has not got — so
   * without its own branch an empty one answers `undefined !== ''` and a blank
   * document claims to hold something.
   */
  it('is not content while every item is empty', () => {
    expect(hasContent(doc([{ kind: 'checks', items: [{ text: '', done: false }] }]))).toBe(false);
    expect(hasContent(doc([{ kind: 'checks', items: [{ text: 'x', done: false }] }]))).toBe(true);
  });
});

/**
 * Every kind has to be reachable from the toolbar.
 *
 * The bug this pins: the toolbar held two hard-coded arrays of kinds while the
 * command palette read a separate list, so a new kind appeared in the palette
 * and silently not on the toolbar — two of the three lists agreed, and the one
 * people press did not. They are one list now, and this is what says so.
 */
describe('reaching a block from the toolbar', () => {
  it('offers every kind the document model has', () => {
    const offered = new Set(KINDS);
    const missing = (Object.keys(BLOCK_LABEL) as BlockKind[]).filter((k) => !offered.has(k));
    expect(missing).toEqual([]);
  });

  it('offers each of them once, so none is drawn in two groups', () => {
    expect(KINDS.length).toBe(new Set(KINDS).size);
  });
});

describe('what the document says it holds', () => {
  it('names both kinds', () => {
    const said = summary([
      { kind: 'code', text: 'x', language: '' },
      { kind: 'checks', items: [{ text: 'x', done: false }] },
    ]);
    expect(said).toContain('1 code');
    expect(said).toContain('1 checklist');
  });
});
