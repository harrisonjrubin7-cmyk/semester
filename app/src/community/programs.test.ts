/**
 * The volunteer and alias rules exist twice — as the TypeScript the app
 * reasons with, and as the SQL the database enforces. These read the numbers
 * out of the statements that use them in the migration and hold the two to
 * each other, so tuning one without the other fails here rather than in
 * front of a volunteer.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALIAS_ELIGIBLE_TYPES, ALIAS_RATE_LIMIT } from './alias';
import { VOLUNTEER_P2_CATEGORIES } from './moderation';
import { VOLUNTEER_RULES } from './volunteer';

const sql = readFileSync(new URL('../../../supabase/migrations/20260927170000_community.sql', import.meta.url), 'utf8');

function body(fn: string): string {
  const start = sql.indexOf(`create or replace function ${fn}(`);
  expect(start, `${fn} is no longer in the migration`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('end $$;', start));
}

describe('volunteer rules, in both places', () => {
  it('calibration: 20 items, pass at 85%', () => {
    const recompute = body('private.volunteer_recompute');
    const pass = Math.ceil(VOLUNTEER_RULES.calibrationTasks * VOLUNTEER_RULES.calibrationPass);
    expect(recompute).toContain(`answered >= ${VOLUNTEER_RULES.calibrationTasks} and right_answers >= ${pass}`);
  });

  it('quality: the last 20 controls, 5 points each, active at 85, paused below 75', () => {
    const recompute = body('private.volunteer_recompute');
    expect(recompute).toContain(`limit ${VOLUNTEER_RULES.qualityWindow}`);
    expect(recompute).toContain(`quality := right_answers * ${VOLUNTEER_RULES.qualityStep}`);
    expect(recompute).toContain(`when quality >= ${VOLUNTEER_RULES.activeAt} then 'active'`);
    expect(recompute).toContain(`when quality >= ${VOLUNTEER_RULES.pauseBelow} then 'probation'`);
  });

  it('caps: 20 an hour, 100 a day', () => {
    expect(body('private.volunteer_ready')).toContain(
      `last_hour >= ${VOLUNTEER_RULES.perHour} or last_day >= ${VOLUNTEER_RULES.perDay}`,
    );
  });

  it('eligibility: a 30-day account', () => {
    expect(body('public.apply_to_volunteer')).toContain(`interval '${VOLUNTEER_RULES.minAccountAgeDays} days'`);
  });

  it('the narrow P2 categories a volunteer may see', () => {
    const eligible = body('private.volunteer_eligible_case');
    const listed = /k\.category in \(([^)]+)\)/.exec(eligible)?.[1] ?? '';
    expect(listed.split(',').map((x) => x.trim().replaceAll("'", '')).sort()).toEqual([...VOLUNTEER_P2_CATEGORIES].sort());
  });
});

describe('alias rules, in both places', () => {
  it('three posts an hour under an alias', () => {
    expect(body('public.create_community_post')).toContain(`per_hour := least(per_hour, ${ALIAS_RATE_LIMIT.postsPerHour})`);
  });

  it('only support and study-group communities', () => {
    const approve = body('public.approve_community_pseudonymity');
    const listed = /c\.kind not in \(([^)]+)\)/.exec(approve)?.[1] ?? '';
    expect(listed.split(',').map((x) => x.trim().replaceAll("'", '')).sort()).toEqual([...ALIAS_ELIGIBLE_TYPES].sort());
  });

  it('the same name rule', () => {
    expect(sql).toContain(`name ~ '^[A-Za-z][A-Za-z0-9]{3,23}$'`);
    const aliasTs = readFileSync(new URL('./alias.ts', import.meta.url), 'utf8');
    expect(aliasTs).toContain('/^[A-Za-z][A-Za-z0-9]{3,23}$/');
  });
});
