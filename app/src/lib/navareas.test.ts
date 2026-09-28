import { describe, expect, it } from 'vitest';
import { NAV_AREAS, NAV_AREA_OF, navAreaInfo, navAreaOf, destinationsInNavArea, type NavArea } from './navareas';
import { DESTINATIONS } from './nav';
import { DEFAULT_TABS } from './tabbar';
import type { Screen } from './types';

/**
 * The journey map is a map beside the registry rather than a field in it, so
 * the completeness a required field would have given is held here instead.
 * `navareas.ts` says why.
 */

const registered = DESTINATIONS.map((d) => d.screen);

describe('the journey areas', () => {
  it('are few enough to be a navigation, not a menu', () => {
    // Six areas and the account. An eighth is a sign that a shelf has been
    // copied across instead of a question being answered.
    expect(NAV_AREAS.length).toBeLessThanOrEqual(7);
    expect(new Set(NAV_AREAS.map((a) => a.id)).size).toBe(NAV_AREAS.length);
  });

  it('each ask a question and name one primary action', () => {
    for (const a of NAV_AREAS) {
      expect(a.question, a.id).toMatch(/\?$/);
      expect(a.primary.length, a.id).toBeGreaterThan(0);
      expect(navAreaInfo(a.id)).toBe(a);
    }
  });

  it('each open on a front door that is inside the area', () => {
    for (const a of NAV_AREAS) {
      expect(NAV_AREA_OF[a.home], `${a.id} opens on ${a.home}`).toBe(a.id);
    }
  });

  it('are none of them empty', () => {
    for (const a of NAV_AREAS) {
      expect(destinationsInNavArea(a.id).length, a.id).toBeGreaterThan(0);
    }
  });
});

describe('every destination', () => {
  it('has exactly one area', () => {
    // If the registry stops parsing into rows this list empties and the test
    // below passes vacuously, which is the one way it fails silently.
    expect(registered.length).toBeGreaterThan(50);
    const missing = registered.filter((s) => NAV_AREA_OF[s] === undefined);
    expect(missing, 'add these to NAV_AREA_OF in lib/navareas.ts').toEqual([]);
  });

  it('and the map names nothing that is not a destination', () => {
    const stale = (Object.keys(NAV_AREA_OF) as Screen[]).filter((s) => !registered.includes(s));
    expect(stale, 'remove these from NAV_AREA_OF — they are not in lib/nav.ts').toEqual([]);
  });
});

describe('navAreaOf', () => {
  it('gives a nested screen the area of the root it sits under', () => {
    // A deadline is inside Courses, a flashcard inside Study, a settings page
    // inside Settings; none of them is a destination of its own.
    expect(navAreaOf('item')).toBe('learn');
    expect(navAreaOf('drill')).toBe('learn');
    expect(navAreaOf('setLook')).toBe('you');
    // Not nested anywhere in lib/nav.ts, so named in navareas.ts instead.
    expect(navAreaOf('guess')).toBe('learn');
  });

  it('returns a real area for every screen the tab bar can hold', () => {
    const ids = new Set<NavArea>(NAV_AREAS.map((a) => a.id));
    for (const s of registered) expect(ids.has(navAreaOf(s)), s).toBe(true);
  });
});

describe('the default bottom bar', () => {
  it('is the front doors of Today, Plan, Learn, Help and Progress', () => {
    // One tab per area and no area twice. Campus and You are one tap away in
    // the launcher; the bar holds the five a day runs through.
    expect(DEFAULT_TABS.map(navAreaOf)).toEqual(['today', 'plan', 'learn', 'help', 'progress']);
    for (const s of DEFAULT_TABS) expect(navAreaInfo(navAreaOf(s)).home, s).toBe(s);
  });
});
