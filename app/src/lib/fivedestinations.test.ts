import { describe, expect, it } from 'vitest';
import { toHash } from './route';
import { SCREENS } from '../screens';
import {
  DEFAULT_TABS,
  FIVE_DESTINATIONS,
  FIVE_LABELS,
  canonicalDestinationFor,
  PINNED,
  barFor,
  barForMode,
  labelForMode,
  litForMode,
  litTab,
  tabLabel,
} from './tabbar';
import type { Screen } from './types';

/**
 * D-003: the five student destinations, drawn over the screens that exist.
 * The first block is the control — with the flag off, nothing may change.
 */

/** Every routable screen: the lazy registry, plus `home`, which App draws itself. */
const SCREEN_IDS = new Set<string>([...Object.keys(SCREENS), 'home']);

const EVERY = { mealPlan: 'both' as const, housing: true, campusMap: true };
const saved: Screen[] = ['home', 'courses', 'study', 'calendar', 'me'];

describe('with the flag off, the bar is exactly what it was', () => {
  it('draws the student’s own bar, with its own words and lighting', () => {
    expect(barForMode(saved, EVERY, 'student', false)).toEqual(barFor(saved, EVERY, 'student'));
    for (const s of [...DEFAULT_TABS, 'degree', 'search'] as Screen[]) {
      expect(labelForMode(s, false), s).toBe(tabLabel(s));
      expect(litForMode('yes', saved, false)).toBe(litTab('yes', saved));
    }
  });
});

describe('with the flag on', () => {
  const five = barForMode(saved, EVERY, 'student', true);

  it('draws Today, My Path, Search, Plan, Me — Me last, as always', () => {
    expect(five).toEqual(FIVE_DESTINATIONS);
    expect(five.map((s) => labelForMode(s, true))).toEqual(['Today', 'My Path', 'Search', 'Plan', 'Me']);
    expect(five.at(-1)).toBe(PINNED);
  });

  it('keeps every id and route as it was', () => {
    for (const s of FIVE_DESTINATIONS) {
      expect(SCREEN_IDS.has(s), s).toBe(true);
      expect(toHash({ screen: s, id: '' })).toBe(`#/${s}`);
    }
    expect(Object.keys(FIVE_LABELS).sort()).toEqual([...FIVE_DESTINATIONS].sort());
  });

  it('lights the destination a nested screen belongs to', () => {
    expect(litForMode('yes', five, true)).toBe('degree');
    expect(litForMode('registrar', five, true)).toBe('degree');
    expect(litForMode('costs', five, true)).toBe('calendar');
    expect(litForMode('behind', five, true)).toBe('home');
    expect(litForMode('ask', five, true)).toBe('search');
    expect(litForMode('settings', five, true)).toBe('me');
    expect(litForMode('university', five, true)).toBe('search');
    expect(litForMode('opportunities', five, true)).toBe('search');
    expect(litForMode('degree', five, true)).toBe('degree');
  });

  it('uses one canonical-home rule outside the navigation component', () => {
    expect(canonicalDestinationFor('guide')).toBe('me');
    expect(canonicalDestinationFor('university')).toBe('search');
    expect(canonicalDestinationFor('yes')).toBe('degree');
    expect(canonicalDestinationFor('calendar')).toBe('calendar');
  });

  it('leaves out a destination the role cannot open, rather than a dead tab', () => {
    const faculty = barForMode(saved, EVERY, 'faculty', true);
    expect(faculty).not.toContain('degree');
    expect(faculty).toEqual(['home', 'search', 'calendar', 'me']);
  });
});
