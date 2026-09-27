import { describe, expect, it } from 'vitest';
import { EMPTY_ABROAD, STAGE_STEPS, approvalText, creditLine, creditPicture, readAbroad, stageProgress, type AbroadPlan } from './abroad';

const program = (id: string, extra = {}) => ({
  id, name: 'Madrid Spring', host: 'Universidad Carlos III', city: 'Madrid', country: 'Spain', term: 'Spring 2027',
  deadline: '2026-10-15', cost: 18500, currency: 'EUR', credits: 15, url: '', notes: '', ...extra,
});
const course = (id: string, status: string, credits = 3, extra = {}) => ({
  id, programId: 'p1', host: `Host ${id}`, counts: `ECON ${id}`, credits, status, from: 'Global Education email, 3 Oct', ...extra,
});
const PLAN: AbroadPlan = readAbroad({
  programs: [program('p1')],
  courses: [course('a', 'pre-approved'), course('b', 'pre-approved'), course('c', 'pending'), course('d', 'estimated'), course('e', 'not-approved')],
  steps: { p1: { [STAGE_STEPS.application[0]]: true } },
});

describe('the credit a student can count on', () => {
  it('counts only what they recorded as pre-approved, and keeps the rest apart', () => {
    expect(creditPicture(PLAN, 'p1')).toEqual({ planned: 15, approved: 6, pending: 3, estimated: 3, unmatched: 3 });
    expect(creditLine(creditPicture(PLAN, 'p1'))).toBe(
      '6 of 15 credits recorded as pre-approved · 3 pending · 3 estimated, not reviewed · 3 with no course matched yet',
    );
  });

  it('never counts a course recorded as not approved toward the plan', () => {
    // Four courses matched (12 credits); the not-approved one leaves 3 unmatched.
    expect(creditPicture(PLAN, 'p1').unmatched).toBe(3);
  });
});

describe('the course plan copied for an advisor', () => {
  it('says whose word each approval is, and that the written decision counts', () => {
    const text = approvalText(PLAN, 'p1');
    expect(text).toContain('Madrid Spring, Universidad Carlos III (Spring 2027)');
    expect(text).toContain('- Host a → ECON a · 3 cr · Pre-approved (recorded from Global Education email, 3 Oct)');
    expect(text).toContain('Approvals listed are as I recorded them; the written decisions are what count.');
  });
});

describe('reading a stored plan', () => {
  it('reads back what it wrote', () => {
    expect(readAbroad(JSON.parse(JSON.stringify(PLAN)))).toEqual(PLAN);
    expect(stageProgress(PLAN, 'p1', 'application')).toEqual({ done: 1, total: STAGE_STEPS.application.length });
  });

  it('drops what it cannot trust, and courses whose program is gone', () => {
    const got = readAbroad({
      programs: [program('p1'), program('p2', { deadline: '2026-02-31' }), program('p3', { cost: -5 })],
      courses: [course('a', 'pre-approved'), course('b', 'approved-by-me'), course('c', 'pending', 3, { programId: 'gone' })],
      steps: { p1: { 'Made up step': true, [STAGE_STEPS.return[0]]: 'yes' }, gone: {} },
    });
    expect(got.programs.map((p) => p.id)).toEqual(['p1']);
    expect(got.courses.map((c) => c.id)).toEqual(['a']);
    expect(got.steps).toEqual({ p1: {} });
    expect(readAbroad('nonsense')).toEqual(EMPTY_ABROAD);
  });

  it('keeps an unknown cost as unknown rather than zero', () => {
    expect(readAbroad({ programs: [program('p1', { cost: null })] }).programs[0].cost).toBeNull();
  });
});
