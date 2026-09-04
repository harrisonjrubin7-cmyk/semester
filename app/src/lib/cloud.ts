/**
 * Accounts, and the copy of your semester that follows you between devices.
 *
 * The app stays offline-first: localStorage is the working copy, it is what
 * every screen reads, and the app is fully usable signed out. Signing in adds a
 * second copy in Postgres and keeps the two in step — so the phone and the
 * laptop show the same semester, and a lost phone is not a lost semester.
 *
 * The reconciliation is deliberately simple and deliberately stated. It used to
 * be **last write wins across the whole copy**, which sounded modest and was
 * in fact destructive: two devices each writing a note offline meant the one
 * that synced second won its entire list, and the other note was gone with
 * nothing to say so. What arrives from the account is now merged field by
 * field on the device — see `lib/merge.ts` — so lists you add to keep both
 * sides and settings take the copy that synced later.
 *
 * What still does not merge is one record edited on both devices: the later
 * edit of the same note is the one that survives. Anything cleverer is a
 * distributed-systems project, and pretending otherwise in the UI would be
 * worse than saying it plainly.
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
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        /*
         * PKCE, and a storage key of our own.
         *
         * PKCE because this is a static site: there is no server to hold a
         * client secret, so the code-for-token exchange has to be proved by the
         * browser that started it. The default implicit flow puts the token in
         * the URL fragment, where it lands in history and in any analytics that
         * reads the address bar.
         *
         * The key is named because the default is derived from the project ref,
         * and two builds of this app pointed at one project would otherwise
         * share a session slot and sign each other out.
         */
        flowType: 'pkce',
        storageKey: 'semester.auth',
      },
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
  /**
   * How they signed in, in words. "Google", "Microsoft", or "an email address
   * and password".
   *
   * Carried on the account rather than looked up from the session, because the
   * store keeps the account and drops the session — and "signed in as
   * you@gmail.com" does not tell somebody which button they pressed, which is
   * exactly what they need to know when signing in on a second device.
   */
  via: string;
}

export function accountOf(session: Session | null): Account | null {
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email ?? '', via: providerOf(session) };
}

/**
 * Which provider a session came through, for the account screen to say.
 *
 * "Signed in as you@gmail.com" does not tell somebody whether they used
 * Google or typed a password, and that is exactly what they need to know when
 * signing in on a second device.
 */
export function providerOf(session: Session | null): string {
  const raw = session?.user?.app_metadata?.provider;
  if (typeof raw !== 'string' || !raw) return '';
  if (raw === 'email') return 'an email address and password';
  return PROVIDER_LABEL[raw as Provider] ?? raw;
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
/**
 * The providers a student might actually have.
 *
 * `azure` is Microsoft, which is what most universities issue — and the
 * registration must accept "any organizational directory and personal
 * Microsoft accounts", or a student at another university and anyone with an
 * outlook.com address are both locked out. That is the single most common way
 * this is set up wrong.
 *
 * Email and password stay as a third way in, because some universities block
 * third-party OAuth apps outright and a student whose only account is blocked
 * would otherwise have no way in at all.
 *
 * No email domain is ever checked. Any Google or Microsoft account is valid.
 */
export type Provider = 'google' | 'azure' | 'apple';

/** What to call a provider on a button, and in "signed in with". */
export const PROVIDER_LABEL: Record<Provider, string> = {
  google: 'Google',
  azure: 'Microsoft',
  apple: 'Apple',
};

export async function signInWith(provider: Provider): Promise<void> {
  const { error } = await (await cloud()).auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: appUrl(),
      // Microsoft returns no email at all without these, and an account with
      // no email is one the student cannot recognise as theirs.
      ...(provider === 'azure' ? { scopes: 'email openid profile' } : {}),
    },
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

/**
 * Send this device's copy up.
 *
 * `removed` is the courses this device has actually deleted since it last
 * pushed — not "everything the account has that this device does not hold",
 * which is what it used to be and which was a way to lose a whole course.
 * A device that had never synced would push its two courses, and the third,
 * imported on the laptop, was deleted from the account by a phone that had
 * simply never heard of it.
 *
 * The trade is stated rather than hidden: delete a course offline and close
 * the app before it syncs, and the course comes back on the next pull. That
 * is visible and you can delete it again. The other failure was silent and
 * you could not.
 */
export async function push(
  userId: string,
  state: CloudState,
  courses: { id: string; data: unknown }[],
  removed: string[] = [],
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
  // pull brings it back from the dead. Only those, by name.
  const gone = removed.filter((id) => !courses.some((c) => c.id === id));
  if (gone.length > 0) {
    const { error: pruneError } = await db
      .from('courses')
      .delete()
      .eq('user_id', userId)
      .in('id', gone);
    if (pruneError) throw new Error(pruneError.message);
  }
}


// ── Push devices and the queue ────────────────────────────────────────────
//
// Four small writes, kept here with the rest of the account traffic rather
// than in `lib/push.ts`, which stays free of Supabase so it can be tested
// without one. What each row means is in `supabase/push.sql`.

/** This device, so the sender knows where to post. */
export async function saveDevice(device: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<void> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in first — a reminder has to belong to an account.');
  const { error } = await db
    .from('push_devices')
    .upsert({ ...device, user_id: userId }, { onConflict: 'endpoint' });
  if (error) throw new Error(error.message);
}

export async function dropDevice(endpoint: string): Promise<void> {
  const db = await cloud();
  const { error } = await db.from('push_devices').delete().eq('endpoint', endpoint);
  if (error) throw new Error(error.message);
}

/**
 * The week's reminders, replacing whatever was queued before.
 *
 * Replacing rather than adding: the plan is recomputed from the current state
 * of the semester, so anything left from a previous run is about a week that
 * has moved. The primary key is (user, reminder id), and those ids are unique
 * per reminder per day, so a re-queue overwrites in place.
 */
export async function saveQueue(
  queue: { id: string; at: number; title: string; body: string; screen?: string; item?: string }[],
): Promise<void> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in first — a reminder has to belong to an account.');

  await db.from('push_queue').delete().eq('user_id', userId);
  if (queue.length === 0) return;

  const { error } = await db.from('push_queue').insert(
    queue.map((r) => ({
      user_id: userId,
      id: r.id,
      send_at: new Date(r.at).toISOString(),
      title: r.title,
      body: r.body,
      // Where tapping it lands. This was a hardcoded empty string, so every
      // reminder the server sent arrived with no destination and every tap
      // opened the app at home — the whole point of working out where a
      // reminder belongs, thrown away one line before it left the device.
      screen: r.screen ?? '',
      item: r.item ?? '',
    })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Delete every row belonging to this account.
 *
 * Not a flag, not an archive. `on delete cascade` in the schema means removing
 * the auth user takes everything with it — but a browser holding an anon key
 * cannot delete an auth user, and it should not be able to. So this deletes the
 * rows it owns, which row-level security already scopes to exactly this
 * account, and then signs out.
 *
 * ## What it does not touch
 *
 * This device's own copy. Somebody deleting their account has asked to be off
 * the server, not to lose their semester — and the two are separate on purpose,
 * with Erase from this device as its own deliberate action. Saying so plainly
 * is the difference between a button people can press and one they will not.
 *
 * The tables are named rather than discovered, so a table added later and
 * forgotten here leaves rows behind. `privacy.test.ts` is what catches that:
 * the page claims every row goes, and the claim is checked against this list.
 */
export const OWNED_TABLES = ['push_queue', 'push_devices', 'courses', 'state'];

export async function deleteEverything(): Promise<string> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in first — there is no account to delete.');

  const failed: string[] = [];
  for (const table of OWNED_TABLES) {
    const { error } = await db.from(table).delete().eq('user_id', userId);
    // A table this project does not have is not a failure — a build without
    // reminders has no queue to empty. Anything else is reported rather than
    // swallowed, because "deleted" is a promise.
    if (error && !/does not exist|schema cache/i.test(error.message)) failed.push(table);
  }
  await db.auth.signOut();
  if (failed.length > 0) {
    return `Signed out, and most of your account is gone — but ${failed.join(' and ')} could not be removed. Email ${'harrisonjrubin7@gmail.com'} and it will be done by hand.`;
  }
  return 'Your account is empty and you are signed out. This device still has its own copy — Erase from this device removes that.';
}

/** Switching reminders off deletes what was waiting to be sent. */
export async function wipeQueue(): Promise<void> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return;
  await db.from('push_queue').delete().eq('user_id', userId);
}
