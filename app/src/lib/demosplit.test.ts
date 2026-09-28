import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The product and the demo are two sites, and the deploy keeps them that way.
 *
 * For as long as the repository variable VITE_INSTITUTIONAL_PREVIEW was set,
 * the one address Pages served was a demo: "Demo environment", Northstar
 * fixtures, a persona switcher — and the company site's "Log in" landed in it.
 * `.github/workflows/pages.yml` now builds the product with the flag pinned
 * off and the demo into /demo/ with the account service blanked. This reads
 * the two steps so neither half can drift back without a test saying so.
 */
const pages = readFileSync(new URL('../../../.github/workflows/pages.yml', import.meta.url), 'utf8');

/** The `run:` body of a named step. */
function step(name: string): string {
  const at = pages.indexOf(`- name: ${name}\n`);
  expect(at, `pages.yml has no step named "${name}"`).toBeGreaterThan(-1);
  const next = pages.indexOf('\n      - ', at + 1);
  return pages.slice(at, next === -1 ? undefined : next);
}

describe('the deployed product', () => {
  it('is never built as a demo, whatever the repository variable says', () => {
    const build = step('Build');
    expect(build).toMatch(/export VITE_INSTITUTIONAL_PREVIEW=false\n/);
    expect(build).not.toMatch(/VITE_INSTITUTIONAL_PREVIEW=true/);
  });
});

describe('the deployed demo', () => {
  it('wears the demo label, at its own address', () => {
    const demo = step('Build the demo');
    expect(demo).toMatch(/export VITE_INSTITUTIONAL_PREVIEW=true\n/);
    expect(demo).toMatch(/VITE_BASE: \$\{\{ steps\.pages\.outputs\.base_path \}\}\/demo\//);
    expect(demo).toMatch(/mv dist-demo dist\/demo/);
  });

  it('has no connection to the real account service', () => {
    const demo = step('Build the demo');
    expect(demo).toMatch(/export VITE_SUPABASE_URL=\n/);
    expect(demo).toMatch(/export VITE_SUPABASE_KEY=\n/);
  });

  it('is built after the product, so the product owns the site root', () => {
    expect(pages.indexOf('- name: Build the demo')).toBeGreaterThan(pages.indexOf('- name: Build\n'));
  });
});
