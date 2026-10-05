import { describe, expect, it } from 'vitest';
import { DESTINATIONS, PACKS, buildPack, leftOut, previewLines } from './expertpack';

const NOW = Date.UTC(2026, 8, 30);

describe('handoff packs', () => {
  it('covers the nine destinations, each with a fixed list of fields', () => {
    expect(DESTINATIONS).toHaveLength(9);
    for (const d of DESTINATIONS) expect(PACKS[d].fields.length).toBeGreaterThan(0);
  });

  it('starts empty: nothing ticked is not a pack', () => {
    expect(buildPack('tutor', { topic: 'Regression', goal: 'Pass' }, new Set(), NOW)).toBeNull();
  });

  it('holds only ticked fields that have something in them', () => {
    const p = buildPack('tutor', { topic: ' Regression ', attempted: '', goal: 'Understand slope' }, new Set(['topic', 'attempted']), NOW)!;
    expect(p.fields).toEqual([{ id: 'topic', label: 'Topic', value: 'Regression' }]);
  });

  it('never carries a field the destination may not receive, however it is offered', () => {
    const p = buildPack('money', { checklist: 'FAFSA', draft: 'my essay', grades: '3.9', questions: 'When?' }, new Set(['checklist', 'draft', 'grades', 'questions']), NOW)!;
    expect(p.fields.map((x) => x.id)).toEqual(['checklist', 'questions']);
    expect(JSON.stringify(p)).not.toContain('my essay');
  });

  it('says what stays private', () => {
    expect(leftOut('writing', { prompt: 'p', stage: 'outline', revision: '' }, new Set(['prompt']))).toEqual(['Draft stage']);
  });

  it('is a snapshot that a later edit cannot change', () => {
    const avail: Record<string, string> = { topic: 'Regression' };
    const p = buildPack('office-hours', avail, new Set(['topic']), NOW)!;
    avail.topic = 'changed';
    expect(p.fields[0].value).toBe('Regression');
    expect(Object.isFrozen(p)).toBe(true);
    expect(() => { (p.fields[0] as { value: string }).value = 'x'; }).toThrow();
    expect(p.madeAt).toBe(NOW);
  });

  it('previews the whole pack, naming who it is for', () => {
    const p = buildPack('accessibility', { barrier: 'Long exams tire me', contact: 'Email' }, new Set(['barrier', 'contact']), NOW)!;
    expect(previewLines(p)).toEqual(['For: Accessibility office', 'Barrier, in your own words: Long exams tire me', 'Preferred contact route: Email']);
  });
});
