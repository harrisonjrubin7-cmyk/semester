import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TERM_END, TERM_START, stepsFor } from './termtransition';

const SCREENS: string[] = (() => {
  const types = readFileSync(new URL('./types.ts', import.meta.url), 'utf8');
  const union = /export type Screen =([\s\S]*?);\n/.exec(types)!;
  return [...union[1].matchAll(/\|\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
})();

describe('the term transition', () => {
  it('opens only screens that exist, once each id', () => {
    for (const list of [TERM_START, TERM_END]) {
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
      for (const s of list) {
        expect(SCREENS, `${s.id} → ${s.screen}`).toContain(s.screen);
        expect(s.why.length, s.id).toBeGreaterThan(20);
      }
    }
  });

  it('covers the brief’s two lists', () => {
    expect(TERM_START.map((s) => s.id)).toEqual(['confirm-courses', 'import-syllabi', 'set-schedule', 'review-policies', 'choose-reminders', 'set-goals', 'connect-support']);
    expect(TERM_END.map((s) => s.id)).toEqual(['review', 'archive', 'keep-notes', 'export', 'update-goals', 'plan-next', 'career-evidence', 'review-shares', 'remove-deadlines']);
  });

  it('switches to the end list in the last three weeks', () => {
    const end = new Date(2026, 11, 15);
    expect(stepsFor(new Date(2026, 8, 28), end)).toBe(TERM_START);
    expect(stepsFor(new Date(2026, 10, 30), end)).toBe(TERM_END);
    expect(stepsFor(new Date(2026, 11, 20), end)).toBe(TERM_END);
    expect(stepsFor(new Date(2026, 8, 28), null)).toBe(TERM_START);
  });
});
