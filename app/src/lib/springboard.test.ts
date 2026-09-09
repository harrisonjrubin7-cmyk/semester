import { describe, expect, it } from 'vitest';
import {
  DOCK,
  DOCK_KEY,
  PAGES,
  afterMove,
  arrangedDock,
  arrangedPages,
  dockFor,
  folderKey,
  keyOf,
  labelFor,
  matches,
  pageKey,
  pagesFor,
  placed,
  searchable,
} from './springboard';
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

  /*
   * The blurb is what the shelves print under a screen and what the directory
   * shows beside it, so a word read there has to find the screen here too. It
   * did not: this matcher looked at the label and the keywords only.
   */
  it('matches a word from the sentence the directory shows', () => {
    // Taken from the registry rather than typed here, so this keeps testing
    // the behaviour after somebody rewrites a blurb.
    const found = DESTINATIONS.map((d) => {
      const word = d.blurb.toLowerCase().match(/\b[a-z]{7,}\b/)?.[0];
      return word && !`${d.label} ${d.short ?? ''} ${d.keywords}`.toLowerCase().includes(word)
        ? { screen: d.screen, word }
        : null;
    }).find(Boolean);
    expect(found, 'no blurb has a word the label and keywords do not').toBeTruthy();
    expect(matches(found!.screen, found!.word)).toBe(true);
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

/**
 * The home screen after somebody has moved an icon.
 *
 * The promise is the one every arrangement in this app makes: a saved order
 * is a preference *over* the pages and never a replacement for them. It can
 * put icons in an odd sequence; it can never hide one, invent one, or bring
 * back one the school gate has switched off. Every case below is a way of
 * checking that a stale key — and this one goes stale the moment a screen is
 * added to `PAGES` — stays harmless.
 */
describe('an arrangement somebody dragged', () => {
  const keysOn = (caps: Capabilities, saved: string, page = 0) =>
    arrangedPages(caps, saved)[page].items.map(keyOf);

  it('is the built-in arrangement when nothing has been dragged', () => {
    expect(arrangedPages(ALL, '')).toEqual(pagesFor(ALL));
    expect(arrangedDock(ALL, undefined)).toEqual(dockFor(ALL));
  });

  it('puts a page in the order it was dragged into', () => {
    const first = keysOn(ALL, '');
    const moved = [first[3], ...first.filter((k) => k !== first[3])];
    expect(keysOn(ALL, afterMove('', pageKey(0), moved))).toEqual(moved);
  });

  it('keeps every icon on the page it was arranged on', () => {
    const first = keysOn(ALL, '');
    const saved = afterMove('', pageKey(0), [first[first.length - 1], first[0]]);
    expect(new Set(keysOn(ALL, saved))).toEqual(new Set(first));
  });

  it('cannot hide an icon by leaving it out of the saved order', () => {
    // The case that will actually happen: a screen added to `PAGES` months
    // after somebody arranged their home screen.
    const first = keysOn(ALL, '');
    const saved = afterMove('', pageKey(0), [first[2]]);
    expect(keysOn(ALL, saved)[0]).toBe(first[2]);
    expect(keysOn(ALL, saved)).toHaveLength(first.length);
  });

  it('cannot bring back a screen this school does not have', () => {
    const only = new Set(keysOn(NONE, ''));
    const saved = afterMove('', pageKey(0), ['maps', 'meals', 'housing']);
    for (const key of keysOn(NONE, saved)) expect(only.has(key)).toBe(true);
  });

  it('arranges a folder by its own name, not its page position', () => {
    const pages = arrangedPages(ALL, '');
    const at = pages.findIndex((p) => p.items.some((i) => typeof i !== 'string'));
    const folder = pages[at].items.find((i) => typeof i !== 'string')!;
    const last = folder.screens[folder.screens.length - 1];
    const saved = afterMove('', folderKey(folder.label), [last]);
    const after = arrangedPages(ALL, saved)[at].items.find(
      (i) => typeof i !== 'string' && i.label === folder.label,
    );
    expect(typeof after !== 'string' && after!.screens[0]).toBe(last);
    expect(typeof after !== 'string' && after!.screens).toHaveLength(folder.screens.length);
  });

  it('arranges the dock without letting it grow', () => {
    const dock = dockFor(ALL);
    const saved = afterMove('', DOCK_KEY, [dock[2], 'essay']);
    expect(arrangedDock(ALL, saved)).toEqual([dock[2], ...dock.filter((s) => s !== dock[2])]);
  });

  it('keeps one list without disturbing the others', () => {
    const first = keysOn(ALL, '');
    const dock = dockFor(ALL);
    const saved = afterMove(afterMove('', pageKey(0), [first[1]]), DOCK_KEY, [dock[3]]);
    expect(keysOn(ALL, saved)[0]).toBe(first[1]);
    expect(arrangedDock(ALL, saved)[0]).toBe(dock[3]);
  });

  it('survives a key that has gone to rubbish', () => {
    // A hand-edited look key, or one from a version that wrote it differently.
    expect(arrangedPages(ALL, 'p0|:|,,,')).toEqual(pagesFor(ALL));
  });

  it('names a folder distinctly from a screen, so neither moves the other', () => {
    // `+Make` and `make` would be the same name in the same list without this.
    expect(keyOf({ label: 'Make', screens: ['draw'] })).not.toBe('make');
    expect(keyOf('make')).toBe('make');
  });
});
