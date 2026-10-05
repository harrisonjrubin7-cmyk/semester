import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIN_COHORT } from '../institution-ops';
import { refusal } from './api';
import {
  CHOICE_LABEL, DEFAULTS, DOMAINS, DOMAIN_ABOUT, DOMAIN_LABEL, PLATFORM_MIN_COHORT, SETTING_HINT, SETTING_LABEL, SPEC,
  current, diff, draftOf, effectiveConfig, history, problemText, problems, publishBlocker, show, studioAllowed, valid,
  type ConfigVersion, type Settings,
} from './studio';

/**
 * Holds the Configuration Studio's spec to the migration that enforces it —
 * every domain, key, kind and bound — and its arithmetic to cases worked by
 * hand. The database refuses what this file would refuse; if the two drift,
 * the screen would accept a value the database then rejects, or worse.
 */

const root = join(import.meta.dirname, '../../../..');
const SQL = readFileSync(join(root, 'supabase/migrations/20260930230000_configuration_studio.sql'), 'utf8');

/** `private.config_spec()`'s JSON, read straight off the migration. */
const DB_SPEC = JSON.parse(SQL.slice(SQL.indexOf('$j$') + 3, SQL.indexOf('$j$', SQL.indexOf('$j$') + 3))) as Record<string, Record<string, Record<string, unknown>>>;

const T = '2026-10-01T00:00:00.000Z';
function version(over: Partial<ConfigVersion> = {}): ConfigVersion {
  return {
    id: 'v', tenant_id: 'u', domain: 'workflows', state: 'published', version: 1, settings: {}, note: '', based_on: null,
    created_by: 'editor', published_by: 'registrar', created_at: T, updated_at: T, published_at: T, ...over,
  };
}
const draft = (over: Partial<ConfigVersion> = {}) => version({ state: 'draft', version: null, published_by: null, published_at: null, ...over });

describe('the Configuration Studio, held to its migration', () => {
  it('names the same domains, in the same order, as the database check', () => {
    const at = SQL.indexOf("domain         text        not null check (domain in (");
    const words = [...SQL.slice(at, SQL.indexOf('))', at)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(words).toEqual([...DOMAINS]);
    expect(Object.keys(DB_SPEC)).toEqual([...DOMAINS]);
  });

  it('has the database’s spec, key for key and bound for bound', () => {
    const mine = JSON.parse(JSON.stringify(SPEC));
    expect(mine).toEqual(DB_SPEC);
  });

  it('has a label for every domain, every setting and every choice', () => {
    for (const d of DOMAINS) {
      expect(DOMAIN_LABEL[d], d).toBeTruthy();
      expect(DOMAIN_ABOUT[d], d).toBeTruthy();
      for (const [key, spec] of Object.entries(SPEC[d])) {
        expect(SETTING_LABEL[key], `${d}.${key} has no label`).toBeTruthy();
        if (spec.kind === 'enum' || spec.kind === 'set') for (const v of spec.values) expect(CHOICE_LABEL[v], `${d}.${key}=${v}`).toBeTruthy();
      }
    }
    for (const key of Object.keys(SETTING_HINT)) expect(Object.values(SPEC).some((s) => key in s), `hint for ${key}`).toBe(true);
  });

  it('has a unique key across domains, so a label is never ambiguous', () => {
    const keys = Object.values(SPEC).flatMap((s) => Object.keys(s));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('grants the three capabilities to the roles the check walks', () => {
    for (const c of ['config:manage', 'config:publish', 'config:view']) expect(SQL).toContain(`'${c}'`);
    for (const pair of [
      "('implementation_manager', 'config:manage')", "('integration_admin',      'config:manage')",
      "('university_admin',       'config:publish')", "('registrar',              'config:publish')",
    ]) expect(SQL).toContain(pair);
    // Nobody who only publishes can draft: the second person holds a different key.
    expect(SQL).not.toContain("('registrar',              'config:manage')");
  });

  it('records its table in the audit vocabulary', () => {
    expect(SQL).toMatch(/entity_type in \([^)]*'school_config_versions'/s);
    expect(SQL).toContain('create trigger audit_school_config_versions after insert or update or delete');
  });
});

describe('the defaults', () => {
  it('are valid, and name only keys the spec has', () => {
    for (const d of DOMAINS) {
      expect(problems(d, DEFAULTS[d]), d).toEqual([]);
      for (const key of Object.keys(DEFAULTS[d])) expect(SPEC[d][key], `${d}.${key}`).toBeTruthy();
    }
  });

  it('keep the reporting floor at the platform’s n = 10, the one institution-ops keeps', () => {
    expect(PLATFORM_MIN_COHORT).toBe(MIN_COHORT);
    expect(DEFAULTS.reporting.min_cohort_size).toBe(MIN_COHORT);
    const spec = SPEC.reporting.min_cohort_size;
    expect(spec.kind === 'int' && spec.min).toBe(MIN_COHORT);
  });

  it('start every new feature off, and keep data ninety days after someone leaves', () => {
    expect(DEFAULTS.features.default_release_stage).toBe('off');
    expect(DEFAULTS.data.retention_days_after_exit).toBe(90);
  });
});

describe('checking a value', () => {
  // The same cases the SQL check walks against private.config_problems.
  it('agrees with the database on the cases it is asked', () => {
    expect(problems('workflows', { approval_sla_days: 5, advisor_approval_required: true })).toEqual([]);
    expect(problems('workflows', { secret_key: 1 })).toEqual(['unknown_key:secret_key']);
    expect(problems('workflows', { approval_sla_days: 61 })).toEqual(['bad_value:approval_sla_days']);
    expect(problems('workflows', { approval_sla_days: 0 })).toEqual(['bad_value:approval_sla_days']);
    expect(problems('workflows', { approval_sla_days: '5' })).toEqual(['bad_value:approval_sla_days']);
    expect(problems('workflows', { approval_sla_days: 5.5 })).toEqual(['bad_value:approval_sla_days']);
    expect(problems('workflows', { advisor_approval_required: 1 })).toEqual(['bad_value:advisor_approval_required']);
    expect(problems('academic_structure', { grading_scale: 'vibes' })).toEqual(['bad_value:grading_scale']);
    expect(problems('roles', { enabled_roles: ['student', 'superuser'] })).toEqual(['bad_value:enabled_roles']);
    expect(problems('roles', { enabled_roles: ['student', 'student'] })).toEqual(['bad_value:enabled_roles']);
    expect(problems('roles', { enabled_roles: [] })).toEqual(['bad_value:enabled_roles']);
    expect(problems('roles', { enabled_roles: 'student' })).toEqual(['bad_value:enabled_roles']);
    expect(problems('branding', { accent_color: 'red' })).toEqual(['bad_value:accent_color']);
    expect(problems('branding', { accent_color: '#1a2B3c' })).toEqual([]);
    expect(problems('branding', { display_name: 'Pay 4111 1111 1111 1111' })).toEqual(['bad_value:display_name']);
    expect(problems('branding', { display_name: '   ' })).toEqual(['bad_value:display_name']);
    expect(problems('reporting', { min_cohort_size: 9 })).toEqual(['bad_value:min_cohort_size']);
    expect(problems('reporting', { min_cohort_size: 25 })).toEqual([]);
    expect(problems('workflows', [1])).toEqual(['not_object']);
    expect(problems('workflows', null)).toEqual(['not_object']);
  });

  it('lists problems in key order, as the database does', () => {
    expect(problems('workflows', { zzz: 1, approval_sla_days: 0, escalate_after_days: 0 })).toEqual([
      'bad_value:approval_sla_days', 'bad_value:escalate_after_days', 'unknown_key:zzz',
    ]);
  });

  it('refuses a control character in typed text, and a settings object over 8 KB', () => {
    expect(valid({ kind: 'text', max: 40 }, 'a\u0007b')).toBe(false);
    expect(problems('branding', { display_name: 'x'.repeat(120) })).toEqual([]);
    expect(problems('branding', { display_name: 'x'.repeat(121) })).toEqual(['bad_value:display_name']);
    expect(problems('roles', { enabled_roles: ['student'], ...Object.fromEntries(Array.from({ length: 900 }, (_, i) => [`k${i}`, 'xxxxxxxxxx'])) })).toEqual(['too_large']);
  });

  it('turns a code into a sentence naming the setting', () => {
    expect(problemText('bad_value:approval_sla_days')).toContain('Days an approval may wait');
    expect(problemText('unknown_key:model_key')).toContain('model_key');
  });
});

describe('versions', () => {
  const rows = [
    version({ id: 'a', version: 1, settings: { approval_sla_days: 5 } }),
    version({ id: 'b', version: 3, settings: { approval_sla_days: 4 } }),
    version({ id: 'c', version: 2, settings: { approval_sla_days: 10 } }),
    draft({ id: 'd', settings: { approval_sla_days: 7 } }),
    version({ id: 'e', domain: 'ai', version: 1, settings: { ai_enabled: false } }),
  ];

  it('takes the highest published version as current, never the draft', () => {
    expect(current(rows, 'workflows')?.id).toBe('b');
    expect(current(rows, 'roles')).toBeNull();
    expect(draftOf(rows, 'workflows')?.id).toBe('d');
    expect(draftOf(rows, 'ai')).toBeNull();
  });

  it('lists history newest first, published only', () => {
    expect(history(rows, 'workflows').map((r) => r.version)).toEqual([3, 2, 1]);
  });

  it('lays a school’s choices over the platform’s defaults, domain by domain', () => {
    const e = effectiveConfig(rows);
    expect(e.workflows).toEqual({ ...DEFAULTS.workflows, approval_sla_days: 4 });
    expect(e.ai.ai_enabled).toBe(false);
    expect(e.ai.require_citations).toBe(true);
    expect(e.roles).toEqual(DEFAULTS.roles);
    expect(Object.keys(e)).toEqual([...DOMAINS]);
  });

  it('shows a rollback as the change it is', () => {
    const before = { approval_sla_days: 4, advisor_approval_required: true } as Settings;
    const after = { approval_sla_days: 5 } as Settings;
    expect(diff('workflows', before, after)).toEqual([
      { key: 'advisor_approval_required', from: true, to: undefined },
      { key: 'approval_sla_days', from: 4, to: 5 },
    ]);
    expect(diff('workflows', before, before)).toEqual([]);
    expect(diff('roles', { enabled_roles: ['student', 'staff'] }, { enabled_roles: ['student', 'staff'] })).toEqual([]);
    expect(show(undefined)).toBe('platform default');
    expect(show(['student', 'staff'])).toBe('Students, Staff');
    expect(show(true)).toBe('Yes');
  });
});

describe('who may publish', () => {
  const holds = ['config:manage', 'config:publish', 'config:view'];

  it('is never the person who drafted it, even holding the capability', () => {
    expect(publishBlocker(draft({ created_by: 'me' }), 'me', holds)).toMatch(/does not publish it/);
    expect(publishBlocker(draft({ created_by: 'me' }), 'you', holds)).toBeNull();
  });

  it('needs the capability', () => {
    expect(publishBlocker(draft(), 'you', ['config:manage'])).toMatch(/cannot publish/);
  });

  it('is refused for a draft the database would refuse', () => {
    expect(publishBlocker(draft({ settings: { approval_sla_days: 0 } }), 'you', holds)).toMatch(/outside what is allowed/);
  });

  it('shows the studio only to the three capabilities', () => {
    expect(studioAllowed(['config:view'])).toBe(true);
    expect(studioAllowed(['config:manage'])).toBe(true);
    expect(studioAllowed(['migration:manage'])).toBe(false);
    expect(studioAllowed([])).toBe(false);
  });
});

describe('a database refusal, as a sentence', () => {
  it('names the setting rather than the column', () => {
    expect(refusal({ message: 'This configuration is not valid: bad_value:approval_sla_days, unknown_key:zzz' }, 'x').message)
      .toBe('Days an approval may wait: that value is outside what is allowed. zzz is not a setting the studio offers.');
  });
  it('says a second draft is a second draft', () => {
    expect(refusal({ code: '23505', message: 'duplicate key value violates unique constraint "school_config_one_draft"' }, 'x').message).toMatch(/already has a draft/);
  });
  it('turns row-level security into the account’s limit', () => {
    expect(refusal({ message: 'new row violates row-level security policy' }, 'x').message).toBe('Your account cannot do that at this school.');
  });
  it('passes the second-person rule through in its own words', () => {
    expect(refusal({ message: 'Whoever drafted a configuration does not publish it.' }, 'x').message).toBe('Whoever drafted a configuration does not publish it.');
  });
});
