import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  EMPTY_CALM,
  INFORMATION_BUDGET,
  MEMORY_LIMITS,
  allows,
  briefingDue,
  calmOrDefault,
  clearMemory,
  readCalm,
  remember,
  withinBudget,
  type CalmSettings,
} from './calm-controls';

/** Local-time moments, because quiet hours are the student's wall clock. */
const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);
const NOON = at(12);
const wide: CalmSettings = { ...EMPTY_CALM, quiet: null, categories: [...CATEGORIES] };

describe('the defaults are the calmest', () => {
  it('has no briefing, a minimal digest, a one-day horizon and overnight quiet hours', () => {
    expect(EMPTY_CALM.briefing.on).toBe(false);
    expect(EMPTY_CALM.digest).toBe('minimal');
    expect(EMPTY_CALM.horizon).toBe('day');
    expect(EMPTY_CALM.quiet).toEqual({ from: 22 * 60, to: 8 * 60 });
    expect(EMPTY_CALM.memory).toEqual([]);
  });

  it('lets only dates somebody else set interrupt, and only outside quiet hours', () => {
    const sent = CATEGORIES.filter((c) => allows(c, EMPTY_CALM, NOON));
    expect(sent).toEqual(['deadlines']);
    expect(allows('deadlines', EMPTY_CALM, at(23))).toBe(false);
    expect(allows('deadlines', EMPTY_CALM, at(7, 59))).toBe(false);
    expect(allows('deadlines', EMPTY_CALM, at(8))).toBe(true);
  });

  it('budgets one most-important thing, three to five next actions and one notification a day', () => {
    expect(INFORMATION_BUDGET).toMatchObject({ mostImportant: 1, nextActionsMin: 3, nextActionsMax: 5, notificationsPerDay: 1 });
    expect(withinBudget([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4, 5]);
    expect(withinBudget([1, 2])).toEqual([1, 2]);
  });
});

describe('each switch suppresses what it claims', () => {
  it('pauseScenarios stops scenarios on both channels and nothing else', () => {
    const s = { ...wide, pauseScenarios: true };
    expect(allows('scenarios', wide, NOON)).toBe(true);
    expect(allows('scenarios', s, NOON)).toBe(false);
    expect(allows('scenarios', s, NOON, 'surface')).toBe(false);
    expect(allows('career', s, NOON)).toBe(true);
  });

  it('pauseCareer stops career on both channels and nothing else', () => {
    const s = { ...wide, pauseCareer: true };
    expect(allows('career', wide, NOON)).toBe(true);
    expect(allows('career', s, NOON)).toBe(false);
    expect(allows('career', s, NOON, 'surface')).toBe(false);
    expect(allows('scenarios', s, NOON)).toBe(true);
  });

  it('hideStudyBlocks stops study on both channels and nothing else', () => {
    const s = { ...wide, hideStudyBlocks: true };
    expect(allows('study', wide, NOON)).toBe(true);
    expect(allows('study', s, NOON)).toBe(false);
    expect(allows('study', s, NOON, 'surface')).toBe(false);
    expect(allows('plan', s, NOON)).toBe(true);
  });

  it('the category list governs notifications, not the screen the student opened', () => {
    const s = { ...wide, categories: ['deadlines' as const] };
    expect(allows('campus', s, NOON)).toBe(false);
    expect(allows('campus', s, NOON, 'surface')).toBe(true);
  });

  it('quiet hours hold back notifications, wrap midnight, and do not hide a screen', () => {
    const s = { ...wide, quiet: { from: 22 * 60, to: 8 * 60 } };
    expect(allows('plan', s, at(23))).toBe(false);
    expect(allows('plan', s, at(3))).toBe(false);
    expect(allows('plan', s, at(3), 'surface')).toBe(true);
    expect(allows('plan', { ...s, quiet: null }, at(3))).toBe(true);
  });

  it('the briefing is off until switched on, waits for its time, and waits out quiet hours', () => {
    const on = { ...EMPTY_CALM, briefing: { on: true, at: 7 * 60 } };
    expect(briefingDue(EMPTY_CALM, NOON)).toBe(false);
    expect(briefingDue({ ...on, quiet: null }, at(6, 59))).toBe(false);
    expect(briefingDue({ ...on, quiet: null }, at(7))).toBe(true);
    expect(briefingDue(on, at(7, 30))).toBe(false); // inside 22:00 to 08:00
    expect(briefingDue(on, at(8))).toBe(true);
  });

  it('clearMemory empties the memory and changes nothing else', () => {
    const s = remember({ ...EMPTY_CALM, minimalMode: true }, 'Prefers mornings', 1, 'm1');
    expect(s.memory).toHaveLength(1);
    expect(clearMemory(s)).toEqual({ ...s, memory: [] });
  });

  it('remember ignores blank text and keeps the newest notes within the limit', () => {
    expect(remember(EMPTY_CALM, '   ', 1, 'x')).toBe(EMPTY_CALM);
    let s = EMPTY_CALM;
    for (let i = 0; i < MEMORY_LIMITS.notes + 5; i++) s = remember(s, `note ${i}`, i, `id${i}`);
    expect(s.memory).toHaveLength(MEMORY_LIMITS.notes);
    expect(s.memory.at(-1)!.text).toBe(`note ${MEMORY_LIMITS.notes + 4}`);
  });
});

describe('readCalm', () => {
  it('round-trips a full record', () => {
    const s: CalmSettings = {
      ...EMPTY_CALM,
      briefing: { on: true, at: 9 * 60 + 30 },
      quiet: null,
      digest: 'daily',
      categories: ['plan', 'study'],
      pauseScenarios: true,
      pauseCareer: true,
      hideStudyBlocks: true,
      minimalMode: true,
      horizon: 'term',
      memory: [{ id: 'a', text: 'Likes lists', at: 5 }],
    };
    expect(readCalm(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('refuses what is not a settings record, so the library keeps the bytes', () => {
    for (const v of [null, 'x', 4, [], {}, { version: 2 }]) expect(() => readCalm(v)).toThrow();
    expect(calmOrDefault({ version: 2 })).toBe(EMPTY_CALM);
  });

  it('falls back to the calm default for each malformed field', () => {
    const got = readCalm({
      version: 1,
      briefing: { on: 'yes', at: 99 * 60 },
      quiet: { from: 'x', to: 5 },
      digest: 'hourly',
      categories: 'all',
      pauseScenarios: 1,
      pauseCareer: null,
      hideStudyBlocks: 'true',
      minimalMode: {},
      horizon: 'year',
      memory: [{ id: '', text: 'x', at: 1 }, { id: 'ok', text: 'kept', at: 2 }, 7],
    });
    expect(got).toEqual({ ...EMPTY_CALM, memory: [{ id: 'ok', text: 'kept', at: 2 }] });
  });

  it('keeps an explicit null quiet window and drops unknown categories', () => {
    const got = readCalm({ version: 1, quiet: null, categories: ['plan', 'gossip', 'plan'] });
    expect(got.quiet).toBeNull();
    expect(got.categories).toEqual(['plan']);
  });
});
