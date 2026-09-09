import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CLAIMS } from './privacy';

/**
 * Signed out, nothing leaves the device.
 *
 * `lib/privacy.ts` says it in as many words, on a screen about rights: "Signed
 * out, nothing leaves the device at all — no courses, no grades, no notes, no
 * analytics." Two screens can break that promise, because two screens are
 * about other people and therefore talk to the account service: Classmates and
 * Group work.
 *
 * Group work was breaking it. Measured in a browser, signed out, walking the
 * app screen by screen with every request recorded: four GETs to the account
 * service the moment it opened, and nothing from anywhere else in the app.
 *
 * The cause is a shape that looks safe and is not. The screen refuses to draw
 * without an account — its sign-in panel says "a group is other people, so it
 * needs an account" — but that `return` comes *after* the hooks, because a
 * component cannot return before its effects are declared. So the effect fired
 * on the way to a screen that renders nothing, and the request went out while
 * the person was being told the screen does nothing without an account.
 *
 * `Classmates` had the guard inside its loader and was already right.
 *
 * ## Why this is read from the source
 *
 * Measuring it properly needs a browser and a network log, which is how it was
 * found and is not something a unit test can hold. What a test can hold is the
 * guard itself: every loader that reaches the account service checks for one
 * before it does. That is the thing that regressed, and it is the thing that
 * would regress again.
 */

const screens = {
  'Group work': readFileSync('src/screens/Groupwork.tsx', 'utf8'),
  Classmates: readFileSync('src/screens/Classmates.tsx', 'utf8'),
};

/**
 * Everything each screen calls that leaves the device.
 *
 * Named rather than matched by shape: these are the functions in
 * `lib/classmates.ts` that open a request, and a new one added to a loader
 * should be added here too.
 */
const REACHES_OUT = /\b(groupsIn|membersOf|partsOf|myProfile|myRooms)\s*\(/;

describe('the promise on the privacy screen', () => {
  it('is still the promise being made', () => {
    // If this sentence is ever softened, the tests below are guarding a claim
    // the app no longer makes, and somebody should decide that on purpose.
    const said = CLAIMS.map((c) => c.body).join(' ');
    expect(said).toContain('Signed out, nothing leaves the device at all');
  });
});

describe('a screen that needs an account', () => {
  for (const [name, source] of Object.entries(screens)) {
    it(`${name} checks for one before it asks the server for anything`, () => {
      // Read as "what comes just before the call", rather than by parsing the
      // callback around it: the guard is one line above the request in both
      // screens, and a shape-matching test that breaks on a line wrap is a
      // test somebody deletes rather than fixes.
      const calls = [...source.matchAll(new RegExp(REACHES_OUT, 'g'))];
      expect(calls.length, `${name} should have at least one call to check`).toBeGreaterThan(0);
      for (const call of calls) {
        const before = source.slice(Math.max(0, call.index - 400), call.index);
        expect(
          before,
          `${name} calls ${call[1]}() with no account check in the 400 characters before it`,
        ).toMatch(/if \(!\s*account\b/);
      }
    });

    it(`${name} says so on screen rather than failing quietly`, () => {
      expect(source).toMatch(/if \(!account\)/);
    });
  }
});
