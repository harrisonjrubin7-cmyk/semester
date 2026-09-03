/**
 * Accounts, and the copy of your semester that follows you between devices.
 *
 * The app stays offline-first: localStorage is the working copy, it is what
 * every screen reads, and the app is fully usable signed out. Signing in adds a
 * second copy in Postgres and keeps the two in step — so the phone and the
 * laptop show the same semester, and a lost phone is not a lost semester.
 *
 * The reconciliation is deliberately simple and deliberately stated: **last
 * write wins, per device, by timestamp**. Two devices editing the same note
 * offline will not merge; the later save is the one that survives. Anything
 * cleverer is a distributed-systems project, and pretending otherwise in the UI
 * would be worse than saying it plainly.
 *
 * What does not sync: files you attach. They live in IndexedDB and can be tens
 * of megabytes; uploading them silently on a phone plan is not a decision the
 * app should make for you. The screen says so.
 */

import type { Session, SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as unknown as Record<string, string | undefined>;
const URL = env.VITE_SUPABASE_URL ?? '';
const KEY = env.VITE_SUPABASE_KEY ?? '';

/** False when no project is configured — the app then runs device-only. */
export const cloudConfigured = Boolean(URL && KEY);

let client: Promise<SupabaseClient> | null = null;

/**
 * The Supabase client, fetched the first time anything wants it.
 *
 * Imported dynamically rather than at the top of this file, and that is why it
 * is a promise. The store imports this module, so a static import put the
 * whole SDK in front of somebody opening Today on a phone — to serve accounts,
 * sync and the classmate rooms, none of which Today touches. It now arrives
 * the first time somebody signs in or opens a room.
 *
 * The promise is cached rather than the client, so callers racing on the first
 * use share one import and one client instead of each starting their own.
 */
export function cloud(): Promise<SupabaseClient> {
  if (!cloudConfigured) {
    return Promise.reject(new Error('No account service is configured for this build.'));
  }
  client ??= import('@supabase/supabase-js').then((mod) =>
    mod.createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    }),
  );
  return client;
}

/**
 * Where an email link or an OAuth round trip should come back to.
 *
 * Deliberately not `window.location.href`. That href can still be carrying the
 * `?code=` or `?error=` of the callback that just happened, and a redirect URL
 * has to match the project's allowlist exactly — a near miss is not an error,
 * it silently falls back to the Site URL, which is the kind of failure nobody
 * can diagnose from the outside. The app's own address is stable, matches one
 * allowlist entry, and is the same string in dev (`http://localhost:5173/`) as
 * deployed (`https://…/semester/`).
 */
export function appUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  // `URL` is taken in this module by the project address, hence globalThis.
  return new globalThis.URL(base, window.location.origin).href;
}

// ── Signing in ────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  email: string;
}

export function accountOf(session: Session | null): Account | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? '' };
}

export async function currentSession(): Promise<Session | null> {
  if (!cloudConfigured) return null;
  const { data } = await (await cloud()).auth.getSession();
  return data.session;
}

/**
 * Watch for a sign-in or a sign-out.
 *
 * The subscription starts once the client has loaded, so the canceller has to
 * cope with being called before that — an effect mounted and unmounted in the
 * same tick would otherwise leave a live subscription behind with nothing
 * holding on to it.
 */
export function onAuthChange(fn: (session: Session | null) => void): () => void {
  if (!cloudConfigured) return () => {};
  let stop: (() => void) | null = null;
  let cancelled = false;
  void cloud().then((db) => {
    if (cancelled) return;
    const { data } = db.auth.onAuthStateChange((_event, session) => fn(session));
    stop = () => data.subscription.unsubscribe();
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

export async function signUp(email: string, password: string): Promise<string> {
  const { data, error } = await (await cloud()).auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw new Error(error.message);
  // With email confirmation on, there is no session until the link is clicked.
  return data.session
    ? 'Account made. Your semester will sync from now on.'
    : 'Check your email for the confirmation link, then come back and sign in. ' +
      'If the link lands on a page that will not load, the confirmation still worked — ' +
      'it is verified before the redirect — so come back here and sign in anyway.';
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await (await cloud()).auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/** Google or Apple, when they are switched on in the Supabase dashboard. */
export async function signInWith(provider: 'google' | 'apple'): Promise<void> {
  const { error } = await (await cloud()).auth.signInWithOAuth({
    provider,
    options: { redirectTo: appUrl() },
  });
  if (error) throw new Error(error.message);
}

export async function sendReset(email: string): Promise<void> {
  const { error } = await (await cloud()).auth.resetPasswordForEmail(email, {
    redirectTo: appUrl(),
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await (await cloud()).auth.signOut();
}

/**
 * Turn a Postgres or PostgREST error into something a person can act on.
 *
 * The raw wording is accurate and useless: "Could not find the table
 * 'public.state' in the schema cache" is the database telling you the setup
 * step was missed, in a sentence that gives no hint of that. Anything not
 * recognised is passed through untouched — a wrong guess would be worse than
 * the original.
 */
export function explainSyncError(message: string): string {
  if (/schema cache|does not exist|relation .* does not exist/i.test(message)) {
    return (
      `${message}\n\nThe database tables have not been created yet. Whoever runs this ` +
      `deployment needs to run supabase/schema.sql once in the SQL Editor — and if the ` +
      `tables are already there, the API's schema cache is stale: run ` +
      `NOTIFY pgrst, 'reload schema'; or restart the project.`
    );
  }
  if (/JWT|not authenticated|invalid claim/i.test(message)) {
    return `${message}\n\nThe session has expired. Sign out and back in.`;
  }
  if (/row-level security|violates policy/i.test(message)) {
    return (
      `${message}\n\nThe row-level policies are refusing the write, which usually means ` +
      `schema.sql ran only in part. Re-run it.`
    );
  }
  return message;
}

// ── Syncing ───────────────────────────────────────────────────────────────

/** The shape held in the `state` row: everything except the courses. */
export interface CloudState {
  [key: string]: unknown;
}

export interface Snapshot {
  state: CloudState | null;
  courses: { id: string; data: unknown }[];
  /** Newest updated_at across the account's rows, as epoch ms. 0 when empty. */
  updated: number;
}

export async function pull(userId: string): Promise<Snapshot> {
  const db = (await cloud());
  const [stateRow, courseRows] = await Promise.all([
    db.from('state').select('data, updated_at').eq('user_id', userId).maybeSingle(),
    db.from('courses').select('id, data, updated_at').eq('user_id', userId),
  ]);

  if (stateRow.error) throw new Error(stateRow.error.message);
  if (courseRows.error) throw new Error(courseRows.error.message);

  const stamps = [
    stateRow.data?.updated_at,
    ...(courseRows.data ?? []).map((r) => r.updated_at as string),
  ].filter(Boolean) as string[];

  return {
    state: (stateRow.data?.data as CloudState) ?? null,
    courses: (courseRows.data ?? []).map((r) => ({ id: r.id as string, data: r.data })),
    updated: stamps.length ? Math.max(...stamps.map((s) => new Date(s).getTime())) : 0,
  };
}

export async function push(
  userId: string,
  state: CloudState,
  courses: { id: string; data: unknown }[],
): Promise<void> {
  const db = (await cloud());

  const { error: stateError } = await db
    .from('state')
    .upsert({ user_id: userId, data: state }, { onConflict: 'user_id' });
  if (stateError) throw new Error(stateError.message);

  if (courses.length > 0) {
    const { error } = await db
      .from('courses')
      .upsert(
        courses.map((c) => ({ user_id: userId, id: c.id, data: c.data })),
        { onConflict: 'user_id,id' },
      );
    if (error) throw new Error(error.message);
  }

  // A course deleted on this device has to be deleted there too, or the next
  // pull brings it back from the dead.
  const keep = courses.map((c) => c.id);
  const { error: pruneError } = await db
    .from('courses')
    .delete()
    .eq('user_id', userId)
    .not('id', 'in', `(${keep.map((k) => `"${k}"`).join(',') || '""'})`);
  if (pruneError) throw new Error(pruneError.message);
}
