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
import { SUMMARY_MAX } from './crisis';
import { VOLUNTEER_P2_CATEGORIES } from './moderation';
import { SEVERITY_DELTA, STANDING_WORDS } from './safety-state';
import { JIT_HOURS } from './identity';
import { VOLUNTEER_RULES } from './volunteer';

const sql = readFileSync(new URL('../../../supabase/migrations/20260928032000_community.sql', import.meta.url), 'utf8');

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

describe('escalation rules, in both places', () => {
  it('only P0 and P1', () => {
    expect(body('private.escalation_allowed')).toContain(`k.severity not in ('P0', 'P1')`);
  });

  it('the summary that leaves is capped at the same length', () => {
    const decide = body('public.decide_community_escalation');
    expect(decide).toContain(`'summary', left(e.requested_reason, ${SUMMARY_MAX})`);
  });

  it('the payload keys are the fields prepareEscalation builds', () => {
    const decide = body('public.decide_community_escalation');
    const built = /jsonb_build_object\(([\s\S]*?)\);/.exec(decide)?.[1] ?? '';
    const keys = [...built.matchAll(/'([a-z_]+)',/g)].map((m) => m[1]).sort();
    expect(keys).toEqual(['agreement_ref', 'case_id', 'category', 'occurred_at', 'severity', 'summary', 'tenant_id']);
  });
});

describe('safety state, in both places', () => {
  it('costs the same at each severity, and nothing at P3', () => {
    const record = body('private.record_safety_outcome');
    expect(record).toContain(
      `case k.severity when 'P0' then ${SEVERITY_DELTA.P0} when 'P1' then ${SEVERITY_DELTA.P1} else ${SEVERITY_DELTA.P2} end`,
    );
    expect(SEVERITY_DELTA.P3).toBe(0);
    expect(record).toContain(`if k.severity = 'P3' then return; end if;`);
  });

  it('tells the student the same words', () => {
    const start = sql.indexOf('create or replace function public.my_community_standing(');
    const standing = sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start) + 5));
    expect(standing).toContain(`'${STANDING_WORDS.affected}'`);
    expect(standing).toContain(`'${STANDING_WORDS.clear}'`);
  });
});

describe('just-in-time identity, in both places', () => {
  it('a grant lasts as long in the database as identity.ts says', () => {
    expect(body('public.decide_alias_identity')).toContain(`now() + interval '${JIT_HOURS} hours'`);
  });

  it('a request needs the same ten characters of reason viewIdentity asks for', () => {
    expect(body('public.request_alias_identity')).toContain('coalesce(length(trim(want_reason)), 0) < 10');
  });
});
