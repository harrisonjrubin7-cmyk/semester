import { describe, expect, it } from 'vitest';
import {
  characters,
  emphasise,
  findAll,
  marked,
  outline,
  readingMinutes,
  replaceAll,
} from './doctools';
import type { Block, Doc } from './document';

const doc = (blocks: Block[]): Doc => ({
  id: 'd',
  title: 'A memo',
  subtitle: '',
  courseId: null,
  blocks,
  created: 0,
  updated: 0,
});

describe('the outline', () => {
  it('lists the headings in order, with where each one is', () => {
    const d = doc([
      { kind: 'heading', level: 1, text: 'Findings' },
      { kind: 'text', text: 'Some prose.' },
      { kind: 'heading', level: 2, text: 'Method' },
      { kind: 'heading', level: 3, text: 'Sampling' },
    ]);
    expect(outline(d)).toEqual([
      { at: 0, level: 1, text: 'Findings' },
      { at: 2, level: 2, text: 'Method' },
      { at: 3, level: 3, text: 'Sampling' },
    ]);
  });

  it('skips a heading nobody has finished typing', () => {
    expect(outline(doc([{ kind: 'heading', level: 1, text: '   ' }]))).toEqual([]);
  });

  it('shows a heading\u2019s words, not its markup', () => {
    const d = doc([{ kind: 'heading', level: 1, text: 'The **real** cost' }]);
    expect(outline(d)[0].text).toBe('The real cost');
  });
});

describe('measuring', () => {
  it('counts characters of prose without the marks', () => {
    expect(characters(doc([{ kind: 'text', text: '**four**' }]))).toBe(4);
  });

  it('never says a document takes less than a minute', () => {
    expect(readingMinutes(doc([{ kind: 'text', text: 'one two three' }]))).toBe(1);
  });

  it('scales with the length', () => {
    const long = Array.from({ length: 1100 }, () => 'word').join(' ');
    expect(readingMinutes(doc([{ kind: 'text', text: long }]))).toBe(5);
  });
});

describe('find', () => {
  const d = doc([
    { kind: 'heading', level: 1, text: 'Trade policy' },
    { kind: 'text', text: 'Policy is policy, whatever the POLICY says.' },
    { kind: 'bullets', items: ['a policy', 'no match here'], numbered: false },
    { kind: 'quote', text: 'a quoted policy', source: 'Policy Review 2024' },
    { kind: 'table', rows: [['policy']], header: false, caption: 'policy' },
    { kind: 'equation', latex: 'policy = x', caption: '' },
  ]);

  it('finds every match, in reading order', () => {
    const hits = findAll(d, 'policy');
    expect(hits.map((h) => h.at)).toEqual([0, 1, 1, 1, 2, 3]);
  });

  it('leaves tables, equations and a quotation’s source alone', () => {
    // Replacing a word through a document must not rewrite the algebra, and a
    // citation that quietly changed is worse than one that did not change.
    const hits = findAll(d, 'policy');
    expect(hits.some((h) => h.at === 4 || h.at === 5)).toBe(false);
    expect(hits.filter((h) => h.at === 3)).toHaveLength(1);
  });

  it('matches case when asked', () => {
    expect(findAll(d, 'POLICY', { matchCase: true })).toHaveLength(1);
    expect(findAll(d, 'POLICY')).toHaveLength(6);
  });

  it('can want a whole word', () => {
    const words = doc([{ kind: 'text', text: 'art started as art' }]);
    expect(findAll(words, 'art')).toHaveLength(3);
    expect(findAll(words, 'art', { wholeWord: true })).toHaveLength(2);
  });

  it('says which list item a match is in', () => {
    const hit = findAll(d, 'policy').find((h) => h.at === 2);
    expect(hit?.item).toBe(0);
    expect(findAll(d, 'policy').find((h) => h.at === 1)?.item).toBe(-1);
  });

  it('finds nothing for an empty search rather than everything', () => {
    expect(findAll(d, '')).toEqual([]);
  });
});

describe('replace', () => {
  const d = doc([
    { kind: 'text', text: 'policy and policy' },
    { kind: 'bullets', items: ['a policy'], numbered: false },
    { kind: 'equation', latex: 'policy = x', caption: '' },
  ]);

  it('replaces every match and says how many', () => {
    const { doc: next, changed } = replaceAll(d, 'policy', 'rule');
    expect(changed).toBe(3);
    expect(next.blocks[0]).toMatchObject({ text: 'rule and rule' });
    expect(next.blocks[1]).toMatchObject({ items: ['a rule'] });
  });

  it('does not touch the equation', () => {
    const { doc: next } = replaceAll(d, 'policy', 'rule');
    expect(next.blocks[2]).toEqual(d.blocks[2]);
  });

  it('never changes the original', () => {
    replaceAll(d, 'policy', 'rule');
    expect(d.blocks[0]).toMatchObject({ text: 'policy and policy' });
  });

  it('puts the replacement in exactly as typed', () => {
    // No case matching. A tool that decided "Economics" should replace
    // "economics" has quietly rewritten a proper noun somebody chose.
    const { doc: next } = replaceAll(doc([{ kind: 'text', text: 'Policy policy' }]), 'policy', 'rule');
    expect(next.blocks[0]).toMatchObject({ text: 'rule rule' });
  });

  it('gives the same document back when nothing matched', () => {
    const { doc: next, changed } = replaceAll(d, 'nothing here', 'x');
    expect(changed).toBe(0);
    expect(next).toBe(d);
  });
});

describe('emphasis', () => {
  it('wraps a selection', () => {
    expect(emphasise('the real cost', 4, 8, 'bold')).toBe('the **real** cost');
    expect(emphasise('the real cost', 4, 8, 'italic')).toBe('the *real* cost');
  });

  it('takes the marks off a selection already inside them', () => {
    expect(emphasise('the **real** cost', 6, 10, 'bold')).toBe('the real cost');
  });

  it('takes them off when the selection includes the marks', () => {
    expect(emphasise('the **real** cost', 4, 12, 'bold')).toBe('the real cost');
  });

  it('keeps the marks against the words, not the spaces', () => {
    // `runs` refuses `* a *` on purpose — it is how `2 * 3` stays arithmetic —
    // so stars around a space would do nothing and look like a broken button.
    expect(emphasise('the real cost', 3, 9, 'italic')).toBe('the *real* cost');
  });

  it('does nothing to an empty or blank selection', () => {
    expect(emphasise('the real cost', 4, 4, 'bold')).toBe('the real cost');
    expect(emphasise('a   b', 1, 4, 'bold')).toBe('a   b');
  });

  it('knows when a whole line is already marked', () => {
    expect(marked('**all of it**', 'bold')).toBe(true);
    expect(marked('**some** of it', 'bold')).toBe(false);
    expect(marked('*all of it*', 'italic')).toBe(true);
  });
});

describe('whole words, when the word is not plain ASCII', () => {
  it('does not match inside an accented word', () => {
    // `\b` is defined against ASCII, so "café" ended at the "f" as far as it
    // was concerned and "é" matched inside the word.
    const d = doc([{ kind: 'text', text: 'café and é alone' }]);
    expect(findAll(d, 'é', { wholeWord: true })).toHaveLength(1);
    expect(findAll(d, 'é')).toHaveLength(2);
  });

  it('does not match the front of a longer term with punctuation', () => {
    // "C++" has no word boundary to anchor to, so the guard used to be dropped
    // on that side and it matched the front of "C++primer".
    const d = doc([{ kind: 'text', text: 'C++primer and C++ alone' }]);
    expect(findAll(d, 'C++', { wholeWord: true })).toHaveLength(1);
  });

  it('still finds an ordinary word', () => {
    const d = doc([{ kind: 'text', text: 'art started as art' }]);
    expect(findAll(d, 'art', { wholeWord: true })).toHaveLength(2);
  });

  it('replaces only the whole words', () => {
    const d = doc([{ kind: 'text', text: 'café and é' }]);
    expect(replaceAll(d, 'é', 'e', { wholeWord: true }).changed).toBe(1);
  });
});

describe('emphasis inside an emphasised run', () => {
  it('does not produce markdown that is not markdown', () => {
    // Selecting "real" inside "**really**" used to produce `****real**ly**`,
    // which `runs` then renders as literal stars.
    const out = emphasise('**really**', 2, 6, 'bold');
    expect(out).not.toContain('****');
    expect(out).toBe('really');
  });

  it('un-marks only the run the selection is in, leaving the others', () => {
    // Selecting part of the first run of "**abc** and **b**" takes the mark
    // off that run and leaves the second one bold.
    expect(emphasise('**abc** and **b**', 2, 4, 'bold')).toBe('abc and **b**');
  });

  it('never leaves a doubled marker behind', () => {
    for (const [text, from, to] of [
      ['**really**', 2, 6],
      ['**really**', 4, 8],
      ['**abc** and **b**', 2, 4],
      ['*italic*', 1, 4],
    ] as const) {
      const out = emphasise(text, from, to, text.startsWith('**') ? 'bold' : 'italic');
      expect(out).not.toContain('****');
      expect(out).not.toContain('***');
    }
  });

  it('still wraps and unwraps the ordinary cases', () => {
    expect(emphasise('the real cost', 4, 8, 'bold')).toBe('the **real** cost');
    expect(emphasise('the **real** cost', 6, 10, 'bold')).toBe('the real cost');
  });
});
