import { describe, expect, it } from 'vitest';
import {
  FOCUS,
  KEPT_IN_FOCUS,
  NONESSENTIAL,
  SET_ASIDE,
  essentialOnly,
  focusLine,
  focusOf,
  focused,
  inFocus,
  inFocusMode,
  setAside,
} from './focus';
import { ALWAYS_TO_HAND, DESTINATIONS, GROUPS, destination } from './nav';
import { DOCK } from './springboard';
import { DEFAULT_TABS } from './tabbar';
import { DEFAULT_FAVOURITES } from './desk';
import { DEFAULT_NOTIFS, NOTIF_DEFS } from '../data/misc';

/**
 * Focus, held against the registry it filters.
 *
 * Every case here reads `DESTINATIONS` rather than a fixture, because the
 * question is not whether the filter works on three made-up rows — it is
 * whether the term's screens survive it and the campus's do not, in the
 * registry as it stands today, and the registry is edited months apart from
 * this file.
 */

const on = (rows = DESTINATIONS) => focused(rows, 'on');
const byScreen = (s: string) => {
  const d = destination(s as never);
  if (!d) throw new Error(`${s} is not in the registry`);
  return d;
};

describe('the setting', () => {
  it('is off unless it says on, so a value from a future build cannot hide three shelves', () => {
    expect(focusOf('on')).toBe('on');
    expect(focusOf('off')).toBe('off');
    expect(focusOf(undefined)).toBe('off');
    expect(focusOf('finals')).toBe('off');
    expect(inFocusMode('on')).toBe(true);
    expect(inFocusMode('off')).toBe(false);
    expect(FOCUS.map((f) => f.id)).toEqual(['off', 'on']);
  });

  it('is a no-op while off — the same array back, so a memo over it holds', () => {
    expect(focused(DESTINATIONS, 'off')).toBe(DESTINATIONS);
    expect(focused(DESTINATIONS, undefined)).toBe(DESTINATIONS);
    expect(setAside(DESTINATIONS, 'off')).toBe(0);
  });
});

describe('what stays', () => {
  it('keeps every shelf that is this term, whole', () => {
    for (const g of GROUPS.filter((g) => !SET_ASIDE.includes(g))) {
      const shelf = DESTINATIONS.filter((d) => d.group === g);
      expect(on(shelf)).toEqual(shelf);
    }
  });

  it('keeps the five things experience §377 names: classes, deadlines, study, the calendar, documents', () => {
    for (const s of ['courses', 'home', 'calendar', 'study', 'write', 'deck', 'sources', 'work']) {
      expect(inFocus(byScreen(s))).toBe(true);
    }
  });

  it('never sets aside anything the chrome is made of', () => {
    // A tab, a dock icon or a shortcut pointing at a screen the directory
    // has set aside would be the app arguing with itself, in the one row
    // that is always on screen.
    for (const s of [...ALWAYS_TO_HAND, ...DEFAULT_TABS, ...DOCK, ...DEFAULT_FAVOURITES]) {
      expect(inFocus(byScreen(s)), s).toBe(true);
    }
  });

  it('keeps the two named exceptions, and each is an exception to something', () => {
    for (const s of KEPT_IN_FOCUS) {
      const d = byScreen(s);
      expect(inFocus(d), s).toBe(true);
      // On a shelf that is set aside — or the name in the list is dead and the
      // sentence in the header about it is a lie.
      expect(SET_ASIDE.includes(d.group), `${s} is on ${d.group}, which is not set aside`).toBe(true);
    }
  });
});

describe('what waits', () => {
  it('sets aside the campus, social and after-the-degree screens the spec names', () => {
    for (const s of ['classmates', 'activities', 'groupwork', 'meals', 'housing', 'maps', 'career', 'athletics', 'nil', 'family', 'pathway', 'applying']) {
      expect(inFocus(byScreen(s)), s).toBe(false);
    }
  });

  it('sets aside a real number of screens, and counts them the same way twice', () => {
    const kept = on();
    expect(kept.length).toBeLessThan(DESTINATIONS.length);
    expect(kept.length).toBeGreaterThan(DESTINATIONS.length / 2);
    expect(setAside(DESTINATIONS, 'on')).toBe(DESTINATIONS.length - kept.length);
    // Every set-aside screen is on a set-aside shelf and not an exception:
    // the two lists above are the whole rule, and nothing else decides.
    for (const d of DESTINATIONS.filter((d) => !kept.includes(d))) {
      expect(SET_ASIDE.includes(d.group)).toBe(true);
      expect(KEPT_IN_FOCUS.includes(d.screen)).toBe(false);
    }
  });
});

describe('the reminders', () => {
  it('quiets the all-clear and the Sunday report, and nothing that is a deadline', () => {
    const all = Object.fromEntries(NOTIF_DEFS.map((d) => [d.k, true])) as typeof DEFAULT_NOTIFS;
    const quiet = essentialOnly(all, 'on');
    for (const d of NOTIF_DEFS) {
      expect(quiet[d.k], d.k).toBe(!NONESSENTIAL.includes(d.k));
    }
    // A class, a deadline, an exam, a registrar date, attendance, tuition —
    // named, so a rule added to NONESSENTIAL by mistake fails by name.
    for (const k of ['class', 'today', 'two', 'start', 'exam', 'term', 'attend', 'bill'] as const) {
      expect(quiet[k], k).toBe(true);
    }
  });

  it('is a view, not a write: the same object back while off, and off stays off', () => {
    expect(essentialOnly(DEFAULT_NOTIFS, 'off')).toBe(DEFAULT_NOTIFS);
    const none = Object.fromEntries(NOTIF_DEFS.map((d) => [d.k, false])) as typeof DEFAULT_NOTIFS;
    expect(essentialOnly(none, 'on')).toEqual(none);
    // And the person's own settings are untouched by the on view.
    const before = { ...DEFAULT_NOTIFS };
    essentialOnly(DEFAULT_NOTIFS, 'on');
    expect(DEFAULT_NOTIFS).toEqual(before);
  });

  it('names only rules that exist', () => {
    const keys = NOTIF_DEFS.map((d) => d.k as string);
    for (const k of NONESSENTIAL) expect(keys).toContain(k);
  });
});

describe('the sentence', () => {
  it('counts, in words, and says where to find what went', () => {
    expect(focusLine(0)).toMatch(/Nothing/);
    expect(focusLine(1)).toMatch(/One screen is/);
    expect(focusLine(17)).toMatch(/17 screens are/);
    expect(focusLine(17)).toMatch(/Search still finds them/);
  });
});
