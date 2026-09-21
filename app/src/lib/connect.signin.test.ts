/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROVIDERS, signInReady, type ProviderId, type ProviderSpec } from './connect';

/**
 * A sign-in offered on half its setting, and spent before it fails.
 *
 * Zoom's API sends no CORS headers and Apple's client secret is a JWT signed
 * with a private key, so both providers can only finish a token exchange
 * through `VITE_OAUTH_PROXY`. `needsProxy` on the spec has said so since they
 * were added, `.env.example` calls the proxy the thing Zoom "needs", and
 * `SETUP.md` says Apple needs it "to sign the client secret".
 *
 * `screens/Connect.tsx` asked `spec.clientId` alone. With the ID set and no
 * proxy it drew "Sign in with Zoom", sent the student to Zoom's consent
 * screen, and failed on the way back — consent granted for nothing. The other
 * branch of the same sentence was true and useful: not switched on in this
 * copy, add the .ics instead.
 *
 * Nothing tested `signInReady`'s question before this, in either half.
 */

/** A spec with only the two fields the question reads; the rest is scenery. */
function spec(parts: { clientId: string; needsProxy: boolean }): ProviderSpec {
  return {
    id: 'zoom',
    name: 'Test',
    blurb: '',
    authorizeUrl: 'https://example.com/authorize',
    tokenUrl: 'https://example.com/token',
    scopes: '',
    calendar: true,
    ...parts,
  };
}

describe('whether a sign-in can finish, not just start', () => {
  it('is offered when a provider that needs no proxy has a client ID', () => {
    expect(signInReady(spec({ clientId: 'abc', needsProxy: false }), '')).toBe(true);
  });

  it('is offered when a provider that needs one has both', () => {
    expect(signInReady(spec({ clientId: 'abc', needsProxy: true }), '/oauth')).toBe(true);
  });

  /*
   * The guard. Drop the `needsProxy` half of `signInReady` and this goes red:
   * a client ID alone reads as ready, which is the button that spends a
   * student's consent and then fails the exchange.
   */
  it('is not offered when a provider that needs one has no proxy', () => {
    expect(signInReady(spec({ clientId: 'abc', needsProxy: true }), '')).toBe(false);
  });

  /*
   * The other half, which was never the bug but is now load-bearing: drop the
   * `clientId` half and this goes red instead.
   */
  it.each([
    ['needs a proxy', true],
    ['does not', false],
  ])('is not offered without a client ID, whether it %s', (_what, needsProxy) => {
    expect(signInReady(spec({ clientId: '', needsProxy }), '/oauth')).toBe(false);
  });

  /*
   * A control. Every negative case above is satisfied by a `signInReady` that
   * returns `false` for everything, which would take the sign-in away from
   * Microsoft and Google as well — the two providers this app can talk to
   * with no proxy at all, and the ones a student is most likely to have.
   */
  it('still offers the two providers that need no proxy, on a build with none', () => {
    const direct = (['microsoft', 'google'] as ProviderId[]).map((id) => ({
      ...PROVIDERS[id],
      clientId: 'abc',
    }));
    expect(direct.map((s) => signInReady(s, ''))).toEqual([true, true]);
  });
});

describe('the flags the question is asked about', () => {
  /*
   * A control on the specs rather than the helper. `signInReady` is only worth
   * anything if `needsProxy` is still true for the providers that cannot do
   * without one — a spec edited to `false` would make every case above pass
   * while putting the failing button back on the screen.
   */
  it.each([
    ['zoom', true],
    ['apple', true],
    ['google', false],
    ['microsoft', false],
  ])('has %s needing a proxy: %s', (id, needs) => {
    expect(PROVIDERS[id as ProviderId].needsProxy).toBe(needs);
  });

  /*
   * And a structural check on the screen, which is where the fault was. A
   * runtime test of this file cannot see `screens/Connect.tsx` go back to
   * asking `spec.clientId` on its own, and that regression is the whole bug.
   */
  it('has the screen asking the helper rather than the client ID alone', () => {
    const screen = readFileSync(new URL('../screens/Connect.tsx', import.meta.url), 'utf8');
    expect(screen).toContain('signInReady(spec)');
    expect(screen).not.toMatch(/\{!spec\.clientId \?/);
  });
});

describe('the deploy that would build the failing button', () => {
  const pages = readFileSync(new URL('../../../.github/workflows/pages.yml', import.meta.url), 'utf8');

  /*
   * `signInReady` keeps the button off the screen, which is the student's
   * half. This is the deployer's: a build configured that way is a mistake
   * somebody should hear about while they still have the settings open,
   * rather than a provider quietly missing from Connect.
   */
  it('refuses a proxy-needing client ID with no proxy', () => {
    expect(pages).toContain('VITE_OAUTH_PROXY');
    expect(pages).toMatch(/-z "\$VITE_OAUTH_PROXY"/);
    expect(pages).toContain('VITE_ZOOM_CLIENT_ID');
    expect(pages).toContain('VITE_APPLE_CLIENT_ID');
  });

  it('exits rather than only noting it', () => {
    const at = pages.indexOf('-z "$VITE_OAUTH_PROXY"');
    expect(at).toBeGreaterThan(-1);
    expect(pages.slice(at, at + 700)).toContain('exit 1');
  });

  /*
   * A control. Both names appearing somewhere in a 300-line workflow proves
   * nothing on its own — they are passed to the build a hundred lines above.
   * This is the check that they appear inside the guard.
   */
  it('names them inside the guard rather than only in the build env', () => {
    const at = pages.indexOf('-z "$VITE_OAUTH_PROXY"');
    const guard = pages.slice(at, at + 700);
    expect(guard).toContain('VITE_ZOOM_CLIENT_ID');
    expect(guard).toContain('VITE_APPLE_CLIENT_ID');
    expect(guard).not.toContain('VITE_GOOGLE_CLIENT_ID');
  });
});
