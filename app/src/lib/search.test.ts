import { describe, expect, it } from 'vitest';
import { FILLER, has, queryWords, worthSplitting } from './search';
import { findApps } from './desk';
import { findEverything } from './find';
import { buildCatalog } from '../data/catalog';
import type { Capabilities } from './school';

const ALL: Capabilities = {
  mealPlan: 'both',
  housing: true,
  campusMap: true,
  registrarUrl: 'https://example.invalid',
  orgPortalUrl: 'https://example.invalid',
};

describe('the containment test', () => {
  it('skips a field that is not there rather than guarding at every call', () => {
    expect(has('econ', undefined, null, 'ECON 101')).toBe(true);
    expect(has('econ', undefined, null, '')).toBe(false);
  });
});

describe('the words a query comes down to', () => {
  it('drops what nobody searches by', () => {
    expect(queryWords('where are my grades')).toEqual(['grades']);
    expect(queryWords('delete my account')).toEqual(['delete', 'account']);
  });

  it('comes down to nothing when that is all there was', () => {
    expect(queryWords('the a my')).toEqual([]);
    expect(worthSplitting(queryWords('the a my'), 'the a my')).toBe(false);
  });

  it('is not worth splitting a word that survives it unchanged', () => {
    // Already tried against every field by the tiers above it in both
    // searches; splitting it again only duplicates the row it made.
    expect(worthSplitting(queryWords('grades'), 'grades')).toBe(false);
    // But "where are my grades" comes down to one word those tiers never saw.
    expect(worthSplitting(queryWords('where are my grades'), 'where are my grades')).toBe(true);
  });

  it('stays short enough not to throw away words that carry meaning', () => {
    // "work", "check", "create" and "study" are all screens in this app. A
    // stop list that grew to hold them would make them unsearchable.
    for (const word of ['work', 'check', 'create', 'study', 'guide', 'money']) {
      expect(FILLER.has(word), `"${word}" is a screen, not filler`).toBe(false);
    }
  });
});

describe('the two searches, on the same query', () => {
  /*
   * They rank different things — screens here, records and screens there — so
   * they will not agree about order. What they must not disagree about is
   * whether there is anything to find at all: the bar sits directly above the
   * row that opens the palette, and a query that the one calls "No app matches
   * that" while the other answers is the fault this file was split out to
   * stop.
   */
  const cat = buildCatalog([]);
  const palette = (q: string) =>
    findEverything(cat, new Date(), q, [], [], ALL)
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'screen')
      .map((h) => (h as { screen: string }).screen);

  it('both answer the sentences people type', () => {
    for (const q of ['study guide', 'pay my bill', 'where are my grades', 'add reading']) {
      expect(findApps(q, ALL).length, `the bar found nothing for "${q}"`).toBeGreaterThan(0);
      expect(palette(q).length, `the palette found nothing for "${q}"`).toBeGreaterThan(0);
    }
  });

  it('both find nothing in a query made of filler', () => {
    expect(findApps('the a my', ALL)).toEqual([]);
    expect(palette('the a my')).toEqual([]);
  });

  it('both refuse a query where one word is nowhere', () => {
    expect(findApps('grades parsnip', ALL)).toEqual([]);
    expect(palette('grades parsnip')).toEqual([]);
  });
});
