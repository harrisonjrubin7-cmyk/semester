import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every job the code expects to be scheduled is scheduled — in the file that
 * schedules things, in the health query that checks the live database, and in
 * the deploy notes that say what is live.
 *
 * ## The failure this is for
 *
 * A function written to be run on a timer and never put on one. Three were
 * found at once, on 28 September: `sweep_lti_nonce()` says in its migration
 * that it is "called from the same place the rest of this project's
 * housekeeping is called from", `sweep_lti_link_ticket()` is its twin, and
 * `expire_capture_assets()` is "run by the deployment retention worker". None
 * was called by anything. Nothing went red, because nothing that is never
 * called can fail — the rows it was meant to remove simply accumulate.
 *
 * A second shape of the same fault was live at the same time: three jobs that
 * *were* in `supabase/scheduler.sql` had never been applied to the project.
 * This file cannot see the project, so that half is `supabase/health.sql`
 * block 6, which lists what `cron.job` should hold. What this file can do is
 * hold that list to `scheduler.sql`, so the query cannot go stale.
 *
 * ## How "expected" is decided, without a list somebody has to remember
 *
 *   - **Sweeps.** A function in `supabase/migrations/` named like one —
 *     `sweep_*`, `expire_*`, `purge_*`, `*_retention_sweep`, `*_purge_journal`
 *     — is a sweep, and a sweep nobody schedules is the bug above. The few
 *     that are legitimately called by something other than a job are listed
 *     below with what calls them, and that caller is checked too.
 *   - **Cron-invoked Edge Functions.** A function directory whose code checks
 *     a cron bearer token (`CRON_SECRET`, or the database's
 *     `integration_tick_authorized`) is called by a job, so a job must post to
 *     it. A `*_CRON_SECRET` in a shared module whose function is not deployed
 *     yet must still have its Vault secret and its (parked) job.
 *
 * `supabase/check.sh` cannot do any of this: it builds from a Postgres with no
 * pg_cron, so no `.check.sql` suite can see a schedule.
 */

const ROOT = join(process.cwd(), '..');
const SUPABASE = join(ROOT, 'supabase');
const MIGRATIONS = join(SUPABASE, 'migrations');
const FUNCTIONS = join(SUPABASE, 'functions');

const read = (path: string) => readFileSync(path, 'utf8');
const scheduler = () => read(join(SUPABASE, 'scheduler.sql'));

interface Job {
  name: string;
  schedule: string;
  body: string;
}

/** Every `cron.schedule('name', 'schedule', $job$…$job$)` in scheduler.sql. */
export function jobs(sql: string): Job[] {
  const out: Job[] = [];
  for (const m of sql.matchAll(/cron\.schedule\(\s*'([a-z0-9-]+)',\s*'([^']+)',\s*\$job\$([\s\S]*?)\$job\$\s*\)/g)) {
    out.push({ name: m[1], schedule: m[2], body: m[3] });
  }
  return out;
}

/** The jobs scheduler.sql leaves parked with `cron.alter_job(…, active := false)`. */
export function parked(sql: string): Set<string> {
  const out = new Set<string>();
  for (const m of sql.matchAll(/jobname = '([a-z0-9-]+)'\),\s*active := false/g)) out.add(m[1]);
  return out;
}

/** Every schema-qualified function the migrations create. */
function functionsCreated(): Set<string> {
  const out = new Set<string>();
  for (const file of readdirSync(MIGRATIONS)) {
    if (!file.endsWith('.sql')) continue;
    for (const m of read(join(MIGRATIONS, file)).matchAll(/create (?:or replace )?function ((?:public|private)\.[a-z_0-9]+)\s*\(/gi)) {
      out.add(m[1].toLowerCase());
    }
  }
  return out;
}

const SWEEP_SHAPE = /\.(sweep_|expire_|purge_)|_retention_sweep$|_purge_journal$/;

/**
 * Sweep-shaped functions a job does not call directly, and what does.
 * Each caller is itself checked to be something a job calls.
 */
const CALLED_BY: Record<string, { caller: string; file: string }> = {
  'private.gateway_purge_journal': {
    caller: 'public.gateway_purge_journal',
    file: '20260924184500_gateway_action_journal.sql',
  },
  // Both run through the legal-hold check, which is what the jobs call.
  'private.sweep_ai_runtime_metadata': {
    caller: 'private.run_sweep',
    file: '20260930130000_hold_gated_sweeps.sql',
  },
  'private.sweep_community_retention': {
    caller: 'private.run_sweep',
    file: '20260930130000_hold_gated_sweeps.sql',
  },
};

/** The `schema.fn` names a job body calls. */
function called(body: string): string[] {
  return [...body.matchAll(/((?:public|private)\.[a-z_0-9]+)\s*\(/g)].map((m) => m[1]);
}

/** A function directory's own code plus every `_shared` module it imports. */
function functionCode(dir: string): string {
  const index = read(join(FUNCTIONS, dir, 'index.ts'));
  let code = index;
  for (const m of index.matchAll(/from '\.\.\/_shared\/([a-z0-9/_-]+\.ts)'/g)) {
    const path = join(FUNCTIONS, '_shared', m[1]);
    if (existsSync(path)) code += read(path);
  }
  return code;
}

const deployable = () =>
  readdirSync(FUNCTIONS).filter((d) => !d.startsWith('_') && existsSync(join(FUNCTIONS, d, 'index.ts')));

const CRON_INVOKED = /Deno\.env\.get\('[A-Z_]*CRON_SECRET'\)|integration_tick_authorized/;

/** The jobs `health.sql` block 6 expects, with their parked flag. */
function healthExpected(): Map<string, boolean> {
  const sql = read(join(SUPABASE, 'health.sql'));
  const block = /with expected\(jobname, parked\) as \(values([\s\S]*?)\n\)/.exec(sql);
  expect(block, 'health.sql no longer has the expected-jobs query').not.toBeNull();
  const out = new Map<string, boolean>();
  for (const m of block![1].matchAll(/\('([a-z0-9-]+)',\s*(true|false)\)/g)) out.set(m[1], m[2] === 'true');
  return out;
}

describe('the probes read the files rather than reporting an empty tree', () => {
  it('finds the jobs scheduler.sql has always had', () => {
    const names = jobs(scheduler()).map((j) => j.name);
    expect(names.length).toBeGreaterThan(8);
    expect(names).toEqual(expect.arrayContaining(['push', 'tombstones', 'integration-sync']));
    expect(parked(scheduler())).toEqual(new Set(['push', 'escalation-delivery', 'media-scan', 'support-reply-notify']));
  });

  it('parks vendor-gated support email and reactivates the credential-free retention clock', () => {
    const sql = scheduler();
    expect(sql).toMatch(/cron\.alter_job\([\s\S]*?jobname\s*=\s*'support-reply-notify'[\s\S]*?active\s*:=\s*false/);
    expect(sql).toMatch(/cron\.alter_job\([\s\S]*?jobname\s*=\s*'support-ticket-retention'[\s\S]*?active\s*:=\s*true/);
  });

  it('installs the credential-free support retention job with its migration', () => {
    const migration = read(join(MIGRATIONS, '20261008195500_support_ticket_retention.sql'));
    expect(migration).toMatch(/cron\.schedule\([\s\S]*?'support-ticket-retention'/);
    expect(migration).toMatch(/cron\.alter_job\([\s\S]*?jobname\s*=\s*'support-ticket-retention'[\s\S]*?active\s*:=\s*true/);
    expect(migration).toMatch(/create index if not exists support_tickets_retention_due[\s\S]*?where retention_classified[\s\S]*?tenant_id is null/);
    expect(migration).toMatch(/jobname = 'support-reply-notify'[\s\S]*?active := false/);
  });

  it('serializes support-ticket deletion with legal-hold writes', () => {
    const migration = read(join(MIGRATIONS, '20261008195500_support_ticket_retention.sql'));
    const functions = [
      'create or replace function private.sweep_support_ticket_retention()',
      'create or replace function public.forget_my_support_tickets()',
    ];
    for (const signature of functions) {
      const start = migration.indexOf(signature);
      const end = migration.indexOf('end $$;', start);
      const body = migration.slice(start, end);
      const lock = body.indexOf('lock table public.legal_holds in share mode;');
      const holdCheck = body.indexOf('private.account_is_held');
      const tenantHoldCheck = body.indexOf('private.tenant_is_held');
      const deletion = body.indexOf('delete from public.support_tickets');
      expect(start).toBeGreaterThanOrEqual(0);
      expect(lock).toBeGreaterThanOrEqual(0);
      expect(holdCheck).toBeGreaterThanOrEqual(0);
      expect(tenantHoldCheck).toBeGreaterThanOrEqual(0);
      expect(deletion).toBeGreaterThanOrEqual(0);
      expect(lock).toBeLessThan(holdCheck);
      expect(lock).toBeLessThan(tenantHoldCheck);
      expect(lock).toBeLessThan(deletion);
    }

    const directStart = migration.indexOf(
      'create or replace function public.forget_my_support_tickets()',
    );
    const directEnd = migration.indexOf('end $$;', directStart);
    const directBody = migration.slice(directStart, directEnd);
    const profileLock = directBody.indexOf('from public.profiles p');
    const membershipHoldCheck = directBody.indexOf('private.account_is_held');
    const directDeletion = directBody.indexOf('delete from public.support_tickets');
    expect(profileLock).toBeGreaterThanOrEqual(0);
    expect(directBody.slice(profileLock, membershipHoldCheck)).toMatch(/for update of p/);
    expect(profileLock).toBeLessThan(membershipHoldCheck);
    expect(profileLock).toBeLessThan(directDeletion);
  });

  it('snapshots only a signed deployment tenant and locks membership through ticket creation', () => {
    const migration = read(join(MIGRATIONS, '20261008195500_support_ticket_retention.sql'));
    expect(migration).toMatch(/add column if not exists tenant_id text/);
    expect(migration).toMatch(/add column if not exists retention_classified boolean not null default false/);
    expect(migration).toMatch(/add column if not exists retention_subject_id uuid/);
    expect(migration).toMatch(/alter column student_id drop not null/);
    expect(migration).toMatch(/support_ticket_live_or_preserved_subject check/);
    expect(migration).toMatch(/insert into public\.support_tickets[\s\S]*?\(student_id, tenant_id, retention_classified,/);
    expect(migration).toMatch(/from public\.profiles p[\s\S]*?for update of p/);
    expect(migration).toMatch(/public\.billing_account_tenants bt/);
    expect(migration).toMatch(/join public\.contracts c/);
    expect(migration).toMatch(/c\.kind = 'order_form'/);
    expect(migration).toMatch(/c\.status = 'signed'/);
    expect(migration).toMatch(/who, ticket_tenant, true,/);
    expect(migration).not.toMatch(/update public\.support_tickets t[\s\S]*?from public\.profiles p/);
    expect(migration).toMatch(/t\.status in \('resolved', 'closed'\)[\s\S]*?t\.retention_classified[\s\S]*?t\.tenant_id is null/);
    expect(migration).toMatch(/t\.tenant_id is not null[\s\S]*?private\.tenant_is_held\(t\.tenant_id\)/);
    expect(migration).toMatch(/active legal hold'[\s\S]*?errcode = '55006'/);
    expect(migration).toMatch(/current_setting\('semester\.erasing_account', true\) is distinct from who::text[\s\S]*?not t\.retention_classified[\s\S]*?errcode = '55000'/);
    expect(migration).toMatch(/current_setting\('semester\.erasing_account', true\) = who::text[\s\S]*?set retention_subject_id = student_id,[\s\S]*?student_id = null,[\s\S]*?email_notice_enabled = false,[\s\S]*?status = 'closed'[\s\S]*?and not retention_classified/);
    expect(migration).toMatch(/support_ticket_queue\(\)[\s\S]*?where t\.student_id is not null/);
    expect(migration).toMatch(/support_ticket_thread\(want_ticket uuid\)[\s\S]*?t\.student_id is not null/);
    expect(migration).toMatch(/guard_preserved_support_ticket_message[\s\S]*?t\.student_id is null[\s\S]*?errcode = '55000'/);
    expect(migration).toMatch(/drop function if exists public\.claim_support_notifications\(uuid, integer\)/);
    expect(migration).toMatch(/claim_support_notifications\([\s\S]*?want_not_before timestamptz[\s\S]*?delete from public\.support_notification_outbox[\s\S]*?o\.queued_at < want_not_before[\s\S]*?o\.queued_at >= want_not_before/);
    expect(migration).toMatch(/create or replace function private\.refuse_delete_while_held\(\)[\s\S]*?lock table public\.legal_holds in share mode[\s\S]*?private\.tenant_is_held\(t\.tenant_id\)[\s\S]*?delete from public\.support_notification_outbox[\s\S]*?delete from public\.support_access_grant[\s\S]*?student_id = null/);
  });

  it('finds sweep functions in the migrations, including one scheduled from the start', () => {
    const sweeps = [...functionsCreated()].filter((f) => SWEEP_SHAPE.test(f));
    expect(sweeps.length).toBeGreaterThan(8);
    expect(sweeps).toContain('public.sweep_tombstones');
  });

  it('finds the cron-invoked Edge Functions', () => {
    const invoked = deployable().filter((d) => CRON_INVOKED.test(functionCode(d)));
    expect(invoked.sort()).toEqual(['integration-tick', 'push', 'support-reply-notify']);
  });
});

describe('everything the code expects to run on a schedule has a job', () => {
  it('every sweep function in the migrations is called by a job, or by something a job calls', () => {
    const all = jobs(scheduler());
    const direct = new Set(all.flatMap((j) => called(j.body)));
    const unscheduled = [...functionsCreated()]
      .filter((f) => SWEEP_SHAPE.test(f))
      .filter((f) => !direct.has(f))
      .filter((f) => {
        const via = CALLED_BY[f];
        if (!via) return true;
        // The caller must really call it, and a job must really call the caller.
        const sql = read(join(MIGRATIONS, via.file));
        return !(sql.includes(`${f}()`) && direct.has(via.caller));
      });
    expect(unscheduled, `sweep functions no job calls: ${unscheduled.join(', ')}`).toEqual([]);
  });

  it('and every job calls a function the migrations actually create', () => {
    const made = functionsCreated();
    const typos = jobs(scheduler())
      .flatMap((j) => called(j.body).map((f) => `${j.name} → ${f}`))
      .filter((s) => !made.has(s.split(' → ')[1]));
    expect(typos).toEqual([]);
  });

  it('every Edge Function that checks a cron token has a job posting to it', () => {
    const bodies = jobs(scheduler()).map((j) => j.body);
    const orphaned = deployable()
      .filter((d) => CRON_INVOKED.test(functionCode(d)))
      .filter((d) => !bodies.some((b) => b.includes(`/functions/v1/${d}'`)));
    expect(orphaned).toEqual([]);
  });

  it('every *_CRON_SECRET a shared module reads has its Vault secret and a job sending it', () => {
    const sql = scheduler();
    const missing: string[] = [];
    for (const file of readdirSync(join(FUNCTIONS, '_shared'))) {
      if (!file.endsWith('.ts')) continue;
      for (const m of read(join(FUNCTIONS, '_shared', file)).matchAll(/\b([A-Z]+(?:_[A-Z]+)*)_CRON_SECRET\b/g)) {
        const vault = `${m[1].toLowerCase()}_cron_secret`;
        const job = jobs(sql).find((j) => j.body.includes(`name = '${vault}'`));
        if (!sql.includes(`vault.create_secret(`) || !sql.includes(`'${vault}'`) || !job) missing.push(`${file}: ${vault}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('a job posting to a function that is not deployed from this repository is parked', () => {
    const here = new Set(deployable());
    const sql = scheduler();
    const live = jobs(sql)
      .map((j) => ({ name: j.name, fn: /\/functions\/v1\/([a-z0-9-]+)'/.exec(j.body)?.[1] }))
      .filter((j) => j.fn && !here.has(j.fn) && !parked(sql).has(j.name));
    expect(live).toEqual([]);
  });
});

describe('the live check and the deploy notes cannot drift from scheduler.sql', () => {
  it('health.sql expects exactly the jobs scheduler.sql creates, parked where it parks them', () => {
    const sql = scheduler();
    const fromFile = new Map(jobs(sql).map((j) => [j.name, parked(sql).has(j.name)]));
    expect(Object.fromEntries(healthExpected())).toEqual(Object.fromEntries(fromFile));
  });

  it('surfaces support-notification dead letters even when pg_cron itself succeeds', () => {
    const sql = read(join(SUPABASE, 'health.sql'));
    expect(sql).toMatch(/from public\.support_notification_outbox/);
    expect(sql).toMatch(/dead_lettered_at is not null/);
    expect(sql).toMatch(/latest_error/);
  });

  it('scheduler.sql names each job once', () => {
    const names = jobs(scheduler()).map((j) => j.name);
    expect(names.length).toBe(new Set(names).size);
  });

  it('DEPLOY.md names every job, so the owner applying it knows what to expect', () => {
    const deploy = read(join(SUPABASE, 'DEPLOY.md'));
    const unnamed = jobs(scheduler())
      .map((j) => j.name)
      .filter((n) => !deploy.includes(`\`${n}\``) && !new RegExp(`^\\s+${n}\\s`, 'm').test(deploy));
    expect(unnamed).toEqual([]);
  });
});
