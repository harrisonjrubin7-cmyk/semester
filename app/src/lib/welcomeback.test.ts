import { describe, expect, it } from 'vitest';
import { decorateItem } from './date';
import type { Item } from './types';
import { AWAY_DAYS, aheadLine, confirmLine, named, welcomeBack } from './welcomeback';

const NOW = new Date(2026, 9, 12, 12, 0);
const DAY = 24 * 60 * 60 * 1000;

const item = (id: string, month: number, day: number): Item =>
  ({ id, c: 'econ', title: id, kind: 'hw', month, day, year: 2026 }) as unknown as Item;

// Away since Oct 3 at lunch; back Oct 12.
const LAST = new Date(2026, 9, 3, 12, 0).getTime();
const items = [
  item('before-break', 9, 1), // fell before they left
  item('left-that-evening', 9, 3), // due the day they were last here, later on
  item('mid-break', 9, 7),
  item('handed-in', 9, 8),
  item('today', 9, 12),
  item('friday', 9, 16),
  item('far-off', 9, 30),
].map((i) => decorateItem(i, NOW));

describe('welcomeBack', () => {
  it('says nothing on a first run, with no mark to count from', () => {
    expect(welcomeBack(items, {}, 0, NOW)).toBeNull();
  });

  it('leaves a short gap to the one-line change report', () => {
    const recent = NOW.getTime() - (AWAY_DAYS - 1) * DAY;
    expect(welcomeBack(items, {}, recent, NOW)).toBeNull();
  });

  it('counts the gap in calendar days', () => {
    expect(welcomeBack(items, {}, LAST, NOW)?.days).toBe(9);
  });

  it('asks about what fell inside the gap, and only that', () => {
    const w = welcomeBack(items, { 'handed-in': true }, LAST, NOW);
    expect(w?.toConfirm.map((i) => i.id)).toEqual(['left-that-evening', 'mid-break']);
  });

  it('looks a week ahead, skipping what is ticked', () => {
    const w = welcomeBack(items, { friday: true }, LAST, NOW);
    expect(w?.ahead.map((i) => i.id)).toEqual(['today']);
  });

  it('starts with the soonest thing ahead', () => {
    expect(welcomeBack(items, {}, LAST, NOW)?.restart?.id).toBe('today');
  });

  it('falls back to the most recent thing that went by when the week is clear', () => {
    const w = welcomeBack(items, { today: true, friday: true, 'handed-in': true }, LAST, NOW);
    expect(w?.restart?.id).toBe('mid-break');
  });

  it('offers no restart when nothing is outstanding', () => {
    const all = Object.fromEntries(items.map((i) => [i.id, true]));
    expect(welcomeBack(items, all, LAST, NOW)?.restart).toBeNull();
  });
});

describe('what counts as having gone by during the absence', () => {
  // Last here Oct 3 at noon, as above.
  const on3 = (id: string, dueAt: number) => ({ ...decorateItem(item(id, 9, 3), NOW), dueAt });

  it('leaves out a deadline that fell on the last day, before they closed the app', () => {
    const w = welcomeBack([on3('nine-am', 9 * 60)], {}, LAST, NOW);
    expect(w?.toConfirm).toEqual([]);
  });

  it('keeps one that fell on the last day, after they closed the app', () => {
    const w = welcomeBack([on3('five-pm', 17 * 60)], {}, LAST, NOW);
    expect(w?.toConfirm.map((i) => i.id)).toEqual(['five-pm']);
  });
});

describe('the words', () => {
  it('never calls a deadline missed, because it cannot know', () => {
    const w = welcomeBack(items, {}, LAST, NOW)!;
    expect(confirmLine(w)).toMatch(/went by/);
    expect(confirmLine(w)).not.toMatch(/missed|failed|late/i);
  });

  it('is silent about confirming when nothing went by', () => {
    const clear = items.filter((i) => !['left-that-evening', 'mid-break', 'handed-in'].includes(i.id));
    expect(confirmLine(welcomeBack(clear, {}, LAST, NOW)!)).toBe('');
  });

  it('says when the week is clear rather than showing nothing', () => {
    expect(aheadLine(welcomeBack([], {}, LAST, NOW)!)).toBe('Nothing is due in the next week.');
  });

  it('names three and counts the rest', () => {
    const r = named(items);
    expect(r.shown).toHaveLength(3);
    expect(r.more).toBe(items.length - 3);
  });
});
