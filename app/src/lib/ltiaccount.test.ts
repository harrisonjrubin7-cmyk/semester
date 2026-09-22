/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isProvisionedEmail,
  landingPath,
  provisionedEmail,
  provisionedMetadata,
} from '../../../supabase/functions/_shared/ltiaccount';
import { OWNED_TABLES } from './cloud';
import type { Launch } from '../../../supabase/functions/_shared/lti';

/**
 * What account a Brightspace launch opens, and the one table list that has to
 * agree with another file.
 *
 * The rules module is tested the way `lti.test.ts` tests its sibling. The
 * interesting half of this file is the last block, which is not a unit test at
 * all: it reads `lti_account_untouched` out of the migration as text and holds
 * it against `OWNED_TABLES`. That is the instrument this repository reaches
 * for when two correct files can drift apart — `referral.test.ts` on two
 * integers and `allowance.test.ts` on a monthly limit — and it is needed here
 * for a specific failure that no unit test of either side can see: **a content
 * table added later that the emptiness check does not know about**, which
 * would let an account with work in it be retired as empty.
 */

const who = (over: Partial<Launch> = {}): Launch => ({
  subject: 'platform-user-88',
  issuer: 'https://brightspace.vanderbilt.edu',
  clientId: 'semester-client',
  deploymentId: 'deploy-1',
  roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
  teaches: false,
  contextId: 'econ-1020',
  contextTitle: 'ECON 1020',
  targetLinkUri: 'https://semester.example/functions/v1/lti/launch',
  name: 'A Student',
  email: 'a.student@vanderbilt.edu',
  ...over,
});

describe('the address a provisioned account is created with', () => {
  it('is the same address every time, so a second launch finds the same account', async () => {
    const a = await provisionedEmail('https://b.edu', 'subject-1');
    const b = await provisionedEmail('https://b.edu', 'subject-1');
    expect(a).toBe(b);
  });

  it('differs by subject and by issuer', async () => {
    const one = await provisionedEmail('https://b.edu', 'subject-1');
    expect(one).not.toBe(await provisionedEmail('https://b.edu', 'subject-2'));
    expect(one).not.toBe(await provisionedEmail('https://other.edu', 'subject-1'));
  });

  /*
   * Two schools can hand out the same opaque subject, and a naive join of the
   * two halves would let ("a|b","c") and ("a","b|c") hash alike. The separator
   * is a NUL, which can appear in neither.
   */
  it('cannot be made to collide by moving the boundary between the two halves', async () => {
    expect(await provisionedEmail('https://b.edu/x', 'y')).not.toBe(
      await provisionedEmail('https://b.edu', '/xy'),
    );
  });

  /*
   * The whole point. A reserved domain nobody can receive mail at means the
   * address can never be a login or a password-reset target, and can never
   * collide with a real account — so an email match has nothing to find even
   * if somebody later writes one.
   */
  it('is on a domain that cannot receive mail', async () => {
    expect(await provisionedEmail('https://b.edu', 's')).toMatch(/@lti\.invalid$/);
  });

  it('never contains the subject, which some platforms set to a username', async () => {
    const made = await provisionedEmail('https://b.edu', 'jane.doe');
    expect(made).not.toContain('jane');
  });

  it('never contains the address the platform claimed', async () => {
    const made = await provisionedEmail('https://b.edu', 'a.student@vanderbilt.edu');
    expect(made).not.toContain('vanderbilt');
  });

  it('recognises its own addresses and nobody else’s', async () => {
    expect(isProvisionedEmail(await provisionedEmail('https://b.edu', 's'))).toBe(true);
    expect(isProvisionedEmail('a.student@vanderbilt.edu')).toBe(false);
    expect(isProvisionedEmail('lti-short@lti.invalid')).toBe(false);
    expect(isProvisionedEmail(null)).toBe(false);
  });
});

describe('what a provisioned account carries about the person', () => {
  it('keeps the claimed name and address for display, prefixed', () => {
    const meta = provisionedMetadata(who());
    expect(meta.lti_name).toBe('A Student');
    expect(meta.lti_email).toBe('a.student@vanderbilt.edu');
    expect(meta.lti_issuer).toBe('https://brightspace.vanderbilt.edu');
  });

  it('carries nulls rather than inventing anything when the platform sent none', () => {
    const meta = provisionedMetadata(who({ name: null, email: null, contextTitle: null }));
    expect(meta.lti_name).toBeNull();
    expect(meta.lti_email).toBeNull();
    expect(meta.lti_context).toBeNull();
  });
});

describe('where a launch lands', () => {
  it('opens the course the platform named', () => {
    expect(landingPath(who())).toBe('#/courses?lti=econ-1020');
  });

  it('escapes a context id rather than pasting it into a URL', () => {
    expect(landingPath(who({ contextId: 'a b&c' }))).toBe('#/courses?lti=a%20b%26c');
  });

  it('falls back to the front door when the platform named no course', () => {
    expect(landingPath(who({ contextId: null }))).toBe('#/today');
  });
});

// ── The two files that have to agree ──────────────────────────────────────

/**
 * Tables that rows land in without the person doing anything that could be
 * lost. Registering a device, a feed being fetched, signing in at all.
 *
 * This is the decision, written once. A table here is one the emptiness check
 * ignores; a table in `OWNED_TABLES` and not here is one it must count. Adding
 * an owned table later fails this file until somebody says which it is, which
 * is the whole point.
 */
const NOT_CONTENT = new Set([
  'push_devices',
  'push_queue',
  'access_log',
  'profiles',
  /*
   * `activity` is the strongest case in this list rather than the weakest, and
   * it is worth saying why in more than a word.
   *
   * It holds one row per account per day per mark — that the app was opened,
   * that a course existed by then, that a card had been answered. Nothing a
   * person typed, and nothing that could be lost: it is a record *about* the
   * work, which is the same category as `access_log` two lines up and the
   * reason `RETENTION.md` lets it have a clock at all.
   *
   * And counting it would break the check rather than tighten it. An account
   * that has been opened once has an `opened` row, so *every* account that has
   * ever signed in would read as non-empty — and an emptiness check that
   * always answers "not empty" refuses every attach, including the ones this
   * flow exists to allow. `20260921151000_activity.sql` is the table.
   */
  'activity',
]);

/**
 * The definition of `lti_account_untouched` that a deploy actually ends up
 * with, which is the *last* one in version order and not the first.
 *
 * This read a hardcoded path — `20260921160100_lti_identity.sql`, where the
 * function was first created — and that is half of why a later change to the
 * table list was made by editing that file. It is in `ledger.snapshot`:
 * production applied it, so `db push` skips it, and an edit to it reaches a
 * fresh database and nothing else. The test went green either way, which is
 * the part that mattered.
 *
 * Taking the newest file that redefines the function makes the two agree: a
 * redefinition in a new migration is read, and an edit to an applied one is
 * not enough on its own.
 */
const DEFINES = 'create or replace function public.lti_account_untouched';

const migration = () => {
  const dir = join(__dirname, '../../../supabase/migrations');
  const holds = readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .filter((n) => readFileSync(join(dir, n), 'utf8').includes(DEFINES));
  // The control: a rename would otherwise leave this reading nothing, and
  // every assertion below passes against nothing.
  expect(holds.length, 'no migration defines lti_account_untouched any more').toBeGreaterThan(0);
  return readFileSync(join(dir, holds[holds.length - 1]), 'utf8');
};

/**
 * The tables `lti_account_untouched` actually looks in, read out of the SQL.
 *
 * They live in a `values` list rather than in the body of one `select`,
 * because the function walks them and skips any relation that is not there —
 * see the migration for why `public.forms` made that necessary. So this reads
 * the list, and the control below is what caught this extractor returning
 * nothing when the shape changed: without it, every assertion here would have
 * passed against an empty set and reported all clear.
 */
function tablesChecked(): Set<string> {
  const body = migration().split('create or replace function public.lti_account_untouched')[1];
  expect(body, 'lti_account_untouched is not in that migration any more').toBeTruthy();
  const sql = body.split('$$')[1] ?? '';
  return new Set([...sql.matchAll(/\('public\.(\w+)'/g)].map((m) => m[1]));
}

describe('the emptiness check and the list of what an account owns', () => {
  it('reads the function out of the migration at all', () => {
    // The control. Every assertion below passes against an empty set, which is
    // also what a broken regex returns.
    expect(tablesChecked().size).toBeGreaterThan(5);
  });

  it('looks only in tables an account actually owns', () => {
    const owned = new Set(OWNED_TABLES.map((t) => t.table));
    const strangers = [...tablesChecked()].filter((t) => !owned.has(t));
    expect(strangers, `lti_account_untouched reads tables no account owns: ${strangers}`).toEqual([]);
  });

  /*
   * The direction that matters. A content table added to `OWNED_TABLES` and
   * not to the function is an account that reads as empty while holding
   * somebody's work — and retiring it is the one irreversible thing in this
   * whole flow.
   */
  it('looks in every owned table that holds something a person did', () => {
    const checked = tablesChecked();
    /*
     * A table with no owning column of its own is reached through its parent —
     * `form_responses` has only `form_id` and cascades from `forms` — so it is
     * covered when the parent is checked and not otherwise. This distinction
     * is not decoration: it is what the first run of this test found, by
     * demanding a column that table does not have.
     */
    const missed = OWNED_TABLES.filter((t) => !NOT_CONTENT.has(t.table))
      .filter((t) => (t.column ? !checked.has(t.table) : !checked.has(t.cascadesFrom ?? t.table)))
      .map((t) => t.table);
    expect(
      missed,
      `these hold a person's work and lti_account_untouched cannot see them: ${missed}. ` +
        'Add them to the function, or to NOT_CONTENT with a reason.',
    ).toEqual([]);
  });

  /*
   * And the parent of a cascading table is not optional. Dropping `forms` from
   * the function would leave `form_responses` invisible too, which is the kind
   * of two-step gap a list of names does not show you.
   */
  it('checks the parent of every table that is owned only by cascade', () => {
    const checked = tablesChecked();
    const orphaned = OWNED_TABLES.filter((t) => !t.column && t.cascadesFrom)
      .filter((t) => !NOT_CONTENT.has(t.table))
      .filter((t) => !checked.has(t.cascadesFrom!))
      .map((t) => `${t.table} (via ${t.cascadesFrom})`);
    expect(orphaned, `owned by cascade, and the parent is not checked: ${orphaned}`).toEqual([]);
  });

  it('and NOT_CONTENT names nothing that has stopped being owned', () => {
    const owned = new Set(OWNED_TABLES.map((t) => t.table));
    const stale = [...NOT_CONTENT].filter((t) => !owned.has(t));
    expect(stale, `NOT_CONTENT names tables no account owns: ${stale}`).toEqual([]);
  });
});
