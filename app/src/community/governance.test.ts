import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MECHANICS, COMMUNITY_PHASES, FORBIDDEN_MECHANICS, GATED_PROGRAMS, LAUNCH_GATES, NON_GOALS, NOT_AN_EMERGENCY_SERVICE,
  NOT_PRIMARY_METRICS, OUTCOME_MEASURES, PACKAGES, READINESS_BRIEF, REVENUE_NOT_TAKEN, SEVERITY_LADDER, brief, readyToEnable,
  type BriefId, type GateId,
} from './governance';
import { COMMUNITY_FLAGS } from './flags';

/**
 * The governance data is held to its shape and its two functions to their
 * refusals. A brief with a bare "yes" is not a brief; a programme with one
 * gate unsigned is not enabled.
 */

const answered = (): Record<BriefId, string> => Object.fromEntries(READINESS_BRIEF.map((q) => [q.id, `A written answer to "${q.ask}" of some length.`])) as Record<BriefId, string>;
const signed = (): Record<GateId, { by: string; evidence: string; on: string }> =>
  Object.fromEntries(LAUNCH_GATES.map((g) => [g.id, { by: 'dean of students', evidence: `docs/evidence/${g.id}.md`, on: '2026-09-28' }])) as Record<GateId, { by: string; evidence: string; on: string }>;

describe('the readiness brief', () => {
  it('asks the fourteen questions the blueprints require, and the five the charter and the gate do not', () => {
    expect(READINESS_BRIEF).toHaveLength(14);
    expect(new Set(READINESS_BRIEF.map((q) => q.id)).size).toBe(14);
    for (const id of ['never', 'abuse', 'owner', 'escalation', 'exit', 'stop']) expect(READINESS_BRIEF.some((q) => q.id === id), id).toBe(true);
  });

  it('is complete only when every question has a written answer', () => {
    expect(brief({ feature: 'circles', answers: answered() })).toEqual({ complete: true, unanswered: [] });
    const a = answered();
    delete (a as Partial<Record<BriefId, string>>).never;
    expect(brief({ feature: 'circles', answers: a }).unanswered).toEqual(['never']);
  });

  it('a bare yes, a label or a short phrase is not an answer, because none is twenty characters', () => {
    for (const bad of ['yes', 'No.', 'n/a', 'TBD', 'students', 'Yes, absolutely.  ']) {
      const a = answered();
      a.abuse = bad;
      expect(brief({ feature: 'x', answers: a }).unanswered, bad).toEqual(['abuse']);
    }
  });
});

describe('the launch gates', () => {
  it('are the eleven conditions, each named once', () => {
    expect(LAUNCH_GATES).toHaveLength(11);
    expect(new Set(LAUNCH_GATES.map((g) => g.id)).size).toBe(11);
  });

  it('cover every programme the database can switch, under the names flags.ts gives them', () => {
    // The high-risk flags in flags.ts are programmes `community_programs` switches per tenant.
    for (const key of Object.keys(COMMUNITY_FLAGS)) {
      const snake = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      if (['community_reporting', 'moderation_console'].includes(snake)) continue;
      expect(GATED_PROGRAMS, `${key} → ${snake}`).toContain(snake);
    }
  });

  it('enable only with every gate signed, dated and evidenced', () => {
    expect(readyToEnable({ tenant: 't', program: 'peer_mentorship', gates: signed() })).toEqual({ ready: true, missing: [], reasons: [] });
    const g = signed();
    g.sla = { by: '', evidence: 'x', on: '2026-09-28' };
    g.closure = { by: 'x', evidence: 'y', on: 'yesterday' };
    const v = readyToEnable({ tenant: 't', program: 'peer_mentorship', gates: g });
    expect(v.ready).toBe(false);
    expect(v.missing).toEqual(['sla', 'closure']);
  });

  it('refuse a programme they do not know', () => {
    const v = readyToEnable({ tenant: 't', program: 'public_feed' as never, gates: signed() });
    expect(v.ready).toBe(false);
    expect(v.reasons[0]).toContain('public_feed');
  });
});

describe('the ladder, the mechanics and the money', () => {
  it('has five severity levels, P4 the only one that opens no case', () => {
    expect(SEVERITY_LADDER.map((s) => s.level)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4']);
    expect(SEVERITY_LADDER.filter((s) => !s.opensCase).map((s) => s.level)).toEqual(['P4']);
    for (const s of SEVERITY_LADDER) for (const k of ['example', 'response', 'owner', 'target'] as const) expect(s[k].length, `${s.level}.${k}`).toBeGreaterThan(10);
  });

  it('never promises 24/7 response', () => {
    expect(NOT_AN_EMERGENCY_SERVICE).toMatch(/not an emergency service/);
    expect(NOT_AN_EMERGENCY_SERVICE).toMatch(/does not promise 24\/7/);
    for (const s of SEVERITY_LADDER) expect(s.target).not.toMatch(/24\/7|always|guarantee/i);
  });

  it('names the seven forbidden mechanics, each with a reason, and none of them among the allowed', () => {
    expect(FORBIDDEN_MECHANICS).toHaveLength(7);
    for (const f of FORBIDDEN_MECHANICS) expect(f.why.length, f.what).toBeGreaterThan(10);
    const allowed = ALLOWED_MECHANICS.map((m) => m.mechanic.toLowerCase());
    for (const f of FORBIDDEN_MECHANICS) expect(allowed).not.toContain(f.what.toLowerCase());
    for (const m of ALLOWED_MECHANICS) expect(m.rule.length, m.mechanic).toBeGreaterThan(10);
  });

  it('phases 1 to 5, every package in one of them, safety and foundations first', () => {
    expect(Object.keys(COMMUNITY_PHASES).map(Number)).toEqual([1, 2, 3, 4, 5]);
    expect(PACKAGES).toHaveLength(6);
    for (const p of PACKAGES) expect(Object.keys(COMMUNITY_PHASES).map(Number)).toContain(p.phase);
    expect(PACKAGES.filter((p) => p.phase === 1).map((p) => p.id).sort()).toEqual(['foundations', 'safety']);
    const phases: number[] = PACKAGES.map((p) => p.phase);
    expect(phases).not.toContain(5);
  });

  it('refuses the eight revenue models, and names outcomes rather than activity', () => {
    expect(REVENUE_NOT_TAKEN).toHaveLength(8);
    expect(REVENUE_NOT_TAKEN.join(' ')).toMatch(/behavioral data/);
    expect(REVENUE_NOT_TAKEN.join(' ')).toMatch(/report a safety concern/);
    expect(OUTCOME_MEASURES).toHaveLength(6);
    for (const m of OUTCOME_MEASURES) for (const bad of NOT_PRIMARY_METRICS) expect(m.toLowerCase()).not.toContain(bad);
    expect(NON_GOALS).toHaveLength(6);
  });
});
