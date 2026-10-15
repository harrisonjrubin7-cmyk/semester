import { describe, expect, it } from 'vitest';
import { CHANGE_CLASSES, CRITICAL_PERIODS, gate, type Change, type FreezeWindow } from './changes';

const FINALS: FreezeWindow = { id: 'finals', label: 'Finals and grade release', from: '2026-12-08', to: '2026-12-19' };
const calendar = [FINALS];

const full = (cls: Change['class']): string[] => [...CHANGE_CLASSES.find((c) => c.id === cls)!.requires].filter((r) => r !== 'open incident id');

const high = (over: Partial<Change> = {}): Change => ({ class: 'high_risk', attached: full('high_risk'), approvals: 2, on: '2026-11-03', ...over });

describe('the change gate', () => {
  it('lets a fully documented, twice-approved high-risk change through outside a freeze', () => {
    expect(gate(high(), calendar)).toEqual({ allowed: true, reasons: [] });
  });

  it('refuses a high-risk change with one approval, and says how many it needs', () => {
    const r = gate(high({ approvals: 1 }), calendar);
    expect(r.allowed).toBe(false);
    expect(r.reasons).toContain('needs 2 approvals, has 1');
  });

  it('names every missing attachment, not just the first', () => {
    const r = gate(high({ attached: [] }), calendar);
    expect(r.allowed).toBe(false);
    for (const need of full('high_risk')) expect(r.reasons).toContain(`missing: ${need}`);
  });

  it('refuses a normal change inside a freeze, naming the window, and passes the day after', () => {
    const normal: Change = { class: 'normal', attached: full('normal'), approvals: 1, on: '2026-12-08' };
    expect(gate(normal, calendar).reasons[0]).toMatch(/^frozen: Finals and grade release/);
    expect(gate({ ...normal, on: '2026-12-19' }, calendar).allowed).toBe(false); // the window is inclusive
    expect(gate({ ...normal, on: '2026-12-20' }, calendar).allowed).toBe(true);
    expect(gate({ ...normal, on: '2026-12-07' }, calendar).allowed).toBe(true);
  });

  it('never freezes a standard change', () => {
    expect(gate({ class: 'standard', attached: ['green CI'], approvals: 1, on: '2026-12-10' }, calendar).allowed).toBe(true);
  });

  it('lets an emergency change through a freeze only with an incident id', () => {
    const e: Change = { class: 'emergency', attached: ['incident commander approves', 'post-incident review scheduled within five business days'], approvals: 1, on: '2026-12-10' };
    expect(gate(e, calendar).allowed).toBe(false);
    expect(gate(e, calendar).reasons).toContain('missing: open incident id');
    expect(gate({ ...e, incident: 'INC-0007' }, calendar).allowed).toBe(true);
  });

  it('with no freeze calendar, refuses a high-risk change as no_calendar — absence of a freeze is not safety', () => {
    const r = gate(high(), null);
    expect(r.allowed).toBe(false);
    expect(r.reasons.some((x) => x.startsWith('no_calendar'))).toBe(true);
  });

  it('with no freeze calendar, a normal change is not blocked for want of one', () => {
    expect(gate({ class: 'normal', attached: full('normal'), approvals: 1, on: '2026-12-10' }, null).allowed).toBe(true);
  });

  it('rejects malformed dates and windows instead of guessing', () => {
    expect(() => gate(high({ on: '12/10/2026' }), calendar)).toThrow(RangeError);
    expect(() => gate(high(), [{ id: 'x', label: 'x', from: '2026-12-19', to: '2026-12-08' }])).toThrow(RangeError);
  });
});

describe('the classes themselves', () => {
  it('require more as risk rises, and only emergency and standard escape a freeze', () => {
    const by = Object.fromEntries(CHANGE_CLASSES.map((c) => [c.id, c]));
    expect(by.high_risk.approvals).toBeGreaterThan(by.normal.approvals);
    expect(by.high_risk.requires.length).toBeGreaterThan(by.normal.requires.length);
    expect(CHANGE_CLASSES.filter((c) => !c.blockedByFreeze).map((c) => c.id).sort()).toEqual(['emergency', 'standard']);
  });

  it('every high-risk change needs a rehearsed rollback and a fresh backup reference', () => {
    const r = CHANGE_CLASSES.find((c) => c.id === 'high_risk')!.requires;
    expect(r).toContain('rollback plan rehearsed on staging');
    expect(r).toContain('fresh backup reference');
  });

  it('keeps the critical periods in the owner\'s order, registration first', () => {
    expect(CRITICAL_PERIODS[0].id).toBe('registration');
    expect(new Set(CRITICAL_PERIODS.map((p) => p.id)).size).toBe(CRITICAL_PERIODS.length);
  });
});
