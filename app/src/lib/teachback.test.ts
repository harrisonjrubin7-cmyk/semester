import { describe, expect, it } from 'vitest';
import type { StudySource } from './studystudio';
import { TEACH_BACK_SYSTEM, parseTeachBack, teachBackPrompt } from './teachback';

const SOURCES: StudySource[] = [
  {
    id: 's1',
    title: 'Chapter 1.pdf',
    locator: 'Page 3',
    text: 'The opportunity cost of a choice is the value of the next best alternative given up. It is not the money price.',
  },
];
const EXPLANATION = 'Opportunity cost is the money you pay for something, like the price of a ticket.';
const reply = (o: object) => JSON.stringify({ unsupported: false, covered: [], missing: [], conflicts: [], ...o });

describe('teach-back prompt', () => {
  it('sends the topic, the explanation and only the chosen text', () => {
    const p = JSON.parse(teachBackPrompt('Opportunity cost', EXPLANATION, SOURCES));
    expect(p.explanation).toBe(EXPLANATION);
    expect(p.sources).toEqual([{ id: 's1', title: 'Chapter 1.pdf', text: SOURCES[0].text }]);
  });

  it('refuses before sending anything it should not', () => {
    expect(() => teachBackPrompt('', EXPLANATION, SOURCES)).toThrow(/topic/);
    expect(() => teachBackPrompt('x', ' ', SOURCES)).toThrow(/explanation/);
    expect(() => teachBackPrompt('x', 'a'.repeat(6001), SOURCES)).toThrow(/Nothing has been sent/);
    expect(() => teachBackPrompt('x', EXPLANATION, [])).toThrow(/source/);
  });

  it('asks for no grade and no model answer', () => {
    expect(TEACH_BACK_SYSTEM).toMatch(/no score, grade or percentage/);
    expect(TEACH_BACK_SYSTEM).toMatch(/Do not write a model answer/);
    expect(TEACH_BACK_SYSTEM).toMatch(/ONLY the selected sources/);
  });
});

describe('teach-back reply', () => {
  it('keeps a point whose quotation is in the source, with where it is', () => {
    const out = parseTeachBack(
      reply({ missing: [{ point: 'It is what you give up', sourceId: 's1', quote: 'the value of the next best alternative given up' }] }),
      SOURCES,
      EXPLANATION,
    );
    expect(out.missing).toHaveLength(1);
    expect(out.missing[0].at).toBeDefined();
    expect(out.dropped).toBe(0);
  });

  it('drops and counts a point whose quotation is not in the source', () => {
    // General knowledge, however true, is not what this is asking for.
    const out = parseTeachBack(
      reply({ covered: [{ point: 'Scarcity', sourceId: 's1', quote: 'Resources are scarce relative to wants.' }] }),
      SOURCES,
      EXPLANATION,
    );
    expect(out.covered).toEqual([]);
    expect(out.dropped).toBe(1);
  });

  it('shows a contradiction only when the student really wrote their side of it', () => {
    const conflict = { point: 'It is not the price', sourceId: 's1', quote: 'It is not the money price.' };
    const real = parseTeachBack(reply({ conflicts: [{ ...conflict, said: 'the money you pay for something' }] }), SOURCES, EXPLANATION);
    expect(real.conflicts).toHaveLength(1);
    expect(real.conflicts[0].said).toBe('the money you pay for something');
    const invented = parseTeachBack(reply({ conflicts: [{ ...conflict, said: 'opportunity cost is always zero' }] }), SOURCES, EXPLANATION);
    expect(invented.conflicts).toEqual([]);
    expect(invented.dropped).toBe(1);
  });

  it('drops a point naming a source that was not selected', () => {
    const out = parseTeachBack(reply({ covered: [{ point: 'x', sourceId: 's9', quote: 'the value of the next best alternative' }] }), SOURCES, EXPLANATION);
    expect(out.covered).toEqual([]);
    expect(out.dropped).toBe(1);
  });

  it('carries "not in your sources" through, and refuses a reply it cannot read', () => {
    expect(parseTeachBack(reply({ unsupported: true }), SOURCES, EXPLANATION).unsupported).toBe(true);
    expect(() => parseTeachBack('not json', SOURCES, EXPLANATION)).toThrow(/incomplete/);
  });
});
