import { describe, expect, it } from 'vitest';
import { orderQueue, STATE_TEXT, STATES, stateOf, type Assignment } from './triage';

const now = new Date(2026, 9, 14, 9, 0).getTime();
const h = (n: number) => now + n * 3_600_000;
const a = (o: Partial<Assignment> = {}): Assignment => ({
  id: 'x',
  course: 'ECON 101',
  title: 'Problem set',
  due: h(8),
  label: 'institution_verified',
  sourceAt: now - 3_600_000,
  effortMin: 50,
  ...o,
});

describe('stateOf', () => {
  it('is ready when the source is sound and time is not known to be short', () => {
    expect(stateOf(a(), now).state).toBe('ready');
  });
  it('needs time when open time cannot cover the estimate', () => {
    const t = stateOf(a({ freeMin: 20 }), now);
    expect(t.state).toBe('needs_time');
    expect(t.reasons.join(' ')).toMatch(/not enough open time/);
  });
  it('a saved block counts toward the estimate', () => {
    expect(stateOf(a({ freeMin: 20, blockMin: 40 }), now).state).toBe('ready');
  });
  it('needs review for a missing, estimated or stale date', () => {
    expect(stateOf(a({ due: null }), now).state).toBe('needs_review');
    expect(stateOf(a({ label: 'estimated' }), now).state).toBe('needs_review');
    expect(stateOf(a({ sourceAt: now - 20 * 86_400_000 }), now).state).toBe('needs_review');
  });
  it('waiting, blocked, deferred and complete take precedence, in that care', () => {
    expect(stateOf(a({ done: true, blockedBy: 'x' }), now).state).toBe('complete');
    expect(stateOf(a({ deferredUntil: h(48) }), now).state).toBe('deferred');
    expect(stateOf(a({ blockedBy: 'the lab' }), now).state).toBe('blocked');
    expect(stateOf(a({ waitingOn: 'your instructor' }), now).state).toBe('waiting');
  });
  it('an expired deferral is open again', () => {
    expect(stateOf(a({ deferredUntil: h(-1) }), now).state).toBe('ready');
  });
  it('says what it does not know', () => {
    expect(stateOf(a(), now).unknowns.join(' ')).toMatch(/instructor will change the deadline/);
  });
  it('never uses judgment language', () => {
    const all = [a(), a({ freeMin: 1 }), a({ due: null })].flatMap((x) => {
      const t = stateOf(x, now);
      return [...t.reasons, ...t.unknowns];
    });
    expect(JSON.stringify([all, STATE_TEXT])).not.toMatch(/\b(fail|at risk|behind|insufficient)\b/i);
    expect(STATES).toHaveLength(7);
  });
});

describe('orderQueue', () => {
  it('offers the nearer due date first and leaves out work a student cannot act on', () => {
    const q = orderQueue(
      [a({ id: 'far', due: h(24 * 6) }), a({ id: 'near', due: h(4) }), a({ id: 'wait', waitingOn: 'TA' }), a({ id: 'done', done: true })],
      now,
    );
    expect(q.map((x) => x.id)).toEqual(['near', 'far']);
  });
  it("the student's own priority lifts an item, and work already scheduled lowers it", () => {
    const q = orderQueue(
      [a({ id: 'plain', due: h(30) }), a({ id: 'mine', due: h(30), priority: 2 }), a({ id: 'planned', due: h(30), blockMin: 50 })],
      now,
    );
    expect(q.map((x) => x.id)).toEqual(['mine', 'plain', 'planned']);
  });
  it('exposes no number', () => {
    expect(Object.keys(orderQueue([a()], now)[0])).not.toContain('score');
  });
});
