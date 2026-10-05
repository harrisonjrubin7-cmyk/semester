// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { RETURN_KEY, RETURN_MS, rememberReturn, returnPoint, takeReturn } from './returnto';

/**
 * Where a sign-in that left the page puts somebody back.
 *
 * The provider returns the tab to the bare app address — it has to, the
 * redirect must match the allowlist exactly — so the place is written down
 * before leaving and taken on the way back. See `lib/returnto.ts`.
 */

afterEach(() => localStorage.clear());

describe('returnPoint', () => {
  it('is where the student is, when that is a place', () => {
    expect(returnPoint('#/calendar', [])).toBe('#/calendar');
  });

  it('keeps what the place is about', () => {
    expect(returnPoint('#/guide/econ?mode=learn', [])).toBe('#/guide/econ?mode=learn');
  });

  it('is the screen before Account, when the student is on Account to sign in', () => {
    // The usual case: signing in is done from Account, and Account is the
    // form they just finished, not where they were.
    expect(returnPoint('#/account', ['home', 'mail'])).toBe('#/mail');
  });

  it('skips back past every sign-in screen in the history', () => {
    expect(returnPoint('#/account', ['mail', 'connect', 'account'])).toBe('#/mail');
  });

  it('is nothing when there is nowhere better than the first screen', () => {
    expect(returnPoint('#/onboarding', [])).toBeNull();
    expect(returnPoint('', [])).toBeNull();
  });
});

describe('takeReturn', () => {
  const at = 1_800_000_000_000;

  it('gives back what was remembered — the control', () => {
    rememberReturn('#/calendar', at);
    expect(takeReturn(at + 60_000)).toBe('#/calendar');
  });

  it('gives it back once', () => {
    rememberReturn('#/calendar', at);
    takeReturn(at + 1);
    expect(takeReturn(at + 2)).toBeNull();
    expect(localStorage.getItem(RETURN_KEY)).toBeNull();
  });

  it('drops it once stale, and still removes it', () => {
    rememberReturn('#/calendar', at);
    expect(takeReturn(at + RETURN_MS + 1)).toBeNull();
    expect(localStorage.getItem(RETURN_KEY)).toBeNull();
  });

  it('drops one stamped in the future, which is a clock that moved and not a trip', () => {
    rememberReturn('#/calendar', at);
    expect(takeReturn(at - 1)).toBeNull();
  });

  it('drops an address the router no longer knows', () => {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ hash: '#/no-such-screen', at }));
    expect(takeReturn(at + 1)).toBeNull();
  });

  it('never sends somebody back to a sign-in screen, whatever was stored', () => {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ hash: '#/account', at }));
    expect(takeReturn(at + 1)).toBeNull();
  });

  it('shrugs at something that is not what it wrote', () => {
    localStorage.setItem(RETURN_KEY, 'not json');
    expect(takeReturn(at)).toBeNull();
    localStorage.setItem(RETURN_KEY, JSON.stringify({ hash: 7, at }));
    expect(takeReturn(at)).toBeNull();
  });

  it('writes nothing for nowhere', () => {
    rememberReturn(null, at);
    expect(localStorage.getItem(RETURN_KEY)).toBeNull();
  });
});
