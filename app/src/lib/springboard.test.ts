import { describe, expect, it } from 'vitest';
import { DOCK, PAGES, dockFor, labelFor, matches, pagesFor, placed, searchable } from './springboard';
import { DESTINATIONS, offered } from './nav';
import type { Capabilities } from './school';

const ALL: Capabilities = {
  mealPlan: 'both',
  housing: true,
  campusMap: true,
  registrarUrl: 'https://yes.example',
  orgPortalUrl: 'https://link.example',
};
const NONE: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };

const flat = (pages: ReturnType<typeof pagesFor>) =>
  pages.flatMap((p) => p.items.flatMap((i) => (typeof i === 'string' ? [i] : i.screens)));

describe('the arrangement names real screens', () => {
  it('places nothing the directory has never heard of', () => {
    // An id here that names no real screen would be drawn as an icon that goes
    // nowhere.
    const real = new Set(DESTINATIONS.map((d) => d.screen as string));
    for (const id of placed()) {
      expect(real.has(id), id).toBe(true);
    }
  });

  it('has a dock of four, on every page', () => {
    expect(DOCK).toHaveLength(4);
    expect(dockFor(ALL)).toEqual(DOCK);
  });

  it('opens on the day', () => {
    expect(PAGES[0].widgets).toBe(true);
    expect(PAGES[0].items).toContain('home');
  });

  it('carries widgets on exactly one page', () => {
    expect(PAGES.filter((p) => p.widgets)).toHaveLength(1);
  });
});

describe('nothing is unreachable', () => {
  it('puts anything the arrangement forgot on a last page', () => {
    // The two lists are edited months apart, so this will happen — and a
    // launcher that silently hides a screen is worse than an untidy page.
    const shown = new Set(flat(pagesFor(ALL)).concat(dockFor(ALL)));
    for (const d of offered(ALL)) {
      expect(shown.has(d.screen as string), d.screen).toBe(true);
    }
  });

  it('reaches everything a school with nothing still has', () => {
    const shown = new Set(flat(pagesFor(NONE)).concat(dockFor(NONE)));
    for (const d of offered(NONE)) {
      expect(shown.has(d.screen as string), d.screen).toBe(true);
    }
  });
});

describe('capability gating comes free', () => {
  it('drops a screen this school has no equivalent of', () => {
    // No error and no gap where an icon should be.
    expect(flat(pagesFor(ALL))).toContain('meals');
    expect(flat(pagesFor(NONE))).not.toContain('meals');
    expect(flat(pagesFor(NONE))).not.toContain('housing');
    expect(flat(pagesFor(NONE))).not.toContain('maps');
  });

  it('keeps a folder that only partly empties', () => {
    const campus = pagesFor(NONE)
      .flatMap((p) => p.items)
      .find((i) => typeof i !== 'string' && i.label === 'Campus');
    expect(campus).toBeTruthy();
    if (campus && typeof campus !== 'string') {
      expect(campus.screens).not.toContain('meals');
      expect(campus.screens.length).toBeGreaterThan(0);
    }
  });

  it('drops a folder that empties completely rather than opening onto nothing', () => {
    const gone: Capabilities = { ...NONE };
    const folders = pagesFor(gone)
      .flatMap((p) => p.items)
      .filter((i): i is { label: string; screens: string[] } => typeof i !== 'string');
    for (const f of folders) {
      expect(f.screens.length, f.label).toBeGreaterThan(0);
    }
  });

  it('never leaves an empty page', () => {
    for (const p of pagesFor(NONE)) {
      expect(p.items.length).toBeGreaterThan(0);
    }
  });

  it('leaves the universal screens alone', () => {
    const shown = flat(pagesFor(NONE));
    for (const s of ['home', 'courses', 'study', 'grades', 'registrar']) {
      expect(shown, s).toContain(s);
    }
  });
});

describe('the captions', () => {
  it('uses the short name where the directory has one', () => {
    // An icon caption has about nine characters before it wraps — the same
    // budget the tab bar has.
    expect(labelFor('registrar')).toBe('Dates');
  });

  it('falls back to the full label rather than the id', () => {
    expect(labelFor('home')).toBe('Today');
  });

  it('gives back the id for something it does not know, rather than nothing', () => {
    expect(labelFor('nonsense')).toBe('nonsense');
  });
});

describe('searching the springboard', () => {
  it('matches on a name', () => {
    expect(matches('meals', 'meal')).toBe(true);
    expect(matches('meals', 'housing')).toBe(false);
  });

  it('matches on what the directory knows the screen is about', () => {
    // Somebody types what they want, not what the screen is called.
    expect(matches('registrar', 'withdraw')).toBe(true);
  });

  it('shows everything when nothing is typed', () => {
    expect(matches('meals', '')).toBe(true);
    expect(matches('meals', '   ')).toBe(true);
  });

  it('searches only what this school has', () => {
    expect(searchable(ALL)).toContain('meals');
    expect(searchable(NONE)).not.toContain('meals');
  });
});
