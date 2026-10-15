import { describe, expect, it } from 'vitest';
import {
  EMPTY_RHYTHM,
  calendarProposal,
  carryForward,
  monday,
  newPlan,
  readRhythm,
  rhythmKey,
  savePlan,
  simulate,
  starter,
  printable,
} from './operating-rhythm';
describe('student-owned operating rhythm', () => {
  it('escapes private content in printable exports', () => {
    const p = newPlan('2026-10-01');
    p.values.notes = '<script>alert("private")</script>';
    expect(printable(p)).not.toContain('<script>');
    expect(printable(p)).toContain('&lt;script&gt;');
  });
  it('round-trips student-confirmed milestone completion', () => {
    const p = newPlan('2026-10-01');
    p.completedSteps = ['Review rubric'];
    expect(readRhythm(savePlan(EMPTY_RHYTHM, p)).plans[0].completedSteps).toEqual(['Review rubric']);
  });
  it('keeps accounts, terms and daily/weekly work distinct', () => {
    expect(rhythmKey('a', 'fall')).not.toBe(rhythmKey('b', 'fall'));
    expect(rhythmKey('a', 'fall')).not.toBe(rhythmKey('a', 'spring'));
    expect(rhythmKey(null, 'fall')).not.toBe(rhythmKey('a', 'fall'));
  });
  it('preserves explicit waiting and blocked states when launching', () => {
    const p = newPlan('2026-10-01');
    p.status = 'Waiting';
    p.values.step = 'Write memo';
    expect(starter(p)).toContain('follow-up');
    p.status = 'Blocked';
    p.values.response = 'Ask the TA';
    expect(starter(p)).toBe('Ask the TA');
  });
  it('rejects corrupt dates, unsafe state, excessive content and duplicate records', () => {
    const l = savePlan(EMPTY_RHYTHM, newPlan('2026-10-01'));
    for (const mutate of [
      (p: ReturnType<typeof newPlan>) => (p.date = '2026-02-30'),
      (p: ReturnType<typeof newPlan>) => Object.assign(p, { status: 'at-risk' }),
      (p: ReturnType<typeof newPlan>) => (p.values.notes = 'x'.repeat(4001)),
      (p: ReturnType<typeof newPlan>) => (p.audit = []),
    ]) {
      const copy = structuredClone(l);
      mutate(copy.plans[0]);
      expect(() => readRhythm(copy)).toThrow();
    }
    expect(() => readRhythm({ ...l, plans: [l.plans[0], l.plans[0]] })).toThrow();
  });
  it('carries only selected goal, next step and support without private reflections', () => {
    const p = newPlan('2026-10-05');
    p.values.carry = 'Find one source';
    p.values.notes = 'private';
    p.values.helped = 'quiet';
    p.values.next = 'Open library guide';
    const next = carryForward(p);
    expect(next.date).toBe('2026-10-12');
    expect(next.values.outcome).toBe('Find one source');
    expect(next.values.notes).toBe('');
    expect(next.values.helped).toBe('');
  });
  it('finds Monday across month/year boundaries', () => {
    expect(monday('2027-01-01')).toBe('2026-12-28');
    expect(monday('2026-10-05')).toBe('2026-10-05');
  });
  it('preserves other dates on updates and caps retained records', () => {
    let l = savePlan(EMPTY_RHYTHM, newPlan('2026-10-01'));
    l = savePlan(l, newPlan('2026-10-02'));
    const p = newPlan('2026-10-01');
    p.values.outcome = 'Changed';
    l = savePlan(l, p);
    expect(l.plans).toHaveLength(2);
    expect(l.plans[0].values.outcome).toBe('Changed');
  });
  it('models buffers without altering effort and supports turning them off', () => {
    const tasks = [
      { title: 'a', context: 'write', minutes: 25 },
      { title: 'b', context: 'admin', minutes: 10 },
      { title: 'c', context: 'write', minutes: 25 },
    ];
    const r = simulate(tasks, 5, 80);
    expect(r.original.total).toBe(70);
    expect(r.batched.total).toBe(65);
    expect(tasks.map((t) => t.title)).toEqual(['a', 'b', 'c']);
    expect(simulate(tasks, 0, 80).original.total).toBe(60);
    expect(() => simulate(tasks, NaN, 80)).toThrow();
  });
  it('exports a local calendar proposal with escaped text and valid folded UTF-8 lines', () => {
    const p = newPlan('2026-10-01');
    p.values.window = '2026-10-01T23:55';
    p.values.outcome = 'Read; notes\nBEGIN:VEVENT' + 'é'.repeat(90);
    p.minutes = 10;
    const ics = calendarProposal(p);
    expect(ics).toContain('DTEND:20261002T000500');
    expect(ics).toContain('Read\\; notes\\nBEGIN:VEVENT');
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    p.values.window = '';
    expect(() => calendarProposal(p)).toThrow();
  });
});
