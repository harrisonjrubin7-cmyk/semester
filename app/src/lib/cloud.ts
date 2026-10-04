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
 * And a device never writes over a copy it has not read. Every push names the
 * `updated_at` it last saw for each row, and a row that has moved on refuses
 * the write — the store then pulls, merges, and pushes the merge. See `push`
 * and `Stale` below. Before that, the merge only ran for a device that
 * happened to pull first, and a laptop left open overnight pushed straight
 * over the phone's morning.
 *
 * One record edited on both devices before either syncs keeps the later edit
 * in use, and the other version is kept on this device and offered on Account
 * (`lib/conflicts.ts`, against the version both devices last agreed on). A
 * deletion is settled against the same version, so a note or course deleted
 * on one device stays deleted, and a deletion against an edit is offered the
 * same way (`lib/deletions.ts`). What still is not cleverer: text is not
 * merged inside a record, and the choice is whole-version.
 *
 * What does not sync: files you attach. They live in IndexedDB and can be tens
 * of megabytes; uploading them silently on a phone plan is not a decision the
 * app should make for you. The screen says so.
 */

import { passwordProblem } from './password';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { requireOnline } from './offline-mode';
import { classify, reference, say, type Code } from './failure';
import type { Seen } from '../state/shape';
import { MOVE_MS, fetchWithin, timedOut, tookTooLong } from './net';
import { explainSignUp } from './invite';
import { READ_ONLY, ReadOnly } from './readonly';

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

/**
 * `bornOn` is YYYY-MM-DD. It travels in the account's metadata, where
 * `private.record_stated_age` reads it, refuses an under-13, keeps only the
 * day a minor turns 18, and deletes it (`lib/age.ts`).
 */
export async function signUp(email: string, password: string, bornOn?: string): Promise<SignedUp> {
  const { data, error } = await (await cloud()).auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl(), ...(bornOn ? { data: { birth_date: bornOn } } : {}) },
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

/** Where this account stands: never the date, only the standing. */
export type AgeStatus = 'unknown' | 'adult' | 'minor' | 'under_minimum';

export async function myAgeStatus(): Promise<AgeStatus> {
  const { data, error } = await (await cloud()).rpc('my_age_status');
  if (error) throw new Error(error.message);
  return (data as AgeStatus) ?? 'unknown';
}

/** Once, for an account made without a birth date. A second answer is refused. */
export async function stateMyAge(bornOn: string): Promise<'adult' | 'minor' | 'under_minimum_age' | 'already_stated'> {
  const { data, error } = await (await cloud()).rpc('state_my_age', { want_birth_date: bornOn });
  if (error) throw new Error(error.message);
  return data as 'adult' | 'minor' | 'under_minimum_age' | 'already_stated';
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
 * Watch for the moment an emailed reset link has been opened.
 *
 * Supabase raises `PASSWORD_RECOVERY` once the link's code has been exchanged
 * for a short session. That session is enough to set a password and nothing
 * else the app asks for, so the recovery screen listens here and asks for the
 * new password straight away.
 */
export function onPasswordRecovery(fn: () => void): () => void {
  if (!cloudConfigured) return () => {};
  let stop: (() => void) | null = null;
  let cancelled = false;
  void cloud().then((db) => {
    if (cancelled) return;
    const { data } = db.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') fn();
    });
    stop = () => data.subscription.unsubscribe();
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

/** Set the password of the signed-in (or just-recovered) account. */
export async function setNewPassword(password: string): Promise<string> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const { error } = await (await cloud()).auth.updateUser({ password });
  if (error) throw new Error(error.message);
  return 'Your password is changed.';
}

/**
 * Ask for a new sign-in address. Supabase emails a confirmation and the
 * address does not change until it is followed, so the sentence says that
 * rather than claiming a change that has not happened.
 */
export async function changeEmail(email: string): Promise<string> {
  const { error } = await (await cloud()).auth.updateUser({ email }, { emailRedirectTo: appUrl() });
  if (error) throw new Error(error.message);
  return `A confirmation link is on its way to ${email}. Your address changes when you follow it.`;
}

/** Sign out every device but this one. */
export async function signOutOtherDevices(): Promise<string> {
  const { error } = await (await cloud()).auth.signOut({ scope: 'others' });
  if (error) throw new Error(error.message);
  return 'Every other device has been signed out.';
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

/**
 * What each course row held when this device last knew it matched the
 * database: the stamp, and the data in a canonical form. Keyed `user/id`.
 *
 * It is what lets `push` send only the courses that changed. A push used to
 * rewrite every course, changed or not, and on 30 September that was where
 * capacity gave first: the load harness's push, the state row and four 42 KB
 * courses, was the slowest thing a student does (docs/PERFORMANCE-AND-LOW-END-
 * DEVICE-PLAN.md). A student edits one course at a time.
 *
 * Skipping a row is safe only when two things hold, and both are checked: the
 * stamp this push names for it is the stamp recorded here, so the device has
 * not taken a newer copy since; and its data is what was recorded, so there
 * is nothing to send. If another device changed that row meanwhile, not
 * writing it loses nothing: this push does not touch it, and the state row's
 * compare-and-swap, which every push makes, is refused because the other
 * device's push moved that too.
 *
 * Memory only. After a reload it is empty until the first pull, and the first
 * push writes everything, which is what every push did before.
 */
const acked = new Map<string, { at: string; data: string }>();

/** JSON with object keys sorted, so jsonb's reordering is not a change. */
function canon(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

const ackKey = (userId: string, id: string) => `${userId}/${id}`;

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
  for (const r of rows) acked.set(ackKey(userId, r.id), { at: r.updated_at, data: canon(r.data) });
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
 * The account's copy moved on since this device last read it.
 *
 * Thrown by `push` instead of writing, and caught by the store, which pulls,
 * merges and pushes again. It is not a failure anybody needs to read about:
 * it is the sync working, and it never reaches `explainSync`.
 */
export class Stale extends Error {
  constructor(what: string) {
    super(`The account's copy of ${what} changed on another device since this one last read it.`);
    this.name = 'Stale';
  }
}

/**
 * A write's failure as an Error that keeps the database's code and status.
 *
 * `new Error(error.message)` kept only the prose, and the retry decision is
 * made by `classify`, which reads the code first. A check-constraint refusal
 * (23514) then fell through to INTERNAL_ERROR and was sent again every five
 * minutes, with a line telling the student it might recover by itself. It
 * will not: the same snapshot fails the same check.
 */
export function failed(error: { message: string; code?: string; status?: number }): Error {
  return Object.assign(new Error(error.message), { code: error.code, status: error.status });
}

export function isStale(e: unknown): e is Stale {
  return e instanceof Error && e.name === 'Stale';
}

/** Postgres's unique_violation: an insert found the row already there. */
const TAKEN = '23505';

/**
 * Send this device's copy up — but only over the copy it last read.
 *
 * ## Why every write names the stamp it expects
 *
 * This was an upsert, and an upsert overwrites whatever is there. The pull
 * side has merged field by field since `lib/merge.ts`, but a merge only helps
 * a device that pulls before it pushes, and this one never did: a laptop left
 * open overnight pushed its copy over the phone's morning and the phone's
 * edits were gone from the account, with nothing to say so. `lib/merge.ts`
 * could not help, because the account never held both copies at once.
 *
 * So each row is now a compare-and-swap on `updated_at`, which the database
 * sets and no client can (`touch_updated_at`). A row this device has read is
 * updated only where its stamp is still the one `seen` recorded; a row it has
 * never read is inserted, and an insert that finds the row already there has
 * lost the same race. Either way nothing is written over a copy this device
 * has not seen — `push` throws `Stale`, and the store pulls, merges and
 * pushes the merged copy back.
 *
 * What this does not solve is the same record edited on both devices before
 * either syncs: the merge still keeps the later edit of it. The difference is
 * that the merge now gets to run. Before, the account never saw the loser.
 *
 * ## The rest of it, unchanged
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
  seen: Seen | null = null,
): Promise<Seen> {
  /*
   * Read-only mode (`lib/readonly.ts`): nothing leaves this device, and the
   * refusal is here as well as in the store so that no other caller can push
   * around it. Before the client is even fetched — a build in read-only mode
   * has no reason to load the SDK for a write it will not make.
   */
  if (READ_ONLY) throw new ReadOnly();
  const db = (await cloud());

  /*
   * `.select('updated_at')` on every write, and it is the point of this
   * function returning anything at all.
   *
   * The device has to write down what it has now taken, and the only honest
   * value is the stamp the database just wrote. This used to be `Date.now()`
   * on the device — see `state/shape.ts` for what that cost — and reading the
   * stamp back costs nothing, because the row is already being returned by the
   * statement that wrote it. It is also how a stale update is noticed: an
   * update whose filter matched nothing returns no row.
   */
  let stateAt: string | undefined;
  if (seen?.state) {
    const { data, error } = await db
      .from('state')
      .update({ data: state })
      .eq('user_id', userId)
      .eq('updated_at', seen.state)
      .select('updated_at');
    if (error) throw failed(error);
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) throw new Stale('your semester');
    stateAt = rows[0].updated_at;
  } else {
    const { data, error } = await db
      .from('state')
      .insert({ user_id: userId, data: state })
      .select('updated_at')
      .maybeSingle();
    if (error) {
      if (error.code === TAKEN) throw new Stale('your semester');
      throw failed(error);
    }
    stateAt = (data as { updated_at?: string } | null)?.updated_at;
  }

  const stamps: Record<string, string> = {};
  const sent = new Map(courses.map((c) => [c.id, canon(c.data)]));
  // Known to this device and unchanged since the database last confirmed
  // them: nothing to send, and the stamp carries forward (see `acked`).
  const same = courses.filter((c) => {
    const at = seen?.courses[c.id];
    const was = at ? acked.get(ackKey(userId, c.id)) : undefined;
    return !!was && was.at === at && was.data === sent.get(c.id);
  });
  for (const c of same) stamps[c.id] = seen!.courses[c.id];
  const known = courses.filter((c) => seen?.courses[c.id] && !same.includes(c));
  const fresh = courses.filter((c) => !seen?.courses[c.id]);

  // New to this device: one insert for all of them. A clash on any means
  // another device got there first, and the whole push goes round again.
  if (fresh.length > 0) {
    const { data, error } = await db
      .from('courses')
      .insert(fresh.map((c) => ({ user_id: userId, id: c.id, data: c.data })))
      .select('id, updated_at');
    if (error) {
      if (error.code === TAKEN) throw new Stale('a course');
      throw failed(error);
    }
    for (const row of (data ?? []) as { id: string; updated_at: string }[]) {
      stamps[row.id] = row.updated_at;
    }
  }

  // Read before: one update each, because each names its own stamp. A term
  // is a handful of courses, so this is a handful of small requests.
  const updated = await Promise.all(
    known.map((c) =>
      db
        .from('courses')
        .update({ data: c.data })
        .eq('user_id', userId)
        .eq('id', c.id)
        .eq('updated_at', seen!.courses[c.id])
        .select('id, updated_at')
        .then(({ data, error }) => ({ id: c.id, data, error })),
    ),
  );
  for (const { id, data, error } of updated) {
    if (error) throw failed(error);
    const rows = (data ?? []) as { id: string; updated_at: string }[];
    if (rows.length === 0) throw new Stale('a course');
    stamps[id] = rows[0].updated_at;
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
    for (const id of gone) acked.delete(ackKey(userId, id));
  }

  // What the database now holds, for the next push to compare against.
  for (const c of [...fresh, ...known]) {
    if (stamps[c.id]) acked.set(ackKey(userId, c.id), { at: stamps[c.id], data: sent.get(c.id)! });
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
  return { ...(stateAt ? { state: stateAt } : {}), courses: stamps };
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
 * Delete this account: its rows, and the sign-in itself.
 *
 * ## Where it happens now, and why it moved
 *
 * This used to run here, in the browser: one filtered DELETE per entry in
 * `OWNED_TABLES`, each its own request, then a sign-out. A browser holding a
 * publishable key cannot delete an `auth.users` row and must not be able to,
 * so the email address and the sign-in outlived the button, and a failure half
 * way left half an account behind (SECURITY-GAP-ANALYSIS.md, S-2).
 *
 * So the button calls the `delete-account` Edge Function, which erases every
 * row naming the account in **one transaction** (`public.erase_account`, in
 * `supabase/migrations/20260929010000_account_erasure_and_export.sql`) and
 * then deletes the auth user with the service role. Its answer says what
 * happened — `erased`, `signInRemoved` — and this function signs out only when
 * both are true. On anything else the student stays signed in, is told
 * exactly which of the two happened, and can press the button again.
 *
 * ## What the lists below are now
 *
 * The server does not read them: it derives its list from the database's own
 * foreign keys to `auth.users`, so a table added later is erased the day it
 * lands. `OWNED_TABLES` and `KEPT_TABLES` stay as the privacy page's account
 * of what goes and what stays, and `erasure.test.ts` holds that account to the
 * schema — every owned table reachable by a cascade from `auth.users` or by
 * one of the `forget_my_*` functions `erase_account` calls, and no kept table
 * hanging off `auth.users` by a cascade that would take it.
 *
 * ## What it does not touch
 *
 * This device's own copy. Somebody deleting their account has asked to be off
 * the server, not to lose their semester — and the two are separate on purpose,
 * with Erase from this device as its own deliberate action.
 *
 * `KEPT_TABLES` — the rows other people are relying on. Each carries its
 * reason, and the page prints them.
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
   * Two tables need it. `organization_members` holds one person's rank in an
   * organization as decided by another, so DELETE on it is revoked from both
   * API roles outright and there is no filter that would work.
   * `forget_my_organizations()` is the only way out, and it does more than a
   * DELETE could: it takes the `DECLINED` and `REMOVED` rows that
   * `leave_organization()` refuses to touch, and the trigger behind it removes
   * an organization left with no members at all. `support_access_grant` names
   * an account in either the student or supporter column, so its RPC safely
   * removes both sides in one server-side operation.
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
  // What a school shared about you through an integration, and the consent
  // that let it in. Both also cascade on account deletion.
  { table: 'canonical_entity_references', column: 'subject_user_id' },
  { table: 'consent_record', column: 'subject_user_id' },
  { table: 'courses', column: 'user_id' },
  { table: 'state', column: 'user_id' },
  { table: 'notes', column: 'user_id' },
  { table: 'tasks', column: 'user_id' },
  // The student's private productivity workspace. The database also cascades
  // it from auth.users, but listing it here keeps explicit erasure complete
  // even when account deletion is exercised before the auth row is removed.
  { table: 'productivity_workspace', column: 'user_id' },
  // Tasks and events written through the command API (`server/productivity/`).
  // Both cascade from auth.users; the person is `owner_id`, not `user_id`.
  { table: 'productivity_task', column: 'owner_id' },
  { table: 'productivity_event', column: 'owner_id' },
  { table: 'appointments', column: 'user_id' },
  { table: 'sittings', column: 'user_id' },
  { table: 'calendar_feeds', column: 'user_id' },
  // Graduation scenario drafts a student chose to save to their account
  // (`lib/graduation-cloud.ts`, Phase D). The foreign key cascades from
  // auth.users too; listed so the delete here does not depend on it.
  { table: 'graduation_scenarios', column: 'user_id' },
  { table: 'productivity_workspace', column: 'user_id' },
  // Advisor shares (`lib/advisor-shares.ts`, Phase G), at either end: the ones
  // a student made and the ones an advisor received. Deleting them cascades to
  // their read log. `erase_account` runs the RPC before the auth user goes,
  // and an advisor has no delete policy — the RPC removes both sides.
  { table: 'advisor_shares', column: null, via: 'forget_my_advisor_shares' },
  // Course demand (Phase K): the courses a student contributed and their
  // consent. The consent allows no client write, so the RPC removes both;
  // the plan rows are listed too, since the student may delete those directly.
  { table: 'demand_consents', column: null, via: 'forget_my_course_demand' },
  { table: 'term_plan_courses', column: 'user_id' },
  // What a student said applies to them for campus office actions, and which
  // of those actions they marked done (`lib/office-actions-remote.ts`, Phase
  // J). Both are the student's alone; no office can read either.
  { table: 'institution_action_audiences', column: 'user_id' },
  { table: 'institution_action_progress', column: 'user_id' },
  // The link a registrar made from the school's student record to this
  // account (D-145), which the student reads their record and student account
  // through (lib/finance/mine.ts, D-146). The student has no delete policy on
  // it, so the filtered DELETE takes nothing; the cascade from auth.users
  // does, and the school's record stays with the school.
  { table: 'academic_record_subjects', column: 'user_id' },
  // A request to be recognised as a member of a university (`school_membership_
  // requests`, G-03). The person reads their own; they have no delete policy —
  // a decision is a record other people made — so the filtered DELETE takes
  // nothing and the cascade from auth.users does. It holds no address.
  { table: 'school_membership_requests', column: 'user_id' },
  // A formal export, correction, restriction or assisted-erasure request.
  // It is keyed by `subject` and cascades with auth.users; the completed fact
  // may remain without an identity in the older `data_requests` ledger.
  { table: 'data_subject_request', column: 'subject' },
  // A support grant names this account in either of two columns. The RPC
  // removes both sides, which one filtered DELETE cannot express, while its
  // audit trigger leaves only pseudonyms behind.
  { table: 'support_access_grant', column: null, via: 'forget_my_support_access' },
  // A private beta you joined: the membership, and through it what you sent
  // as beta feedback and why you left. The tables have no grant at all, so a
  // filtered DELETE cannot reach them; the RPC removes the memberships (the
  // other two cascade) and any beta invitation to your confirmed address.
  { table: 'beta_memberships', column: null, via: 'forget_my_beta' },
  { table: 'beta_feedback', column: null, cascadesFrom: 'beta_memberships' },
  { table: 'beta_exit_requests', column: null, cascadesFrom: 'beta_memberships' },
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
  // Community. A member cannot filter on author_id or host_id — neither is
  // readable — so one RPC removes posts, hosted sessions, session places,
  // mutes and memberships together. The two entries call it twice, which is
  // harmless: the second finds nothing. A post that is the subject of a
  // moderation case is withdrawn and anonymised rather than deleted; see
  // `community_cases` below. `community.check.sql` walks it.
  { table: 'community_posts', column: null, via: 'forget_my_community' },
  { table: 'community_sessions', column: null, via: 'forget_my_community' },
  // A member's aliases and volunteer record go in the same call. Neither is
  // written by this client; both are about the account, so both go with it.
  { table: 'community_aliases', column: null, via: 'forget_my_community' },
  { table: 'community_volunteers', column: null, via: 'forget_my_community' },
  { table: 'community_media', column: null, via: 'forget_my_community' },
  { table: 'community_session_participants', column: 'user_id' },
  { table: 'community_mutes', column: 'user_id' },
  { table: 'community_members', column: 'user_id' },

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
  // The codes that made them, keyed on the student for the same reason: the
  // invite is the student's statement. A claimant's link to it is
  // `claimed_by`, which `on delete set null` clears when their account goes.
  { table: 'family_invites', column: 'student_id' },
  // The confirmed copies behind a share, and the log of every read of them.
  // Both are the student's; a supporter holds no row in either, and a reader's
  // own deletion only clears `reader_id` on the log (`on delete set null`).
  { table: 'family_shared_items', column: 'student_id' },
  { table: 'family_access_events', column: 'student_id' },
  // An athlete's share with academic support (D-039), gone at either end:
  // the student's shares and the ones a staff member received. `erase_account`
  // runs the RPC, and the auth cascade takes anything left; the RPC reaches the
  // received ones. Its read log goes with each share (`on delete cascade`).
  { table: 'support_shares', column: null, via: 'forget_my_support_shares' },
  // Its read log has no column of the student's: each row goes with the
  // share it records, by `on delete cascade`.
  { table: 'support_share_events', column: null, cascadesFrom: 'support_shares' },

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

  // ── Help requests ───────────────────────────────────────────────────────
  // No API role holds DELETE on `help_requests`: the only writes into it are
  // the functions in `20260927230000_help_requests.sql`, so the way out is one
  // of them too. The events are the student's record of who opened what, and
  // go with their request.
  { table: 'help_requests', column: null, via: 'forget_my_help_requests' },
  { table: 'help_request_events', column: null, cascadesFrom: 'help_requests' },

  // ── Mentor requests ─────────────────────────────────────────────────────
  // Same shape: no API role writes `mentor_requests` directly, so it leaves
  // through `forget_my_mentor_requests()` (20260928021700), which removes every
  // request the account sent or received.
  { table: 'mentor_requests', column: null, via: 'forget_my_mentor_requests' },
  // The offers themselves, with the display name the mentor chose. Both hang
  // off `auth.users` by `on delete cascade`, which `erase_account` follows;
  // each table's owner-delete policy is what the old client path relied on.
  { table: 'peer_mentor_offers', column: 'user_id' },
  { table: 'alumni_mentor_offers', column: 'user_id' },

  // ── Support tickets ─────────────────────────────────────────────────────
  // Questions to Semester's own support staff, not to a campus office. No API
  // role holds any grant on either table (`20260928210000_support_tickets.sql`),
  // so the way out is the student's own function; messages go with their ticket.
  { table: 'support_tickets', column: null, via: 'forget_my_support_tickets' },
  { table: 'support_ticket_messages', column: null, cascadesFrom: 'support_tickets' },

  { table: 'forms', column: 'owner' },
  // Taken by the line above rather than by a request of its own:
  // `form_responses.form_id` references `forms` with `on delete cascade`, and
  // a referential action runs as the table's owner rather than under
  // row-level security, so the answers go when the form does.
  // `forms.check.sql` proves that, because a cascade nobody has watched fire
  // is a cascade this file is only assuming.
  { table: 'form_responses', column: null, cascadesFrom: 'forms' },

  // ── The operations console ──────────────────────────────────────────────
  // An operator's saved views and last-open tab (`lib/console/client.ts`).
  // Keyed by `subject`, which references `auth.users` with `on delete
  // cascade` (`20260929100000_console_control_plane.sql`), and owner-only by
  // row-level security, so the rows go with the account.
  { table: 'operator_preference', column: 'subject' },

  // ── A school's dining ───────────────────────────────────────────────────
  // Your meal plan and mobile orders (`lib/dining/client.ts`). Each row names
  // you by a column that references `auth.users` with `on delete cascade`
  // (`20260929330000_dining.sql`), so they go with the account; the school's
  // own system of record keeps its copy.
  { table: 'dining_plans', column: 'student' },
  { table: 'dining_orders', column: 'student' },

  // ── The official registration ledger and gradebook ──────────────────────
  // Your enrollments (`lib/enrollment/client.ts`), and every version of your
  // grades and your regrade requests (`lib/gradebook/client.ts`). Each names
  // you by a column that references `auth.users` with `on delete cascade`
  // (`20260929300000_registration_transaction.sql`,
  // `20260929310000_gradebook.sql`), so they go with the account; a regrade's
  // answer goes with its request. The school's own record keeps its copy.
  { table: 'registration_enrollments', column: 'student' },
  { table: 'grade_entries', column: 'student_id' },
  { table: 'regrade_requests', column: 'student_id' },
  { table: 'regrade_resolutions', column: null, cascadesFrom: 'regrade_requests' },
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
    table: 'module_mode_request',
    why: 'A request to switch one of a school’s modules between Connect and Core is a governance record of the school, kept with its approvals. Deleting your account removes you as the person who asked; the request and what it changed stay.',
  },
  {
    table: 'module_mode_approval',
    why: 'An approval is the proof that two administrators agreed to a change in what the school’s record is. Deleting your account removes your id from it; the approval stays, so the change can still be explained.',
  },
  {
    table: 'commercial_prices',
    why: 'The price list is not a record about you. Anyone can read it, no account writes a row in it, and the Membership panel only reads it to name what Plus costs.',
  },
  {
    table: 'subscriptions',
    why: 'A paid subscription is a financial record of what was charged and when. The app only reads your own; deleting your account unlinks you from the billing account it belongs to, and the record stays, no longer tied to your account.',
  },
  {
    table: 'gtm_campaigns',
    why: 'A campaign you ran for your school belongs to the school, and its record is how the school shows what it sent and why. Deleting your account removes you as its owner or approver; the campaign stays, and one with no owner cannot be switched on again.',
  },
  {
    table: 'gtm_campaign_reviews',
    why: 'A privacy, accessibility or brand review you recorded is part of the record of why a campaign was allowed to go out. It stays with the campaign, no longer attributed to you.',
  },
  {
    table: 'academic_record_entries',
    why: 'Your school’s academic record of you — enrollment, grades, credits, standing, degrees — is an education record the school keeps, not data you gave Semester. Deleting your account removes your link to read it here; the school’s record stays with the school, and if you worked on it as staff, it stays no longer naming you.',
  },
  {
    table: 'academic_record_changes',
    why: 'A change you proposed or decided on your school’s academic record is part of the record of why an entry says what it says. It stays with the school, no longer attributed to you.',
  },
  {
    table: 'student_payment_plans',
    why: 'A payment plan you asked your school for, and whether it agreed, is part of the school’s financial record of your account. Deleting your account leaves the plan with the school, no longer naming you as the one who asked; if you decided on plans as staff, the same.',
  },
  {
    table: 'student_payment_plan_installments',
    why: 'A plan’s schedule of payments belongs to the plan: it stays with the school when the plan does, and names nobody.',
  },
  {
    table: 'student_account_entries',
    why: 'Your school’s record of your student account — what was charged, paid, refunded and credited — is a financial record the school keeps, not data you gave Semester. Deleting your account removes your link to read it here; the school’s record stays with the school, and if you worked on it as staff, it stays no longer naming you.',
  },
  {
    table: 'student_account_requests',
    why: 'A request you made or decided on a student account is part of the record of why the account says what it says. It stays with the school, no longer attributed to you.',
  },
  {
    table: 'student_account_reconciliations',
    why: 'A reconciliation you recorded with your school’s payment provider is how the school shows a month’s payments were checked. It holds totals and a file fingerprint, never a payment’s details, and stays with the school, no longer attributed to you.',
  },
  {
    table: 'student_account_closes',
    why: 'A month you closed on your school’s student accounts is part of its financial record. It stays with the school, no longer attributed to you.',
  },
  {
    table: 'student_account_settings',
    why: 'Your school’s thresholds for student accounts — when a hold applies, when a second approver is needed — are its configuration, not a record about you. They stay with the school.',
  },
  {
    table: 'migration_projects',
    why: 'A migration you ran for your school, moving a domain out of a system it is retiring, belongs to the school and is part of how it shows the cutover was safe. Deleting your account removes you as the person who opened it; the migration stays.',
  },
  {
    table: 'migration_field_maps',
    why: 'A field mapping you wrote for one of your school’s migrations says how its old system’s fields became Semester’s, and it names fields, never a person. It stays with the migration.',
  },
  {
    table: 'migration_runs',
    why: 'Counts you recorded while migrating your school’s data — rows read, mapped, missing — and the fingerprint of the file they came from are the evidence a cutover was approved on. They hold no record from the file, stay with the migration, and are no longer attributed to you.',
  },
  {
    table: 'migration_approvals',
    why: 'An approval or rejection you recorded for a migration’s cutover is part of the record of why your school retired a system. It stays with the migration, no longer attributed to you.',
  },
  {
    table: 'workflow_versions',
    why: 'A workflow you drafted or published for your school — the steps of a process and the checks a student must meet — is the school’s process, not a record about you, and it holds no student. Deleting your account removes you as the person who drafted or published it; every version stays.',
  },
  {
    table: 'school_config_versions',
    why: 'A configuration you drafted or published for your school — its terms, workflow thresholds, AI defaults or reporting floor — is the school’s policy, not a record about you. Deleting your account removes you as the person who drafted or published it; every version stays.',
  },
  {
    table: 'groups',
    why: 'A group you started belongs to everyone in it. Deleting it would take its shared actions away from the other members, so your membership goes and the group stays, with no starter recorded.',
  },
  {
    table: 'group_tasks',
    why: 'Parts of a group project you added are what the rest of the group is working from, so they stay with the group, no longer attributed to you.',
  },
  {
    table: 'reports',
    why: 'A report you filed is a record about somebody else. It has no delete policy at all, deliberately: deleting your account is not a way to withdraw one. It stays, no longer naming you as its reporter.',
  },
  {
    table: 'organizations',
    why: 'A student organization outlives everybody in it — that is most of what makes it one rather than a study group. Your membership goes and it stays, with no founder recorded if you started it. If you were its last administrator it is left with none, and any member can take it on; if you were its last member it goes with you, because an organization nobody is in is not anything.',
  },
  {
    table: 'course_ai_rules',
    why: 'The AI rules an instructor published for a course are course policy the whole class relies on, not a record about you. A student account never writes a row; an instructor who leaves has their name cleared from the rules they published, and the rules stay.',
  },
  {
    table: 'course_guidance',
    why: 'Guidance an instructor published for a course belongs to the course, not to any one account. Students only read it; an instructor who leaves has their name cleared from what they published, and it stays for the class.',
  },
  {
    table: 'study_packs',
    why: 'A study pack an instructor published is a list of course references for the whole class. Students only read it; an instructor who leaves has their name cleared from the packs they published, and the packs stay.',
  },
  {
    table: 'schools',
    why: 'The list of universities the app recognises is not a record about you — no account writes a row in it, and only an administrator can. Leaving is not a way to remove a university, and the entry saying which one you are at lives on your own profile, which does go.',
  },
  {
    table: 'opportunities',
    why: 'A job, internship or scholarship listing an office or employer published is an institutional notice, not a record about you. If you submitted one on behalf of an office, it stays for the students it was meant for, with your account no longer named as its publisher.',
  },
  {
    table: 'help_destinations',
    why: 'The offices your university chose to reach through Semester — their names, links and hours — are institutional configuration, not a record about you. Your requests to them go with your account; the list of offices stays.',
  },
  {
    table: 'integration_connections',
    why: 'A university\'s connections to its other systems, and the record of each sync, belong to the university. Its integration staff read them; a student account never writes a row here, so leaving takes nothing from them. Anything imported about you specifically is held apart, readable only by you, and goes with your account.',
  },
  {
    table: 'integration_scopes',
    why: 'What each of your university\'s connections is approved to read. University configuration, not a record about you.',
  },
  {
    table: 'integration_mappings',
    why: 'How your university\'s systems\' fields map onto Semester\'s. University configuration, not a record about you.',
  },
  {
    table: 'integration_sync_runs',
    why: 'The history of your university\'s syncs: counts and times, never a record about a named student.',
  },
  {
    table: 'integration_sync_errors',
    why: 'Sync problems for your university\'s integration staff, with any external record identifier replaced by a one-way hash before it is stored.',
  },
  {
    table: 'integration_dead_letter_events',
    why: 'Sync work that failed and is waiting for review. It points at a stored payload and holds no record about you itself.',
  },
  {
    table: 'feature_kill_switch',
    why: 'The emergency stops for features across a university or all of Semester. Not a record about anybody.',
  },
  {
    table: 'communities',
    why: 'A community outlives whoever started it — the other members are still in it. Your membership goes; the community stays, with no creator recorded anywhere a member can read.',
  },
  {
    table: 'community_venues',
    why: 'The study venues your school approved are not a record about you, and only a community manager can add or remove one.',
  },
  {
    table: 'community_cases',
    why: 'A Trust & Safety case about a post stays when its author deletes their account, and so does the post, withdrawn and shown as "Deleted account" — deleting an account is not a way to make a report disappear. Cases carry a retention date; the sweep that enforces it is not yet scheduled.',
  },
  {
    table: 'community_reports',
    why: 'A report you filed is a record about somebody else, like `reports`: deleting your account is not a way to withdraw one. Who filed it is readable by nobody through the app, reviewers included.',
  },
  {
    table: 'community_signals',
    why: 'What an automated detector recorded about a post — the rule, how sure it was, and what a reviewer then decided. It belongs to the moderation case and goes when the case does, on the case\'s retention date.',
  },
  {
    table: 'community_calibration_items',
    why: 'Practice posts with a known answer, written by Trust & Safety staff for volunteer moderators to calibrate on. Not a record about any student.',
  },
  {
    table: 'community_volunteer_events',
    why: 'If you volunteered as a moderator: when you applied, trained, signed the agreements, and any change to your standing, each naming you only by a one-way hash. It is removed a year after it happened, by the daily retention sweep.',
  },
  {
    table: 'community_identity_grants',
    why: 'When Trust & Safety needed to know which account posted something under an alias during an investigation: who asked and who approved, by a one-way hash, and when it ran out. It goes with the case, and never records what was seen.',
  },
  {
    table: 'community_escalation_agreement_events',
    why: 'The history of your university\'s escalation agreement — each draft, activation and retirement by Semester\'s Trust & Safety staff. A record about the school\'s agreement, not about you.',
  },
  {
    table: 'community_escalation_policies',
    why: 'Whether your university has signed an agreement to receive escalations of serious safety cases, and which kinds it covers. An agreement of the school, not a record about you.',
  },
  {
    table: 'community_escalations',
    why: 'A request by Trust & Safety to tell your university about a serious safety case, and a second reviewer\'s decision on it. It goes with the case, on the case\'s retention date; it never holds your name, email or account id, only an opaque reference when the agreement requires one.',
  },
  {
    table: 'community_escalation_deliveries',
    why: 'The one queued copy of an approved escalation and whether it was delivered. It is removed 90 days after delivery, and goes with its escalation before then.',
  },
  {
    table: 'community_programs',
    why: 'Whether your university has switched pseudonyms or volunteer moderation on. A setting of the school, not a record about you; only the service role writes it.',
  },
  {
    table: 'community_retention_runs',
    why: 'How many records each daily retention sweep removed, and when. No row names a person, and the log trims itself after a year.',
  },
  {
    table: 'support_access_event',
    why: 'Support-access evidence stays after the grant is deleted so a student or university can establish that a read occurred. It contains typed tenant, grant, scope, expiry, revocation, action and time fields plus SHA-256 pseudonyms — never a name, email, free-form reason, note, source excerpt, recording, protected trait or emotion inference — and ordinary accounts cannot change or delete it.',
  },
  {
    table: 'console_duty',
    why: 'The segregation-of-duties matrix the operations console reads: which party asks for each high-risk action and which approves. It is policy seeded by a migration from lib/ops/console.ts, names no person, and the browser only reads it.',
  },
  {
    table: 'dining_locations',
    why: 'Your school’s dining locations, as its card office lists them. Not a record about you, and no student account writes a row.',
  },
  {
    table: 'dining_hours',
    why: 'When your school’s dining locations open. Not a record about you, and no student account writes a row.',
  },
  {
    table: 'registration_terms',
    why: 'Your school’s registration calendar: when enrollment opens, when add/drop and withdrawal end. A setting of the school, not a record about you; if you set it, your name is cleared and the term stays.',
  },
  {
    table: 'registration_sections',
    why: 'Your school’s course sections, their seats and meeting times. A setting of the school, not a record about you; if you set one, your name is cleared and the section stays.',
  },
  {
    table: 'gradebook_schemes',
    why: 'How a course weights its grades. The course’s, not any student’s; if you set it as an instructor, your name is cleared and the scheme stays.',
  },
  {
    table: 'gradebook_items',
    why: 'A course’s graded items, such as a midterm. The course’s, not any student’s; if you added one as an instructor, your name is cleared and the item stays.',
  },
  {
    table: 'dining_menu_items',
    why: 'What your school’s dining locations serve and what it costs. Not a record about you, and no student account writes a row.',
  },
];

/** What the `delete-account` function answers; see `_shared/deleteaccount.ts`. */
type Erasure = { erased?: unknown; signInRemoved?: unknown; message?: unknown };

/** Said when no answer came back, because then nobody here knows what happened. */
export const ERASURE_UNKNOWN =
  'No answer came back from the server, so this cannot say whether anything was deleted. You are still signed in here. Press Delete my account again — it is safe to repeat, and the answer will say what is left.';

export async function deleteEverything(): Promise<string> {
  requireOnline('delete');
  const db = await cloud();
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first — there is no account to delete.');

  let res: Response;
  try {
    res = await fetchWithin(
      `${feedBase()}/delete-account`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: KEY },
        body: JSON.stringify({ confirm: 'DELETE' }),
      },
      MOVE_MS,
    );
  } catch {
    // Not "nothing was deleted". A CORS refusal is exactly this rejection, and
    // it arrives *after* the function has run — `_shared/cors.ts` has the
    // incident. Not knowing is the only true thing to say.
    return ERASURE_UNKNOWN;
  }

  let said: Erasure = {};
  try {
    said = (await res.json()) as Erasure;
  } catch {
    said = {};
  }
  const message = typeof said.message === 'string' && said.message ? said.message : '';

  if (res.ok && said.erased === true && said.signInRemoved === true) {
    // Local only: the sessions on the server went with the auth user, and a
    // global sign-out would ask a server that no longer knows this token.
    await db.auth.signOut({ scope: 'local' });
    return `${message || 'Your account is deleted.'} You are signed out. What stays, and why, is on this page. This device still has its own copy — Erase from this device removes that.`;
  }
  if (said.erased === true) {
    return message || 'Your data is deleted, but the sign-in could not be removed yet. Press Delete my account again to finish.';
  }
  if (said.erased === false) {
    return message || 'Nothing was deleted. Try again in a minute.';
  }
  return res.status === 404
    ? 'Account deletion is not available on this server yet, so nothing was deleted. Email the address on this page and it will be done by hand.'
    : ERASURE_UNKNOWN;
}

/**
 * Everything the server holds about this account, as one JSON file.
 *
 * `export_my_data()` (same migration as `erase_account`) walks the same list
 * the erasure does — every foreign key to `auth.users`, and every row hanging
 * off those by a cascade — so what can be downloaded and what is deleted are
 * one list rather than two that drift. Three kinds of row are left out
 * because they are another person's record about this account, and the file
 * says so in its own `withheld` field.
 */
export async function exportAccount(now = new Date()): Promise<{ name: string; body: string; tables: number }> {
  const db = await cloud();
  const { data, error } = await db.rpc('export_my_data');
  if (error) throw failed(error);
  const file = (data ?? {}) as { tables?: Record<string, unknown> };
  return {
    name: `Semester account export ${now.toISOString().slice(0, 10)}.json`,
    body: JSON.stringify(data, null, 2),
    tables: Object.keys(file.tables ?? {}).length,
  };
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
