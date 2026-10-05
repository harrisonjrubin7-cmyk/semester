import { describe, expect, it } from 'vitest';
import { PATTERN_FLOOR, coverage, coverageWords, eveningPattern, forReview } from './learninginsights';
import { cardIdentity, type Reviews } from './review';
import type { Guide } from './types';

const guide = { code: 'X', name: 'X', blurb: '', source: '', mastery: 0, audio: false, terms: [], units: [
  { name: 'One', mastery: 0, cards: [{ q: 'q1', a: '' }, { q: 'q2', a: '' }] },
  { name: 'Two', mastery: 0, cards: [] },
] } as unknown as Guide;
const rv = (seen: number) => ({ right: 1, wrong: 0, streak: 1, ease: 2.5, interval: 1, seen, due: 0 });

describe('learning insights', () => {
  it('counts cards answered, not time spent', () => {
    const reviews: Reviews = { [cardIdentity('c', guide.units[0].cards[0])]: rv(5) };
    const c = coverage('c', guide, reviews);
    expect(c).toEqual([{ unit: 'One', total: 2, answered: 1 }, { unit: 'Two', total: 0, answered: 0 }]);
    expect(coverageWords(c[0])).toBe('One: 1 of 2 cards answered');
    expect(coverageWords(c[1])).toMatch(/no cards yet/);
  });

  it('control: an untouched course reads zero, not a made-up figure', () => {
    expect(coverage('c', guide, {}).every((x) => x.answered === 0)).toBe(true);
  });

  it('lists only the concepts marked review later', () => {
    const s = (state: 'unseen' | 'needs-review', name: string) => ({ id: name, name, state, confidence: null, evidence: [], nextReview: null });
    expect(forReview([s('needs-review', 'A'), s('unseen', 'B')])).toEqual(['A']);
  });

  const at = (hour: number) => Date.UTC(2026, 8, 30, hour);
  const utcHour = (ms: number) => new Date(ms).getUTCHours();
  const many = (hours: number[]): Reviews => Object.fromEntries(hours.map((h, i) => [`k${i}`, rv(at(h))]));

  it('is silent below the floor even when every answer was late', () => {
    // Literal counts, not derived from the constant: a floor lowered to 1 would
    // otherwise move this test with it and still pass.
    expect(PATTERN_FLOOR).toBe(8);
    expect(eveningPattern(many(Array(7).fill(23)), utcHour)).toBeNull();
  });

  it('speaks, as a dismissible question, once most answers were late', () => {
    const said = eveningPattern(many(Array(8).fill(23)), utcHour);
    expect(said).toMatch(/after 10 PM/);
    expect(said).toMatch(/You can ignore this/);
    expect(said).not.toMatch(/\b(weak|risk|lazy|behind|productiv)/i);
  });

  it('control: daytime answers do not trigger it', () => {
    expect(eveningPattern(many(Array(8).fill(14)), utcHour)).toBeNull();
  });
});
