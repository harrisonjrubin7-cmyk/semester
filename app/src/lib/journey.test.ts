import { describe, expect, it } from 'vitest';
import { AREAS, AREA_OF, areaInfo, areaOf, destinationsInArea, type Area } from './journey';
import { DESTINATIONS } from './nav';
import { DEFAULT_TABS } from './tabbar';
import type { Screen } from './types';

/**
 * The journey map is a map beside the registry rather than a field in it, so
 * the completeness a required field would have given is held here instead.
 * `journey.ts` says why.
 */

const registered = DESTINATIONS.map((d) => d.screen);

describe('the journey areas', () => {
  it('are few enough to be a navigation, not a menu', () => {
    // Six areas and the account. An eighth is a sign that a shelf has been
    // copied across instead of a question being answered.
    expect(AREAS.length).toBeLessThanOrEqual(7);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
  });

  it('each ask a question and name one primary action', () => {
    for (const a of AREAS) {
      expect(a.question, a.id).toMatch(/\?$/);
      expect(a.primary.length, a.id).toBeGreaterThan(0);
      expect(areaInfo(a.id)).toBe(a);
    }
  });

  it('each open on a front door that is inside the area', () => {
    for (const a of AREAS) {
      expect(AREA_OF[a.home], `${a.id} opens on ${a.home}`).toBe(a.id);
    }
  });

  it('are none of them empty', () => {
    for (const a of AREAS) {
      expect(destinationsInArea(a.id).length, a.id).toBeGreaterThan(0);
    }
  });
});

describe('every destination', () => {
  it('has exactly one area', () => {
    // If the registry stops parsing into rows this list empties and the test
    // below passes vacuously, which is the one way it fails silently.
    expect(registered.length).toBeGreaterThan(50);
    const missing = registered.filter((s) => AREA_OF[s] === undefined);
    expect(missing, 'add these to AREA_OF in lib/journey.ts').toEqual([]);
  });

  it('and the map names nothing that is not a destination', () => {
    const stale = (Object.keys(AREA_OF) as Screen[]).filter((s) => !registered.includes(s));
    expect(stale, 'remove these from AREA_OF — they are not in lib/nav.ts').toEqual([]);
  });
});

describe('areaOf', () => {
  it('gives a nested screen the area of the root it sits under', () => {
    // A deadline is inside Courses, a flashcard inside Study, a settings page
    // inside Settings; none of them is a destination of its own.
    expect(areaOf('item')).toBe('learn');
    expect(areaOf('drill')).toBe('learn');
    expect(areaOf('setLook')).toBe('you');
    // Not nested anywhere in lib/nav.ts, so named in journey.ts instead.
    expect(areaOf('guess')).toBe('learn');
  });

  it('returns a real area for every screen the tab bar can hold', () => {
    const ids = new Set<Area>(AREAS.map((a) => a.id));
    for (const s of registered) expect(ids.has(areaOf(s)), s).toBe(true);
  });
});

describe('the default bottom bar', () => {
  it('already spans most of the journey', () => {
    // Today, Courses, Study, Calendar and Progress: four areas in five tabs.
    // Help is the one missing, and adding it means taking one of the two
    // Learn tabs away — a decision for a person, recorded in the
    // constitution, not something a test should make. This holds the floor.
    const areas = new Set(DEFAULT_TABS.map(areaOf));
    expect(areas.size).toBeGreaterThanOrEqual(4);
  });
});
