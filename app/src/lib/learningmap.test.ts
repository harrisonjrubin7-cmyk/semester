import { describe, expect, it } from 'vitest';
import { CHECK_LENGTHS, OWN_LABELS, STATE_WORDS, checkResult, checkWords, nextAction, pickCheck, type CheckAnswer } from './learningmap';
import type { Guide } from './types';

const card = (q: string) => ({ q, a: 'a' }) as Guide['units'][number]['cards'][number];
const guide = (units: string[][]): Guide =>
  ({ code: 'X', name: 'X', blurb: '', source: 'S', mastery: 0, audio: false, terms: [], units: units.map((qs, i) => ({ name: `Unit ${i}`, mastery: 0, cards: qs.map(card) })) }) as Guide;
const concepts = [0, 1, 2].map((i) => ({ id: `c:unit:${i}`, name: `Unit ${i}`, source: 's' }));

describe('the words for a state', () => {
  it('has one student-facing word per measured state, all from the student vocabulary', () => {
    for (const w of Object.values(STATE_WORDS)) expect(OWN_LABELS).toContain(w);
  });

  it('never reads recall as independent application', () => {
    expect(STATE_WORDS.retained).toBe('Can explain with notes');
    expect(Object.values(STATE_WORDS)).not.toContain('Can apply independently');
  });

  it('gives every state a next action with a reason and no judgement', () => {
    for (const state of Object.keys(STATE_WORDS) as (keyof typeof STATE_WORDS)[]) {
      const a = nextAction({ state, name: 'Elasticity' });
      expect(a.text).toContain('Elasticity');
      expect(a.why).not.toBe('');
      expect(a.text + a.why).not.toMatch(/\b(weak|risk|fail|behind)\b/i);
    }
  });
});

describe('the start-here check', () => {
  it('samples every unit in turn rather than the first chapter', () => {
    const g = guide([['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], ['c1', 'c2', 'c3']]);
    const picks = pickCheck('c', g, 5);
    expect(picks.map((p) => p.card.q)).toEqual(['a1', 'b1', 'c1', 'a2', 'b2']);
    expect(new Set(picks.slice(0, 3).map((p) => p.unit)).size).toBe(3);
    expect(picks[0].conceptId).toBe('c:unit:0');
  });

  it('asks for fewer when the course has fewer, and never invents a card', () => {
    expect(pickCheck('c', guide([['a1'], ['b1']]), 10)).toHaveLength(2);
    expect(pickCheck('c', guide([]), 5)).toEqual([]);
  });

  it('offers a short, a medium and a longer check', () => {
    expect(CHECK_LENGTHS).toEqual([5, 8, 10]);
  });

  it('treats "not sure" as not-yet, not as a failure, and says what was handled well', () => {
    const answers: CheckAnswer[] = [
      { conceptId: 'c:unit:0', answer: 'got' },
      { conceptId: 'c:unit:1', answer: 'unsure' },
      { conceptId: 'c:unit:2', answer: 'missed' },
    ];
    const r = checkResult(concepts, answers);
    expect(r).toMatchObject({ answered: 3, got: 1, unsure: 1, missed: 1 });
    expect(r.handled).toEqual(['Unit 0']);
    expect(r.revisit.map((x) => x.name)).toEqual(['Unit 1', 'Unit 2']);
    expect(r.revisit[0].why).toMatch(/not sure/);
    expect(r.revisit[1].why).toMatch(/missed/);
  });

  it('control: a check where everything was answered has nothing to revisit', () => {
    const r = checkResult(concepts, concepts.map((c) => ({ conceptId: c.id, answer: 'got' as const })));
    expect(r.revisit).toEqual([]);
    expect(checkWords(r).join(' ')).toMatch(/Nothing here needs another look/);
  });

  it('never grades: no score, no percentage, and it says so', () => {
    const r = checkResult(concepts, [{ conceptId: 'c:unit:0', answer: 'missed' }]);
    const said = checkWords(r).join(' ');
    expect(said).toMatch(/not a grade/);
    expect(said).not.toMatch(/%|score|weak|at risk|fail/i);
    expect(r).not.toHaveProperty('score');
  });

  it('answers honestly for an empty check', () => {
    expect(checkWords(checkResult(concepts, []))).toEqual(['Nothing answered yet.']);
  });
});

import { DEFAULT_PREFS, SESSIONS, checkLengthFor } from './learningprefs';

describe('learning preferences', () => {
  it('sizes the check to the sitting, from the lengths the check offers', () => {
    for (const s of SESSIONS) expect(CHECK_LENGTHS as readonly number[]).toContain(checkLengthFor(s));
    expect(checkLengthFor(5)).toBeLessThan(checkLengthFor(30));
  });

  it('starts with personal patterns off', () => {
    expect(DEFAULT_PREFS.patterns).toBe(false);
  });
});
