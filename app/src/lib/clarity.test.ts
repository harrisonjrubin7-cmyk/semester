import { describe, expect, it } from 'vitest';
import { ASK_EVERY_DAYS, EMPTY_CLARITY, KEEP_ANSWERS, answer, notNow, readClarity, shouldAsk, tally } from './clarity';

const NOW = Date.UTC(2026, 8, 27, 12);
const DAY = 86_400_000;

describe('when to ask', () => {
  it('asks someone who has never answered', () => {
    expect(shouldAsk(EMPTY_CLARITY, NOW)).toBe(true);
  });

  it('asks at most once a week', () => {
    const s = answer(EMPTY_CLARITY, 'yes', NOW);
    expect(shouldAsk(s, NOW + DAY)).toBe(false);
    expect(shouldAsk(s, NOW + ASK_EVERY_DAYS * DAY)).toBe(true);
  });

  it('puts the question away for a week on "Not now"', () => {
    const s = notNow(EMPTY_CLARITY, NOW);
    expect(shouldAsk(s, NOW + DAY)).toBe(false);
    expect(shouldAsk(s, NOW + ASK_EVERY_DAYS * DAY + 1)).toBe(true);
  });
});

describe('the stored answers', () => {
  it('counts what the student answered, and nothing else', () => {
    let s = EMPTY_CLARITY;
    for (const a of ['yes', 'no', 'yes', 'somewhat'] as const) s = answer(s, a, NOW);
    expect(tally(s)).toEqual({ yes: 2, somewhat: 1, no: 1 });
  });

  it('keeps a year of weekly answers at most', () => {
    let s = EMPTY_CLARITY;
    for (let i = 0; i < KEEP_ANSWERS + 5; i++) s = answer(s, 'yes', NOW + i);
    expect(s.answers).toHaveLength(KEEP_ANSWERS);
  });

  it('round-trips and drops what it cannot read', () => {
    const s = answer(notNow(EMPTY_CLARITY, NOW), 'somewhat', NOW);
    expect(readClarity(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const bad = readClarity({ version: 1, answers: [{ at: NOW, answer: 'maybe' }, { at: 'x', answer: 'yes' }], quietUntil: 'soon' });
    expect(bad).toEqual(EMPTY_CLARITY);
    expect(() => readClarity({ version: 2 })).toThrow();
  });
});
