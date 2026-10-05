import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULE_FLAG_NAMES } from '../experience-flags';
import { CONTROLS } from '../mecontrols';
import { destination } from '../nav';
import { TIER_REVIEWERS } from './config-tiers';
import { CLOCKS, MODULE_EFFECTS, simulate, simulateModule, simulateRetention } from './policysim';

const root = join(import.meta.dirname, '../../../..');
const exists = (p: string) => existsSync(join(root, p));

describe('the policy simulator', () => {
  it('describes every module, on screens that exist, with support content that exists', () => {
    expect(Object.keys(MODULE_EFFECTS).sort()).toEqual([...MODULE_FLAG_NAMES].sort());
    for (const [m, e] of Object.entries(MODULE_EFFECTS)) {
      expect(e.screens.length, m).toBeGreaterThan(0);
      for (const s of e.screens) expect(destination(s) ?? CONTROLS.find((c) => c.screen === s), `${m} → ${s}`).toBeDefined();
      expect(e.workflows.length, m).toBeGreaterThan(0);
      expect(e.alternatives.length, m).toBeGreaterThan(0);
      for (const p of e.support) expect(exists(p), `${m} cites ${p}`).toBe(true);
    }
    for (const c of CLOCKS) expect(exists(c.enforcedBy), `${c.id} cites ${c.enforcedBy}`).toBe(true);
  });

  it('answers the five questions the brief asks before a module goes off in a course', () => {
    const s = simulateModule({ kind: 'module-off', module: 'course_studio', scope: 'course', course: 'ECON 1020' });
    expect(s.who).toContain('ECON 1020');
    expect(s.workflows).toContain('The course’s AI policy shown before the assistant answers');
    expect(s.alternatives.length).toBeGreaterThan(0);
    expect(s.support).toContain('docs/FACULTY-COURSE-STUDIO-DESIGN.md');
    expect(s.audit.event).toBe('policy.module.course_studio.off');
    expect(s.audit.records).toContain('The value before and after');
    expect(s.reviewers).toEqual([...TIER_REVIEWERS[3]]);
    expect(s.refused).toBeNull();
    expect(simulateModule({ kind: 'module-off', module: 'offline_mode', scope: 'tenant' }).who).toContain('institution');
    // Only Course Studio has a per-course switch; a course scope on any other module is refused, not described.
    expect(Object.entries(MODULE_EFFECTS).filter(([, e]) => e.perCourse).map(([m]) => m)).toEqual(['course_studio']);
    const wrong = simulateModule({ kind: 'module-off', module: 'offline_mode', scope: 'course', course: 'ECON 1020' });
    expect(wrong.refused).toMatch(/no per-course switch/);
    expect(wrong.workflows).toEqual([]);
  });

  it('answers the three questions the brief asks before a retention clock changes', () => {
    const s = simulateRetention({ kind: 'retention', clock: 'gateway_audit', toDays: 90 });
    expect(s.dataClasses).toEqual(['audit']);
    expect(s.exports.length + s.deletions.length).toBeGreaterThan(0);
    expect(s.contracts).toContain('Data-processing agreement: AI processing records');
    expect(s.reviewers).toEqual([...TIER_REVIEWERS[3]]);
    expect(s.refused).toBeNull();
    expect(s.change).toContain('from 180 days to 90 days');
  });

  it('refuses a clock on a student’s own work, a clock under its floor, a non-change and nonsense', () => {
    expect(simulateRetention({ kind: 'retention', clock: 'student-work', toDays: 365 }).refused).toMatch(/until they delete it/);
    expect(simulateRetention({ kind: 'retention', clock: 'audit_events', toDays: 365 }).refused).toMatch(/floor of 1095 days/);
    expect(simulateRetention({ kind: 'retention', clock: 'audit_events', toDays: 1460 }).refused).toBeNull();
    expect(simulateRetention({ kind: 'retention', clock: 'access_log', toDays: 90 }).refused).toBe('That is the clock already.');
    expect(simulateRetention({ kind: 'retention', clock: 'access_log', toDays: 0 }).refused).toMatch(/whole number/);
    expect(() => simulateRetention({ kind: 'retention', clock: 'nope', toDays: 1 })).toThrow();
  });

  it('routes either kind through one entry point', () => {
    expect(simulate({ kind: 'retention', clock: 'activity', toDays: 180 }).change).toContain('400 days to 180 days');
    expect(simulate({ kind: 'module-off', module: 'trust_center', scope: 'tenant' }).audit.event).toBe('policy.module.trust_center.off');
  });
});
