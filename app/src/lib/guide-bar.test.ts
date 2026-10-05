import { describe, expect, it } from 'vitest';
import { EMPTY_CALM, type CalmSettings } from './calm-controls';
import {
  EMPTY_SUPPRESSIONS,
  STAGES,
  SUPPRESS_FOR,
  SUPPRESS_LIMIT,
  SURFACES,
  SURFACE_CATEGORY,
  confirmationFor,
  counted,
  guideBar,
  isSuppressed,
  readSuppressions,
  suppress,
  unsuppress,
  visiblePriority,
  type GuideInput,
  type GuidePriority,
} from './guide-bar';

const priority: GuidePriority = {
  id: 'deadline:essay',
  title: 'Outline the essay',
  why: 'It is the nearest date you have confirmed.',
  source: 'Syllabus, imported',
  deadlineLabel: 'Due Thursday 11:59 PM',
  fallback: false,
};
const input = (over: Partial<GuideInput> = {}): GuideInput => ({
  surface: 'today',
  priority,
  counts: { deadlines: 2, planDecisions: 1, continuations: 2 },
  calm: EMPTY_CALM,
  ...over,
});
const calm = (over: Partial<CalmSettings>): CalmSettings => ({ ...EMPTY_CALM, ...over });

describe('counted', () => {
  it('pluralises, with words to ten and digits after', () => {
    expect(counted(1, 'deadline')).toBe('One deadline');
    expect(counted(2, 'deadline')).toBe('Two deadlines');
    expect(counted(10, 'deadline')).toBe('Ten deadlines');
    expect(counted(11, 'deadline')).toBe('11 deadlines');
    expect(counted(2, 'continuation')).toBe('Two continuations');
  });
});

describe('headline', () => {
  it('lists what there is, in one line, with correct plurals', () => {
    const m = guideBar(input());
    expect(m.headline).toBe('Today, you have: One priority · Two deadlines · One plan decision · Two continuations');
  });

  it('leaves out anything at zero', () => {
    const m = guideBar(input({ counts: { deadlines: 0, planDecisions: 0, continuations: 1 } }));
    expect(m.headline).toBe('Today, you have: One priority · One continuation');
    expect(m.headline).not.toMatch(/deadline|plan decision|Zero/);
  });

  it('says plainly when nothing is waiting', () => {
    const m = guideBar(input({ priority: null, counts: { deadlines: 0, planDecisions: 0, continuations: 0 } }));
    expect(m.headline).toBe('Today, nothing is waiting for you.');
    expect(m.actions).toEqual([]);
    expect(m.nextBestStep).toBeNull();
  });

  it('never counts more than one priority, and a fallback is not counted', () => {
    expect(guideBar(input()).parts.filter((p) => /priorit/.test(p))).toEqual(['One priority']);
    const m = guideBar(input({ priority: { ...priority, fallback: true }, counts: { deadlines: 0, planDecisions: 0, continuations: 0 } }));
    expect(m.parts).toEqual([]);
    expect(m.nextBestStep).toBe('Outline the essay · Due Thursday 11:59 PM');
    expect(m.doesNotKnow.join(' ')).toContain('gentle default');
  });
});

describe('the contract', () => {
  it('names its six stages in order', () => {
    expect(STAGES).toEqual(['notice', 'understand', 'decide', 'act', 'confirm', 'continue']);
  });

  it('understand: says why, what it used and what it cannot see', () => {
    const m = guideBar(input());
    expect(m.why).toBe(priority.why);
    expect(m.dataUsed[0]).toBe('Syllabus, imported');
    expect(m.dataUsed).toContain('Two deadlines you have added or imported');
    expect(m.doesNotKnow.length).toBeGreaterThanOrEqual(2);
    expect(m.doesNotKnow[0]).toMatch(/not added or connected/);
  });

  it('decide and act: why, snooze, not now, then the primary action', () => {
    expect(guideBar(input()).actions.map((a) => a.label)).toEqual(['Why this matters', 'Snooze', 'Not now', 'Start']);
    expect(guideBar(input({ priority: { ...priority, primaryLabel: 'Open the outline' } })).actions.at(-1)).toEqual({ kind: 'primary', label: 'Open the outline' });
  });

  it('confirm: says what happened and until when', () => {
    const until = new Date(2026, 9, 2, 9, 0).getTime();
    expect(confirmationFor('snooze', until)).toMatch(/^Snoozed until .+\.$/);
    expect(confirmationFor('notNow', until)).toMatch(/^Not now\. .+\.$/);
    expect(confirmationFor('hide', until)).toMatch(/^Hidden\./);
  });

  it('continue: never ends a choice in silence', () => {
    expect(guideBar(input()).continueLine).not.toBe('');
    expect(guideBar(input({ priority: null })).continueLine).not.toBe('');
  });

  it('uses calm words only', () => {
    const m = guideBar(input());
    const all = JSON.stringify(m) + confirmationFor('snooze', 1);
    expect(all).not.toMatch(/at risk|failing|behind|you will fail|streak|overdue/i);
  });
});

describe('minimal mode', () => {
  it('collapses to one line and the primary action', () => {
    const m = guideBar(input({ calm: calm({ minimalMode: true }) }));
    expect(m.minimal).toBe(true);
    expect(m.line).toBe('Outline the essay · Due Thursday 11:59 PM');
    expect(m.actions.map((a) => a.kind)).toEqual(['primary']);
    expect(m.why).toBeNull();
    expect(m.dataUsed).toEqual([]);
  });

  it('still says something when there is no suggestion', () => {
    expect(guideBar(input({ priority: null, counts: { deadlines: 0, planDecisions: 0, continuations: 0 }, calm: calm({ minimalMode: true }) })).line).toBe('Nothing is waiting for you today.');
  });
});

describe('surfaces', () => {
  it('lists the seven and maps each to a calm category', () => {
    expect([...SURFACES]).toEqual(['today', 'path', 'plan', 'study', 'workspace', 'career', 'campus']);
    for (const s of SURFACES) expect(SURFACE_CATEGORY[s]).toBeTruthy();
  });

  it('is hidden where the student has paused it, and shown elsewhere', () => {
    expect(guideBar(input({ surface: 'career', calm: calm({ pauseCareer: true }) })).hidden).toBe(true);
    expect(guideBar(input({ surface: 'study', calm: calm({ hideStudyBlocks: true }) })).hidden).toBe(true);
    expect(guideBar(input({ surface: 'today', calm: calm({ pauseCareer: true, hideStudyBlocks: true }) })).hidden).toBe(false);
    const hidden = guideBar(input({ surface: 'career', calm: calm({ pauseCareer: true }) }));
    expect(hidden.actions).toEqual([]);
    expect(hidden.line).toBe('');
  });
});

describe('choices kept on the device', () => {
  const T = 1_000_000_000_000;

  it('suppresses by id until the time is up, then stops on its own', () => {
    const r = suppress(EMPTY_SUPPRESSIONS, 'deadline:essay', 'snooze', T);
    expect(isSuppressed(r, 'deadline:essay', T + 1)).toBe(true);
    expect(isSuppressed(r, 'deadline:essay', T + SUPPRESS_FOR.snooze - 1)).toBe(true);
    expect(isSuppressed(r, 'deadline:essay', T + SUPPRESS_FOR.snooze)).toBe(false);
    expect(isSuppressed(r, 'deadline:other', T + 1)).toBe(false);
  });

  it('lasts longer for Not now than Snooze, and longest for Hide', () => {
    expect(SUPPRESS_FOR.snooze).toBeLessThan(SUPPRESS_FOR.notNow);
    expect(SUPPRESS_FOR.notNow).toBeLessThan(SUPPRESS_FOR.hide);
    expect(isSuppressed(suppress(EMPTY_SUPPRESSIONS, 'a', 'hide', T), 'a', T + SUPPRESS_FOR.notNow + 1)).toBe(true);
  });

  it('is not fooled by an id that is an object property name', () => {
    expect(isSuppressed(EMPTY_SUPPRESSIONS, 'constructor', T)).toBe(false);
    expect(isSuppressed(EMPTY_SUPPRESSIONS, '__proto__', T)).toBe(false);
  });

  it('can take a choice back', () => {
    const r = suppress(EMPTY_SUPPRESSIONS, 'a', 'notNow', T);
    expect(isSuppressed(unsuppress(r, 'a'), 'a', T + 1)).toBe(false);
  });

  it('drops expired entries and stays within its limit, keeping the longest-lived', () => {
    let r = suppress(EMPTY_SUPPRESSIONS, 'old', 'snooze', T);
    r = suppress(r, 'keep', 'hide', T + SUPPRESS_FOR.snooze + 1);
    expect(Object.keys(r.items)).toEqual(['keep']);
    let full = EMPTY_SUPPRESSIONS;
    full = suppress(full, 'hidden-one', 'hide', T);
    for (let i = 0; i < SUPPRESS_LIMIT + 10; i++) full = suppress(full, `s${i}`, 'snooze', T);
    expect(Object.keys(full.items)).toHaveLength(SUPPRESS_LIMIT);
    expect(isSuppressed(full, 'hidden-one', T + 1)).toBe(true);
  });

  it('puts a suppressed priority away, so the bar never shows it', () => {
    const r = suppress(EMPTY_SUPPRESSIONS, priority.id, 'notNow', T);
    expect(visiblePriority(priority, r, T + 1)).toBeNull();
    expect(visiblePriority(priority, r, T + SUPPRESS_FOR.notNow)).toBe(priority);
    const m = guideBar(input({ priority: visiblePriority(priority, r, T + 1), counts: { deadlines: 0, planDecisions: 0, continuations: 0 } }));
    expect(m.suggestionId).toBeNull();
    expect(m.headline).toBe('Today, nothing is waiting for you.');
  });

  it('round-trips and refuses malformed storage', () => {
    const r = suppress(EMPTY_SUPPRESSIONS, 'a', 'snooze', T);
    expect(readSuppressions(JSON.parse(JSON.stringify(r)))).toEqual(r);
    for (const v of [null, {}, { version: 1 }, { version: 1, items: { a: { kind: 'forever', until: 1 } } }, { version: 1, items: { a: { kind: 'hide', until: 'x' } } }]) {
      expect(() => readSuppressions(v)).toThrow();
    }
  });
});
