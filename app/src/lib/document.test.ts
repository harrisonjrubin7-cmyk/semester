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

describe('emphasis', () => {
  it('reads bold and italic', () => {
    expect(runs('a **b** c')).toEqual([
      { text: 'a ', bold: false, italic: false },
      { text: 'b', bold: true, italic: false },
      { text: ' c', bold: false, italic: false },
    ]);
  });

  it('nests italic inside bold', () => {
    expect(runs('**a *b* c**')).toEqual([
      { text: 'a ', bold: true, italic: false },
      { text: 'b', bold: true, italic: true },
      { text: ' c', bold: true, italic: false },
    ]);
  });

  it('keeps two bold runs apart rather than swallowing what is between them', () => {
    expect(runs('**a** and **b**').map((r) => r.text)).toEqual(['a', ' and ', 'b']);
  });

  it('leaves arithmetic alone', () => {
    // The case a naive `\*(.+?)\*` turns into an italic 3.
    expect(runs('2 * 3 * 4')).toEqual([{ text: '2 * 3 * 4', bold: false, italic: false }]);
  });

  it('always returns at least one run', () => {
    expect(runs('')).toHaveLength(1);
  });

  it('strips the marks for a count', () => {
    expect(unmarked('**two** words')).toBe('two words');
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
    expect(blocks[2]).toEqual({ kind: 'bullets', items: ['one', 'two'], numbered: false });
  });

  it('knows a numbered list from a bulleted one', () => {
    const [block] = fromMarkdown('1. one\n2. two');
    expect(block).toEqual({ kind: 'bullets', items: ['one', 'two'], numbered: true });
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
        { kind: 'bullets', items: ['one', 'two'], numbered: false },
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
