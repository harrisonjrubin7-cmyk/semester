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

import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as unknown as Record<string, string | undefined>;
const URL = env.VITE_SUPABASE_URL ?? '';
const KEY = env.VITE_SUPABASE_KEY ?? '';

/** False when no project is configured — the app then runs device-only. */
export const cloudConfigured = Boolean(URL && KEY);

let client: SupabaseClient | null = null;

export function cloud(): SupabaseClient {
  if (!cloudConfigured) throw new Error('No account service is configured for this build.');
  client ??= createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
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
  const { data } = await cloud().auth.getSession();
  return data.session;
}

export function onAuthChange(fn: (session: Session | null) => void): () => void {
  if (!cloudConfigured) return () => {};
  const { data } = cloud().auth.onAuthStateChange((_event, session) => fn(session));
  return () => data.subscription.unsubscribe();
}

export async function signUp(email: string, password: string): Promise<string> {
  const { data, error } = await cloud().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.href },
  });
  if (error) throw new Error(error.message);
  // With email confirmation on, there is no session until the link is clicked.
  return data.session
    ? 'Account made. Your semester will sync from now on.'
    : 'Check your email for the confirmation link, then come back and sign in. ' +
      'If that link lands on a "localhost refused to connect" page, the confirmation ' +
      'still worked — Supabase verifies before it redirects — so just sign in here. ' +
      '(Whoever runs this deployment can stop that by setting the project\'s Site URL.)';
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await cloud().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/** Google or Apple, when they are switched on in the Supabase dashboard. */
export async function signInWith(provider: 'google' | 'apple'): Promise<void> {
  const { error } = await cloud().auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.href },
  });
  if (error) throw new Error(error.message);
}

export async function sendReset(email: string): Promise<void> {
  const { error } = await cloud().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href,
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await cloud().auth.signOut();
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
  const db = cloud();
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
  const db = cloud();

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
