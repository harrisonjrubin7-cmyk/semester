import { describe, expect, it } from 'vitest';
import { PULL_MAX, PULL_TO_FIRE, fires, pullLabel, pulled, said, whenAgo, type Outcome } from './refresh';

const NOW = 1_788_000_000_000;
const MIN = 60_000;

const out = (over: Partial<Outcome>): Outcome => ({
  cloud: true,
  signedIn: true,
  took: false,
  courses: 0,
  error: '',
  at: 0,
  ...over,
});

describe('saying what came of it', () => {
  it('says so when nothing was new', () => {
    // "Nothing new" is a real answer. A refresh that spins and then shows
    // exactly what it showed before leaves the user guessing whether it found
    // nothing or failed silently, and those are very different facts.
    expect(said(out({}), NOW)).toContain('Nothing new');
  });

  it('says what it took, and how many courses came with it', () => {
    const line = said(out({ took: true, courses: 4, at: NOW - 5 * MIN }), NOW);
    expect(line).toContain('4 courses');
    expect(line).toContain('5 minutes ago');
  });

  it('counts one course as one', () => {
    expect(said(out({ took: true, courses: 1, at: NOW }), NOW)).toContain('1 course.');
  });

  it('does not invent a count it does not have', () => {
    const line = said(out({ took: true, courses: 0, at: NOW }), NOW);
    expect(line).toContain('Took a newer copy');
    expect(line).not.toContain('0 courses');
  });
});

describe('what it refuses to claim', () => {
  it('never says "up to date" on a device with no account', () => {
    // A phone with no account is not up to date with anything, and saying it
    // is, is the exact failure that makes people stop trusting an indicator.
    const line = said(out({ signedIn: false }), NOW);
    expect(line).toContain('Not signed in');
    expect(line.toLowerCase()).not.toContain('up to date');
    expect(line.toLowerCase()).not.toContain('nothing new');
  });

  it('says a build with no account service has nothing to check', () => {
    expect(said(out({ cloud: false, signedIn: false }), NOW)).toContain('this device only');
  });

  it('reports a failed check as a failure, not as nothing found', () => {
    const line = said(out({ error: 'The account service did not answer.' }), NOW);
    expect(line).toContain('Could not check');
    expect(line).toContain('did not answer');
  });

  it('lets the error win over everything else', () => {
    // Otherwise a check that failed after taking a partial copy would report
    // the good half and hide the bad one.
    expect(said(out({ took: true, courses: 4, error: 'Offline.' }), NOW)).toContain('Could not check');
  });
});

describe('how long ago, coarsely', () => {
  it('calls anything within a couple of minutes "just now"', () => {
    // "Updated 4 minutes ago" and "updated just now" mean the same thing to
    // somebody deciding whether to trust the screen.
    expect(whenAgo(NOW, NOW)).toBe('just now');
    expect(whenAgo(NOW - 90_000, NOW)).toBe('just now');
  });

  it('counts minutes, then hours, then days', () => {
    expect(whenAgo(NOW - 20 * MIN, NOW)).toBe('20 minutes ago');
    expect(whenAgo(NOW - 3 * 60 * MIN, NOW)).toBe('3 hours ago');
    expect(whenAgo(NOW - 50 * 60 * MIN, NOW)).toBe('2 days ago');
  });

  it('says one hour and one day in the singular', () => {
    expect(whenAgo(NOW - 60 * MIN, NOW)).toBe('1 hour ago');
    expect(whenAgo(NOW - 24 * 60 * MIN, NOW)).toBe('1 day ago');
  });
});

describe('the drag', () => {
  it('goes nowhere until the finger moves', () => {
    expect(pulled(0)).toBe(0);
    expect(pulled(-40)).toBe(0);
  });

  it('resists, so the end of the pull can be felt', () => {
    // The first pixels move nearly one-for-one and the last barely move.
    const early = pulled(10) / 10;
    const late = (pulled(200) - pulled(190)) / 10;
    expect(early).toBeGreaterThan(late);
  });

  it('never draws past its limit however hard it is pulled', () => {
    expect(pulled(10_000)).toBeLessThanOrEqual(PULL_MAX);
  });

  it('does not fire on a flick past the top of a list', () => {
    expect(fires(8)).toBe(false);
    expect(pullLabel(8)).toBe('Pull to check');
  });

  it('fires once it has been pulled far enough, and says so first', () => {
    const far = 400;
    expect(pulled(far)).toBeGreaterThanOrEqual(PULL_TO_FIRE);
    expect(fires(far)).toBe(true);
    expect(pullLabel(far)).toBe('Let go to check');
  });

  it('can actually be reached', () => {
    // A threshold above the maximum draw would be a gesture that never fires.
    expect(PULL_TO_FIRE).toBeLessThan(PULL_MAX);
  });
});
