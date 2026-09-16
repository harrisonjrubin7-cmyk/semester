import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DOING } from './doing';
import { findEverything } from './find';
import { buildCatalog } from '../data/catalog';

/**
 * The things the app does are findable by the words people use for them.
 *
 * `findable.test.ts` does this for screens: every screen is in `DESTINATIONS`
 * or is named with the reason it is not, so one cannot be added and be
 * invisible. This is the same guard for the things that are not screens — the
 * eleven ways through a course, and the named panels that live on one.
 *
 * It is here because the failure is silent in both directions. A mode added to
 * `types.ts` and not here works perfectly and cannot be searched for; a mode
 * renamed in `modes.ts` and not here leaves search offering a name that is on
 * no screen in the app. Neither shows up as anything breaking.
 */
const cat = buildCatalog([]);

/** What `findEverything` answers, flattened, best first within each group. */
const asked = (q: string) =>
  findEverything(cat, new Date(), q, [], []).flatMap((g) => g.hits);

/** The title of the best thing this query found, whatever kind it is. */
const best = (q: string) => asked(q)[0]?.title ?? '';

describe('every way through a course', () => {
  /** The `StudyMode` union, read from the source that defines it. */
  function everyMode(): string[] {
    const src = readFileSync('src/lib/types.ts', 'utf8');
    const block = /export type StudyMode =([\s\S]*?);\n/.exec(src);
    if (!block) throw new Error('The StudyMode union has moved; point this at it.');
    return [...block[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  }

  it('is in the registry, so a new one cannot arrive unfindable', () => {
    const filed = new Set(DOING.filter((d) => d.mode).map((d) => d.mode));
    const missing = everyMode().filter((m) => !filed.has(m as never));
    expect(
      missing,
      'Add it to DOING in lib/doing.ts with the words somebody would search for',
    ).toEqual([]);
  });

  it('has no entry for a mode that no longer exists', () => {
    const real = new Set(everyMode());
    const stale = DOING.filter((d) => d.mode && !real.has(d.mode)).map((d) => d.mode);
    expect(stale, 'These are in the registry and gone from the union.').toEqual([]);
  });

  /*
   * Read out of `modes.ts` rather than trusted, because the drift is silent:
   * rename Listen there and the search goes on offering "Listen", which is a
   * result naming something no screen in the app calls itself any more.
   */
  it('is called here exactly what lib/modes.ts calls it', () => {
    const src = readFileSync('src/lib/modes.ts', 'utf8');
    const named = new Map<string, string>();
    for (const m of src.matchAll(/id: '([a-z]+)',\s*\n\s*label: '([^']+)'/g)) {
      named.set(m[1], m[2]);
    }
    expect(named.size, 'no id/label pairs parsed out of modes.ts — its shape changed').
      toBeGreaterThanOrEqual(10);
    for (const d of DOING) {
      if (!d.mode) continue;
      const there = named.get(d.mode);
      if (!there) continue;
      expect(d.label, `${d.mode} is "${d.label}" here and "${there}" in modes.ts`).toBe(there);
    }
  });
});

describe('every entry', () => {
  it('says what it is, in words that are not just its name', () => {
    for (const d of DOING) {
      expect(d.blurb.trim().length, `${d.id} has no sentence`).toBeGreaterThan(20);
      // The point of the registry. A label somebody already knows is not what
      // they type — "Listen" was findable before this file and "podcast" was
      // not, and only one of those is what a person searches.
      expect(d.keywords.trim().split(/\s+/).length, `${d.id} needs real keywords`)
        .toBeGreaterThan(3);
      expect(d.within.trim().length, `${d.id} does not say where it lives`).toBeGreaterThan(0);
    }
  });

  it('is named once', () => {
    const ids = DOING.map((d) => d.id);
    expect(ids.length).toBe(new Set(ids).size);
  });
});

/*
 * The queries themselves, taken from the build-out plan's Phase 0 and from
 * measuring the rest of the app the same way. Each number below is what the
 * search answered before `lib/doing.ts` existed.
 */
describe('the words people actually type', () => {
  it('finds the mode, not the screen it lives on', () => {
    expect(best('podcast')).toBe('Listen');            // was 0 results
    expect(best('cram sheet')).toBe('Cram');           // was 0
    expect(best('cheat sheet')).toBe('Cram');          // was 0
    expect(best('worked examples')).toBe('Cases');     // was 0
    expect(best('field guide')).toBe('Field guide');   // was 0
    expect(best('narrated lesson')).toBe('Watch');     // was 0
    expect(best('flashcards')).toBe('Cards');          // was the Study screen
  });

  it('finds a panel that is not a screen at all', () => {
    // Was one result, and it was the Costs screen — see lib/doing.ts.
    expect(best('teach back')).toMatch(/Teach-back/);
    expect(best('mistake journal')).toMatch(/Teach-back/);
  });

  /*
   * The one that shows why a missing index is worse than a missing keyword.
   * "audio" is one edit from "audit", so with nothing true in the index the
   * near-miss tier answered with the degree audit and the registrar — a
   * confident wrong answer to a word this app has a whole mode for.
   */
  it('stops a near miss answering for a word the app really has', () => {
    expect(best('audio')).toBe('Listen');
    const hits = asked('audio');
    expect(hits.some((h) => h.kind === 'screen' && h.title.includes('egree'))).toBe(false);
  });

  it('reaches the settings pages, which were in neither search', () => {
    // lib/settings.ts has carried all of these words the whole time; the
    // global search just never read that list.
    expect(best('colour')).toBe('Colour and type');
    expect(best('font')).toBe('Colour and type');
    expect(best('typeface')).toBe('Colour and type');
    expect(best('dark mode')).toBe('Colour and type');
    expect(best('change the layout')).toBe('Layout and navigation');
  });

  it('still finds nothing for words that are nowhere', () => {
    expect(asked('parsnip velocity brigade')).toEqual([]);
  });
});
