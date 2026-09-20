import { describe, expect, it } from 'vitest';
import {
  BLOCK_LABEL,
  blankBlock,
  blankDoc,
  docFileName,
  fromMarkdown,
  hasContent,
  runs,
  summary,
  toMarkdown,
  unmarked,
  words,
  type Block,
  type Doc,
} from './document';

const doc = (blocks: Block[], title = 'Memo'): Doc => ({
  ...blankDoc(title),
  id: 'd1',
  blocks,
});

/**
 * One run written the short way.
 *
 * `runs` returns five marks per piece and a test that spelled all five out
 * every time would be a wall of `false` with the one interesting word buried
 * in it. This says the marks that are on, and nothing else.
 */
const piece = (text: string, on: Partial<Omit<ReturnType<typeof runs>[number], 'text'>> = {}) => ({
  text,
  bold: false,
  italic: false,
  strike: false,
  underline: false,
  highlight: false,
  code: false,
  link: '',
  ...on,
});

describe('emphasis', () => {
  it('reads bold and italic', () => {
    expect(runs('a **b** c')).toEqual([piece('a '), piece('b', { bold: true }), piece(' c')]);
  });

  it('nests italic inside bold', () => {
    expect(runs('**a *b* c**')).toEqual([
      piece('a ', { bold: true }),
      piece('b', { bold: true, italic: true }),
      piece(' c', { bold: true }),
    ]);
  });

  it('keeps two bold runs apart rather than swallowing what is between them', () => {
    expect(runs('**a** and **b**').map((r) => r.text)).toEqual(['a', ' and ', 'b']);
  });

  it('leaves arithmetic alone', () => {
    // The case a naive `\*(.+?)\*` turns into an italic 3.
    expect(runs('2 * 3 * 4')).toEqual([piece('2 * 3 * 4')]);
  });

  it('always returns at least one run', () => {
    expect(runs('')).toHaveLength(1);
  });

  it('strips the marks for a count', () => {
    expect(unmarked('**two** words')).toBe('two words');
  });

  it('reads a strike-through, which is how a draft says "cut this"', () => {
    expect(runs('keep ~~cut~~ keep')).toEqual([
      piece('keep '),
      piece('cut', { strike: true }),
      piece(' keep'),
    ]);
  });

  it('reads an underline, the mark markdown never had', () => {
    expect(runs('the ++signed++ copy')).toEqual([
      piece('the '),
      piece('signed', { underline: true }),
      piece(' copy'),
    ]);
  });

  it('reads a highlight', () => {
    expect(runs('read ==this bit== first')).toEqual([
      piece('read '),
      piece('this bit', { highlight: true }),
      piece(' first'),
    ]);
  });

  /*
   * The two cases the new markers could have broken, and the reason both use
   * the same shape as `~~`: the markers have to sit against the words. A
   * methods section full of `n == 40` and a cost line reading `12 ++ 3` are
   * both ordinary prose, and a naive `/\+\+(.+?)\+\+/` eats them.
   */
  it('leaves a comparison and a pair of pluses alone', () => {
    expect(runs('where n == 40 and n == 41')).toEqual([piece('where n == 40 and n == 41')]);
    expect(runs('a ++ b ++ c')).toEqual([piece('a ++ b ++ c')]);
  });

  it('nests the new marks inside the old ones', () => {
    expect(runs('**a ==b== c**')).toEqual([
      piece('a ', { bold: true }),
      piece('b', { bold: true, highlight: true }),
      piece(' c', { bold: true }),
    ]);
  });

  it('strips the new marks for a count too', () => {
    expect(unmarked('++two++ ==words==')).toBe('two words');
  });

  it('reads backticks as code, and reads nothing inside them', () => {
    expect(runs('the `**p**` value')).toEqual([
      piece('the '),
      piece('**p**', { code: true }),
      piece(' value'),
    ]);
  });

  it('reads a link as its words and where it points', () => {
    expect(runs('see [the paper](https://example.edu/x.pdf) for it')).toEqual([
      piece('see '),
      piece('the paper', { link: 'https://example.edu/x.pdf' }),
      piece(' for it'),
    ]);
  });

  it('marks the words inside a link without losing where it points', () => {
    expect(runs('[**Smith**](https://example.edu)')).toEqual([
      // The trailing slash is `safeUrl` normalising through `new URL`, which
      // is what stops two spellings of one address becoming two relationships
      // in the Word file.
      piece('Smith', { bold: true, link: 'https://example.edu/' }),
    ]);
  });

  /*
   * The case that makes the brackets usable at all. Prose is full of
   * `[bracketed]` asides followed by `(parentheses)`, and reading that pair as
   * a link would make an ordinary sentence unwritable.
   */
  it('leaves a bracketed aside beside a parenthesis alone', () => {
    expect(runs('[sic] (see below)').map((r) => r.link)).toEqual(['']);
  });

  it('counts a link by its words rather than by its address', () => {
    expect(unmarked('see [the paper](https://example.edu/x.pdf)')).toBe('see the paper');
  });
});

describe('counting', () => {
  it('counts the prose', () => {
    expect(words(doc([{ kind: 'text', text: 'one two three' }]))).toBe(3);
  });

  it('does not count a table against a word limit', () => {
    const withTable = doc([
      { kind: 'text', text: 'one two' },
      { kind: 'table', rows: [['a', 'b'], ['c', 'd']], header: true, caption: 'x' },
    ]);
    expect(words(withTable)).toBe(2);
  });

  it('does not count an equation', () => {
    expect(words(doc([{ kind: 'equation', latex: '\\frac{a}{b}', caption: '' }]))).toBe(0);
  });

  it('counts headings and list items, which are prose', () => {
    const d = doc([
      { kind: 'heading', level: 1, text: 'Two words' },
      { kind: 'bullets', items: ['one', 'two three'], numbered: false },
    ]);
    expect(words(d)).toBe(5);
  });
});

describe('what is in it', () => {
  it('says a fresh document is empty', () => {
    expect(hasContent({ ...blankDoc('New'), id: 'd' })).toBe(false);
  });

  it('does not count a page break as content', () => {
    expect(hasContent(doc([{ kind: 'break' }]))).toBe(false);
  });

  it('counts a table with anything in it', () => {
    expect(hasContent(doc([{ kind: 'table', rows: [['a']], header: false, caption: '' }]))).toBe(true);
  });

  it('summarises in the language of the editor', () => {
    const said = summary([
      { kind: 'heading', level: 1, text: 'A' },
      { kind: 'text', text: 'b' },
      { kind: 'text', text: 'c' },
      { kind: 'table', rows: [['x']], header: false, caption: '' },
    ]);
    expect(said).toBe('1 heading, 2 paragraphs, 1 table');
  });

  it('says so when there is nothing', () => {
    expect(summary([])).toBe('nothing in it yet');
  });

  it('has a label for every kind a person can add', () => {
    for (const kind of Object.keys(BLOCK_LABEL) as (keyof typeof BLOCK_LABEL)[]) {
      expect(blankBlock(kind).kind).toBe(kind);
    }
  });
});

describe('markdown, out', () => {
  it('writes the title as the one h1', () => {
    const out = toMarkdown(doc([{ kind: 'heading', level: 1, text: 'Findings' }], 'Memo'));
    expect(out).toContain('# Memo');
    expect(out).toContain('## Findings');
  });

  it('writes a table with its rule', () => {
    const out = toMarkdown(
      doc([{ kind: 'table', rows: [['a', 'b'], ['1', '2']], header: true, caption: '' }]),
    );
    expect(out).toContain('| a | b |');
    expect(out).toContain('| --- | --- |');
  });

  it('fences an equation the way a maths-aware renderer expects', () => {
    const out = toMarkdown(doc([{ kind: 'equation', latex: 'e=mc^2', caption: '' }]));
    expect(out).toContain('$$\ne=mc^2\n$$');
  });

  it('keeps a quotation’s attribution on its own line', () => {
    const out = toMarkdown(doc([{ kind: 'quote', text: 'A line.', source: 'Keynes' }]));
    expect(out).toContain('> A line.');
    expect(out).toContain('> — Keynes');
  });

  it('leaves an empty paragraph out rather than printing a blank', () => {
    expect(toMarkdown(doc([{ kind: 'text', text: '   ' }]))).toBe('# Memo\n');
  });
});

describe('markdown, in', () => {
  it('reads headings, prose and a list', () => {
    const blocks = fromMarkdown('## Findings\n\nSome prose.\n\n- one\n- two');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'text', 'bullets']);
    // Read as lines rather than as strings: a list carries how far in each
    // line sits, and one with no indentation is a list of level-0 lines.
    expect(blocks[2]).toEqual({
      kind: 'bullets',
      items: [
        { text: 'one', level: 0 },
        { text: 'two', level: 0 },
      ],
      numbered: false,
    });
  });

  it('knows a numbered list from a bulleted one', () => {
    const [block] = fromMarkdown('1. one\n2. two');
    expect(block).toEqual({
      kind: 'bullets',
      items: [
        { text: 'one', level: 0 },
        { text: 'two', level: 0 },
      ],
      numbered: true,
    });
  });

  it('reads a table and drops its rule', () => {
    const [block] = fromMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
    expect(block).toEqual({
      kind: 'table',
      rows: [
        ['a', 'b'],
        ['1', '2'],
      ],
      header: true,
      caption: '',
    });
  });

  it('reads a fenced equation', () => {
    const [block] = fromMarkdown('$$\n\\frac{a}{b}\n$$');
    expect(block).toEqual({ kind: 'equation', latex: '\\frac{a}{b}', caption: '' });
  });

  it('takes an attribution out of a quotation', () => {
    const [block] = fromMarkdown('> A line.\n> — Keynes');
    expect(block).toEqual({ kind: 'quote', text: 'A line.', source: 'Keynes' });
  });

  it('keeps a one-line quotation whole rather than reading it as an attribution', () => {
    const [block] = fromMarkdown('> — not really a source');
    expect(block).toEqual({ kind: 'quote', text: '— not really a source', source: '' });
  });

  it('keeps what it does not recognise, as prose', () => {
    const blocks = fromMarkdown('<div>markup nobody asked for</div>');
    expect(blocks).toEqual([{ kind: 'text', text: '<div>markup nobody asked for</div>' }]);
  });

  it('never comes back with nothing to type into', () => {
    expect(fromMarkdown('')).toEqual([{ kind: 'text', text: '' }]);
  });

  it('round-trips the shapes it can', () => {
    const before = doc(
      [
        { kind: 'heading', level: 1, text: 'Findings' },
        { kind: 'text', text: 'Some prose.' },
        {
          kind: 'bullets',
          items: [
            { text: 'one', level: 0 },
            { text: 'two', level: 0 },
          ],
          numbered: false,
        },
        { kind: 'table', rows: [['a', 'b'], ['1', '2']], header: true, caption: '' },
        { kind: 'equation', latex: 'e=mc^2', caption: '' },
      ],
      'Memo',
    );
    // The title is written as the `#` and read back as the document's own
    // title by the screen, so what round-trips here is everything under it.
    const again = fromMarkdown(toMarkdown(before).replace(/^# Memo\n\n/, ''));
    expect(again).toEqual(before.blocks);
  });
});

describe('the file name', () => {
  it('is made of the title', () => {
    expect(docFileName('A Memo on Tariffs')).toBe('a-memo-on-tariffs.docx');
  });

  it('has a name even when the title has no letters in it', () => {
    expect(docFileName('!!!')).toBe('document.docx');
  });

  it('takes the extension it is given', () => {
    expect(docFileName('Notes', 'md')).toBe('notes.md');
  });
});

/**
 * The three kinds a document could not hold, both ways through markdown.
 *
 * Markdown is how a document leaves this app and how a pasted outline comes
 * into it, so a kind that only goes one way is a kind that loses its content
 * the first time somebody exports and re-imports — which is what "Read
 * something in" invites people to do.
 */
describe('checklists, code and contents', () => {
  it('writes a checklist as a task list and reads one back', () => {
    const made = doc([
      {
        kind: 'checks',
        items: [
          { text: 'Read the chapter', done: true },
          { text: 'Write the memo', done: false },
        ],
      },
    ]);
    const md = toMarkdown(made);
    expect(md).toContain('- [x] Read the chapter');
    expect(md).toContain('- [ ] Write the memo');
    expect(fromMarkdown(md).find((b) => b.kind === 'checks')).toEqual({
      kind: 'checks',
      items: [
        { text: 'Read the chapter', done: true },
        { text: 'Write the memo', done: false },
      ],
    });
  });

  /*
   * The case the ordering exists for: `- [x] done` matches the bullet rule
   * too, and read by that rule it arrives as a list item whose words begin
   * "[x]" — which is how a task list pasted from anywhere else becomes
   * nonsense.
   */
  it('does not read a ticked line as an ordinary bullet', () => {
    expect(fromMarkdown('- [ ] a thing')[0].kind).toBe('checks');
    expect(fromMarkdown('- a thing')[0].kind).toBe('bullets');
  });

  it('fences code with its language and reads it back unchanged', () => {
    const md = toMarkdown(doc([{ kind: 'code', text: 'a <- b * c', language: 'r' }]));
    expect(md).toContain('```r');
    expect(fromMarkdown(md).find((b) => b.kind === 'code')).toEqual({
      kind: 'code',
      text: 'a <- b * c',
      language: 'r',
    });
  });

  it('writes the contents as the headings rather than as a token nothing reads', () => {
    const md = toMarkdown(
      doc([
        { kind: 'toc', title: 'Contents' },
        { kind: 'heading', level: 1, text: 'The tariff' },
        { kind: 'heading', level: 2, text: 'The vote' },
      ]),
    );
    expect(md).toContain('## Contents');
    expect(md).toContain('- The tariff');
    expect(md).toContain('  - The vote');
  });

  it('leaves the contents out of a document with no headings in it', () => {
    expect(toMarkdown(doc([{ kind: 'toc', title: 'Contents' }]))).not.toContain('Contents');
  });

  it('counts a checklist’s words and does not count a contents page as content', () => {
    expect(words(doc([{ kind: 'checks', items: [{ text: 'two words', done: false }] }]))).toBe(2);
    expect(hasContent(doc([{ kind: 'toc', title: 'Contents' }]))).toBe(false);
    expect(hasContent(doc([{ kind: 'code', text: 'x', language: '' }]))).toBe(true);
  });
});
