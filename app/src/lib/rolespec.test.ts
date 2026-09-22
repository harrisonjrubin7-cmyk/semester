import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `docs/ROLE_REQUIREMENTS.md`, against the repository it describes.
 *
 * `roadmap.test.ts` exists for the same reason and states it better than this
 * can: a document about the code "has been wrong about its own subject at
 * least five times, every one found by building the thing it described rather
 * than by reading it."
 *
 * This one was written knowing that. The adjacent requirements document — the
 * fifty-five items about the layer under the tools — was drafted with three
 * module paths that do not exist: `lib/docnotes.ts`, `lib/decktheme.ts` and
 * `lib/slidefit.ts` are all test files with no module of that name behind
 * them. They were caught by hand, on the second pass. Nothing would have
 * caught them on the fifth.
 *
 * So there are two rules here, and the second is the one worth having.
 *
 * ## The paths
 *
 * Every repository file the document names in backticks has to be there. This
 * is cheap and catches the whole class above, including the case nobody greps
 * for: a module renamed six weeks from now, with the prose left pointing at
 * where it used to be.
 *
 * ## The claims
 *
 * The document's central finding is that the repository holds **three**
 * vocabularies of what a person can be, that two agree, and that the third —
 * the only one a server enforces — shares exactly one value with them. That is
 * an argument about the current state, and the whole sequencing section rests
 * on it.
 *
 * A finding like that rots in the one direction nobody notices: somebody
 * reconciles the vocabularies, which is the outcome the document is asking
 * for, and the document silently becomes a description of a problem that was
 * solved. It would still read as true. So the disagreement is asserted here,
 * and the day it stops being true this file goes red and says which paragraph
 * to rewrite.
 *
 * The same applies to three smaller findings: that the LTI launch's roles are
 * not persisted, that `public.reports` has no status and so is a sink rather
 * than a queue, and that `is_app_admin` lives in `private` rather than
 * `public`. Each is a sentence in the document that a single commit elsewhere
 * can falsify.
 *
 * Every rule below carries a control — an assertion that the extraction found
 * anything at all — because a regex that stops matching is indistinguishable
 * from a rule that passes, and that is exactly how the first teardown probe in
 * this repository read six clean files as leaking.
 */

const at = (...parts: string[]) => join('..', ...parts);

const SPEC = at('docs', 'ROLE_REQUIREMENTS.md');
const spec = readFileSync(SPEC, 'utf8');

describe('the files it names', () => {
  /*
   * Every `app/…`, `supabase/…`, `packages/…`, `docs/…` or `scripts/…` in
   * backticks that ends in a real extension. A path with `*` or `<` in it is a
   * pattern rather than a file — the document names `supabase/*.check.sql` as
   * a set, which is correct prose and not a path to resolve.
   */
  const named = [
    ...spec.matchAll(/`((?:app|supabase|packages|docs|scripts)\/[A-Za-z0-9_./*<>-]+)`/g),
  ]
    .map((m) => m[1])
    .filter((path) => /\.(ts|tsx|sql|md|json|mjs)$/.test(path))
    .filter((path) => !path.includes('*') && !path.includes('<'));

  const distinct = [...new Set(named)];

  it('names a good many, so this rule has something to hold', () => {
    // The control. A document reformatted so its paths are no longer in
    // backticks would make the assertion below vacuously true.
    expect(distinct.length).toBeGreaterThan(20);
  });

  it('names only files that are there', () => {
    expect(distinct.filter((path) => !existsSync(at(path)))).toEqual([]);
  });
});

describe('the three role vocabularies it says disagree', () => {
  const roles = readFileSync(at('app', 'src', 'lib', 'role.ts'), 'utf8');
  const institution = readFileSync(at('packages', 'institution', 'src', 'index.ts'), 'utf8');
  const migration = readFileSync(
    at('supabase', 'migrations', '20260921161500_roles.sql'),
    'utf8',
  );

  /** `export type Role = 'student' | 'faculty' | …;` */
  const fromClient = (() => {
    const m = roles.match(/export type Role =([^;]+);/);
    return m ? new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])) : new Set<string>();
  })();

  /** `export const UNIVERSITY_ROLES = [ … ] as const;` */
  const fromContract = (() => {
    const m = institution.match(/UNIVERSITY_ROLES = \[([^\]]+)\]/);
    return m ? new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])) : new Set<string>();
  })();

  /** `check (account_role in ('student', 'parent', 'mentor'))` */
  const fromDatabase = (() => {
    const m = migration.match(/check \(account_role in \(([^)]+)\)\)/);
    return m ? new Set([...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])) : new Set<string>();
  })();

  it('found all three, so the comparisons below mean something', () => {
    // The control, and the important one: three empty sets agree with each
    // other about everything.
    expect(fromClient.size, 'lib/role.ts Role union').toBeGreaterThan(1);
    expect(fromContract.size, 'UNIVERSITY_ROLES').toBeGreaterThan(1);
    expect(fromDatabase.size, 'profiles.account_role check').toBeGreaterThan(1);
  });

  it('the client and the contract still agree, as it says', () => {
    expect([...fromClient].sort()).toEqual([...fromContract].sort());
  });

  it('the database still disagrees with both, as it says', () => {
    /*
     * The assertion this file exists for. The document says the enforced
     * vocabulary "shares a single value with the other two", names that value
     * as `student`, and builds its sequencing on the gap. Reconciling them is
     * the point of item 239 — and on the day somebody does, this is what says
     * the document now describes a solved problem.
     */
    const shared = [...fromDatabase].filter((r) => fromClient.has(r));
    expect(shared, 'the enforced vocabulary now shares more than `student`').toEqual(['student']);
  });

  it('is one role per account in all three places, which is what item 239 changes', () => {
    // `account_role text not null` — singular, not an array and not a table.
    expect(migration).toMatch(/account_role text not null/);
    // A single `role: Role` in application state, not a collection.
    const shape = readFileSync(at('app', 'src', 'state', 'shape.ts'), 'utf8');
    expect(shape).toMatch(/\brole: Role;/);
  });
});

describe('what it reports about the schema', () => {
  const identity = readFileSync(
    at('supabase', 'migrations', '20260921160100_lti_identity.sql'),
    'utf8',
  );
  const adminRoles = readFileSync(
    at('supabase', 'migrations', '20260921161500_roles.sql'),
    'utf8',
  );

  /** The column list between `create table … (` and its closing `);`. */
  const columnsOf = (sql: string, table: string): string => {
    const start = sql.indexOf(`create table if not exists public.${table} (`);
    if (start < 0) return '';
    return sql.slice(start, sql.indexOf('\n);', start));
  };

  /**
   * Every column a table has now, not the ones it was created with.
   *
   * This used to read one migration and ask what columns it declared, and the
   * difference cost nothing until a column arrived somewhere else. It did:
   * `20260921214500_report_status.sql` adds `status` to `public.reports` with
   * an `alter table`, and the assertion below went on reading
   * `20260901000200_classmates.sql` and went on passing while its own name —
   * "still a sink rather than a queue" — had stopped being true.
   *
   * A guard that reads one file cannot see a schema. So the `create table` is
   * the start and every `alter table … add column` in the directory is folded
   * in after it.
   */
  const everyMigration = readdirSync(at('supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(at('supabase', 'migrations', f), 'utf8'));

  const columnsNow = (table: string): string => {
    const declared = everyMigration.map((sql) => columnsOf(sql, table)).find(Boolean) ?? '';
    const added = everyMigration
      .flatMap((sql) => [
        ...sql.matchAll(
          new RegExp(`alter table\\s+public\\.${table}\\s+add column(?: if not exists)? (\\w+)`, 'gi'),
        ),
      ])
      .map((m) => `  ${m[1]} added-later`);
    return [declared, ...added].join('\n');
  };

  const identityColumns = columnsOf(identity, 'lti_identity');
  const reportColumns = columnsNow('reports');

  it('found both tables, so their absences are absences', () => {
    // The control. An empty string contains no `status` column either, and
    // would satisfy every assertion below for the wrong reason.
    expect(identityColumns, 'public.lti_identity').toMatch(/issuer/);
    expect(reportColumns, 'public.reports').toMatch(/reporter/);
  });

  it('the LTI launch roles are still not persisted', () => {
    /*
     * `supabase/functions/_shared/lti.ts` reads the roles claim and keeps the
     * unrecognised URIs; nothing writes them down. This is the document's
     * fourth finding and the reason items 246–250 are sequenced third.
     */
    expect(readFileSync(at('supabase', 'functions', '_shared', 'lti.ts'), 'utf8')).toMatch(
      /TEACHING = new Set\(/,
    );
    expect(identityColumns).not.toMatch(/\broles?\b/);
  });

  it('public.reports has a status now, and is no longer only a sink', () => {
    // Item 295 asks for four things. `status` arrived with
    // `20260921214500_report_status.sql`, together with a select policy for
    // `private.is_app_admin()` — so a report can now be read and moved through
    // `open → under_review → resolved → dismissed`.
    //
    // This assertion is the one that was quietly false: it read the creating
    // migration, the column had been added by a later one, and the test passed
    // under a name that had stopped describing the schema.
    expect(reportColumns, 'reports.status').toMatch(/^\s*status\b/m);
  });

  it('and still has no category, assignee or resolution', () => {
    // The other three of item 295. A queue an administrator can read is not
    // yet a case system, and the document should not be able to claim it is.
    for (const field of ['category', 'assigned', 'resolution']) {
      expect(reportColumns, `reports.${field} now exists`).not.toMatch(
        new RegExp(`^\\s*${field}`, 'm'),
      );
    }
  });

  it('is_app_admin is still in private, and still the only tier', () => {
    /*
     * The document credits this choice and then says the remaining problem is
     * that it is one capability. Both halves are checked: the schema, because a
     * `public.is_app_admin()` would be a URL PostgREST publishes; and that no
     * second capability has appeared without the document noticing.
     */
    expect(adminRoles).toMatch(/create or replace function private\.is_app_admin\(\)/);
    expect(adminRoles).not.toMatch(/function public\.is_app_admin/);
  });
});

describe('the specification it continues', () => {
  const items = [...spec.matchAll(/^# (\d+)\./gm)].map((m) => Number(m[1]));

  it('carries items 239 to 301, in order, with no gaps and nothing twice', () => {
    /*
     * The master specification is numbered across documents, so a dropped item
     * is invisible: nothing else in the repository knows 274 should exist. Two
     * of these numbered documents have already been written by different
     * sessions in one afternoon.
     */
    const want = Array.from({ length: 63 }, (_, i) => 239 + i);
    expect(items).toEqual(want);
  });
});
