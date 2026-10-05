import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STEWARD_ROLES, CONTRACTS } from './data-contracts';
import { APPROVAL_FLOW, SETTINGS } from './config-tiers';
import { AUDIENCE_LABEL, AUDIENCES, AVOID, SECTIONS, type Audience } from './incident-comms';
import { LEVELS } from './hierarchy';
import { CRITERIA } from './scorecard';

/*
 * The governance tables (20260927235000_governance_registries.sql) enforce the
 * same vocabularies these modules define — the settings and their tiers, the
 * audiences and what each must say, the eleven criteria. Two copies of a list
 * are one edit from disagreeing, and when they do the screen says yes and the
 * database says no. So the migration marks each copy between `registry:`
 * comments and this reads them, the way flags.test.ts reads the kill switches.
 * Both directions: a key the SQL has and the code lacks fails as surely as
 * the reverse.
 */
const migrations = resolve(__dirname, '../../../../supabase/migrations');
// The review fixes (#828) carry the approvers block; later files add to the
// earlier, so all are read as one, and a registry a later file redefines is
// read from the latest (launch_delay and change_notice, 20261004120000).
const sql = [
  '20260927235000_governance_registries.sql',
  '20260927235500_governance_review_fixes.sql',
  '20261004120000_incident_notice_launch_delay_and_change.sql',
]
  .map((f) => readFileSync(resolve(migrations, f), 'utf8'))
  .join('\n');

function block(name: string): string {
  const all = [...sql.matchAll(new RegExp(`-- registry:${name}\\n([\\s\\S]*?)-- end registry`, 'g'))];
  if (!all.length) throw new Error(`no registry:${name} block in the migration`);
  return all[all.length - 1][1];
}

const quoted = (text: string) => [...text.matchAll(/'([^']+)'/g)].map((m) => m[1]);
const sorted = (xs: Iterable<string>) => [...xs].sort();

describe('the governance tables enforce the registries’ own lists', () => {
  it('finds every block it reads, so a renamed marker fails here rather than passing on nothing', () => {
    for (const name of ['levels', 'connectors', 'steward-roles', 'criteria', 'approval-steps', 'settings',
      'audiences', 'sections', 'avoid', 'required-details', 'cadence', 'approvers']) {
      expect(() => block(name), name).not.toThrow();
    }
  });

  it('policy levels', () => {
    expect(quoted(block('levels'))).toEqual([...LEVELS]);
  });

  it('connectors and stewardship roles', () => {
    expect(sorted(quoted(block('connectors')))).toEqual(sorted(CONTRACTS.map((c) => c.connector)));
    expect(sorted(quoted(block('steward-roles')))).toEqual(sorted(Object.keys(STEWARD_ROLES)));
  });

  it('scorecard criteria', () => {
    expect(quoted(block('criteria'))).toEqual([...CRITERIA]);
  });

  it('approval steps, in order', () => {
    // After `<@`: the column's own default, array['request'], sits in the block too.
    expect(quoted(block('approval-steps').split('<@')[1])).toEqual([...APPROVAL_FLOW]);
  });

  it('every registered setting, at its tier', () => {
    const pairs = [...block('settings').matchAll(/when '([^']+)'\s+then (\d)/g)].map((m) => [m[1], Number(m[2])]);
    expect(Object.fromEntries(pairs)).toEqual(Object.fromEntries(SETTINGS.map((s) => [s.key, s.tier])));
    expect(pairs).toHaveLength(SETTINGS.length);
  });

  it('incident audiences, sections and avoided phrases', () => {
    expect(sorted(quoted(block('audiences')))).toEqual(sorted(Object.keys(AUDIENCE_LABEL)));
    expect(quoted(block('sections'))).toEqual([...SECTIONS]);
    expect(sorted(quoted(block('avoid')))).toEqual(sorted(AVOID));
  });

  it('each audience’s required details and their allowed answers', () => {
    const inSql = Object.fromEntries(
      [...block('required-details').matchAll(/when '([^']+)'\s+then '([^']+)'/g)].map((m) => [m[1], JSON.parse(m[2])]),
    ) as Record<string, Record<string, string[] | null>>;
    for (const a of Object.keys(AUDIENCES) as Audience[]) {
      const want = Object.fromEntries(AUDIENCES[a].requires.map((r) => [r.key, r.oneOf ? [...r.oneOf] : null]));
      expect(inSql[a] ?? {}, a).toEqual(want);
    }
    for (const a of Object.keys(inSql)) expect(Object.keys(AUDIENCES), a).toContain(a);
  });

  it('each audience’s update cadence', () => {
    const inSql = Object.fromEntries(
      [...block('cadence').matchAll(/when '([^']+)'\s+then (\d+)/g)].map((m) => [m[1], Number(m[2])]),
    );
    expect(inSql).toEqual(
      Object.fromEntries((Object.keys(AUDIENCES) as Audience[]).map((a) => [a, AUDIENCES[a].updateEveryMinutes])),
    );
  });

  it('each audience’s required approvers', () => {
    const inSql = Object.fromEntries(
      [...block('approvers').matchAll(/when '([^']+)'\s+then array\[([^\]]*)\]/g)].map((m) => [m[1], quoted(m[2])]),
    );
    expect(inSql).toEqual(
      Object.fromEntries((Object.keys(AUDIENCES) as Audience[]).map((a) => [a, [...AUDIENCES[a].approvers]])),
    );
  });
});
