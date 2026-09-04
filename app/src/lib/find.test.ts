import { describe, expect, it } from 'vitest';
import { findEverything } from './find';
import { buildCatalog } from '../data/catalog';


describe('a query that is a sentence', () => {
  const cat = buildCatalog([]);
  const screens = (q: string) =>
    findEverything(cat, new Date(), q, [], [])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'screen')
      .map((h) => h.screen);

  it('finds a page by words in any order', () => {
    // Until this, the whole query had to appear as one run of characters, so
    // "delete my account" found nothing while "delete account" found the page
    // whose button is literally labelled Delete my account.
    expect(screens('delete my account')).toContain('privacy');
    expect(screens('delete account')).toContain('privacy');
  });

  it('handles the words people put in between', () => {
    expect(screens('where are my grades')).toContain('grades');
  });

  it('does not outrank a direct match', () => {
    // The loose match is a last resort, not a competitor.
    const hits = findEverything(cat, new Date(), 'take it with you', [], [])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'screen');
    expect(hits[0]?.screen).toBe('export');
  });

  it('still finds nothing for words that are nowhere', () => {
    expect(screens('parsnip velocity brigade')).toEqual([]);
  });

  it('needs every word, not any of them', () => {
    // Otherwise one common word would match everything.
    expect(screens('grades parsnip')).toEqual([]);
  });
});
