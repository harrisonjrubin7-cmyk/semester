import { describe, expect, it } from 'vitest';
import { gate } from './classification';
import { toolkitFlags } from './flags';
import { card, fromCourse, permits, redirect, resolve, type PolicySource } from './policy';
import { entitle, NEVER, SUBJECTS, subjectOf, toolsFor, UNIVERSAL, type Tool } from './catalog';
import { explicitOnly, recommend, type Context } from './recommend';
import { boundaryNotice } from './safety';

/**
 * The toolkit's gates: classification, policy precedence, flags, entitlement
 * and recommendation inputs. Each block is one promise the brief makes and
 * the smallest input that would break it.
 */

describe('data-classification gate', () => {
  it('treats unclassified material as an education record and keeps it away from AI', () => {
    const v = gate(undefined, 'ai', true);
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/not been classified/);
  });

  it('hard-blocks T4–T6 from every action, including storing it', () => {
    for (const tier of ['T4', 'T5', 'T6'] as const)
      for (const action of ['store', 'ai', 'share', 'export', 'external'] as const) expect(gate(tier, action, true).allowed).toBe(false);
  });

  it('keeps T3 on the device but out of AI, sharing and export', () => {
    expect(gate('T3', 'store', true).allowed).toBe(true);
    for (const action of ['ai', 'share', 'export', 'external'] as const) expect(gate('T3', action, true).allowed).toBe(false);
  });

  it('never widens a course policy: public material still cannot go to AI where the course forbids it', () => {
    expect(gate('T0', 'ai', false).allowed).toBe(false);
    expect(gate('T0', 'ai', true).allowed).toBe(true);
  });

  it('refuses every external action, since no connector is approved', () => {
    expect(gate('T0', 'external', true).allowed).toBe(false);
  });
});

describe('AI-use policy precedence', () => {
  const course = (blanket: PolicySource['blanket'], uses?: PolicySource['uses']): PolicySource => ({
    layer: 'course', link: '', text: '', effective: '', lastVerified: '', by: 'instructor', blanket, uses,
  });
  const assignment = (uses: PolicySource['uses']): PolicySource => ({ ...course(undefined, uses), layer: 'assignment' });

  it('shows “unavailable” when no layer says anything, and unavailable never permits', () => {
    const r = resolve('brainstorming', []);
    expect(r.state).toBe('unavailable');
    expect(permits(r.state)).toBe(false);
  });

  it('an unstated course policy produces no layer at all', () => {
    expect(fromCourse({ stance: 'unstated', note: '' })).toBeUndefined();
    expect(fromCourse(undefined)).toBeUndefined();
  });

  it('an assignment rule beats the course blanket, in both directions', () => {
    expect(resolve('grammar', [course('prohibited'), assignment({ grammar: 'allowed' })]).state).toBe('allowed');
    expect(resolve('brainstorming', [course('allowed'), assignment({ brainstorming: 'prohibited' })]).state).toBe('prohibited');
  });

  it('a named rule beats a blanket at the same layer', () => {
    expect(resolve('revision', [course('allowed', { revision: 'limited' })]).state).toBe('limited');
  });

  it('a course that “allows AI” still does not allow final answers to an assessment', () => {
    const layer = fromCourse({ stance: 'allowed', note: 'AI allowed for study.' });
    expect(resolve('final-answers', [layer]).state).toBe('prohibited');
    expect(resolve('practice', [layer]).state).toBe('allowed');
  });

  it('labels a student-recorded policy as such, with no invented link or date', () => {
    const layer = fromCourse({ stance: 'limited', note: 'Ask first.' })!;
    expect(layer.by).toBe('student-record');
    expect(layer.link).toBe('');
    expect(layer.effective).toBe('');
  });

  it('files every use into exactly one column of the card', () => {
    const c = card([fromCourse({ stance: 'limited', note: '' })]);
    expect(c.allowed.length + c.disclose.length + c.prohibited.length + c.unavailable.length).toBe(c.all.length);
  });

  it('a course that bans AI is only offered the redirects that need no AI', () => {
    const banned = [fromCourse({ stance: 'banned', note: '' })];
    const offered = redirect(banned);
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((r) => r.needsAi === null)).toBe(true);
  });
});

describe('feature flags', () => {
  it('everything is off with no environment', () => {
    expect(Object.values(toolkitFlags({})).every((s) => s === 'off')).toBe(true);
  });

  it('does not follow the institutional preview the way the experience flags do', () => {
    expect(toolkitFlags({ VITE_INSTITUTIONAL_PREVIEW: 'true' }).aiToolkit).toBe('off');
  });

  it('the kill switch turns every toolkit flag off whatever the others say', () => {
    const f = toolkitFlags({ VITE_AI_TOOLKIT: 'off', VITE_TOOLKIT_RESEARCH: 'production', VITE_TOOLKIT_DATA: 'production' });
    expect(f.researchStudio).toBe('off');
    expect(f.dataStudio).toBe('off');
  });

  it('code execution and external connectors cannot be switched on — nothing is built behind them', () => {
    const f = toolkitFlags({ VITE_AI_TOOLKIT: 'production', VITE_TOOLKIT_CODE: 'production', VITE_TOOLKIT_CONNECTORS: 'production' });
    expect(f.codeExecution).toBe('off');
    expect(f.externalConnectors).toBe('off');
  });

  it('an unknown value reads as off, not as on', () => {
    expect(toolkitFlags({ VITE_AI_TOOLKIT: 'yes' }).aiToolkit).toBe('off');
  });
});

describe('workbench catalog and entitlement', () => {
  it('finds a subject from the course-code prefix and nothing from an unknown one', () => {
    expect(subjectOf('PSCI 1104')?.id).toBe('poli-sci');
    expect(subjectOf('econ 1010')?.id).toBe('economics');
    expect(subjectOf('ZZZZ 1000')).toBeUndefined();
    expect(subjectOf('')).toBeUndefined();
  });

  it('no prefix belongs to two subjects', () => {
    const all = SUBJECTS.flatMap((s) => s.prefixes);
    expect(new Set(all).size).toBe(all.length);
  });

  it('every native tool names a screen and every guided tool names a toolkit section', () => {
    for (const tool of [...UNIVERSAL, ...SUBJECTS.flatMap((s) => s.tools)]) {
      if (tool.state === 'native') expect(tool.screen, tool.id).toBeTruthy();
      if (tool.state === 'guided') expect(tool.opens, tool.id).toBeTruthy();
    }
  });

  it('restricted tools stay unavailable even when approved and the flag is on — nothing has passed review', () => {
    const dna = SUBJECTS.find((s) => s.id === 'bio')!.tools.find((x) => x.id === 'dna-lab')!;
    expect(entitle(dna, new Set(), false).available).toBe(false);
    expect(entitle(dna, new Set(['dna-lab']), true).available).toBe(false);
  });

  it('planned tools say they are not built rather than opening', () => {
    const planned = SUBJECTS.flatMap((s) => s.tools).find((x) => x.state === 'planned')!;
    expect(entitle(planned, new Set(), true)).toMatchObject({ available: false, label: 'Not built yet' });
  });

  it('a never-permitted capability is refused even if an approval list names it and it claims to be native', () => {
    for (const [id] of NEVER) {
      const rogue: Tool = { id, name: id, purpose: '', state: 'native', screen: 'study' };
      expect(entitle(rogue, new Set([id]), true)).toMatchObject({ available: false, label: 'Not permitted' });
    }
  });

  it('no catalog tool uses a never-permitted id', () => {
    const ids = new Set<string>(NEVER.map(([id]) => id));
    expect([...UNIVERSAL, ...SUBJECTS.flatMap((s) => s.tools)].filter((x) => ids.has(x.id))).toEqual([]);
  });

  it('clinical, legal and finance tools all carry their boundary', () => {
    const tools = SUBJECTS.flatMap((s) => s.tools);
    expect(tools.find((x) => x.id === 'med-math')?.boundary).toBe('clinical');
    expect(tools.find((x) => x.id === 'case-brief')?.boundary).toBe('legal');
    expect(tools.find((x) => x.id === 'finance-models')?.boundary).toBe('finance');
  });

  it('every subject inherits the universal tools, without duplicates', () => {
    const tools = toolsFor([SUBJECTS[0], SUBJECTS[1]]);
    expect(new Set(tools.map((x) => x.id)).size).toBe(tools.length);
    for (const u of UNIVERSAL) expect(tools.some((x) => x.id === u.id)).toBe(true);
  });
});

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

describe('boundary notices', () => {
  it('names the boundary a topic runs into', () => {
    expect(boundaryNotice('what dose should I give my patient')?.boundary).toBe('clinical');
    expect(boundaryNotice('answers to the take-home exam')?.boundary).toBe('assessment');
    expect(boundaryNotice('should I buy this stock')?.boundary).toBe('finance');
  });

  it('stays quiet on ordinary coursework, including the letter phi', () => {
    expect(boundaryNotice('sleep and memory in first-year students')).toBeNull();
    expect(boundaryNotice('golden ratio phi in Fibonacci')).toBeNull();
    expect(boundaryNotice('supply and demand elasticity')).toBeNull();
  });
});
