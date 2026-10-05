import { describe, expect, it } from 'vitest';
import { buildPack } from './expertpack';
import { handoffFields, prepare } from './prepare';

const ctx = {
  goal: 'Understand the Week 4 regression assignment',
  materials: ['Week 4 slides', 'Lecture notes'],
  confusing: ['Why does adding a variable change the slope?'],
  attempts: ['Example 1 (got 0.4)', 'Example 2'],
  questions: ['Is R² enough?'],
  aiPolicy: { text: 'AI may be used for explanations, not solutions.', source: 'Syllabus, p. 3' },
};

describe('prepare me', () => {
  it('gathers what the student holds, in the order that kind of thing wants it', () => {
    const p = prepare('office-hours', ctx);
    expect(p.sections.map((s) => s.slot)).toEqual(['goal', 'confusing', 'attempts', 'questions']);
    expect(p.sections[2].lines).toEqual(['Example 1 (got 0.4)', 'Example 2']);
    expect(p.missing).toEqual([]);
  });

  it('reports a slot with nothing in it as missing and invents nothing to fill it', () => {
    const p = prepare('exam', { materials: ['Notes'] });
    expect(p.sections.map((s) => s.slot)).toEqual(['materials']);
    expect(p.missing).toEqual([
      'Nothing yet under "what you marked as not understood".',
      'Nothing yet under "your attempts".',
      'Nothing yet under "your questions".',
    ]);
  });

  it('ignores blank lines', () => {
    expect(prepare('class', { goal: '  ', materials: ['', ' x '] }).sections.map((s) => s.lines)).toEqual([['x']]);
  });

  it('quotes the course AI policy with its source, and shows none when none is stated', () => {
    expect(prepare('assignment', ctx).aiPolicy).toEqual({ text: 'AI may be used for explanations, not solutions.', source: 'Syllabus, p. 3' });
    expect(prepare('assignment', { ...ctx, aiPolicy: undefined }).aiPolicy).toBeNull();
    expect(prepare('assignment', { ...ctx, aiPolicy: { text: 'Allowed', source: '' } }).aiPolicy).toBeNull();
  });

  it('offers office-hours values to the matching pack, and the pack still needs each tick', () => {
    const h = handoffFields(prepare('office-hours', ctx))!;
    expect(h.destination).toBe('office-hours');
    expect(h.available).toMatchObject({ topic: 'Understand the Week 4 regression assignment', attempted: 'Example 1 (got 0.4)\nExample 2' });
    expect(buildPack(h.destination, h.available, new Set(), 0)).toBeNull();
    expect(buildPack(h.destination, h.available, new Set(['attempted']), 0)!.fields.map((f) => f.id)).toEqual(['attempted']);
  });

  it('does not offer what the destination may not receive: confusion marks stay private', () => {
    const h = handoffFields(prepare('office-hours', ctx))!;
    expect(JSON.stringify(h.available)).not.toContain('slope');
  });

  it('has no handoff for a kind with no human service', () => {
    expect(handoffFields(prepare('class', ctx))).toBeNull();
  });

  it('carries the dated thing it is for', () => {
    expect(prepare('exam', { when: { title: 'Midterm', daysAway: 3 } }).when).toEqual({ title: 'Midterm', daysAway: 3 });
    expect(prepare('exam', {}).when).toBeNull();
  });
});
