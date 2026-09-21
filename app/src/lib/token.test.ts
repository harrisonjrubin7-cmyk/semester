// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { route, routeWhy, saveSettings, settings } from './assistant';
import { setSessionToken, sessionToken } from './token';
import { accountOf } from './cloud';
import type { Session } from '@supabase/supabase-js';

/**
 * The session shape that makes the "impossible" state, and what it comes to.
 *
 * `lib/assistant.ts`'s third case — signed in, shared endpoint present, the
 * assistant has no token — was documented as impossible, on the grounds that
 * `state/store.tsx` sets the account and the token on adjacent lines of one
 * callback. It is not impossible. The two lines read different fields:
 *
 *     setAccount(accountOf(s));                   // needs s.user
 *     setSessionToken(s?.access_token ?? null);   // needs s.access_token
 *
 * so any session with a user and no usable token lands there. That claim cost
 * an investigation: it ruled the store out by assumption and sent the search
 * to the bundle, where `lib/token.ts` turned out to occupy exactly one chunk.
 *
 * ## What each test here is for
 *
 * Only the first is a regression guard — it fails if the normalisation in
 * `setSessionToken` is removed. The rest characterise a reachable state, and
 * exist so that a later change which quietly makes the third case
 * unreachable, or collapses its sentence back into the signed-out one, has to
 * say so here.
 */

const sess = (token: unknown) =>
  ({
    user: { id: 'u1', email: 'a@b.c', app_metadata: { provider: 'email' } },
    access_token: token,
  }) as unknown as Session;

/** What the store does with a session, in the order the store does it. */
const take = (s: Session | null) => {
  const account = accountOf(s);
  setSessionToken(s?.access_token ?? null);
  return account;
};

beforeEach(() => {
  window.localStorage.clear();
  setSessionToken(null);
  vi.unstubAllEnvs();
  // The pair, because `sharedEndpoint()` needs both halves — an address with
  // no key names a function nothing can authenticate to. See `cloudsplit.test.ts`.
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_KEY', 'sb_publishable_test');
  saveSettings({ ...settings(), apiKey: '', proxy: '', provider: 'anthropic' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  setSessionToken(null);
});

describe('an empty token is no token', () => {
  /*
   * The guard. `??` catches null and undefined and not `''`, so without the
   * normalisation in `setSessionToken` this module holds `''` — which every
   * reader treats as falsy except `lib/claude.ts`, which would spell it
   * `Bearer ` into a header. Revert `next || null` to `next` and this is the
   * test that goes red.
   */
  it('stores an empty access_token as null', () => {
    take(sess(''));
    expect(sessionToken()).toBeNull();
  });

  it('stores a real access_token unchanged', () => {
    take(sess('tok-abc'));
    expect(sessionToken()).toBe('tok-abc');
  });
});

describe('the state that was called impossible', () => {
  /*
   * The finding itself, as an assertion: the account is made from the user
   * alone. If `accountOf` ever starts requiring a token this goes red, which
   * is the right moment to revisit the sentence in `assistant.ts`.
   */
  it('makes an account from a session whose token is empty', () => {
    expect(accountOf(sess(''))).toBeTruthy();
    expect(accountOf(sess(undefined))).toBeTruthy();
  });

  it.each([
    ['empty', ''],
    ['missing', undefined],
  ])('leaves a signed-in reader with no route when the token is %s', (_name, token) => {
    const account = take(sess(token));

    expect(account, 'signed in').toBeTruthy();
    expect(sessionToken(), 'and yet no token').toBeNull();
    expect(route()).toBe('none');
    expect(routeWhy(Boolean(account))).toContain('not handed its session to the assistant');
  });

  /*
   * Two controls, because every assertion above is that something is missing.
   *
   * The first: the same session with a real token asks its question and the
   * screen says nothing, so the sentence is a property of the broken state
   * and not of the setup. The second: signed out is a different sentence —
   * a version that collapsed the third case back into "sign in" would pass
   * every other test in this file.
   */
  it('CONTROL: the same session with a real token routes and stays silent', () => {
    const account = take(sess('tok-abc'));
    expect(account).toBeTruthy();
    expect(route()).toBe('shared');
    expect(routeWhy(Boolean(account))).toBe('');
  });

  it('CONTROL: signed out is told something else', () => {
    const account = take(null);
    expect(account).toBeNull();
    expect(route()).toBe('none');

    const out = routeWhy(false);
    expect(out).not.toBe('');
    expect(out).not.toContain('not handed its session to the assistant');
  });
});
