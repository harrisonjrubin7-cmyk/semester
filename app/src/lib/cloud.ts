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
import type { Seen } from '../state/shape';
import { MOVE_MS, fetchWithin, timedOut, tookTooLong } from './net';
import { explainSignUp } from './invite';

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

/**
 * What making an account came to.
 *
 * `signedIn` is the part a caller cannot work out from the sentence, and the
 * two paths are genuinely different: with email confirmation switched off the
 * account is live and the app can carry on, and with it on there is no session
 * at all until a link in an inbox is clicked. A first run that moved on from
 * the account step in both cases would be hiding the one instruction that
 * matters in the second.
 */
export interface SignedUp {
  said: string;
  signedIn: boolean;
}

export async function signUp(email: string, password: string): Promise<SignedUp> {
  const { data, error } = await (await cloud()).auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl() },
  });
  // The invite gate is a database trigger, so its refusal arrives here as an
  // unreadable server error. `explainSignUp` turns that one shape into a
  // sentence and passes everything else through untouched — it explains the
  // refusal and is not the refusal. See `lib/invite.ts`.
  if (error) throw new Error(explainSignUp(error.message, email));
  // With email confirmation on, there is no session until the link is clicked.
  return data.session
    ? { said: 'Account made. Your semester will sync from now on.', signedIn: true }
    : {
        said:
          'Check your email for the confirmation link, then come back and sign in. ' +
          'If the link lands on a page that will not load, the confirmation still worked — ' +
          'it is verified before the redirect — so come back here and sign in anyway.',
        signedIn: false,
      };
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

/**
 * Names, read out as a sentence — "Google, Microsoft or Apple".
 *
 * The paragraph under the buttons named two providers by hand, and the third
 * was added to the record without it, so the app drew an Apple button under a
 * line saying "Any Google or Microsoft account works". It was then generated
 * from the record, which fixed that and left a narrower version of the same
 * fault standing: the record is every provider the app *knows*, and the
 * buttons are now every provider the project has *on*. A project with only
 * Google switched on drew one button under a line offering three.
 *
 * So it takes the names rather than reading the record, and the form passes
 * exactly the ones it drew. The sentence cannot name a door that is not there.
 */
export function namesSaid(names: string[]): string {
  if (names.length < 2) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/**
 * Which of the three the project actually has switched on.
 *
 * Every provider is a dashboard setting, not a line of code, and nothing here
 * could see it — so the form drew Google, Microsoft and Apple whatever the
 * project was configured with, and on a project with none of them on, all
 * three were doors that could not open. Pressing one spent a round trip and
 * came back with "Unsupported provider: provider is not enabled": a sentence
 * addressed to whoever runs the deployment, shown to a student, after the
 * press. That is the shape `components/NeedsKey.tsx` exists to abolish and
 * that `c301c98` took off the import screen — the answer belongs before the
 * press, not after it.
 *
 * GoTrue answers it. `/auth/v1/settings` is public, needs only the key the
 * app already ships, and its `external` record is the dashboard's own switch
 * list. Read for our three and nothing else: the record carries a dozen
 * providers this app does not offer, and a `true` beside one of them is not a
 * button anybody asked for.
 *
 * **`null` is not "none".** It means the question could not be asked — no
 * network, a project that is down, a shape that did not parse — and the
 * caller must not read it as a project with nothing switched on. A check that
 * did not happen is not a fact about the project, and the cost of the two
 * mistakes is not symmetric: drawing a button that errors wastes a press,
 * while withholding the only working way in because a fetch failed locks
 * somebody out of their own account. So the form falls back to offering all
 * three, which is what it did before this existed.
 *
 * Cached as a promise rather than a value, for the same reason `cloud()` is:
 * the form mounts on the first run and again on the account screen, and two
 * mounts racing should share one request rather than each starting theirs.
 */
let switchedOn: Promise<Provider[] | null> | null = null;

export function providersOn(): Promise<Provider[] | null> {
  if (!cloudConfigured) return Promise.resolve([]);
  switchedOn ??= (async () => {
    try {
      const res = await fetchWithin(`${URL.replace(/\/$/, '')}/auth/v1/settings`, {
        headers: { apikey: KEY },
      });
      if (!res.ok) return null;
      const external: unknown = ((await res.json()) as { external?: unknown }).external;
      if (!external || typeof external !== 'object') return null;
      const on = external as Record<string, unknown>;
      return (Object.keys(PROVIDER_LABEL) as Provider[]).filter((p) => on[p] === true);
    } catch {
      // Offline, blocked, or not JSON. Unanswered, not answered "none".
      return null;
    }
  })();
  return switchedOn;
}

/** Ask again — for tests, and for a project reconfigured under a live tab. */
export function forgetProvidersOn(): void {
  switchedOn = null;
}

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

/**
 * Send the reset link, and say that it went.
 *
 * It returned nothing, and the form only shows a sentence when there is one to
 * show — so pressing "Send a reset link" and having it work looked exactly
 * like pressing it and having nothing happen. The one case where a person
 * presses a button twice is the case where the first press said nothing.
 *
 * The sentence does not say whether the address is on an account, because the
 * call does not either: Supabase answers the same way for an address it has
 * never seen, so that nobody can use this form to find out who has an account.
 */
export async function sendReset(email: string): Promise<string> {
  const { error } = await (await cloud()).auth.resetPasswordForEmail(email, {
    redirectTo: appUrl(),
  });
  if (error) throw new Error(error.message);
  return `If ${email} has an account, a reset link is on its way to it.`;
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
      `deployment needs to apply the migrations in supabase/migrations/ — this one ` +
      `wants the first, 20260901000100_schema.sql — and if the ` +
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
  /**
   * Newest updated_at across the account's rows, as epoch ms. 0 when empty.
   *
   * For saying so on screen — "took the account's copy, updated at …" — and
   * nothing else. It used to decide whether to take at all, by being compared
   * with a number this device had written down, and `state/shape.ts` has the
   * long version of why a single newest-stamp cannot answer that question.
   * `seen` answers it now.
   */
  updated: number;
  /** Every row's stamp, for `unseen` to compare against what was last taken. */
  seen: Seen;
}

export async function pull(userId: string): Promise<Snapshot> {
  const db = (await cloud());
  const [stateRow, courseRows] = await Promise.all([
    db.from('state').select('data, updated_at').eq('user_id', userId).maybeSingle(),
    db.from('courses').select('id, data, updated_at').eq('user_id', userId),
  ]);

  if (stateRow.error) throw new Error(stateRow.error.message);
  if (courseRows.error) throw new Error(courseRows.error.message);

  const rows = (courseRows.data ?? []) as { id: string; data: unknown; updated_at: string }[];
  const stateAt = stateRow.data?.updated_at as string | undefined;
  const stamps = [stateAt, ...rows.map((r) => r.updated_at)].filter(Boolean) as string[];

  return {
    state: (stateRow.data?.data as CloudState) ?? null,
    courses: rows.map((r) => ({ id: r.id, data: r.data })),
    updated: stamps.length ? Math.max(...stamps.map((s) => new Date(s).getTime())) : 0,
    seen: {
      ...(stateAt ? { state: stateAt } : {}),
      courses: Object.fromEntries(rows.map((r) => [r.id, r.updated_at])),
    },
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
): Promise<Seen> {
  const db = (await cloud());

  /*
   * `.select('updated_at')` on the way out, and it is the point of this
   * function returning anything at all.
   *
   * The device has to write down what it has now taken, and the only honest
   * value is the stamp the database just wrote. This used to be `Date.now()`
   * on the device — see `state/shape.ts` for what that cost — and reading the
   * stamp back costs nothing, because the row is already being returned by the
   * statement that wrote it.
   */
  const { data: stateRow, error: stateError } = await db
    .from('state')
    .upsert({ user_id: userId, data: state }, { onConflict: 'user_id' })
    .select('updated_at')
    .maybeSingle();
  if (stateError) throw new Error(stateError.message);

  const stamps: Record<string, string> = {};
  if (courses.length > 0) {
    const { data, error } = await db
      .from('courses')
      .upsert(
        courses.map((c) => ({ user_id: userId, id: c.id, data: c.data })),
        { onConflict: 'user_id,id' },
      )
      .select('id, updated_at');
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { id: string; updated_at: string }[]) {
      stamps[row.id] = row.updated_at;
    }
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

  /*
   * What this device has taken, as of this push: its own rows at the stamps
   * the database gave them.
   *
   * Rows belonging to another device are deliberately not in here. This device
   * has not seen them, so the next refresh finds them missing from the set,
   * takes them, and records them — which is exactly the behaviour that used to
   * depend on their stamp beating a clock reading.
   */
  const at = (stateRow as { updated_at?: string } | null)?.updated_at;
  return { ...(at ? { state: at } : {}), courses: stamps };
}


// ── Push devices and the queue ────────────────────────────────────────────
//
// Four small writes, kept here with the rest of the account traffic rather
// than in `lib/push.ts`, which stays free of Supabase so it can be tested
// without one. What each row means is in `supabase/migrations/20260901000600_push.sql`.

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
    // `gone_at: null` because registering is proof the subscription is alive.
    // The sender retires a device that answers 404 or 410 twice running and
    // marks it the first time; without this clear, a device that was marked,
    // went quiet, and has now come back would be retired by its next single
    // transient failure rather than given the pass the mark exists to give it.
    .upsert({ ...device, user_id: userId, gone_at: null }, { onConflict: 'endpoint' });
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
/**
 * Every table a deleted account has to be emptied from.
 *
 * The last five exist in the database and nothing writes to them yet: the
 * per-record sync and the calendar feed both landed their SQL before their
 * client halves. They are listed anyway, because the order the two halves ship
 * in decides whether this is a bug, and listing them first makes the order not
 * matter. Deleting from an empty table costs nothing, and `deleteEverything`
 * already tolerates a table a fork does not have.
 *
 * `calendar_feeds` is the one that would have hurt. A feed is a public URL
 * serving a student's timetable to anybody holding the token — leaving the row
 * behind would keep answering after the account it belonged to was gone.
 */
export const OWNED_TABLES = [
  'push_queue',
  'push_devices',
  'courses',
  'state',
  'notes',
  'tasks',
  'appointments',
  'sittings',
  'calendar_feeds',
  // The record of who read the rows above, which is about the account and so
  // goes with it. `access.check.sql` proves the delete policy that makes this
  // line work, and proves a stranger cannot use it to clear somebody else's.
  'access_log',
];

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

// ── The calendar feed ────────────────────────────────────────────────────
//
// A row per account holding the `.ics` this device rendered, the name the
// calendar app shows, and a token. The Edge Function at `/calendar/<token>`
// serves it to Apple and Google, who arrive with no credentials at all.
//
// The device renders and this uploads. The function has no idea what a
// deadline is — see `supabase/CALENDAR-REVIEW.md` for why a second emitter in
// Deno would be the wrong shape.

/** Where the functions live, for building a subscribable URL. */
export function feedBase(): string {
  return `${URL.replace(/\/$/, '')}/functions/v1`;
}

/**
 * Put the rendered calendar up, keeping the token that is already published.
 *
 * The token is generated on the device and only ever travels upward, so a
 * link somebody has already given to their phone keeps working across every
 * later publish. Replacing it is a separate, deliberate act — `replaceFeed`.
 */
export async function publishFeed(feed: {
  token: string;
  body: string;
  name: string;
  events: number;
}): Promise<void> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in first — a feed belongs to an account.');
  const { error } = await db
    .from('calendar_feeds')
    .upsert({ user_id: userId, ...feed }, { onConflict: 'user_id' });
  if (error) throw new Error(error.message);
}

/**
 * The feed as the account holds it, or nothing.
 *
 * `body` is deliberately not selected. It is the whole calendar and the screen
 * only ever says how fresh it is and how much is in it — fetching a hundred
 * kilobytes to render "Published 2 hours ago" would be a waste on every visit.
 */
export async function readFeed(): Promise<{
  token: string;
  updatedAt?: number;
  events?: number;
} | null> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;
  const { data: row, error } = await db
    .from('calendar_feeds')
    .select('token, events, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !row) return null;
  return {
    token: String(row.token),
    events: typeof row.events === 'number' ? row.events : undefined,
    updatedAt: row.updated_at ? Date.parse(String(row.updated_at)) : undefined,
  };
}

/**
 * Retire the published link and start a new one.
 *
 * The body goes with it. A new token with the old calendar still attached
 * would answer for a link nobody has yet, and the next publish puts the body
 * back a moment later anyway — whereas leaving the old body reachable is the
 * one thing "replace this link" is for.
 */
export async function replaceFeed(token: string): Promise<void> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in first — a feed belongs to an account.');
  const { error } = await db
    .from('calendar_feeds')
    .upsert(
      { user_id: userId, token, body: '', events: 0 },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(error.message);
}

// ── Who has read your rows ───────────────────────────────────────────────
//
// Two paths in this project read a student's rows with the service key, which
// does not consult row-level security: the calendar feed, served to whoever
// holds the token because Apple and Google arrive with no credentials, and the
// reminder sender, run by the scheduler rather than by a person.
//
// `supabase/migrations/20260901001300_access_log.sql` writes both down, and
// the policy on that table makes it readable by the account it is about. This
// is that read. The point of the whole thing is the calendar: a published link
// is a bearer credential living in somebody's phone for months, the app has
// always had the button that retires it, and until now it had nothing that
// would ever tell a student to press it.

/** One day's worth of one kind of access, as the app shows it. */
export interface Access {
  /** `YYYY-MM-DD`, in UTC. The log is bucketed by day on purpose. */
  day: string;
  what: 'calendar_feed' | 'push_send';
  /** One of `lib/clientfamily.ts`'s families. `browser` is the interesting one. */
  client: string;
  hits: number;
  lastAt?: number;
}

/**
 * The access log for this account, most recent first.
 *
 * Signed out this is empty rather than an error: there is no account, so there
 * is nothing that could have been read this way — everything is on the device.
 * A build whose project has not had the migration applied is the same answer
 * for a different reason, and the `does not exist` tolerance is
 * `deleteEverything`'s, for the same reason it has one.
 */
export async function readAccessLog(days = 30): Promise<Access[]> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return [];
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data: rows, error } = await db
    .from('access_log')
    .select('day, what, client, hits, last_at')
    .eq('user_id', userId)
    .gte('day', from)
    .order('day', { ascending: false });
  if (error || !Array.isArray(rows)) return [];
  return rows.map((r) => ({
    day: String(r.day),
    what: r.what === 'push_send' ? 'push_send' : 'calendar_feed',
    client: String(r.client ?? 'unknown'),
    hits: typeof r.hits === 'number' ? r.hits : 0,
    lastAt: r.last_at ? Date.parse(String(r.last_at)) : undefined,
  }));
}

// ── Reading a calendar somebody pasted ───────────────────────────────────
//
// The other direction from the feed above, and the one that needs a server for
// a dull reason: a calendar host sends no CORS headers, so the browser is
// refused before the request leaves. `supabase/functions/fetchcal/index.ts` is
// the one route that forwards it, and `lib/feedlink.ts` reaches for this only
// after trying the calendar directly and trying the dev server's own forwarder.

/**
 * One pasted calendar link, fetched through the account.
 *
 * Signed out this throws rather than asking anonymously: the function has no
 * anonymous path, by design — an open URL fetcher is an open relay.
 *
 * The address goes in the body rather than the query string because it carries
 * a token that is the whole of the authentication for that person's calendar,
 * and a query string is the part of a request that lands in every log on the
 * way.
 */
export async function fetchIcsVia(url: string): Promise<string> {
  const db = await cloud();
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Signed out.');
  // A term's calendar is a real download over whatever the phone is on, so
  // this gets the longer of the two deadlines rather than the conversational
  // one — but it does get one. See lib/net.ts.
  let res: Response;
  try {
    res = await fetchWithin(
      `${feedBase()}/fetchcal`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: KEY,
        },
        body: JSON.stringify({ url }),
      },
      MOVE_MS,
    );
  } catch (e) {
    if (timedOut(e)) throw new Error(tookTooLong('The calendar'));
    throw e;
  }
  const text = await res.text();
  if (res.ok) return text;
  // The function answers a refusal as JSON and a calendar as text, so the
  // message it wrote is worth more than the status code.
  let said = '';
  try {
    said = String((JSON.parse(text) as { error?: unknown }).error ?? '');
  } catch {
    said = '';
  }
  throw new Error(said || `The calendar could not be read (${res.status}).`);
}
