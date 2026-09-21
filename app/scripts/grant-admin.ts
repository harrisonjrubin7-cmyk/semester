/**
 * Put somebody on the administrator list, from a terminal and nowhere else.
 *
 * `public.app_admins` has row-level security on and **no policy at all**, so
 * `anon` and `authenticated` match no row of it for select, insert, update or
 * delete. That is the whole design: `private.is_app_admin()` reads it, the
 * administrator dashboard is guarded by that function, and there is no route
 * into the table from the app. The spec is explicit — no in-app self-serve
 * admin signup, ever.
 *
 * Which leaves the table, as merged, with no way to get a row into it. This
 * script is that way, and it is deliberately a thing somebody runs on purpose
 * with a key that is not in the app.
 *
 *     node scripts/grant-admin.ts list
 *     node scripts/grant-admin.ts grant ada@example.com "founder"
 *     node scripts/grant-admin.ts revoke ada@example.com
 *
 * ## Revoking is here, and the spec only asked for the insert
 *
 * An admin list that can only be added to is a one-way door: the first
 * mistyped address is permanent without somebody opening the SQL editor
 * against production, which is the thing this script exists to avoid needing.
 * `list` is here for the same reason — the table is unreadable through the
 * API by everybody, including the administrator it names, so without this
 * there is no way to answer "who is on it" short of the same SQL editor.
 *
 * ## Why it refuses a key that would appear to work
 *
 * The publishable key and the service key are both strings in an environment
 * variable, and the failure when you use the wrong one is quiet in the
 * dangerous direction. With the publishable key the insert is refused by
 * row-level security and `list` returns **zero rows with no error** — a
 * perfectly plausible "there are no administrators yet" that is actually "you
 * cannot see any". So the key is checked before any call is made, and a key
 * that is not a service key is a refusal rather than an empty table.
 *
 * Nothing is read from `argv` but the command, the address and the note: a
 * key passed on a command line is a key in the shell history and in the
 * process list of every other user on the machine.
 */

import { createRequire } from 'node:module';

export type Refusal = { ok: false; why: string };
export type Plan =
  | { ok: true; verb: 'list' }
  | { ok: true; verb: 'grant'; email: string; note: string }
  | { ok: true; verb: 'revoke'; email: string };

const USAGE = [
  'Usage:',
  '  node scripts/grant-admin.ts list',
  '  node scripts/grant-admin.ts grant <email> [note]',
  '  node scripts/grant-admin.ts revoke <email>',
  '',
  'Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
].join('\n');

/**
 * An address this script will act on.
 *
 * Deliberately not a full RFC 5322 parser. The only job here is to refuse the
 * things that are obviously not an address before spending a round trip on
 * them — an empty string, a flag somebody typed in the wrong order, a name
 * with no `@`. A plausible address that does not exist is refused later, by
 * the lookup, which is the check that actually decides.
 */
export function plausibleEmail(value: string): boolean {
  const s = value.trim();
  if (s.length < 3 || s.length > 254) return false;
  if (s.startsWith('-')) return false;
  const at = s.indexOf('@');
  return at > 0 && at === s.lastIndexOf('@') && at < s.length - 1 && !/\s/.test(s);
}

/**
 * Whether this is a key that can write the table, decided before it is used.
 *
 * Two shapes are current. The new-style keys are prefixed — `sb_secret_…`
 * writes, `sb_publishable_…` does not. The legacy keys are JWTs carrying a
 * `role` claim, and the payload is base64url in the middle segment; it is not
 * verified here and does not need to be, because this is not an authorization
 * decision. It is a "you have pasted the wrong one of two strings" check, and
 * the server is what actually refuses.
 */
export function looksLikeServiceKey(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  if (k.startsWith('sb_publishable_')) return false;
  if (k.startsWith('sb_secret_')) return true;
  const parts = k.split('.');
  if (parts.length !== 3) return false;
  try {
    const body = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    return (JSON.parse(body) as { role?: string }).role === 'service_role';
  } catch {
    return false;
  }
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
        'app_admins has no policy, so that key writes nothing and reads an empty table.',
    };
  }
  if (!looksLikeServiceKey(key)) {
    return {
      ok: false,
      why:
        'SUPABASE_SERVICE_ROLE_KEY does not look like a service key.\n' +
        'With the publishable key this script would report "no administrators" rather than an error,\n' +
        'which is the one wrong answer worth refusing up front. Dashboard → Settings → API.',
    };
  }
  return { ok: true, url, key };
}

export function parseArgs(argv: readonly string[]): Plan | Refusal {
  const [verb, ...rest] = argv;
  if (!verb) return { ok: false, why: `No command given.\n\n${USAGE}` };

  if (verb === 'list') {
    if (rest.length) return { ok: false, why: `list takes no arguments.\n\n${USAGE}` };
    return { ok: true, verb: 'list' };
  }

  if (verb === 'grant' || verb === 'revoke') {
    const email = (rest[0] ?? '').trim();
    if (!email) return { ok: false, why: `${verb} needs an email address.\n\n${USAGE}` };
    if (!plausibleEmail(email)) return { ok: false, why: `"${email}" is not an email address.` };
    if (verb === 'revoke') {
      if (rest.length > 1) return { ok: false, why: `revoke takes one address.\n\n${USAGE}` };
      return { ok: true, verb: 'revoke', email };
    }
    const note = rest.slice(1).join(' ').trim();
    if (note.length > 200) return { ok: false, why: 'The note has to be 200 characters or fewer.' };
    return { ok: true, verb: 'grant', email, note };
  }

  return { ok: false, why: `There is no "${verb}" command.\n\n${USAGE}` };
}

/** The account that address belongs to, or null. Never creates one. */
async function findUser(admin: {
  listUsers: (p: { page: number; perPage: number }) => Promise<{
    data: { users: { id: string; email?: string }[] };
    error: { message: string } | null;
  }>;
}, email: string): Promise<{ id: string; email?: string } | null> {
  const want = email.trim().toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === want);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

async function run(plan: Plan, url: string, key: string): Promise<string> {
  const require = createRequire(import.meta.url);
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (plan.verb === 'list') {
    const { data, error } = await db.from('app_admins').select('user_id, note, created_at');
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (!rows.length) return 'No administrators.';
    const lines = await Promise.all(
      rows.map(async (r: { user_id: string; note: string; created_at: string }) => {
        const { data: u } = await db.auth.admin.getUserById(r.user_id);
        const who = u?.user?.email ?? r.user_id;
        return `  ${who}${r.note ? `  — ${r.note}` : ''}  (${r.created_at.slice(0, 10)})`;
      }),
    );
    return `${rows.length} administrator${rows.length === 1 ? '' : 's'}:\n${lines.join('\n')}`;
  }

  const user = await findUser(db.auth.admin, plan.email);
  if (!user) {
    return (
      `No account for ${plan.email}.\n` +
      'This script never creates one — they sign up in the app first, then run this.'
    );
  }

  if (plan.verb === 'revoke') {
    const { error } = await db.from('app_admins').delete().eq('user_id', user.id);
    if (error) throw new Error(error.message);
    return `${plan.email} is no longer an administrator.`;
  }

  // Idempotent on purpose: running it twice is a thing people do when they are
  // not sure the first one worked, and it must not be an error or a second row.
  const { error } = await db
    .from('app_admins')
    .upsert({ user_id: user.id, note: plan.note }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
  return `${plan.email} is an administrator${plan.note ? ` (${plan.note})` : ''}.`;
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
