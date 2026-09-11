import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE, ROLES, forRole, hiddenFrom, pickable, roleOf, type Role } from './role';
import { DESTINATIONS, destinationsFor, offered } from './nav';
import type { Capabilities } from './school';

/** A school that offers everything, so only the role gate is under test. */
const EVERY: Capabilities = {
  mealPlan: 'both',
  housing: true,
  campusMap: true,
  registrarUrl: 'https://example.invalid',
  orgPortalUrl: 'https://example.invalid',
};

describe('the roles the app admits to', () => {
  it('opens as a student, which is every stored copy that predates this', () => {
    expect(DEFAULT_ROLE).toBe('student');
    expect(roleOf('student').ready).toBe(true);
  });

  it('offers only the two it can actually serve', () => {
    expect(pickable().map((r) => r.id)).toEqual(['student', 'faculty']);
  });

  /*
   * The line this file is drawn on. A role that reads only its own data works
   * today because that is the shape the whole app has; a role that reads
   * somebody else's needs a server, an identity on both sides and an
   * authorisation model, and the app has none of the three. Offering one
   * anyway would be a screen that looks right and holds only what you typed
   * into it.
   */
  it('says what each unready role is waiting on, rather than hiding it', () => {
    for (const r of ROLES.filter((r) => !r.ready)) {
      expect(r.needs.length, r.id).toBeGreaterThan(30);
    }
  });

  it('gives every role a blurb and a distinct id', () => {
    expect(new Set(ROLES.map((r) => r.id)).size).toBe(ROLES.length);
    for (const r of ROLES) expect(r.blurb.length, r.id).toBeGreaterThan(20);
  });

  it('falls back rather than returning undefined for a role it never heard of', () => {
    // A stored role from a later build reaches this. Hiding every screen it
    // does not name would open the app on an empty directory.
    expect(roleOf('vice-chancellor').id).toBe('student');
    expect(roleOf('').id).toBe('student');
  });
});

describe('what each role sees', () => {
  it('shows a student everything the school offers', () => {
    expect(hiddenFrom('student')).toEqual([]);
    expect(offered(EVERY, 'student')).toHaveLength(DESTINATIONS.length);
  });

  it('hides what is nonsense addressed to somebody teaching', () => {
    const hidden = hiddenFrom('faculty');
    for (const s of ['degree', 'runway', 'meals', 'housing', 'yes', 'costs']) {
      expect(hidden, s).toContain(s);
      expect(forRole(s, 'faculty')).toBe(false);
    }
  });

  /*
   * `me` reads as "Progress" and is also the app's directory — the way to
   * every other screen under three of the four navigations. Hiding it would
   * take out a navigation surface to tidy a heading.
   */
  it('keeps the directory, whatever the heading on it says', () => {
    expect(forRole('me', 'faculty')).toBe(true);
  });

  it('keeps the screens somebody teaching would actually use', () => {
    for (const s of ['import', 'edit', 'calendar', 'registrar', 'write', 'deck', 'exam', 'mail']) {
      expect(forRole(s, 'faculty'), s).toBe(true);
    }
  });

  // A screen added later and forgotten in the table stays visible rather than
  // vanishing for every role but one.
  it('shows an unnamed screen to everybody, which is the safe direction', () => {
    expect(forRole('a-screen-added-next-year', 'faculty')).toBe(true);
  });

  it('leaves a real tool rather than a handful of screens', () => {
    const left = offered(EVERY, 'faculty');
    expect(left.length).toBe(DESTINATIONS.length - hiddenFrom('faculty').length);
    expect(left.length).toBeGreaterThan(30);
  });
});

describe('the gate composes with the school’s, and neither un-hides the other', () => {
  const NO_CAMPUS: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };

  it('hides a screen either gate hides, whichever way round', () => {
    // `meals` is hidden by both here; `maps` by the school alone; `degree` by
    // the role alone.
    const seen = new Set(offered(NO_CAMPUS, 'faculty').map((d) => d.screen as string));
    expect(seen.has('meals')).toBe(false);
    expect(seen.has('maps')).toBe(false);
    expect(seen.has('degree')).toBe(false);
  });

  it('cannot let a role un-hide what the school hid', () => {
    for (const role of ['student', 'faculty'] as Role[]) {
      expect(offered(NO_CAMPUS, role).some((d) => d.screen === 'maps')).toBe(false);
    }
  });

  it('applies inside a shelf as well as across all of them', () => {
    const campus = destinationsFor('Campus', EVERY, 'faculty').map((d) => d.screen as string);
    expect(campus).not.toContain('meals');
    expect(campus).not.toContain('housing');
    expect(destinationsFor('Campus', EVERY, 'student').map((d) => d.screen as string)).toContain('meals');
  });

  it('defaults to the student everywhere, so an unpassed role changes nothing', () => {
    expect(offered(EVERY)).toEqual(offered(EVERY, 'student'));
    expect(destinationsFor('Campus', EVERY)).toEqual(destinationsFor('Campus', EVERY, 'student'));
  });
});
