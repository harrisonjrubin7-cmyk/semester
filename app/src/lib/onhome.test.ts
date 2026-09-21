// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { INSTALL_FIRST, NO_PUSH_HERE, installedFrom, iosFrom, reach, reachFrom } from './onhome';

describe('reachFrom', () => {
  it('is ready wherever push is actually available', () => {
    expect(reachFrom(true, false, false)).toBe('ready');
    expect(reachFrom(true, true, true)).toBe('ready');
  });

  it('tells an iPhone in a tab that the home screen is the way', () => {
    // The case the switch used to answer by drawing nothing at all.
    expect(reachFrom(false, true, false)).toBe('install-first');
  });

  it('does not tell an iPhone already on the home screen to install anything', () => {
    // A page running from the home screen with no push is an iOS too old for
    // it. Telling somebody to add a page they opened from their home screen
    // is the advice that makes a person stop reading the app's advice.
    expect(reachFrom(false, true, true)).toBe('never');
  });

  it('says plainly that a browser which will not do push will not', () => {
    expect(reachFrom(false, false, false)).toBe('never');
    expect(reachFrom(false, false, true)).toBe('never');
  });

  it('never suggests installing where push already works', () => {
    // `pushable` is checked first for exactly this: an installed iPhone that
    // can push must not be sent back round the loop it already completed.
    for (const ios of [true, false]) {
      for (const installed of [true, false]) {
        expect(reachFrom(true, ios, installed)).toBe('ready');
      }
    }
  });
});

describe('iosFrom', () => {
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const IPAD_OLD =
    'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 Version/12.0 Safari/604.1';
  // iPadOS 13 and later report themselves as a Macintosh, deliberately.
  const IPAD_NEW =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  const MAC = IPAD_NEW;
  const ANDROID =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

  it('knows an iPhone', () => {
    expect(iosFrom(IPHONE, 5)).toBe(true);
  });

  it('knows an iPad that still says so', () => {
    expect(iosFrom(IPAD_OLD, 5)).toBe(true);
  });

  it('knows an iPad pretending to be a Mac, by its touch points', () => {
    expect(iosFrom(IPAD_NEW, 5)).toBe(true);
  });

  it('does not mistake a real Mac for one', () => {
    // The control, and the whole reason the touch count is in there. Without
    // it every Mac in the building is told to add a page to its home screen.
    expect(iosFrom(MAC, 0)).toBe(false);
  });

  it('does not mistake an Android phone for one', () => {
    expect(iosFrom(ANDROID, 5)).toBe(false);
  });
});

describe('installedFrom', () => {
  it('takes the standard media query', () => {
    expect(installedFrom(undefined, true)).toBe(true);
  });

  it('takes Safari’s own flag, which predates the standard', () => {
    expect(installedFrom(true, false)).toBe(true);
  });

  it('is false where neither says so', () => {
    expect(installedFrom(undefined, false)).toBe(false);
    expect(installedFrom(false, false)).toBe(false);
  });
});

describe('what it says', () => {
  it('names the gesture rather than telling anybody to install an app', () => {
    // There is no app. What Add to Home Screen produces is this same page.
    expect(INSTALL_FIRST).toContain('Add to Home Screen');
    expect(INSTALL_FIRST).toContain('Share');
    expect(INSTALL_FIRST).not.toMatch(/install|download the app|App Store/i);
  });

  it('does not leave the other case promising nothing', () => {
    // The row is drawn either way now, so the "never" branch has to be worth
    // reading rather than a shorter way of saying nothing.
    expect(NO_PUSH_HERE).toContain('while it is open');
  });
});

describe('reach, reading this browser', () => {
  const ua = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');

  afterEach(() => {
    if (ua) Object.defineProperty(Navigator.prototype, 'userAgent', ua);
  });

  it('passes a working browser straight through', () => {
    expect(reach(true)).toBe('ready');
  });

  it('reads an iPhone off the user agent and asks for the home screen', () => {
    Object.defineProperty(Navigator.prototype, 'userAgent', {
      configurable: true,
      get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
    });
    expect(reach(false)).toBe('install-first');
  });

  it('says never on a browser that is not one', () => {
    // jsdom's own user agent, which is not an iPhone. The control for the
    // test above: a reader that returned 'install-first' unconditionally
    // would pass that one and fail this.
    expect(reach(false)).toBe('never');
  });
});
