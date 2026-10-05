/**
 * Disconnecting an account, at the provider as well as here.
 *
 * `forget()` in `lib/connect.ts` deletes this device's copy of a token. Until
 * 29 September 2026 that was all "Disconnect" did, and the screen said "the
 * token is gone from this device" — true, and beside the point: the grant the
 * student gave stayed live at Google or Microsoft, and the refresh token that
 * carries it stayed valid for as long as the provider's own policy allowed.
 *
 * ## Where this runs, and why not on a server
 *
 * These tokens have never left the browser (`connect.ts` says so in its first
 * paragraph, and no table or function holds one — the integration control
 * plane stores secret-manager references, not tokens). Sending a token to a
 * server so the server could revoke it would be the first time one left the
 * device, which is the opposite of the fix. So revocation is called from here,
 * directly to the provider, the same way every other call on the token is.
 *
 * ## What each provider actually allows
 *
 *  - **Google** has a revocation endpoint, `POST oauth2.googleapis.com/revoke`,
 *    that takes the token alone and answers a browser (measured 28 September
 *    2026: a POST with `Origin: https://harrisonjrubin7-cmyk.github.io` came
 *    back with that origin in `access-control-allow-origin`). Revoking the
 *    refresh token withdraws the grant and every access token under it. A 200
 *    is the only answer taken as "revoked".
 *  - **Microsoft** has no endpoint that revokes one app's refresh token.
 *    `POST /me/revokeSignInSessions` exists but needs
 *    `User.RevokeSessions.All`, is not supported for personal accounts, and
 *    signs the student out of *every* app on every device — not something a
 *    Disconnect button should do, and not a permission this app should hold.
 *    So the token is deleted here and the student is told, with the two
 *    places to withdraw the consent themselves.
 *  - **Zoom**'s `/oauth/revoke` needs the client secret in a Basic header, and
 *    **Apple**'s `/auth/revoke` needs a client secret signed with a private
 *    key. Neither can be done from a browser. Same treatment as Microsoft.
 *
 * ## Failure never keeps the token
 *
 * Whatever the provider says — refusal, timeout, a network that is down — the
 * local copy is deleted first-thing-after, in a `finally`. A token kept
 * because the revoke failed is a token nobody can disconnect. The outcome is
 * recorded (without the token) so the card can keep saying what is still
 * permitted at the provider until the student deals with it.
 */

import { PROVIDERS, forget, tokens, type ProviderId, type Token } from './connect';
import { fetchWithin } from './net';

/** Google's token revocation endpoint. */
export const GOOGLE_REVOKE = 'https://oauth2.googleapis.com/revoke';

/** Where a student withdraws the permission themselves. */
export interface ManageLink {
  label: string;
  url: string;
}

export const MANAGE: Record<ProviderId, ManageLink[]> = {
  google: [{ label: 'Google Account → Third-party connections', url: 'https://myaccount.google.com/connections' }],
  microsoft: [
    { label: 'My Apps (work or school account)', url: 'https://myapps.microsoft.com' },
    { label: 'Apps you’ve given access (personal account)', url: 'https://account.live.com/consent/Manage' },
  ],
  zoom: [{ label: 'Zoom App Marketplace → Manage → Added apps', url: 'https://marketplace.zoom.us/user/installed' }],
  apple: [{ label: 'Apple Account → Sign in with Apple', url: 'https://account.apple.com/account/manage' }],
};

/** Why a provider cannot be revoked from here, said plainly. */
const NO_ENDPOINT: Record<Exclude<ProviderId, 'google'>, string> = {
  microsoft: 'Microsoft gives apps no way to withdraw a single sign-in.',
  zoom: 'Zoom only lets an app withdraw a sign-in from a server holding its secret, and this app has none.',
  apple: 'Apple only lets an app withdraw a sign-in from a server holding its signing key, and this app has none.',
};

export type RevokeOutcome =
  /** The provider confirmed the grant is withdrawn. */
  | { provider: ProviderId; status: 'revoked' }
  /** It was tried and did not succeed; the grant may still be live. */
  | { provider: ProviderId; status: 'failed'; reason: string }
  /** This provider offers no revocation a browser app can call. */
  | { provider: ProviderId; status: 'manual'; reason: string };

/**
 * Ask the provider to withdraw the grant behind a token. Never throws.
 *
 * `send` is `fetchWithin` by default and a parameter so a test can stand in
 * for the network.
 */
export async function revokeAtProvider(
  token: Pick<Token, 'provider' | 'access' | 'refresh'>,
  send: typeof fetchWithin = fetchWithin,
): Promise<RevokeOutcome> {
  const provider = token.provider;
  if (provider !== 'google') return { provider, status: 'manual', reason: NO_ENDPOINT[provider] };

  // The refresh token first: revoking it withdraws the grant and every access
  // token under it. The access token second, for a connection that never had
  // a refresh token — Google revokes the grant from either.
  const tries = [...new Set([token.refresh, token.access].filter(Boolean))];
  if (tries.length === 0) return { provider, status: 'failed', reason: 'There was no token to withdraw.' };

  let reason = '';
  for (const value of tries) {
    try {
      const res = await send(GOOGLE_REVOKE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: value }),
      });
      if (res.ok) return { provider, status: 'revoked' };
      reason = `Google answered ${res.status}.`;
    } catch {
      reason = 'Google could not be reached.';
    }
  }
  return { provider, status: 'failed', reason };
}

// ── The record ────────────────────────────────────────────────────────────

const RECORD_KEY = 'semester.revocations.v1';
const RECORD_MAX = 20;

/** One disconnect, as remembered. Never carries a token. */
export interface RevokeRecord {
  provider: ProviderId;
  status: RevokeOutcome['status'];
  reason?: string;
  /** Epoch ms. */
  at: number;
}

export function revocations(): RevokeRecord[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECORD_KEY) ?? '[]') as unknown;
    return Array.isArray(list) ? (list as RevokeRecord[]) : [];
  } catch {
    return [];
  }
}

/** The latest disconnect of a provider, if one was recorded. */
export function lastRevocation(provider: ProviderId): RevokeRecord | undefined {
  return revocations().filter((r) => r.provider === provider).at(-1);
}

function record(outcome: RevokeOutcome, now: number): void {
  const entry: RevokeRecord = {
    provider: outcome.provider,
    status: outcome.status,
    ...(outcome.status === 'revoked' ? {} : { reason: outcome.reason }),
    at: now,
  };
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify([...revocations(), entry].slice(-RECORD_MAX)));
  } catch {
    // Storage refused: the screen still says it, from the returned outcome.
  }
}

// ── Disconnecting ─────────────────────────────────────────────────────────

/**
 * Withdraw the grant where the provider allows it, then delete the local
 * token whatever happened, then record what happened. Never throws.
 */
export async function disconnect(
  provider: ProviderId,
  send: typeof fetchWithin = fetchWithin,
  now: () => number = Date.now,
): Promise<RevokeOutcome> {
  const token = tokens()[provider];
  let outcome: RevokeOutcome = {
    provider,
    status: 'failed',
    reason: 'Nothing was connected here to withdraw.',
  };
  try {
    if (token) outcome = await revokeAtProvider(token, send);
  } finally {
    forget(provider);
  }
  record(outcome, now());
  return outcome;
}

/**
 * Every connected account, disconnected. For "Erase from this device", which
 * removes the tokens and so must withdraw them first. Never throws.
 */
export async function disconnectAll(send: typeof fetchWithin = fetchWithin): Promise<RevokeOutcome[]> {
  const held = Object.keys(tokens()) as ProviderId[];
  return Promise.all(held.map((id) => disconnect(id, send)));
}

/** What to tell the student, in one sentence or two. */
export function saidAboutDisconnect(outcome: Pick<RevokeOutcome, 'provider' | 'status'> & { reason?: string }): string {
  const name = PROVIDERS[outcome.provider].name;
  if (outcome.status === 'revoked') {
    return `${name} disconnected. ${name} confirmed Semester’s access is withdrawn, and the sign-in is gone from this device.`;
  }
  const still = `The sign-in is gone from this device, but ${name} may still list Semester as allowed — remove it there to finish.`;
  if (outcome.status === 'manual') return `${name} disconnected here. ${outcome.reason ?? ''} ${still}`.replace(/\s+/g, ' ');
  return `${name} disconnected here, but withdrawing access at ${name} did not work. ${outcome.reason ?? ''} ${still}`.replace(/\s+/g, ' ');
}
