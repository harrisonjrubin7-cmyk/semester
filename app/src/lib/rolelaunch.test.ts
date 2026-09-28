import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_TITLE,
  CONSOLE_PROVISIONING,
  INTERNAL_CATEGORIES,
  NOT_APP_ROLES,
  OPERATIONS_ONLY,
  ROLES,
  STUDENT_RECORD,
  ROLE_STATES,
  SCREENS,
  STATE_MEANING,
  interfaceOf,
  rungs,
  stateOf,
  type RoleCategory,
  type RoleFacts,
  type RoleRow,
} from './rolelaunch';

/**
 * The Role Launch Register, held to the database it describes.
 *
 * Three things could make it lie, and each has a check:
 *
 *   - **The role list drifts.** The roles and their capabilities are read out
 *     of the migrations, not typed twice. A role added in SQL and not here, or
 *     here and not in SQL, fails.
 *   - **A state is claimed.** It is not stored; `stateOf` derives it. What is
 *     checked is the evidence each rung rests on — every cited file exists, and
 *     every SQL check counted as a role's authorization test names that role.
 *   - **The finding goes stale.** Every role is provisionable through exactly
 *     one path, the console's `role-grant` duty, and nothing else writes
 *     `role_grants`. That is asserted from the code, so a commit that adds a
 *     second path turns this red and says which paragraph to rewrite.
 *
 * `docs/ROLE-LAUNCH-REGISTER.md` is rendered from this data. Run
 * `npm run registers` to rewrite it; the last test fails while it is stale.
 */

const root = join(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const DOC = 'docs/ROLE-LAUNCH-REGISTER.md';

const strip = (sql: string) => sql.replace(/--[^\n]*/g, '');
const migrations = readdirSync(join(root, 'supabase/migrations'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => ({ file: f, sql: strip(read(`supabase/migrations/${f}`)) }));

/** Rows of one of the three reference tables, first two columns only. */
function seeded(table: 'app_roles' | 'role_capabilities'): [string, string][] {
  const out: [string, string][] = [];
  const insert = new RegExp(`insert into public\\.${table}\\s*\\([^)]*\\)\\s*values(.*?);`, 'gis');
  for (const { sql } of migrations) {
    for (const m of sql.matchAll(insert)) {
      for (const t of m[1].matchAll(/\(\s*'([^']+)'\s*,\s*('(?:[^']|'')*'|\w+)/g)) out.push([t[1], t[2].replace(/^'|'$/g, '')]);
    }
  }
  return out;
}

const appRoles = new Set(seeded('app_roles').map(([role]) => role));
const matrix = new Map<string, string[]>();
for (const [role, capability] of seeded('role_capabilities')) {
  const held = matrix.get(role) ?? [];
  if (!held.includes(capability)) held.push(capability);
  matrix.set(role, held);
}

const checkFiles = readdirSync(join(root, 'supabase'))
  .filter((f) => f.endsWith('.check.sql'))
  .sort()
  .map((f) => ({ path: `supabase/${f}`, sql: read(`supabase/${f}`) }));
const naming = (literal: string) => checkFiles.filter((c) => c.sql.includes(`'${literal}'`)).map((c) => c.path);

function factsFor(role: string): RoleFacts {
  return { capabilities: matrix.get(role) ?? [], checks: naming(role), modeled: appRoles.has(role) };
}

describe('the role launch register', () => {
  describe('its roles are the database’s', () => {
    it('reads the reference tables out of the migrations at all', () => {
      // The control: an extraction that silently found nothing would make every
      // comparison below vacuous.
      expect(appRoles.size).toBeGreaterThanOrEqual(58);
      expect(matrix.get('moderator')).toContain('report:read');
      expect(matrix.get('platform_admin')).not.toContain('tenant:configure');
    });

    it('ignores rollback notes, which are comments that mention delete', () => {
      const raw = read('supabase/migrations/20260928032000_community.sql');
      expect(raw).toMatch(/--\s+delete from public\.role_capabilities/);
      expect(matrix.get('trust_safety_senior')).toContain('community:review_senior');
    });

    it('names every app role once, and nothing that is not one', () => {
      const listed = ROLES.map((r) => r.role);
      expect(new Set(listed).size, 'a role is listed twice').toBe(listed.length);
      expect([...appRoles].filter((r) => !listed.includes(r)), 'app roles missing from the register').toEqual([]);
      expect(listed.filter((r) => !appRoles.has(r)), 'register rows that are not app roles').toEqual([]);
    });

    it('keeps the roles the brief names but the database deliberately does not', () => {
      for (const { brief } of NOT_APP_ROLES) expect(appRoles.has(brief.toLowerCase().replace(/\W+/g, '_'))).toBe(false);
    });
  });

  describe('the internal boundary: no Semester role inherits a student’s records', () => {
    const internal = ROLES.filter((r) => INTERNAL_CATEGORIES.includes(r.category));
    const every = [...new Set([...matrix.values()].flat())];

    it('has roles on both sides of the line, and lists that name real capabilities', () => {
      // The controls. An empty internal set, or a list naming capabilities the
      // database never grants, would make the two rules below pass vacuously.
      expect(internal.length).toBeGreaterThanOrEqual(8);
      expect(internal.map((r) => r.category)).toContain('platform');
      expect(internal.map((r) => r.category)).toContain('commercial');
      for (const c of [...OPERATIONS_ONLY, ...STUDENT_RECORD]) expect(every, `${c} is granted to nobody`).toContain(c);
      expect(OPERATIONS_ONLY.filter((c) => STUDENT_RECORD.includes(c)), 'a capability on both lists').toEqual([]);
    });

    it('grants an internal role nothing that reaches one student’s records', () => {
      for (const r of internal) {
        const crossing = (matrix.get(r.role) ?? []).filter((c) => STUDENT_RECORD.includes(c));
        expect(crossing, `${r.role} holds ${crossing.join(', ')}`).toEqual([]);
      }
    });

    it('grants an internal role only what the operations list allows, so a new grant is read before it is inherited', () => {
      for (const r of internal) {
        const unknown = (matrix.get(r.role) ?? []).filter((c) => !OPERATIONS_ONLY.includes(c));
        expect(unknown, `${r.role} holds ${unknown.join(', ')}, which neither list has judged`).toEqual([]);
      }
    });

    it('would notice the grant it exists to refuse', () => {
      // The guard, run against the fault it guards: a support agent handed a
      // student's help requests.
      const granted = new Map(matrix);
      granted.set('support_agent', [...(granted.get('support_agent') ?? []), 'help_request:respond']);
      const crossing = (granted.get('support_agent') ?? []).filter((c) => STUDENT_RECORD.includes(c));
      expect(crossing).toEqual(['help_request:respond']);
    });
  });

  describe('its evidence', () => {
    it('can tell a missing file from a present one', () => {
      expect(existsSync(join(root, 'README.md'))).toBe(true);
      expect(existsSync(join(root, 'app/src/screens/NoSuchRoleScreen.tsx'))).toBe(false);
    });

    it('cites only files that exist', () => {
      const cited = [
        ...Object.values(SCREENS),
        ...ROLES.flatMap((r) => [...r.provisioning, ...r.runbook, ...r.training]),
        ...ROLES.flatMap((r) => interfaceOf(r, factsFor(r.role))),
      ];
      for (const { path } of cited) expect(existsSync(join(root, path)), `${path} is missing`).toBe(true);
    });

    it('maps a screen only to a capability some role holds', () => {
      const held = new Set([...matrix.values()].flat());
      for (const capability of Object.keys(SCREENS)) expect(held.has(capability), capability).toBe(true);
    });

    it('counts a SQL check for a role only when it names that role', () => {
      // `naming` is the rule; this is its control, in both directions.
      expect(naming('moderator')).toContain('supabase/capabilities.check.sql');
      expect(naming('no_such_role_anywhere')).toEqual([]);
    });
  });

  describe('its finding', () => {
    it('has exactly one path that assigns an app role: the console’s role-grant duty', () => {
      // The console migration is the one writer of `role_grants`. A second one
      // — another migration, an SSO claim binder, a SCIM group mapper — turns
      // this red and means the register's finding and CONSOLE_PROVISIONING
      // both need rewriting.
      const writers = migrations.filter(({ sql }) => /insert into public\.role_grants/i.test(sql)).map(({ file }) => file);
      expect(writers).toEqual(['20260929110000_console_approvals_and_break_glass.sql']);
      const servers = ['supabase/functions', 'app/server', 'app/api', 'packages/institution/src'];
      const writes: string[] = [];
      const walk = (dir: string) => {
        if (!existsSync(join(root, dir))) return;
        for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
          const path = `${dir}/${entry.name}`;
          if (entry.isDirectory()) walk(path);
          else if (/\.(ts|js|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
            if (/from\(\s*['"]role_grants['"]\s*\)\s*\.(insert|upsert|update)/.test(read(path))) writes.push(path);
          }
        }
      };
      servers.forEach(walk);
      expect(writes).toEqual([]);
      for (const r of ROLES) expect(r.provisioning, r.role).toEqual(CONSOLE_PROVISIONING);
      for (const e of CONSOLE_PROVISIONING) expect(existsSync(join(root, e.path)), e.path).toBe(true);
    });

    it('therefore holds every role at provisionable or above, and none at modeled', () => {
      for (const role of ROLES) {
        const state = stateOf(role, factsFor(role.role));
        expect(state, role.role).not.toBe('undefined');
        expect((ROLE_STATES as readonly string[]).indexOf(state), `${role.role} is ${state}`).toBeGreaterThanOrEqual(ROLE_STATES.indexOf('provisionable'));
      }
    });

    it('approves nothing', () => {
      expect(ROLES.filter((r) => r.approved)).toEqual([]);
    });
  });

  describe('the ladder', () => {
    const complete: RoleRow = {
      role: 'faculty',
      category: 'academic',
      mayDo: 'x',
      mustNever: 'y',
      provisioning: [{ path: 'README.md', shows: 'stand-in' }],
      runbook: [{ path: 'README.md', shows: 'stand-in' }],
      training: [{ path: 'README.md', shows: 'stand-in' }],
      approved: false,
    };
    const facts: RoleFacts = { capabilities: ['help_request:respond'], checks: ['supabase/rolegrants.check.sql'], modeled: true };

    it('reaches supportable when every rung below approval holds', () => {
      expect(stateOf(complete, facts)).toBe('supportable');
    });

    it('stops at the first missing rung, even when later ones hold', () => {
      expect(stateOf({ ...complete, provisioning: [] }, facts)).toBe('modeled');
      expect(stateOf(complete, { ...facts, capabilities: [] })).toBe('provisionable');
      expect(stateOf(complete, { ...facts, checks: [] })).toBe('usable');
      expect(stateOf({ ...complete, training: [] }, facts)).toBe('secure');
      expect(stateOf(complete, { ...facts, modeled: false })).toBe('defined');
      expect(stateOf({ ...complete, mustNever: ' ' }, facts)).toBe('undefined');
    });

    it('still reports the rungs a role holds out of order', () => {
      const r = rungs({ ...complete, provisioning: [] }, facts);
      expect(r.usable && r.secure && r.supportable).toBe(true);
      expect(r.provisionable).toBe(false);
    });
  });

  it('is what docs/ROLE-LAUNCH-REGISTER.md says', () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(read(DOC), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

// ── rendering ────────────────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const paths = (e: readonly { path: string }[]) => (e.length ? e.map((x) => `\`${x.path}\``).join('<br>') : '—');
const tick = (b: boolean) => (b ? '✓' : '·');

function render(): string {
  const rows = ROLES.map((role) => ({ role, facts: factsFor(role.role) }));
  const count = (state: string) => rows.filter(({ role, facts }) => stateOf(role, facts) === state).length;
  const held = (rung: (typeof ROLE_STATES)[number]) => rows.filter(({ role, facts }) => rungs(role, facts)[rung]).length;
  const out: string[] = [];
  out.push(
    '# Role Launch Register',
    '',
    '<!-- Rendered from app/src/lib/rolelaunch.ts by rolelaunch.test.ts. Edit the data, then run `npm run registers` from app/. -->',
    '',
    '> Owner, version, last and next review, status, supersedes and related decisions: [`SEMESTER-OPERATING-SYSTEM.md`](../SEMESTER-OPERATING-SYSTEM.md).',
    '',
    'Every role the database can grant, and how far each has come towards being',
    'switched on in a customer tenant. The roles are the rows of `public.app_roles`',
    'and their capabilities the rows of `public.role_capabilities`, read out of',
    '`supabase/migrations/` by the test that renders this page — so the list cannot',
    'drift from what the database enforces.',
    '',
    'A role\'s state is not written down anywhere. It is the highest rung of the',
    'ladder below reached with every rung under it also reached, derived from the',
    'evidence. A role is enabled for a customer only at **launch approved**.',
    '',
    '| State | Meaning | Roles at this state | Roles holding this rung |',
    '| --- | --- | ---: | ---: |',
    ...ROLE_STATES.map((s) => `| ${s} | ${STATE_MEANING[s]} | ${count(s)} | ${held(s)} |`),
    '',
    '## The finding',
    '',
    `All ${rows.length} roles are at least **provisionable**, through one path: the`,
    'operations console’s `role-grant` duty (`supabase/migrations/20260929110000_console_approvals_and_break_glass.sql`).',
    'A request names the person, the role, the scope and the expiry; the security',
    'seat approves it, never the requester; `console_act()` writes the audit event',
    'first and the grant second, and writes nothing when the event cannot be',
    'written (`supabase/console-approvals.check.sql`). No SSO claim or SCIM group',
    'assigns an app role, and `rolelaunch.test.ts` asserts from the code that',
    'nothing else writes `role_grants`. What each role holds beyond this rung is',
    'what the right-hand column above counts.',
    '',
    'Two further limits on what the columns below prove:',
    '',
    '- **Authorization checks** lists the SQL checks under `supabase/` that name the',
    '  role. Naming it is necessary for a positive and negative test, not proof of',
    '  both. The brief asks for a provision, positive, negative and revocation test',
    '  per role; nobody has yet sorted these checks into those four.',
    '- **Audit event** is not a column. Grants and revocations are audited',
    '  (`supabase/role-grant-audit.check.sql`); the per-capability audit event the',
    '  brief asks for has not been mapped.',
    '',
  );

  for (const category of Object.keys(CATEGORY_TITLE) as RoleCategory[]) {
    const inCat = rows.filter(({ role }) => role.category === category);
    if (!inCat.length) continue;
    out.push(`## ${CATEGORY_TITLE[category]}`, '');
    out.push('| Role | State | Def · Mod · Prov · Use · Sec · Sup · Appr | Capabilities | Interface | Authorization checks | Runbook | Training | Must be able to | Must never |');
    out.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const { role, facts } of inCat) {
      const r = rungs(role, facts);
      out.push(
        `| \`${role.role}\` | ${stateOf(role, facts)} | ${ROLE_STATES.map((s) => tick(r[s])).join(' ')} | ${
          facts.capabilities.length ? facts.capabilities.map((c) => `\`${c}\``).join('<br>') : '—'
        } | ${paths(interfaceOf(role, facts))} | ${facts.checks.length ? facts.checks.map((c) => `\`${c.replace('supabase/', '')}\``).join('<br>') : '—'} | ${paths(role.runbook)} | ${paths(role.training)} | ${cell(role.mayDo)} | ${cell(role.mustNever)} |`,
      );
    }
    out.push('');
  }

  out.push(
    '## The internal boundary',
    '',
    'No Semester-internal role — the platform operations and commercial rows above —',
    'inherits access to a student\'s records because it is internal. `rolelaunch.test.ts`',
    'holds the matrix to two lists in `rolelaunch.ts`, in both directions: an internal',
    'role may hold only an operations capability, and never one that reaches a student\'s',
    'own records. A grant outside either list fails the build until somebody judges it.',
    '',
    '| Internal roles may hold | Internal roles never hold |',
    '| --- | --- |',
    `| ${OPERATIONS_ONLY.map((c) => `\`${c}\``).join('<br>')} | ${STUDENT_RECORD.map((c) => `\`${c}\``).join('<br>')} |`,
    '',
  );

  out.push('## Role × capability', '', 'One row per row of `public.role_capabilities`. A capability\'s checks are the SQL checks that name it.', '');
  out.push('| Role | Capability | Interface | Checks naming the capability |', '| --- | --- | --- | --- |');
  for (const { role, facts } of rows) {
    for (const capability of facts.capabilities) {
      const screen = SCREENS[capability];
      const checks = naming(capability);
      out.push(`| \`${role.role}\` | \`${capability}\` | ${screen ? `\`${screen.path}\`` : '—'} | ${checks.length ? checks.map((c) => `\`${c.replace('supabase/', '')}\``).join('<br>') : '—'} |`);
    }
  }
  out.push('', '## Roles the brief names that are not app roles', '', '| Brief | Where its access lives |', '| --- | --- |');
  for (const { brief, instead } of NOT_APP_ROLES) out.push(`| ${brief} | ${cell(instead)} |`);
  out.push('');
  return out.join('\n');
}
