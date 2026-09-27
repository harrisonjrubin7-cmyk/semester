import { describe, expect, it } from 'vitest';
import { explicitOnly, recommend, type Context } from './recommend';

describe('recommendations', () => {
  const base: Context = { goal: 'paper', courseCode: 'PSCI 1104', hidden: [], showLess: false };

  it('is finite, and every item says why', () => {
    const recs = recommend(base);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(4);
    for (const r of recs) expect(r.why.length).toBeGreaterThan(0);
  });

  it('ignores grades, risk, health, location and anything else it was not given leave to read', () => {
    const polluted = { ...base, gpa: 1.2, riskScore: 0.97, disability: true, gps: [36.14, -86.8], financialAid: 'yes', popularity: 900 };
    expect(recommend(polluted as unknown as Context)).toEqual(recommend(base));
    expect(Object.keys(explicitOnly(polluted as unknown as Context)).sort()).toEqual(Object.keys(base).sort());
  });

  it('explains a subject recommendation by the course code the student imported', () => {
    const why = recommend(base).flatMap((r) => r.why).join(' ');
    expect(why).toContain('PSCI 1104 is Political science');
  });

  it('hides what the student hid and shows fewer when asked', () => {
    const first = recommend(base)[0].workspace.id;
    expect(recommend({ ...base, hidden: [first] }).some((r) => r.workspace.id === first)).toBe(false);
    expect(recommend({ ...base, showLess: true }).length).toBeLessThanOrEqual(2);
  });

  it('puts the chosen assignment type first and says a near due date', () => {
    const recs = recommend({ ...base, assignment: 'policy_memo', dueInDays: 2 });
    expect(recs[0].workspace.template).toBe('policy_memo');
    expect(recs[0].why.join(' ')).toContain('Due in 2 days');
  });
});
