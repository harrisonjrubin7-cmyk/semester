/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iceServers } from './rtc';

/**
 * A relay is three settings, and the screens were promised it by one.
 *
 * `VITE_TURN_URL`, `VITE_TURN_USER` and `VITE_TURN_PASS` are one setting in
 * three parts — `SETUP.md` documents them together and `rtc.ts`'s own header
 * calls them "point at one if you have one". TURN authenticates every
 * allocation, so an address with no credential is a server that answers and
 * then refuses.
 *
 * `relayed` was `Boolean(VITE_TURN_URL)`. `screens/call/Lobby.tsx` reads it to
 * say
 *
 *   > A relay is configured, so a network that refuses a direct connection
 *   > still works.
 *
 * and `screens/call/Green.tsx` to say the call "should hold up" on one. Both
 * are read by somebody who is on such a network at the time, which is the one
 * moment the sentence carries weight — and with a half-set trio both were
 * false, while the other branch of the same sentence would have been true and
 * useful.
 *
 * Neither `relayed` nor `iceServers()` had a test before this.
 */

const URL_ = 'turns:turn.example.com:5349';

beforeEach(() => {
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** Set some or all of the trio; anything omitted is left unset. */
function turn(parts: { url?: string; user?: string; pass?: string }) {
  if (parts.url !== undefined) vi.stubEnv('VITE_TURN_URL', parts.url);
  if (parts.user !== undefined) vi.stubEnv('VITE_TURN_USER', parts.user);
  if (parts.pass !== undefined) vi.stubEnv('VITE_TURN_PASS', parts.pass);
}

const relayEntry = () => iceServers().find((s) => String(s.urls).includes('turn'));

describe('the relay the call screens are told about', () => {
  it('is there when all three parts are', () => {
    turn({ url: URL_, user: 'u', pass: 'p' });
    expect(relayEntry()).toEqual({ urls: [URL_], username: 'u', credential: 'p' });
  });

  /*
   * The guard. Revert `turnServer()` to the address alone and each of these
   * goes red, because the entry comes back with an empty credential — the
   * shape the browser sends and the server rejects.
   */
  it.each([
    ['no credential', { url: URL_, user: 'u' }],
    ['no username', { url: URL_, pass: 'p' }],
    ['neither', { url: URL_ }],
    ['blank credential', { url: URL_, user: 'u', pass: '   ' }],
    ['blank username', { url: URL_, user: '  ', pass: 'p' }],
  ])('is not there with %s', (_name, parts) => {
    turn(parts);
    expect(relayEntry()).toBeUndefined();
  });

  it('is not there when nothing is set', () => {
    expect(relayEntry()).toBeUndefined();
  });

  /*
   * Two controls, because every assertion above is that something is absent.
   *
   * STUN has to survive all of it — it is the part that costs nobody anything
   * and works without configuration, and a `turnServer()` that returned null
   * by dropping the whole list would satisfy every case above.
   */
  it('CONTROL: STUN is there in every one of those cases', () => {
    for (const parts of [{}, { url: URL_ }, { url: URL_, user: 'u' }, { url: URL_, user: 'u', pass: 'p' }]) {
      vi.unstubAllEnvs();
      turn(parts);
      const stun = iceServers().find((s) => String(s.urls).includes('stun'));
      expect(stun, JSON.stringify(parts)).toBeTruthy();
    }
  });

  it('CONTROL: a comma-separated pair of relay addresses still arrives as two', () => {
    turn({ url: `${URL_},turn:turn2.example.com:3478`, user: 'u', pass: 'p' });
    expect(relayEntry()?.urls).toEqual([URL_, 'turn:turn2.example.com:3478']);
  });
});

/**
 * `relayed` is a module constant, read at import, so it cannot be restubbed
 * per case here. What can be checked is that it is the same question as the
 * entry above rather than a second reading of the environment — which is the
 * form the defect took.
 */
describe('and the sentence and the server are one answer', () => {
  const src = readFileSync(new URL('./rtc.ts', import.meta.url), 'utf8');

  it('derives the promise from the server, not from the address', () => {
    expect(src).toMatch(/export const relayed = Boolean\(turnServer\(\)\)/);
    expect(src, 'the address alone is what over-promised').not.toMatch(
      /export const relayed = Boolean\(\(env\.VITE_TURN_URL/,
    );
  });

  it('CONTROL: the file still reads all three names', () => {
    // A `turnServer()` that stopped reading the credentials would satisfy the
    // assertion above while reintroducing the fault.
    for (const name of ['VITE_TURN_URL', 'VITE_TURN_USER', 'VITE_TURN_PASS']) {
      expect(src, `${name} is no longer read`).toContain(name);
    }
  });
});

/** And the deploy, which is where a half-set trio would come from. */
describe('the deploy refuses a partial relay', () => {
  const pages = readFileSync(new URL('../../../.github/workflows/pages.yml', import.meta.url), 'utf8');

  it('counts the three and fails on one or two', () => {
    expect(pages).toContain('turn_set');
    expect(pages).toMatch(/"\$turn_set" -ne 0 \] && \[ "\$turn_set" -ne 3/);
  });

  it('exits rather than only noting it', () => {
    const at = pages.indexOf('"$turn_set" -ne 0');
    expect(pages.slice(at, at + 400)).toContain('exit 1');
  });
});
