import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The public front door has a lot of depth, but the global frame must not make
 * a first-time student or buyer choose among the whole sitemap at once.
 * Contextual pages and search carry the long tail; the header and footer carry
 * the six routes that answer the first visit.
 */

const root = join(import.meta.dirname, '../../..');
const site = [
  readFileSync(join(root, 'company-site/index.html'), 'utf8'),
  readFileSync(join(root, 'company-site/site.js'), 'utf8'),
].join('\n');

const between = (start: string, end: string) => {
  const from = site.indexOf(start);
  return site.slice(from, site.indexOf(end, from));
};

describe('the company site global navigation', () => {
  it('offers six direct audience and decision paths without mega menus', () => {
    const header = between('<nav class="nav-main"', '</nav>');
    const links = [...header.matchAll(/<a href="(#[^"]+)">([^<]+)<\/a>/g)]
      .map(([, href, label]) => [label, href]);

    expect(links).toEqual([
      ['Product', '#product'],
      ['Students', '#students'],
      ['Institutions', '#institutions'],
      ['Pricing', '#pricing'],
      ['Resources', '#tools'],
      ['Trust', '#trust'],
    ]);
    expect(header).not.toContain('button class="dd"');
    expect(site).toContain('document.querySelectorAll(".nav-main>a").forEach');
    expect(site).toContain('a.setAttribute("aria-current","page")');
  });

  it('keeps the mobile menu focused and moves the full sitemap behind search', () => {
    const drawer = between('<div class="drawer"', '</div>\n</div>');

    expect(drawer).toContain('<p class="grp">Explore Semester</p>');
    expect(drawer).toContain('<a href="#tools">Resources</a>');
    expect(drawer).toContain('Search the complete site');
    expect(drawer).toContain('<template id="legacy-mobile-navigation">');
  });

  it('keeps the footer useful without reproducing the entire sitemap', () => {
    const footer = between('<footer>', '</footer>');
    const headings = [...footer.matchAll(/<h2 class="fh">([^<]+)<\/h2>/g)].map((match) => match[1]);
    const links = [...footer.matchAll(/<a\b/g)];

    expect(headings).toEqual(['Product', 'Students', 'Institutions', 'Resources', 'Trust']);
    expect(links.length).toBeLessThanOrEqual(36);
    expect(footer).toContain('Search the complete site');
  });
});
