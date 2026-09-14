// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { PENDING_KEY, redirected } from './redirected';

/**
 * The guard in front of `lib/connect.ts`.
 *
 * Its whole value is that it answers the same question `completeAuth` asks,
 * without loading the module that asks it. So the thing to hold it to is
 * agreement: every case where `completeAuth` would do work must be a `true`
 * here, and every case where it would return `null` must be a `false`. A
 * stricter guard drops a real sign-in; a looser one loads 1,616 lines for
 * nothing, which is the cost this exists to remove.
 */
describe('redirected', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const pending = () =>
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ id: 'google', verifier: 'v', state: 's' }));

  it('is true for a code that a pending request is waiting for', () => {
    pending();
    expect(redirected('?code=abc&state=s')).toBe(true);
  });

  it('is true for a refusal, which still has a note to leave behind', () => {
    pending();
    expect(redirected('?error=access_denied')).toBe(true);
  });

  it('is false on an ordinary cold start — the case that pays for this', () => {
    expect(redirected('')).toBe(false);
  });

  it('is false for a code with no request behind it', () => {
    // Somebody else's query string: a share link, a deep link, a stray
    // parameter. There is nothing to exchange it for.
    expect(redirected('?code=abc')).toBe(false);
  });

  it('is false for a pending request that has not come back yet', () => {
    pending();
    expect(redirected('?screen=study')).toBe(false);
  });
});
