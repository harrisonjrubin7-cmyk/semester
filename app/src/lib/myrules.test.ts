import { describe, expect, it } from 'vitest';
import {
  MOST_DAYS,
  MOST_RULES,
  addRule,
  dropRule,
  editRule,
  myReminders,
  newRule,
  readRules,
  ruleLine,
  type MyRule,
} from './myrules';
import type { DatedItem } from './types';

const rule = (patch: Partial<MyRule> = {}): MyRule => ({ ...newRule(1), ...patch });

const item = (patch: Partial<DatedItem> = {}): DatedItem =>
  ({
    id: 'ps4',
    c: 'econ',
    title: 'Problem Set 4',
    kind: 'Problem set',
    daysAway: 3,
    dueShort: 'Fri Sep 18',
    dueTime: '11:59 PM',
    ...patch,
  }) as DatedItem;

const at = (h: number) => new Date(2026, 8, 15, h, 0);

describe('what a rule says it does', () => {
  it('reads as a sentence', () => {
    expect(ruleLine(rule({ days: 3, hour: 9 }))).toBe('3 days before every deadline, at 9am.');
    expect(ruleLine(rule({ days: 1, hour: 19 }))).toBe('1 day before every deadline, at 7pm.');
    expect(ruleLine(rule({ days: 0, hour: 8 }))).toBe('On the day of every deadline, at 8am.');
  });

  it('names the course when it is for one', () => {
    expect(ruleLine(rule({ courseId: 'econ' }), () => 'ECON 1020')).toBe(
      '3 days before ECON 1020 deadline, at 9am.',
    );
  });

  it('says noon and midnight as hours, not as zero', () => {
    expect(ruleLine(rule({ hour: 12 }))).toContain('12pm');
    expect(ruleLine(rule({ hour: 0 }))).toContain('12am');
  });
});

describe('when one fires', () => {
  it('fires on the day the lead time lands on, at the hour asked for', () => {
    expect(myReminders(at(9), [rule({ days: 3, hour: 9 })], [item()])).toHaveLength(1);
    expect(myReminders(at(8), [rule({ days: 3, hour: 9 })], [item()])).toHaveLength(0);
  });

  it('does not fire on the days either side of it', () => {
    // "Any time after" would fire again at two days and again at one, and
    // turn a lead time into a countdown nobody asked for.
    const r = [rule({ days: 3 })];
    expect(myReminders(at(12), r, [item({ daysAway: 4 })])).toHaveLength(0);
    expect(myReminders(at(12), r, [item({ daysAway: 2 })])).toHaveLength(0);
  });

  it('is silent while switched off', () => {
    expect(myReminders(at(12), [rule({ on: false })], [item()])).toHaveLength(0);
  });

  it('watches one course when it names one', () => {
    const r = [rule({ courseId: 'psci' })];
    expect(myReminders(at(12), r, [item({ c: 'econ' })])).toHaveLength(0);
    expect(myReminders(at(12), r, [item({ c: 'psci' })])).toHaveLength(1);
  });

  it('finds an exam by what the syllabus called it', () => {
    // Same rule `lib/runway.ts` uses, which is why a midterm and a final are
    // both found without either being labelled specially.
    const r = [rule({ watches: 'exam' })];
    expect(myReminders(at(12), r, [item({ kind: 'Problem set' })])).toHaveLength(0);
    expect(myReminders(at(12), r, [item({ kind: 'Midterm' })])).toHaveLength(1);
    expect(myReminders(at(12), r, [item({ kind: 'Final exam' })])).toHaveLength(1);
  });

  it('says the thing and when it is due', () => {
    const [fired] = myReminders(at(12), [rule({ days: 3 })], [item()]);
    expect(fired.title).toBe('Problem Set 4 in 3 days');
    expect(fired.body).toBe('Fri Sep 18 · 11:59 PM');
  });

  it('says "due today" rather than "in 0 days"', () => {
    const [fired] = myReminders(at(12), [rule({ days: 0 })], [item({ daysAway: 0 })]);
    expect(fired.title).toBe('Problem Set 4 is due today');
  });

  it('carries the day in its id, so it fires once', () => {
    const [fired] = myReminders(at(12), [rule({ days: 3 })], [item()]);
    expect(fired.id).toContain('2026-8-15');
    expect(myReminders(at(13), [rule({ days: 3 })], [item()])[0].id).toBe(fired.id);
  });

  it('fires once per matching thing, not once per rule', () => {
    const out = myReminders(at(12), [rule({ days: 3 })], [item(), item({ id: 'e2', title: 'Essay' })]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((f) => f.id)).size).toBe(2);
  });
});

describe('the list of rules', () => {
  it('holds a workable number and then stops', () => {
    let rules: MyRule[] = [];
    for (let i = 0; i < 20; i += 1) rules = addRule(rules, i);
    expect(rules).toHaveLength(MOST_RULES);
  });

  it('edits one without touching its id or the others', () => {
    const rules = [rule({ id: 'a' }), rule({ id: 'b' })];
    const out = editRule(rules, 'a', { days: 7, id: 'hijacked' } as Partial<MyRule>);
    expect(out[0].id).toBe('a');
    expect(out[0].days).toBe(7);
    expect(out[1]).toEqual(rules[1]);
  });

  it('drops one', () => {
    expect(dropRule([rule({ id: 'a' }), rule({ id: 'b' })], 'a').map((r) => r.id)).toEqual(['b']);
  });
});

describe('reading them back off disk', () => {
  it('takes a good list', () => {
    const rules = [rule({ id: 'a', days: 5, hour: 20, watches: 'exam', courseId: 'econ' })];
    expect(readRules(rules)).toEqual(rules);
  });

  it('is empty for anything that is not a list', () => {
    expect(readRules(undefined)).toEqual([]);
    expect(readRules('[]')).toEqual([]);
    expect(readRules({ 0: rule() })).toEqual([]);
  });

  it('drops a rule with a lead time that is not one', () => {
    // A hand-edited store, or a rule from a later version. A rule set to
    // -3 days would never fire and a rule set to 900 would fire on nothing,
    // and neither says so.
    expect(readRules([rule({ days: -1 })])).toEqual([]);
    expect(readRules([rule({ days: MOST_DAYS + 1 })])).toEqual([]);
    expect(readRules([rule({ hour: 24 })])).toEqual([]);
    expect(readRules([rule({ days: 1.5 })])).toEqual([]);
  });

  it('keeps the good ones alongside a bad one', () => {
    expect(readRules([rule({ id: 'a' }), rule({ id: 'b', hour: 99 }), rule({ id: 'c' })]).map((r) => r.id)).toEqual(
      ['a', 'c'],
    );
  });

  it('will not read back more than the list holds', () => {
    const many = Array.from({ length: 30 }, (_, i) => rule({ id: `r${i}` }));
    expect(readRules(many)).toHaveLength(MOST_RULES);
  });
});
