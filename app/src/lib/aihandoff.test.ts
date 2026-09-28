// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXCERPT_WORDS,
  EXTERNAL_AI,
  EXTERNAL_AI_ORDER,
  clearHandoffs,
  compose,
  handoffs,
  offered,
  prepare,
  send,
  type ExternalAiId,
} from './aihandoff';

beforeEach(() => localStorage.clear());

describe('what a handoff sends', () => {
  it('sends nothing without a question', () => {
    expect(prepare({ question: '   ' })).toBeNull();
  });

  it('the prompt is exactly the pieces the review lists, in order', () => {
    const p = prepare({
      question: 'Explain correlation vs causation.',
      course: { code: 'ECON 1020', title: 'Principles of Macroeconomics' },
      excerpt: 'A rise in ice-cream sales tracks drownings.',
    })!;
    expect(p.shared.map((s) => s.label)).toEqual(['Your question', 'Course', 'Excerpt you pasted']);
    expect(compose(p.shared)).toBe(p.prompt);
    for (const piece of p.shared) expect(p.prompt).toContain(piece.value);
  });

  it('leaves out the course and excerpt unless they were given', () => {
    const p = prepare({ question: 'What is a bond?' })!;
    expect(p.shared).toHaveLength(1);
    expect(p.prompt).toBe('What is a bond?');
  });

  it('cuts a long excerpt, and says it did', () => {
    const long = Array.from({ length: EXCERPT_WORDS + 50 }, (_, i) => `w${i}`).join(' ');
    const p = prepare({ question: 'q', excerpt: long })!;
    expect(p.cut).toBe(true);
    const excerpt = p.shared.find((s) => s.label === 'Excerpt you pasted')!.value;
    expect(excerpt.split(' ')).toHaveLength(EXCERPT_WORDS);
    expect(p.prompt).not.toContain(`w${EXCERPT_WORDS}`);
  });

  it.each(EXTERNAL_AI_ORDER)('%s: the link carries the prompt and goes to its own site', (id) => {
    const url = new URL(EXTERNAL_AI[id].url('a & b = "c"\nd'));
    expect(url.protocol).toBe('https:');
    expect([...url.searchParams.values()]).toContain('a & b = "c"\nd');
  });
});

describe('which services are offered', () => {
  it('Grok is listed and not offered', () => {
    expect(offered('grok')).toBe(false);
    expect(EXTERNAL_AI.grok.role).toMatch(/not offered/i);
  });

  it('send refuses a service that is not offered, and opens nothing', () => {
    const opened: string[] = [];
    const ok = send('grok', prepare({ question: 'q' })!, (u) => opened.push(u));
    expect(ok).toBe(false);
    expect(opened).toEqual([]);
    expect(handoffs()).toEqual([]);
  });

  it.each(['claude', 'chatgpt', 'perplexity'] as ExternalAiId[])('%s opens in a new tab without an opener', (id) => {
    const calls: [string, string, string][] = [];
    expect(send(id, prepare({ question: 'q' })!, (u, t, f) => calls.push([u, t, f]))).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe('_blank');
    expect(calls[0][2]).toContain('noopener');
  });
});

describe('the log of what was sent', () => {
  it('records the labels and the course code, never the text', () => {
    const p = prepare({
      question: 'secret question text',
      course: { code: 'PSCI 2220', title: 'National Security' },
      excerpt: 'secret excerpt text',
    })!;
    send('claude', p, () => null);
    const [entry] = handoffs();
    expect(entry.to).toBe('claude');
    expect(entry.course).toBe('PSCI 2220');
    expect(entry.shared).toEqual(['Your question', 'Course', 'Excerpt you pasted']);
    expect(JSON.stringify(handoffs())).not.toContain('secret');
  });

  it('keeps the last twenty, newest first, and clears', () => {
    for (let i = 0; i < 25; i += 1) send('chatgpt', prepare({ question: `q${i}` })!, () => null);
    expect(handoffs()).toHaveLength(20);
    clearHandoffs();
    expect(handoffs()).toEqual([]);
  });

  it('survives a corrupt log', () => {
    localStorage.setItem('semester.handoffs.v1', 'not json{');
    expect(handoffs()).toEqual([]);
  });
});
