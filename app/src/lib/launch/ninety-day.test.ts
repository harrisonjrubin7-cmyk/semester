import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TASKS, blockers, overclaims, planProblems, type Task } from './ninety-day';

/**
 * The 90-day program: every dependency points backwards in time, nothing
 * loops, the cohort cannot launch ahead of its prerequisites, and the operator's
 * document lists the same tasks as this file.
 */

const doc = readFileSync(join(import.meta.dirname, '../../../../docs/90-DAY-LAUNCH-PROGRAM.md'), 'utf8');

describe('the 90-day program', () => {
  it('has no unknown, backwards or circular dependency', () => {
    expect(planProblems(TASKS)).toEqual([]);
  });

  it('would notice each of those (controls)', () => {
    const a: Task = { id: 'a', window: 1, title: 'a', owner: 'founder', evidence: 'x', after: [] };
    const b: Task = { id: 'b', window: 1, title: 'b', owner: 'founder', evidence: 'x', after: ['a'] };
    expect(planProblems([a, { ...b, after: ['nope'] }]).join()).toMatch(/unknown/);
    expect(planProblems([{ ...a, window: 2 }, b]).join()).toMatch(/later window/);
    expect(planProblems([{ ...a, after: ['b'] }, b]).join()).toMatch(/cycle/);
    expect(planProblems([{ ...a, evidence: ' ' }]).join()).toMatch(/evidence/);
  });

  it('launches the cohort only after UAT, training, support, a restore rehearsal, comms and accessibility testing', () => {
    const launch = TASKS.find((t) => t.id === 'launch-cohort')!;
    for (const need of ['uat', 'training', 'support-ready', 'restore-rehearsal', 'comms', 'a11y-core']) expect(launch.after, need).toContain(need);
  });

  it('catches a status column that marks the launch done ahead of its prerequisites', () => {
    const allDone = Object.fromEntries(TASKS.map((t) => [t.id, 'done' as const]));
    expect(overclaims(allDone)).toEqual([]);
    const skipped = { ...allDone, 'restore-rehearsal': 'not_started' as const };
    expect(overclaims(skipped)).toEqual(['launch-cohort: done before restore-rehearsal']);
    expect(blockers('launch-cohort', skipped)).toEqual(['restore-rehearsal']);
  });

  it('lists the same tasks in the document, in the same windows', () => {
    const sections = doc.split(/^## Days /m).slice(1);
    expect(sections).toHaveLength(3);
    sections.forEach((s, i) => {
      const ids = [...s.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]);
      expect(ids, `window ${i + 1}`).toEqual(TASKS.filter((t) => t.window === i + 1).map((t) => t.id));
    });
  });
});
