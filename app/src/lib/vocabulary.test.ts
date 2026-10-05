import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE } from '../site/config';
import { ROUTES, renderPage } from '../site/render';
import { TERMS } from './vocabulary';

/**
 * A term is owned only if its home page prints it and the vocabulary page
 * explains it. Both are held here, against the rendered site, so a term
 * that drifts off its page fails the build rather than fading.
 */
const page = (path: string) => {
  const r = ROUTES.find((x) => x.path === path);
  if (!r) throw new Error(`no route ${path}`);
  return renderPage(r, DEFAULT_SITE);
};

describe('the owned vocabulary', () => {
  it('names nine terms once each, defined in one sentence that says what, not better than', () => {
    expect(TERMS).toHaveLength(9);
    expect(new Set(TERMS.map((t) => t.term)).size).toBe(9);
    for (const t of TERMS) {
      expect(t.means.length, t.term).toBeGreaterThan(40);
      expect(t.means, t.term).not.toMatch(/better than|best|leading|unlike/i);
    }
  });

  it('prints every term on its home page, and every term on the vocabulary page', () => {
    const vocab = page('/platform/vocabulary/');
    for (const t of TERMS) {
      expect(page(t.where), `${t.where} does not print “${t.term}”`).toContain(t.term);
      expect(vocab, t.term).toContain(t.term);
    }
  });
});
