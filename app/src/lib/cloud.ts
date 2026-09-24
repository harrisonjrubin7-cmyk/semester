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
import { classify, reference, say, type Code } from './failure';
import type { Seen } from '../state/shape';
import { MOVE_MS, fetchWithin, timedOut, tookTooLong } from './net';
import { explainSignUp } from './invite';

const env = import.meta.env as unknown as Record<string, string | undefined>;
const URL = env.VITE_SUPABASE_URL ?? '';
const KEY = env.VITE_SUPABASE_KEY ?? '';
const UNIVERSITY_GATEWAY_URL = env.VITE_UNIVERSITY_GATEWAY_URL ?? '';

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

export interface InstitutionSsoConfig {
  enabled: true;
  label: string;
  domain: string;
}

/**
 * The public, non-secret part of an institution's approved SSO connection.
 *
 * The browser cannot turn this on from an environment label alone. The
 * gateway derives it from the current server-side provider record and returns
 * only the human label and domain used by Supabase domain discovery. Missing,
 * malformed and unreachable configurations all mean "do not draw a button".
 */
export async function institutionSsoConfig(): Promise<InstitutionSsoConfig | null> {
  if (!UNIVERSITY_GATEWAY_URL) return null;
  try {
    const base = new globalThis.URL(UNIVERSITY_GATEWAY_URL, window.location.origin);
    const local = ['localhost', '127.0.0.1'];
    const secure =
      base.protocol === 'https:' ||
      (base.protocol === 'http:' && local.includes(base.hostname) && local.includes(window.location.hostname));
    if (base.username || base.password || base.search || base.hash || !secure) return null;

    const result = await fetchWithin(`${base.href.replace(/\/$/, '')}/v1/auth/config`, {
      credentials: 'omit',
      redirect: 'error',
    });
    if (!result.ok) return null;
    const value: unknown = await result.json();
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Record<string, unknown>;
    if (
      candidate.enabled !== true ||
      typeof candidate.label !== 'string' ||
      !candidate.label.trim() ||
      candidate.label.length > 80 ||
      typeof candidate.domain !== 'string' ||
      candidate.domain !== candidate.domain.toLowerCase() ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(candidate.domain)
    ) return null;
    return { enabled: true, label: candidate.label.trim(), domain: candidate.domain };
  } catch {
    return null;
  }
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

/*
 * A `forgetProvidersOn()` sat here to clear the memo above.
 *
 * "For tests, and for a project reconfigured under a live tab" — and neither
 * came. `cloud.test.ts` isolates by `vi.resetModules()` and a fresh import, so
 * all eleven of its `providersOn` cases already begin with `switchedOn` unset;
 * the export was a weaker second way to do what the harness was doing better.
 * A project reconfigured under a live tab is a page reload away from being
 * asked again.
 */

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

export async function signInWithSSO({
  domain,
  redirectTo,
}: {
  domain: string;
  redirectTo: string;
}): Promise<void> {
  if (redirectTo !== appUrl()) throw new Error('Institutional sign-in must return to the approved app address.');
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
    throw new Error('Institutional sign-in is not configured with a valid domain.');
  }
  const { error } = await (await cloud()).auth.signInWithSSO({ domain, options: { redirectTo } });
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
/**
 * The same, from the error itself rather than from its message.
 *
 * `state/store.tsx` had the object in scope at both call sites and passed
 * `e.message`, so PostgREST's `code` and Supabase's `status` were dropped one
 * line before anything tried to work out what had gone wrong — leaving the
 * regexes below to guess it back out of English prose.
 *
 * This keeps every sentence `explainSyncError` produces, because that advice
 * is specific and correct and a category cannot replace it: `42P01` is only
 * "not found" to a taxonomy, while the paragraph below knows it means the
 * migrations were never applied and says which file to start with.
 *
 * ## What happens when none of those three sentences applies
 *
 * `explainSyncError` returns the server's own message unchanged, and that is
 * what `screens/Account.tsx` prints after "Sync failed.". A student is handed
 * a database's sentence with no statement of what survived and nothing to do
 * next — which is the case `lib/failure.ts` was written for, and `say()` there
 * has held the three lines platform §998 asks for the whole time, reached by
 * nothing. `classify` was already being called on this very error and its
 * answer thrown away one line later.
 *
 * So an unmatched failure is composed from the code instead. The three
 * matched branches are untouched, including the message they each quote.
 *
 * The server's words survive only where `verbatim` allows them, which is the
 * deliberate part: a validation message names a field somebody just typed and
 * is the most useful thing on the screen, while an unrecognised internal error
 * is the one case §337 says not to print. That does mean an unmatched error no
 * longer shows its raw text to whoever is deploying. The three deployment
 * paragraphs below are exactly the recognised cases and still quote it, and
 * what replaces it says whether the write landed — which the raw text never
 * did.
 */
export function explainSync(e: unknown, ref = reference()): { said: string; code: Code; ref: string } {
  const message = e instanceof Error ? e.message : String(e);
  const code = classify(e);
  const advised = explainSyncError(message);
  /*
   * Equality is the match test because it is the same test the function makes
   * of itself: every branch that recognises something returns the message with
   * a paragraph appended, so an unchanged string is a fall-through and nothing
   * else. Asking here beats a second copy of three regexes that would then
   * have to be kept in step with the ones twenty lines down.
   */
  const said =
    advised === message
      ? say(code, { ref, detail: message })
      : `${advised}\n\nReference: ${ref}`;
  return { said, code, ref };
}

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
 * When every queued reminder was due, for this account.
 *
 * Read rather than assumed, because the queue is the one place the client and
 * the sender both touch, and the sender's contract is that it deletes a row
 * once it has sent it. Anything still here is therefore still unsent, and
 * `neverArrived` in `lib/push.ts` decides which of those are old enough to
 * mean something.
 *
 * Only `send_at` is selected. The titles and bodies are the part of this table
 * that is somebody's coursework — `PUSH_NOTE` is the promise made about them —
 * and a liveness check has no business reading them back down to the device to
 * count rows.
 *
 * Signed out there is no queue to have an opinion about, so this answers with
 * an empty list rather than throwing: a caller asking "is delivery working"
 * before an account exists is asking about nothing, not hitting an error.
 */
export async function queuedSendAts(): Promise<number[]> {
  if (!cloudConfigured) return [];
  const db = await cloud();
  const { data: who } = await db.auth.getUser();
  const userId = who.user?.id;
  if (!userId) return [];

  const { data, error } = await db.from('push_queue').select('send_at').eq('user_id', userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => new Date((r as { send_at: string }).send_at).getTime());
}

/**
 * Delete the rows belonging to this account.
 *
 * Not a flag, not an archive. `on delete cascade` in the schema means removing
 * the auth user would take everything with it — but a browser holding an anon
 * key cannot delete an auth user, and it should not be able to. **So that
 * cascade never fires**, and what a deleted account is actually emptied of is
 * exactly `OWNED_TABLES` and nothing else. For a long time the privacy page
 * said the opposite, in those words, while eleven tables in `classmates.ts`
 * and `formshare.ts` were in no list at all.
 *
 * ## What it does not touch
 *
 * This device's own copy. Somebody deleting their account has asked to be off
 * the server, not to lose their semester — and the two are separate on purpose,
 * with Erase from this device as its own deliberate action. Saying so plainly
 * is the difference between a button people can press and one they will not.
 *
 * The sign-in itself. The `auth.users` row, and so the address it was created
 * with, is the one thing here no client can remove; `privacy.ts` says so and
 * gives the address to write to.
 *
 * `KEPT_TABLES` — the rows other people are relying on. Each carries its
 * reason, and the page prints them.
 *
 * The tables are named rather than discovered, so a table added later and
 * forgotten here leaves rows behind. `privacy.test.ts` is what catches that,
 * and it now reads every module rather than this one: a table in either list
 * is a decision, a table in neither is the bug.
 */
/** A table a deleted account is emptied from, and the column that owns a row. */
export type OwnedTable = {
  table: string;
  /**
   * The column holding the account id. Null when nothing is *filtered* for
   * this table, which happens two ways: a cascade from another one in this
   * list already takes it — `cascadesFrom` says which — or the rows are
   * unreachable by a filtered DELETE and a function takes them, which `via`
   * names.
   */
  column: string | null;
  cascadesFrom?: string;
  /**
   * The `rpc` this account's rows go through instead of a DELETE.
   *
   * One table needs it. `organization_members` holds one person's rank in an
   * organization as decided by another, so DELETE on it is revoked from both
   * API roles outright and there is no filter that would work.
   * `forget_my_organizations()` is the only way out, and it does more than a
   * DELETE could: it takes the `DECLINED` and `REMOVED` rows that
   * `leave_organization()` refuses to touch, and the trigger behind it removes
   * an organization left with no members at all.
   */
  via?: string;
};

/** A table a deleted account leaves rows in, and why. Said on the privacy page. */
export type KeptTable = {
  table: string;
  /** Why, in a sentence a person reads on the privacy page rather than here. */
  why: string;
};

/**
 * Every table a deleted account has to be emptied from, with the column that
 * decides a row is yours.
 *
 * ## Why the column is here rather than assumed
 *
 * This list was ten bare table names deleted `.eq('user_id', id)`, which is
 * only correct while every table spells ownership that way. Four do not:
 * `forms.owner`, `groups.created_by`, `group_tasks.created_by` and
 * `reports.reporter`. A name added to a list of names would have produced a
 * delete against a column that is not there, and PostgREST answers that with
 * an error — so the button would have reported failure rather than deleting
 * the wrong thing, but it would not have worked.
 *
 * ## Why there are two lists
 *
 * Because "every row belonging to you" is not achievable for all of them, and
 * a list with no room to say so is a list that either lies or grows a silent
 * omission. `KEPT_TABLES` is the second half: the tables a deleted account
 * leaves behind, each with the reason, and `privacy.ts` prints those reasons.
 * A table that is in neither list is the failure `privacy.test.ts` catches.
 *
 * The last of the private tables exist in the database ahead of their client
 * halves: the per-record sync and the calendar feed both landed their SQL
 * first. They are listed anyway, because the order the two halves ship in
 * decides whether this is a bug, and listing them first makes the order not
 * matter. Deleting from an empty table costs nothing.
 *
 * `calendar_feeds` is the one that would have hurt. A feed is a public URL
 * serving a student's timetable to anybody holding the token — leaving the row
 * behind would keep answering after the account it belonged to was gone.
 *
 * `messages` and `message_reactions` are your words in threads other people
 * are still reading, and deleting them leaves gaps there. That is the chosen
 * half of a real trade: the alternative is a deleted student's messages
 * sitting under a `user_id` with no profile, rendering as an author who cannot
 * be identified or asked. `privacy.ts` says the gaps happen.
 */
export const OWNED_TABLES: OwnedTable[] = [
  // ── Private to one account ──────────────────────────────────────────────
  { table: 'push_queue', column: 'user_id' },
  { table: 'push_devices', column: 'user_id' },
  { table: 'courses', column: 'user_id' },
  { table: 'state', column: 'user_id' },
  { table: 'notes', column: 'user_id' },
  { table: 'tasks', column: 'user_id' },
  { table: 'appointments', column: 'user_id' },
  { table: 'sittings', column: 'user_id' },
  { table: 'calendar_feeds', column: 'user_id' },
  // The record of who read the rows above, which is about the account and so
  // goes with it. `access.check.sql` proves the delete policy that makes this
  // line work, and proves a stranger cannot use it to clear somebody else's.
  { table: 'access_log', column: 'user_id' },
  // Which days this account opened the app, and how far through the funnel it
  // got. It is about the account rather than about the work, which is what
  // lets it have a clock at all — and is exactly why it has to go when the
  // account does. `activity.check.sql` proves the delete policy this line
  // needs, and that it cannot be aimed at somebody else's rows.
  { table: 'activity', column: 'user_id' },
  // What this account said was wrong. Keyed on `author` rather than
  // `user_id` — the column list exists for exactly this.
  //
  // It belongs up here rather than among the classmates tables because its
  // select policy asks only `author = auth.uid()`, with no enrolment in the
  // chain, so none of the ordering hazard below applies to it.
  // `feedback.check.sql` proves the delete policy this line needs and that it
  // cannot be aimed at anybody else's reports.
  { table: 'feedback', column: 'author' },

  // ── Classmates: yours, but other people can see them ────────────────────
  //
  // **The order of these is load-bearing, and it is not obvious.** PostgreSQL
  // applies SELECT policies to the WHERE clause of a DELETE, so a row this
  // account cannot *read* is a row it cannot delete by a filter either — and
  // PostgREST always sends a filter. Three of the tables below are readable
  // only while you are still enrolled: `messages` and `message_reactions`
  // through `private.in_class`, `group_members` through
  // `private.group_in_my_class`. Delete `enrollments` first and all three stop
  // matching, PostgREST answers `row_count = 0` with no error at all, and this
  // function reports a deleted account over a room still full of your
  // messages. `deletion.check.sql` walks this list in this order for exactly
  // that reason, and it is what caught it.
  { table: 'messages', column: 'user_id' },
  { table: 'message_reactions', column: 'user_id' },
  // Leaving every group you are in. The groups themselves are in
  // `KEPT_TABLES` — see there for why this is a leave and not a delete.
  { table: 'group_members', column: 'user_id' },
  // Only now. Everything above needs an enrolment to still be visible.
  { table: 'enrollments', column: 'user_id' },
  // The display name strangers in a lecture read. Its own row is readable
  // whatever else has gone, so it is not in the ordered part above.
  { table: 'profiles', column: 'user_id' },
  // Only the blocks *you* made. A row where somebody blocked you is keyed on
  // `blocked`, not `user_id`, and the policy on this table is
  // `using (auth.uid() = user_id)` — so it is neither sent nor permitted, and
  // it must not be: that row is another person's protection from you, and
  // deleting an account is not a way to reappear in their room.
  { table: 'blocks', column: 'user_id' },

  // ── The referral link ───────────────────────────────────────────────────
  //
  // Order is load-bearing again, and for the second reason rather than the
  // first. Both rows are reachable — `referrals` has a select policy for its
  // own row precisely so this delete can find it — but the code has to go
  // *after* the arrival row: deleting `referral_codes` cascades away every
  // `referrals` row naming that code, and doing it first would be relying on a
  // cascade to remove a row this list claims to delete itself.
  //
  // Two different rows, and they are not the same fact. `referrals` here is
  // *your own arrival* — the code you came in on. `referral_codes` is the code
  // you handed out, and the cascade underneath it takes the record of everyone
  // who came through you. See `supabase/migrations/20260921002623_referrals.sql`.
  { table: 'referrals', column: 'user_id' },
  { table: 'referral_codes', column: 'user_id' },

  // ── What you let a parent see ───────────────────────────────────────────
  //
  // Keyed on `student_id`, because a grant is a statement the *student* made.
  //
  // **This does not empty the recipient's side, and that is a known gap rather
  // than a decision.** A parent pressing Delete everything sends
  // `student_id = me`, matches none of the grants naming them as recipient,
  // and leaves them in place — the policy lets either party delete one (see
  // `supabase/family.check.sql`), but this list sends one filter per entry.
  // The cascade on `auth.users` covers a real account removal; this button is
  // explicitly not that. Closing it belongs with the auth flows that first
  // give a parent an account to delete.
  { table: 'family_grants', column: 'student_id' },
  // The codes that made them. Keyed on the student for the same reason the
  // grants are: the invite is the student's statement, and a claimant's copy
  // of it is `claimed_by`, which `on delete set null` takes care of when the
  // claimant's account really goes.
  { table: 'family_invites', column: 'student_id' },

  // ── Shared forms ────────────────────────────────────────────────────────
  // ── Organizations ───────────────────────────────────────────────────────
  //
  // Not a filtered DELETE, and it cannot be one: DELETE on
  // `organization_members` is revoked from both API roles, because the row is
  // somebody else's judgement about this account and a table anybody can
  // delete their own row from is a table an applicant can un-decline
  // themselves in. `forget_my_organizations()` is the only way out and takes
  // everything, decisions included — see
  // `supabase/migrations/20260921234500_organization_succession.sql` for why
  // that is the right answer *here* and the wrong one for somebody who is
  // merely leaving.
  { table: 'organization_members', column: null, via: 'forget_my_organizations' },

  { table: 'forms', column: 'owner' },
  // Taken by the line above rather than by a request of its own:
  // `form_responses.form_id` references `forms` with `on delete cascade`, and
  // a referential action runs as the table's owner rather than under
  // row-level security, so the answers go when the form does.
  // `forms.check.sql` proves that, because a cascade nobody has watched fire
  // is a cascade this file is only assuming.
  { table: 'form_responses', column: null, cascadesFrom: 'forms' },
];

/**
 * The tables a deleted account leaves rows in, and why.
 *
 * Two kinds, and the second was added later. Most are a row the account
 * created that another person is relying on, or a record about another
 * person: there is no version of "delete everything" that includes them and
 * is not also "delete somebody else's data", so the honest thing is to leave
 * them, say so, and say why — which is what `privacy.ts` does with these
 * sentences.
 *
 * The other kind is reference data the account never wrote at all. The guard
 * in `privacy.test.ts` matches every `.from('…')` in the client, reads and
 * writes alike, which is the right posture for a privacy check — touching a
 * table should force a decision about what deletion does to it — but it means
 * a table nobody's account owns arrives here too. Saying "your departure does
 * not remove it" about the list of universities is a true and slightly odd
 * sentence, and it is better than an empty category or a loosened guard.
 */
export const KEPT_TABLES: KeptTable[] = [
  {
    table: 'groups',
    why: 'A group you started belongs to everyone in it. Deleting it would take its shared tasks away from the other members, so your membership goes and the group stays — with a starter who no longer has a profile.',
  },
  {
    table: 'group_tasks',
    why: 'Parts of a group project you added are what the rest of the group is working from, so they stay with the group.',
  },
  {
    table: 'reports',
    why: 'A report you filed is a record about somebody else. It has no delete policy at all, deliberately: deleting your account is not a way to withdraw one.',
  },
  {
    table: 'organizations',
    why: 'A student organization outlives everybody in it — that is most of what makes it one rather than a study group. Your membership goes and it stays, with no founder recorded if you started it. If you were its last administrator it is left with none, and any member can take it on; if you were its last member it goes with you, because an organization nobody is in is not anything.',
  },
  {
    table: 'schools',
    why: 'The list of universities the app recognises is not a record about you — no account writes a row in it, and only an administrator can. Leaving is not a way to remove a university, and the entry saying which one you are at lives on your own profile, which does go.',
  },
];

export async function deleteEverything(): Promise<string> {
  const db = await cloud();
  const { data } = await db.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error('Sign in first — there is no account to delete.');

  const failed: string[] = [];
  for (const { table, column, via } of OWNED_TABLES) {
    if (via) {
      const { error } = await db.rpc(via);
      if (error && !/does not exist|schema cache/i.test(error.message)) failed.push(table);
      continue;
    }
    if (column === null) continue;
    const { error } = await db.from(table).delete().eq(column, userId);
    // A table this project does not have is not a failure — a build without
    // reminders has no queue to empty. Anything else is reported rather than
    // swallowed, because "deleted" is a promise.
    if (error && !/does not exist|schema cache/i.test(error.message)) failed.push(table);
  }
  await db.auth.signOut();
  if (failed.length > 0) {
    return `Signed out, and most of your account is gone — but ${failed.join(' and ')} could not be removed. Email ${'harrisonjrubin7@gmail.com'} and it will be done by hand.`;
  }
  return 'Your rows are gone and you are signed out. What a deleted account leaves behind, and why, is on the Privacy page. This device still has its own copy — Erase from this device removes that.';
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
// `supabase/migrations/20260921143653_access_log.sql` writes both down, and
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

/**
 * One Canvas API path, read through the account.
 *
 * The same arrangement as `fetchIcsVia` above and for the same reason — Canvas
 * sends no CORS headers — with one difference that decides the shape of both
 * this and `supabase/functions/canvas/index.ts`: the secret being carried is an
 * access token rather than a feed URL, so it is the student's whole Canvas
 * account rather than their timetable.
 *
 * Which is why the host, the path and the token all go in the body. A query
 * string lands in every log between here and there, and `lib/canvas.ts` says
 * what that would mean for this one.
 */
export async function fetchCanvasVia(key: { host: string; token: string }, path: string): Promise<string> {
  const db = await cloud();
  const { data } = await db.auth.getSession();
  const session = data.session?.access_token;
  if (!session) throw new Error('Signed out.');
  let res: Response;
  try {
    res = await fetchWithin(
      `${feedBase()}/canvas`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session}`,
          apikey: KEY,
        },
        body: JSON.stringify({ host: key.host, path, token: key.token }),
      },
      MOVE_MS,
    );
  } catch (e) {
    if (timedOut(e)) throw new Error(tookTooLong('Canvas'));
    throw e;
  }
  const text = await res.text();
  if (res.ok) return text;
  // The function answers a refusal as JSON with its own sentence in it, and
  // that sentence knows things a status code does not — whether the token was
  // refused, the session was stale, or the host answered a sign-in page.
  let said = '';
  try {
    said = String((JSON.parse(text) as { error?: unknown }).error ?? '');
  } catch {
    said = '';
  }
  throw new Error(said || `Canvas could not be read (${res.status}).`);
}
