/**
 * Put a university on the list, from a terminal and nowhere else.
 *
 * `20260921170000_schools.sql` made `public.schools` readable by everyone and
 * writable only by `private.is_app_admin()`, and said why: `email_domains` is
 * the whole of the check in `claim_school()`, so anyone who can write it can
 * admit anyone. It also, deliberately, seeded no university — a hardcoded
 * `vanderbilt` row would put one school's name in the schema every other
 * school has to live in.
 *
 * Which left the table with no way to get a row into it, and left
 * `claim_school()` — the function that whole migration exists for — reachable
 * by nobody.
 *
 * `SchoolClaim.tsx` then shipped the screen, and with it a promise: "No
 * universities are set up on this server yet … This is added by an
 * administrator rather than in the app, and the list appears here on its own
 * once one exists." That sentence is correct about everything except the part
 * a student would act on. There was no way for an administrator to add one
 * either, and `schools.check.sql` proves only that an administrator *may*.
 *
 * This is the way, and it is the same shape as `grant-admin.ts` for the same
 * reason: a thing somebody runs on purpose with a key that is not in the app.
 *
 *     node scripts/add-school.ts list
 *     node scripts/add-school.ts add vanderbilt "Vanderbilt University" Vanderbilt
 *     node scripts/add-school.ts domains vanderbilt vanderbilt.edu
 *     node scripts/add-school.ts remove vanderbilt
 *
 * ## `add` cannot set a domain, and that is the point of it
 *
 * The domain list is the credential — it is the entire test `claim_school()`
 * applies — so it is not a trailing positional argument somebody gets wrong at
 * half past eleven. A school with none is a safe and useful state: the
 * migration says so, and `looksClaimable` in `lib/schoolclaim.ts` refuses
 * everybody for a school that publishes none. So a university is listed first,
 * admitting nobody, and starts admitting people only when somebody runs a
 * second command whose only subject is who gets in.
 *
 * ## Removing one is refused while anybody is claiming it
 *
 * `profiles.school_id` is `on delete set null`, which `schools.check.sql`
 * proves and is glad of — under `on delete cascade`, one word away, closing a
 * university would delete the profile of every student who ever attended. What
 * it costs is the quieter failure: removing a school clears the claim of every
 * student at it, they stay signed in, their profile survives, and the thing
 * the server believed about them is gone with no error anywhere. Nothing in
 * the database can refuse that, because nothing in the database is wrong. So
 * `remove` counts first and refuses with the number, rather than doing it and
 * reporting success.
 *
 * ## Why it refuses a key that would appear to work
 *
 * The same reason `grant-admin.ts` does, one table over. With the publishable
 * key, `schools` is readable — the select policy is `using (true)` — so `list`
 * works perfectly and every write is refused by row-level security. A script
 * whose read succeeds and whose write silently does not is worse than one that
 * fails outright, so the key is checked before any call is made.
 *
 * Nothing is read from `argv` but the command and its arguments: a key passed
 * on a command line is a key in the shell history and in the process list of
 * every other user on the machine.
 */

import { createRequire } from 'node:module';
import { looksLikeServiceKey, type Refusal } from './grant-admin.ts';

export type Plan =
  | { ok: true; verb: 'list' }
  | { ok: true; verb: 'add'; id: string; name: string; shortName: string }
  | { ok: true; verb: 'domains'; id: string; domains: string[] }
  | { ok: true; verb: 'remove'; id: string };

const USAGE = [
  'Usage:',
  '  node scripts/add-school.ts list',
  '  node scripts/add-school.ts add <id> <name> [short name]',
  '  node scripts/add-school.ts domains <id> [domain ...]',
  '  node scripts/add-school.ts remove <id>',
  '',
  'Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
].join('\n');

const SLUG =
  'a school id is lower case letters, digits and hyphens, 2 to 40 characters, ' +
  'starting with a letter or a digit.';

/**
 * The id the schema will accept, checked here so the refusal is readable.
 *
 * The pattern is the table's check constraint, and `add-school.test.ts` reads
 * the migration and asserts the two are still the same string. It is not an
 * arbitrary slug rule: a room key is `"vanderbilt/ECON 1020"`, built by
 * `roomKey()` in `lib/classmates.ts` from the school profile's own id, so this
 * row and every message code in that school have to agree about the spelling.
 * A mismatch is not an error anywhere — it is a school whose rooms nobody can
 * find.
 */
export function plausibleId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,39}$/.test(value.trim());
}

/**
 * A domain this script will store.
 *
 * Lower case, no `@`, at least one dot. Not a public-suffix check: the job is
 * to refuse what is obviously not a domain — an address somebody pasted whole,
 * a flag in the wrong position — before spending a round trip on it. What it
 * must never do is accept `@vanderbilt.edu` quietly, because `claim_school()`
 * compares against the part *after* the last `@`, so a stored `@vanderbilt.edu`
 * matches nobody while looking entirely correct in the table.
 */
export function plausibleDomain(value: string): boolean {
  const d = value.trim().toLowerCase();
  if (d.length < 4 || d.length > 253) return false;
  if (d.includes('@') || /\s/.test(d)) return false;
  if (d.startsWith('-') || d.startsWith('.') || d.endsWith('.')) return false;
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(d);
}

/**
 * Lower-cased and de-duplicated, keeping the order given.
 *
 * Lower case because `claim_school()` lowers both sides of the comparison and
 * `looksClaimable()` does too, so a stored `Vanderbilt.EDU` would work and
 * would also be the one row in the table that looked wrong to whoever read it
 * next. Storing the form everything compares against keeps the table readable
 * as the answer rather than as an input to one.
 */
export function tidyDomains(values: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const d = v.trim().toLowerCase();
    if (!d || seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

function refuseDomain(bad: string): string {
  return bad.includes('@')
    ? `"${bad}" is an address, not a domain. Give the part after the @ — claim_school\n` +
        'compares against that, so a stored "@example.edu" matches nobody while looking\n' +
        'right in the table.'
    : `"${bad}" is not a domain.`;
}

export function parseArgs(argv: readonly string[]): Plan | Refusal {
  const [verb, ...rest] = argv;
  if (!verb) return { ok: false, why: `No command given.\n\n${USAGE}` };

  if (verb === 'list') {
    if (rest.length) return { ok: false, why: `list takes no arguments.\n\n${USAGE}` };
    return { ok: true, verb: 'list' };
  }

  if (verb === 'add' || verb === 'domains' || verb === 'remove') {
    const id = (rest[0] ?? '').trim();
    if (!id) return { ok: false, why: `${verb} needs a school id.\n\n${USAGE}` };
    if (!plausibleId(id)) return { ok: false, why: `"${id}" will not do — ${SLUG}` };

    if (verb === 'remove') {
      if (rest.length > 1) return { ok: false, why: `remove takes one id.\n\n${USAGE}` };
      return { ok: true, verb: 'remove', id };
    }

    if (verb === 'domains') {
      const domains = tidyDomains(rest.slice(1));
      const bad = domains.find((d) => !plausibleDomain(d));
      if (bad) return { ok: false, why: refuseDomain(bad) };
      return { ok: true, verb: 'domains', id, domains };
    }

    const name = (rest[1] ?? '').trim();
    if (!name) return { ok: false, why: `add needs a name, quoted if it has spaces.\n\n${USAGE}` };
    if (name.length < 2 || name.length > 120) {
      return { ok: false, why: 'A name is between 2 and 120 characters, as the column is.' };
    }
    if (rest.length > 3) {
      return {
        ok: false,
        why:
          `add takes an id, a name and an optional short name — ${rest.length} arguments came after it.\n` +
          'Domains are set separately, because they are the credential:\n' +
          `  node scripts/add-school.ts domains ${id} <domain ...>`,
      };
    }
    const shortName = (rest[2] ?? '').trim();
    if (shortName.length > 60) {
      return { ok: false, why: 'A short name is 60 characters or fewer, as the column is.' };
    }
    /*
     * The trap this signature sets for anybody who has run it before. `add`
     * used to take domains here, so the old habit — `add vanderbilt "Vanderbilt
     * University" vanderbilt.edu` — is still four legal arguments, and it would
     * store the domain as the short name and admit nobody, with the school
     * listed and looking done. "vanderbilt.edu" is a lawful short name and an
     * unlawful intention, so it is refused by name.
     */
    if (plausibleDomain(shortName)) {
      return {
        ok: false,
        why:
          `"${shortName}" is a domain, and a domain is not what goes there.\n` +
          'add never sets one — it would be the credential passed as a positional argument.\n' +
          `  node scripts/add-school.ts add ${id} "<name>"\n` +
          `  node scripts/add-school.ts domains ${id} ${shortName}`,
      };
    }
    return { ok: true, verb: 'add', id, name, shortName };
  }

  return { ok: false, why: `There is no "${verb}" command.\n\n${USAGE}` };
}

export function readConfig(
  env: Record<string, string | undefined>,
): { ok: true; url: string; key: string } | Refusal {
  const url = (env.SUPABASE_URL ?? '').trim();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  if (!url) return { ok: false, why: 'SUPABASE_URL is not set, so there is no project to write to.' };
  if (!key) {
    return {
      ok: false,
      why:
        'SUPABASE_SERVICE_ROLE_KEY is not set. This script cannot use the publishable key:\n' +
        'schools is readable by everybody, so list would work and every write would be refused.',
    };
  }
  if (!looksLikeServiceKey(key)) {
    return {
      ok: false,
      why:
        'SUPABASE_SERVICE_ROLE_KEY does not look like a service key.\n' +
        'With the publishable key this script reads the table perfectly and writes nothing,\n' +
        'which is the failure worth refusing up front. Dashboard → Settings → API.',
    };
  }
  return { ok: true, url, key };
}

/** The shape of the client this script uses, which is a small corner of it. */
export interface Db {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { count: 'exact'; head: true },
    ) => {
      eq: (column: string, value: string) => PromiseLike<Counted>;
      order: (column: string) => PromiseLike<Counted>;
    };
    upsert: (row: Record<string, unknown>) => PromiseLike<Counted>;
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<Counted>;
    };
    delete: () => { eq: (column: string, value: string) => PromiseLike<Counted> };
  };
}

interface Counted {
  data?: unknown;
  error?: { message?: string } | null;
  count?: number | null;
}

function orThrow(res: Counted): Counted {
  if (res.error) throw new Error(res.error.message ?? String(res.error));
  return res;
}

/**
 * How many students are claiming this school right now.
 *
 * `head: true` with an exact count, so this asks the question without reading
 * anybody's profile: the number is all that is wanted and all that comes back.
 */
export async function claimingCount(db: Db, id: string): Promise<number> {
  const res = orThrow(
    await db.from('profiles').select('user_id', { count: 'exact', head: true }).eq('school_id', id),
  );
  return res.count ?? 0;
}

/** The sentence `remove` prints instead of removing, or '' if it may go ahead. */
export function refuseRemoval(id: string, claiming: number): string {
  if (claiming <= 0) return '';
  return (
    `Refused: ${claiming} ${claiming === 1 ? 'student is' : 'students are'} claiming ${id}.\n` +
    'profiles.school_id is `on delete set null`, so removing this row would clear every one\n' +
    'of those claims with no error anywhere — they would stay signed in and the server would\n' +
    'quietly stop believing they are anywhere. Move them first, or stop admitting new ones:\n' +
    `  node scripts/add-school.ts domains ${id}`
  );
}

/** What `list` prints for what came back, which is a sentence when it is empty. */
export function describe(rows: readonly { id: string; name: string; email_domains?: unknown }[]): string {
  if (rows.length === 0) {
    return 'No schools. Until there is one, claim_school() refuses everybody: there is nothing to claim.';
  }
  return rows
    .map((r) => {
      const domains = Array.isArray(r.email_domains) ? r.email_domains.map(String) : [];
      const published = domains.length
        ? domains.join(', ')
        : 'no domains — this one admits nobody yet';
      return `  ${r.id}  ${r.name}\n      ${published}`;
    })
    .join('\n');
}

async function run(plan: Plan, url: string, key: string): Promise<string> {
  const require = createRequire(import.meta.url);
  const { createClient } = require('@supabase/supabase-js') as {
    createClient: (u: string, k: string, o?: unknown) => Db;
  };
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (plan.verb === 'list') {
    const res = orThrow(await db.from('schools').select('id, name, email_domains').order('name'));
    return describe((res.data ?? []) as { id: string; name: string; email_domains?: unknown }[]);
  }

  if (plan.verb === 'add') {
    // Idempotent on purpose: running it twice is a thing people do when they
    // are not sure the first one worked. `email_domains` is not in the row, so
    // a second run renames a school without quietly disarming it.
    orThrow(
      await db.from('schools').upsert({ id: plan.id, name: plan.name, short_name: plan.shortName }),
    );
    return (
      `${plan.id} is on the list as "${plan.name}", admitting nobody.\n` +
      `Say who gets in with: node scripts/add-school.ts domains ${plan.id} <domain ...>`
    );
  }

  if (plan.verb === 'domains') {
    orThrow(await db.from('schools').update({ email_domains: plan.domains }).eq('id', plan.id));
    return plan.domains.length
      ? `${plan.id} now admits ${plan.domains.join(', ')}, and nothing else.`
      : `${plan.id} now admits nobody. Everybody who has already claimed it still has it.`;
  }

  const refusal = refuseRemoval(plan.id, await claimingCount(db, plan.id));
  if (refusal) return refusal;
  orThrow(await db.from('schools').delete().eq('id', plan.id));
  return `${plan.id} is off the list. Nobody was claiming it.`;
}

async function main(): Promise<void> {
  const plan = parseArgs(process.argv.slice(2));
  if (!plan.ok) {
    console.error(plan.why);
    process.exitCode = 2;
    return;
  }
  const config = readConfig(process.env);
  if (!config.ok) {
    console.error(config.why);
    process.exitCode = 2;
    return;
  }
  try {
    console.log(await run(plan, config.url, config.key));
  } catch (e) {
    console.error(`Refused by the server: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}

// Only when run, never when imported by the test beside it.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main();
}
